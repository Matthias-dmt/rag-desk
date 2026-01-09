import type { EmbeddingProvider, LlmCompletion, LlmProvider } from "./types";

type OllamaEmbeddingResponse = {
  embedding: number[];
};

type OllamaGenerateResponse = {
  response: string;
  eval_count?: number;
};

const DEFAULT_HOST = "http://localhost:11434";
const DEFAULT_EMBED_MODEL = "nomic-embed-text";
const DEFAULT_CHAT_MODEL = "llama3.1";
const DEFAULT_TIMEOUT_MS = 60000;

function getOllamaHost() {
  return process.env.OLLAMA_HOST ?? DEFAULT_HOST;
}

export function createOllamaEmbeddingProvider(): EmbeddingProvider {
  return {
    async embedDocuments(texts: string[]): Promise<number[][]> {
      const embeddings: number[][] = [];
      for (const text of texts) {
        embeddings.push(await embedSingle(text));
      }
      return embeddings;
    },
    async embedQuery(text: string): Promise<number[]> {
      return embedSingle(text);
    },
  };
}

export function createOllamaLlmProvider(): LlmProvider {
  return {
    async generate(prompt: string): Promise<LlmCompletion> {
      const response = await fetchWithTimeout(
        `${getOllamaHost()}/api/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.OLLAMA_CHAT_MODEL ?? DEFAULT_CHAT_MODEL,
            prompt,
            stream: false,
          }),
        }
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Ollama generate failed: ${response.status} ${detail}`);
      }

      const data = (await response.json()) as OllamaGenerateResponse;
      return {
        text: data.response ?? "",
        tokensUsed: data.eval_count,
      };
    },
  };
}

async function embedSingle(text: string): Promise<number[]> {
  const response = await fetchWithTimeout(
    `${getOllamaHost()}/api/embeddings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OLLAMA_EMBED_MODEL ?? DEFAULT_EMBED_MODEL,
        prompt: text,
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Ollama embeddings failed: ${response.status} ${detail}`);
  }

  const data = (await response.json()) as OllamaEmbeddingResponse;
  return data.embedding;
}

function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit
): Promise<Response> {
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(input, {
    ...init,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
}
