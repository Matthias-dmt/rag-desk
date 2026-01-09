import { describe, expect, it } from "vitest";
import { chunkDocument } from "../src/lib/rag/chunking";
import type { KnowledgeDocument } from "../src/lib/rag/types";

describe("chunkDocument", () => {
  it("splits text with overlap", () => {
    const doc: KnowledgeDocument = {
      id: "doc-1",
      name: "Example",
      text: "abcdefghijklmnopqrstuvwxyz",
      sourceType: "text",
    };

    const chunks = chunkDocument(doc, { chunkSize: 10, overlap: 2 });

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({ index: 0, start: 0, end: 10 });
    expect(chunks[1]).toMatchObject({ index: 1, start: 8, end: 18 });
    expect(chunks[2]).toMatchObject({ index: 2, start: 16, end: 26 });
  });

  it("rejects invalid options", () => {
    const doc: KnowledgeDocument = {
      id: "doc-2",
      name: "Bad",
      text: "hello",
      sourceType: "text",
    };

    expect(() =>
      chunkDocument(doc, { chunkSize: 5, overlap: 5 })
    ).toThrowError(/overlap/);
  });
});
