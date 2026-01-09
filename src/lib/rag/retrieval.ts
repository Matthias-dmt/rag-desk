import type { RetrievedChunk } from "./types";
import type { VectorStore } from "../vector/types";

export async function retrieveChunks(
  store: VectorStore,
  queryEmbedding: number[],
  topK: number
): Promise<RetrievedChunk[]> {
  const results = await store.query(queryEmbedding, topK);

  return results.map((result) => ({
    id: result.id,
    docId: result.metadata.docId,
    docName: result.metadata.docName,
    index: result.metadata.chunkIndex,
    start: result.metadata.start,
    end: result.metadata.end,
    text: result.metadata.text,
    score: result.score,
  }));
}
