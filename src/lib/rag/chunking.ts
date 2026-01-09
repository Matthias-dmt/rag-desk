import type { Chunk, ChunkingOptions, KnowledgeDocument } from "./types";

const DEFAULT_CHUNKING: ChunkingOptions = {
  chunkSize: 1000,
  overlap: 200,
};

export function chunkDocument(
  doc: KnowledgeDocument,
  options: ChunkingOptions = DEFAULT_CHUNKING
): Chunk[] {
  if (options.chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0");
  }

  if (options.overlap < 0) {
    throw new Error("overlap must be 0 or greater");
  }

  if (options.overlap >= options.chunkSize) {
    throw new Error("overlap must be smaller than chunkSize");
  }

  const text = doc.text;
  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + options.chunkSize, text.length);
    const raw = text.slice(start, end);
    const trimmed = raw.trim();

    if (trimmed.length > 0) {
      chunks.push({
        id: `${doc.id}:${index}`,
        docId: doc.id,
        docName: doc.name,
        index,
        start,
        end,
        text: trimmed,
      });
      index += 1;
    }

    if (end >= text.length) {
      break;
    }

    start = end - options.overlap;
  }

  return chunks;
}
