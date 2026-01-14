import { promises as fs } from "fs";
import path from "path";
import type { VectorQueryResult, VectorRecord, VectorStore } from "./types";

type StoreFile = {
  records: VectorRecord[];
};

const DEFAULT_FILENAME = ".rag-store.json";

function resolveStorePath() {
  if (process.env.RAG_STORE_PATH) {
    return process.env.RAG_STORE_PATH;
  }
  if (process.env.CF_PAGES || process.env.NODE_ENV === "production") {
    return "/tmp/rag-store.json";
  }
  return path.join(process.cwd(), DEFAULT_FILENAME);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embedding dimensions do not match");
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class FileVectorStore implements VectorStore {
  private filePath: string;

  constructor(filePath = resolveStorePath()) {
    this.filePath = filePath;
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    const store = await this.loadStore();
    const byId = new Map<string, VectorRecord>();

    for (const record of store.records) {
      byId.set(record.id, record);
    }

    for (const record of records) {
      byId.set(record.id, record);
    }

    await this.saveStore({ records: Array.from(byId.values()) });
  }

  async query(embedding: number[], topK: number): Promise<VectorQueryResult[]> {
    const store = await this.loadStore();

    const scored = store.records.map((record) => ({
      ...record,
      score: cosineSimilarity(record.embedding, embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  async deleteByDocId(docId: string): Promise<void> {
    const store = await this.loadStore();
    const remaining = store.records.filter((record) => record.metadata.docId !== docId);
    await this.saveStore({ records: remaining });
  }

  private async loadStore(): Promise<StoreFile> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const data = JSON.parse(raw) as StoreFile;
      if (!Array.isArray(data.records)) {
        return { records: [] };
      }
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { records: [] };
      }
      throw error;
    }
  }

  private async saveStore(store: StoreFile): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(store, null, 2), "utf8");
  }
}
