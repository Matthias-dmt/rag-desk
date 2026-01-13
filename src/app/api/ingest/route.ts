import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { PDFParse } from "pdf-parse";
import "pdf-parse/worker";
import { getPath } from "pdf-parse/worker";
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
    const contentType = request.headers.get("content-type") ?? "";
    const body =
      contentType.includes("multipart/form-data") ? null : ((await request.json()) as IngestRequest);

    let name = body?.name;
    let text = body?.text;
    let sourceType = body?.sourceType;
    let apiKey = body?.apiKey;
    let baseUrl = body?.baseUrl;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const formName = form.get("name");
      const formSourceType = form.get("sourceType");
      apiKey = (form.get("apiKey") as string) ?? undefined;
      baseUrl = (form.get("baseUrl") as string) ?? undefined;

      if (file && file instanceof File) {
        name = typeof formName === "string" ? formName : file.name;
        sourceType =
          typeof formSourceType === "string"
            ? (formSourceType as SourceType)
            : inferSourceType(file);
        text = await extractTextFromFile(file);
      }
    }

    if (!name || !text) {
      return NextResponse.json(
        { error: "name and text are required" },
        { status: 400 }
      );
    }

    const doc: KnowledgeDocument = {
      id: body?.id ?? randomUUID(),
      name,
      text,
      sourceType: sourceType ?? "text",
    };

    const embedder = apiKey
      ? createOpenAIEmbeddingProvider({
          apiKey,
          baseUrl,
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
    const detail =
      error instanceof Error && process.env.NODE_ENV !== "production"
        ? error.stack
        : undefined;
    console.error("Ingest error:", error);
    return NextResponse.json({ error: message, detail }, { status: 500 });
  }
}

async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (typeof PDFParse.setWorker === "function") {
      PDFParse.setWorker(getPath());
    }
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    if (parser.destroy) {
      await parser.destroy();
    }
    return parsed.text ?? "";
  }

  return await file.text();
}

function inferSourceType(file: File): SourceType {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }
  if (file.name.toLowerCase().endsWith(".md")) {
    return "markdown";
  }
  return "text";
}
