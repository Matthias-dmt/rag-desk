import { createOllamaEmbeddingProvider, createOllamaLlmProvider } from "../providers/ollama";
import { FileVectorStore } from "../vector/fileStore";
import { QdrantVectorStore } from "../vector/qdrantStore";

const storeMode = process.env.VECTOR_STORE ?? "file";

export const vectorStore =
  storeMode === "qdrant" ? new QdrantVectorStore() : new FileVectorStore();
export const embeddingProvider = createOllamaEmbeddingProvider();
export const llmProvider = createOllamaLlmProvider();
