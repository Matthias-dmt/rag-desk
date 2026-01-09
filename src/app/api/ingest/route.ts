import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { ingestDocument } from "@/lib/rag/ingestion";
import type { KnowledgeDocument, SourceType } from "@/lib/rag/types";
import { embeddingProvider, vectorStore } from "@/lib/app/runtime";
import { createOpenAIEmbeddingProvider } from "@/lib/providers/openai";
import { addDocument } from "@/lib/app/documents";

type IngestRequest = {
  id?: string;
  name?: string;
  text?: string;
  sourceType?: SourceType;
  apiKey?: string;
  baseUrl?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IngestRequest;

    if (!body?.name || !body?.text) {
      return NextResponse.json(
        { error: "name and text are required" },
        { status: 400 }
      );
    }

    const doc: KnowledgeDocument = {
      id: body.id ?? randomUUID(),
      name: body.name,
      text: body.text,
      sourceType: body.sourceType ?? "text",
    };

    const embedder = body.apiKey
      ? createOpenAIEmbeddingProvider({
          apiKey: body.apiKey,
          baseUrl: body.baseUrl,
        })
      : embeddingProvider;

    const result = await ingestDocument(doc, vectorStore, embedder);

    await addDocument({
      docId: result.docId,
      docName: doc.name,
      chunkCount: result.chunkCount,
    });

    return NextResponse.json({
      docId: result.docId,
      docName: doc.name,
      chunkCount: result.chunkCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
