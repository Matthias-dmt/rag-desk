import type { EmbeddingProvider } from "../providers/types";
import type { VectorRecord, VectorStore } from "../vector/types";
import { chunkDocument } from "./chunking";
import type { ChunkingOptions, KnowledgeDocument } from "./types";

export type IngestionResult = {
  docId: string;
  chunkCount: number;
};

export async function ingestDocument(
  doc: KnowledgeDocument,
  store: VectorStore,
  embedder: EmbeddingProvider,
  options?: ChunkingOptions
): Promise<IngestionResult> {
  const chunks = chunkDocument(doc, options);

  if (chunks.length === 0) {
    return { docId: doc.id, chunkCount: 0 };
  }

  const embeddings = await embedder.embedDocuments(
    chunks.map((chunk) => chunk.text)
  );

  if (embeddings.length !== chunks.length) {
    throw new Error("Embedding count does not match chunk count");
  }

  const records: VectorRecord[] = chunks.map((chunk, index) => ({
    id: chunk.id,
    embedding: embeddings[index],
    metadata: {
      docId: chunk.docId,
      docName: chunk.docName,
      chunkIndex: chunk.index,
      start: chunk.start,
      end: chunk.end,
      text: chunk.text,
    },
  }));

  await store.upsert(records);

  return { docId: doc.id, chunkCount: chunks.length };
}
