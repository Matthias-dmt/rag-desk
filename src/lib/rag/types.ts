export type SourceType = "text" | "markdown" | "pdf";

export type KnowledgeDocument = {
  id: string;
  name: string;
  text: string;
  sourceType: SourceType;
};

export type Chunk = {
  id: string;
  docId: string;
  docName: string;
  index: number;
  start: number;
  end: number;
  text: string;
};

export type ChunkingOptions = {
  chunkSize: number;
  overlap: number;
};

export type RetrievedChunk = Chunk & {
  score: number;
};
