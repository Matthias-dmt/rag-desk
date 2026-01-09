import type { EmbeddingProvider, LlmCompletion, LlmProvider } from "./types";

const DEFAULT_BASE_URL = "https://api.openai.com";
const DEFAULT_EMBED_MODEL = "text-embedding-3-small";
const DEFAULT_CHAT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 60000;

type OpenAIEmbeddingResponse = {
  data: Array<{ embedding: number[] }>;
};

type OpenAIChatResponse = {
  choices: Array<{ message: { content: string } }>;
  usage?: { total_tokens?: number };
};

export type OpenAIConfig = {
  apiKey?: string;
  baseUrl?: string;
  embedModel?: string;
  chatModel?: string;
};

function resolveConfig(config?: OpenAIConfig) {
  return {
    apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY,
    baseUrl: config?.baseUrl ?? process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL,
    embedModel: config?.embedModel ?? process.env.OPENAI_EMBED_MODEL ?? DEFAULT_EMBED_MODEL,
    chatModel: config?.chatModel ?? process.env.OPENAI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL,
  };
}

export function createOpenAIEmbeddingProvider(config?: OpenAIConfig): EmbeddingProvider {
  return {
    async embedDocuments(texts: string[]): Promise<number[][]> {
      const embeddings: number[][] = [];
      for (const text of texts) {
        embeddings.push(await embedSingle(text, config));
      }
      return embeddings;
    },
    async embedQuery(text: string): Promise<number[]> {
      return embedSingle(text, config);
    },
  };
}

export function createOpenAILlmProvider(config?: OpenAIConfig): LlmProvider {
  return {
    async generate(prompt: string): Promise<LlmCompletion> {
      const resolved = resolveConfig(config);
      if (!resolved.apiKey) {
        throw new Error("OpenAI API key is missing");
      }

      const response = await fetchWithTimeout(`${resolved.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resolved.apiKey}`,
        },
        body: JSON.stringify({
          model: resolved.chatModel,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`OpenAI chat failed: ${response.status} ${detail}`);
      }

      const data = (await response.json()) as OpenAIChatResponse;
      return {
        text: data.choices?.[0]?.message?.content ?? "",
        tokensUsed: data.usage?.total_tokens,
      };
    },
  };
}

async function embedSingle(text: string, config?: OpenAIConfig): Promise<number[]> {
  const resolved = resolveConfig(config);
  if (!resolved.apiKey) {
    throw new Error("OpenAI API key is missing");
  }

  const response = await fetchWithTimeout(`${resolved.baseUrl}/v1/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resolved.apiKey}`,
    },
    body: JSON.stringify({
      model: resolved.embedModel,
      input: text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI embeddings failed: ${response.status} ${detail}`);
  }

  const data = (await response.json()) as OpenAIEmbeddingResponse;
  const embedding = data.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error("OpenAI embeddings response missing data");
  }

  return embedding;
}

function fetchWithTimeout(input: RequestInfo, init: RequestInit): Promise<Response> {
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(input, {
    ...init,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
}
