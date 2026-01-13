import { describe, expect, it, vi } from "vitest";

vi.mock("pdf-parse", () => ({
  PDFParse: class {
    static setWorker() {}
    async getText() {
      return { text: "PDF text" };
    }
  },
}));

vi.mock("pdf-parse/worker", () => ({
  getPath: () => "file://worker",
}));

vi.mock("../src/lib/rag/ingestion", () => ({
  ingestDocument: vi.fn().mockResolvedValue({ docId: "doc-1", chunkCount: 1 }),
}));

vi.mock("../src/lib/app/runtime", () => ({
  embeddingProvider: {},
  vectorStore: {},
}));

vi.mock("../src/lib/app/documents", () => ({
  addDocument: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/providers/openai", () => ({
  createOpenAIEmbeddingProvider: vi.fn().mockReturnValue({}),
}));

describe("/api/ingest (pdf)", () => {
  it("parses pdf upload and returns doc metadata", async () => {
    const { POST } = await import("../src/app/api/ingest/route");

    const form = new FormData();
    const file = new File(["%PDF-1.4"], "sample.pdf", {
      type: "application/pdf",
    });
    form.append("file", file);

    const request = new Request("http://localhost/api/ingest", {
      method: "POST",
      body: form,
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      docId: "doc-1",
      docName: "sample.pdf",
      chunkCount: 1,
    });
  });
});
