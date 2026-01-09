import { QdrantClient } from "@qdrant/js-client-rest";
import { createHash } from "crypto";
import type { VectorQueryResult, VectorRecord, VectorStore } from "./types";

const DEFAULT_COLLECTION = "rag_chunks";

export type QdrantConfig = {
  url?: string;
  apiKey?: string;
  collection?: string;
};

function getCollectionName(config?: QdrantConfig) {
  return config?.collection ?? process.env.QDRANT_COLLECTION ?? DEFAULT_COLLECTION;
}

export class QdrantVectorStore implements VectorStore {
  private client: QdrantClient;
  private collection: string;

  constructor(config: QdrantConfig = {}) {
    this.client = new QdrantClient({
      url: config.url ?? process.env.QDRANT_URL ?? "http://localhost:6333",
      apiKey: config.apiKey ?? process.env.QDRANT_API_KEY,
    });
    this.collection = getCollectionName(config);
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    await this.ensureCollection(records[0].embedding.length);

    await this.client.upsert(this.collection, {
      wait: true,
      points: records.map((record) => ({
        id: stableUuidFromString(record.id),
        vector: record.embedding,
        payload: { ...record.metadata, sourceId: record.id },
      })),
    });
  }

  async query(embedding: number[], topK: number): Promise<VectorQueryResult[]> {
    await this.ensureCollection(embedding.length);

    const result = await this.client.search(this.collection, {
      vector: embedding,
      limit: topK,
      with_payload: true,
    });

    return result.map((point) => ({
      id: String(point.payload?.sourceId ?? point.id),
      embedding,
      metadata: point.payload as VectorRecord["metadata"],
      score: point.score ?? 0,
    }));
  }

  async deleteByDocId(docId: string): Promise<void> {
    await this.client.delete(this.collection, {
      wait: true,
      filter: {
        must: [
          {
            key: "docId",
            match: { value: docId },
          },
        ],
      },
    });
  }

  private async ensureCollection(vectorSize: number): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some(
      (collection) => collection.name === this.collection
    );

    if (exists) {
      return;
    }

    await this.client.createCollection(this.collection, {
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    });
  }
}

function stableUuidFromString(value: string): string {
  const hash = createHash("sha1").update(value).digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
