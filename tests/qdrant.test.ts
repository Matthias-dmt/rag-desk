import { QdrantClient } from "@qdrant/js-client-rest";
import { afterAll, describe, expect, it } from "vitest";
import { QdrantVectorStore } from "../src/lib/vector/qdrantStore";
import type { VectorRecord } from "../src/lib/vector/types";

const shouldRun = process.env.RUN_QDRANT_TESTS === "true";
const qdrantUrl = process.env.QDRANT_URL ?? "http://localhost:6333";

async function assertQdrantReachable() {
  try {
    const response = await fetch(`${qdrantUrl}/collections`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new Error(
      `Qdrant is not reachable at ${qdrantUrl}. ` +
        `Start it with 'docker compose up -d'. ` +
        `Original error: ${detail}`
    );
  }
}

(shouldRun ? describe : describe.skip)("QdrantVectorStore", () => {
  const collectionName = `test_${Date.now()}`;

  afterAll(async () => {
    const client = new QdrantClient({ url: qdrantUrl });
    try {
      await client.deleteCollection(collectionName);
    } catch {
      // Best-effort cleanup in case the collection was never created.
    }
  });

  it("stores and retrieves vectors", async () => {
    await assertQdrantReachable();
    const store = new QdrantVectorStore({
      collection: collectionName,
    });

    const records: VectorRecord[] = [
      {
        id: "chunk-1",
        embedding: [0.1, 0.2, 0.3],
        metadata: {
          docId: "doc-1",
          docName: "Doc",
          chunkIndex: 0,
          start: 0,
          end: 10,
          text: "hello world",
        },
      },
      {
        id: "chunk-2",
        embedding: [0.3, 0.2, 0.1],
        metadata: {
          docId: "doc-2",
          docName: "Doc2",
          chunkIndex: 1,
          start: 11,
          end: 20,
          text: "second chunk",
        },
      },
    ];

    await store.upsert(records);

    const results = await store.query([0.1, 0.2, 0.3], 1);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("chunk-1");
    expect(results[0].metadata.docId).toBe("doc-1");
  });
});
