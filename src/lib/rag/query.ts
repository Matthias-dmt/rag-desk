import type { EmbeddingProvider, LlmProvider } from "../providers/types";
import type { VectorStore } from "../vector/types";
import { retrieveChunks } from "./retrieval";
import { buildPrompt } from "./prompt";
import type { RetrievedChunk } from "./types";

export type QueryResult = {
  answer: string;
  sources: RetrievedChunk[];
  tokensUsed?: number;
};

export type QueryOptions = {
  topK: number;
};

const DEFAULT_OPTIONS: QueryOptions = {
  topK: 4,
};

export async function answerQuestion(
  question: string,
  store: VectorStore,
  embedder: EmbeddingProvider,
  llm: LlmProvider,
  options: QueryOptions = DEFAULT_OPTIONS
): Promise<QueryResult> {
  if (question.trim().length === 0) {
    throw new Error("Question cannot be empty");
  }

  const queryEmbedding = await embedder.embedQuery(question);
  const sources = await retrieveChunks(store, queryEmbedding, options.topK);
  const prompt = buildPrompt({ question, chunks: sources });
  const completion = await llm.generate(prompt);

  return {
    answer: completion.text.trim(),
    sources,
    tokensUsed: completion.tokensUsed,
  };
}
