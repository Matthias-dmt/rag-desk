import { describe, expect, it } from "vitest";
import { ingestDocument } from "../src/lib/rag/ingestion";
import type { EmbeddingProvider } from "../src/lib/providers/types";
import type { VectorRecord, VectorStore } from "../src/lib/vector/types";
import type { KnowledgeDocument } from "../src/lib/rag/types";

describe("ingestDocument", () => {
  it("stores chunk embeddings with metadata", async () => {
    const saved: VectorRecord[] = [];

    const store: VectorStore = {
      upsert: async (records) => {
        saved.push(...records);
      },
      query: async () => [],
      deleteByDocId: async () => undefined,
    };

    const embedder: EmbeddingProvider = {
      embedDocuments: async (texts) => texts.map(() => [0, 1, 2]),
      embedQuery: async () => [0, 1, 2],
    };

    const doc: KnowledgeDocument = {
      id: "doc-1",
      name: "Doc",
      text: "hello world from rag",
      sourceType: "text",
    };

    const result = await ingestDocument(doc, store, embedder, {
      chunkSize: 10,
      overlap: 2,
    });

    expect(result.chunkCount).toBeGreaterThan(0);
    expect(saved.length).toBe(result.chunkCount);
    expect(saved[0]).toMatchObject({
      metadata: {
        docId: "doc-1",
        docName: "Doc",
      },
    });
  });

  it("throws when embedding count mismatches chunks", async () => {
    const store: VectorStore = {
      upsert: async () => undefined,
      query: async () => [],
      deleteByDocId: async () => undefined,
    };

    const embedder: EmbeddingProvider = {
      embedDocuments: async () => [[0, 1, 2]],
      embedQuery: async () => [0, 1, 2],
    };

    const doc: KnowledgeDocument = {
      id: "doc-2",
      name: "Mismatch",
      text: "hello world from rag",
      sourceType: "text",
    };

    await expect(
      ingestDocument(doc, store, embedder, { chunkSize: 5, overlap: 1 })
    ).rejects.toThrow(/Embedding count does not match/);
  });
});
