import { describe, expect, it } from "vitest";
import { answerQuestion } from "../src/lib/rag/query";
import type { EmbeddingProvider, LlmProvider } from "../src/lib/providers/types";
import type { VectorStore } from "../src/lib/vector/types";

describe("answerQuestion", () => {
  it("retrieves chunks and returns answer", async () => {
    const store: VectorStore = {
      upsert: async () => undefined,
      deleteByDocId: async () => undefined,
      query: async () => [
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
          score: 0.8,
        },
      ],
    };

    const embedder: EmbeddingProvider = {
      embedDocuments: async () => [[0, 1]],
      embedQuery: async () => [0, 1],
    };

    const llm: LlmProvider = {
      generate: async () => ({ text: "Answer [1]", tokensUsed: 12 }),
    };

    const result = await answerQuestion("What is hello?", store, embedder, llm, {
      topK: 1,
    });

    expect(result.answer).toBe("Answer [1]");
    expect(result.sources).toHaveLength(1);
    expect(result.tokensUsed).toBe(12);
  });

  it("rejects empty questions", async () => {
    const store: VectorStore = {
      upsert: async () => undefined,
      deleteByDocId: async () => undefined,
      query: async () => [],
    };

    const embedder: EmbeddingProvider = {
      embedDocuments: async () => [[0, 1]],
      embedQuery: async () => [0, 1],
    };

    const llm: LlmProvider = {
      generate: async () => ({ text: "", tokensUsed: 0 }),
    };

    await expect(
      answerQuestion("   ", store, embedder, llm)
    ).rejects.toThrow(/Question cannot be empty/);
  });
});
