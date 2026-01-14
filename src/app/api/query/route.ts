import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/rag/query";
import { embeddingProvider, llmProvider, vectorStore } from "@/lib/app/runtime";
import { createOpenAIEmbeddingProvider, createOpenAILlmProvider } from "@/lib/providers/openai";
import { checkRateLimit, getClientIp } from "@/lib/app/rateLimit";

type QueryRequest = {
  question?: string;
  topK?: number;
  apiKey?: string;
  baseUrl?: string;
};

export async function POST(request: Request) {
  try {
    const ip = getClientIp(new Headers(request.headers));
    const max = Number(process.env.RATE_LIMIT_MAX ?? 30);
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
    const limit = checkRateLimit(`${ip}:query`, max, windowMs);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      );
    }

    const body = (await request.json()) as QueryRequest;

    if (!body?.question) {
      return NextResponse.json(
        { error: "question is required" },
        { status: 400 }
      );
    }

    const useOpenAI = Boolean(body.apiKey);
    const embedder = useOpenAI
      ? createOpenAIEmbeddingProvider({
          apiKey: body.apiKey,
          baseUrl: body.baseUrl,
        })
      : embeddingProvider;
    const llm = useOpenAI
      ? createOpenAILlmProvider({
          apiKey: body.apiKey,
          baseUrl: body.baseUrl,
        })
      : llmProvider;

    const result = await answerQuestion(
      body.question,
      vectorStore,
      embedder,
      llm,
      {
        topK: body.topK ?? 4,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
