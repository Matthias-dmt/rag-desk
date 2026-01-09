export type EmbeddingProvider = {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
};

export type LlmCompletion = {
  text: string;
  tokensUsed?: number;
};

export type LlmProvider = {
  generate(prompt: string): Promise<LlmCompletion>;
};
