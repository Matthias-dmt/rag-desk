import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOpenAIEmbeddingProvider,
  createOpenAILlmProvider,
} from "../src/lib/providers/openai";

const mockFetch = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

describe("OpenAI providers", () => {
  it("embeds documents with the configured base URL", async () => {
    vi.stubGlobal("fetch", mockFetch);

    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ embedding: [0, 1, 2] }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const provider = createOpenAIEmbeddingProvider({
      apiKey: "test-key",
      baseUrl: "https://example.com",
      embedModel: "test-embed",
    });

    const result = await provider.embedQuery("hello");

    expect(result).toEqual([0, 1, 2]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://example.com/v1/embeddings");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      model: "test-embed",
      input: "hello",
    });
  });

  it("generates chat responses with the configured base URL", async () => {
    vi.stubGlobal("fetch", mockFetch);

    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Answer" } }],
          usage: { total_tokens: 42 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const provider = createOpenAILlmProvider({
      apiKey: "test-key",
      baseUrl: "https://example.com",
      chatModel: "test-chat",
    });

    const result = await provider.generate("prompt");

    expect(result.text).toBe("Answer");
    expect(result.tokensUsed).toBe(42);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://example.com/v1/chat/completions");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      model: "test-chat",
      messages: [{ role: "user", content: "prompt" }],
    });
  });
});
