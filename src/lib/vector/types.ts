export type VectorRecordMetadata = {
  docId: string;
  docName: string;
  chunkIndex: number;
  start: number;
  end: number;
  text: string;
  sourceId?: string;
};

export type VectorRecord = {
  id: string;
  embedding: number[];
  metadata: VectorRecordMetadata;
};

export type VectorQueryResult = VectorRecord & {
  score: number;
};

export type VectorStore = {
  upsert(records: VectorRecord[]): Promise<void>;
  query(embedding: number[], topK: number): Promise<VectorQueryResult[]>;
  deleteByDocId(docId: string): Promise<void>;
};
