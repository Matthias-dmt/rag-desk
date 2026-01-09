import type { RetrievedChunk } from "./types";

export type PromptInput = {
  question: string;
  chunks: RetrievedChunk[];
};

export function buildPrompt({ question, chunks }: PromptInput): string {
  const context = chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.docName} (chunk ${chunk.index})\n${chunk.text}`
    )
    .join("\n\n");

  return [
    "You are a helpful assistant. Use the provided context to answer.",
    "If the context does not contain the answer, say you do not know.",
    "Always include citations in the form [1], [2] that match the context list.",
    "Format your answer as concise markdown with bullet points and short paragraphs.",
    "Use '-' for bullets, and put each bullet on its own line.",
    "Do not include preambles like \"Here is\" or meta commentary about formatting.",
    "Start directly with the answer content.",
    "",
    "Context:",
    context || "(none)",
    "",
    "Question:",
    question,
    "",
    "Answer:",
  ].join("\n");
}
