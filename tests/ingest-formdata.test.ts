import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/rag/ingestion", () => ({
  ingestDocument: vi.fn().mockResolvedValue({ docId: "doc-1", chunkCount: 2 }),
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

describe("/api/ingest (multipart)", () => {
  it("accepts a file upload and returns doc metadata", async () => {
    const { POST } = await import("../src/app/api/ingest/route");

    const form = new FormData();
    const file = new File(["Hello from file"], "sample.txt", {
      type: "text/plain",
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
      docName: "sample.txt",
      chunkCount: 2,
    });
  });
});
