import { describe, expect, it } from "vitest";
import { retrieveChunks } from "../src/lib/rag/retrieval";
import type { VectorQueryResult, VectorStore } from "../src/lib/vector/types";

describe("retrieveChunks", () => {
  it("maps vector results to retrieved chunks", async () => {
    const results: VectorQueryResult[] = [
      {
        id: "chunk-1",
        embedding: [0, 1],
        metadata: {
          docId: "doc-1",
          docName: "Doc",
          chunkIndex: 0,
          start: 0,
          end: 5,
          text: "hello",
        },
        score: 0.9,
      },
    ];

    const store: VectorStore = {
      upsert: async () => undefined,
      query: async () => results,
      deleteByDocId: async () => undefined,
    };

    const retrieved = await retrieveChunks(store, [0, 1], 1);

    expect(retrieved).toEqual([
      {
        id: "chunk-1",
        docId: "doc-1",
        docName: "Doc",
        index: 0,
        start: 0,
        end: 5,
        text: "hello",
        score: 0.9,
      },
    ]);
  });
});
