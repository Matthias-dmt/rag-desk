"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type IngestResponse = {
  docId: string;
  docName: string;
  chunkCount: number;
};

type Source = {
  docId: string;
  docName: string;
  index: number;
  start: number;
  end: number;
  text: string;
  score: number;
};

type QueryResponse = {
  answer: string;
  sources: Source[];
  tokensUsed?: number;
};

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
  );
}

function formatAnswer(raw: string) {
  return raw
    .replace(/•\s*/g, "\n- ")
    .replace(/\s-\s+/g, "\n- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function Home() {
  const [docName, setDocName] = useState("");
  const [docText, setDocText] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docs, setDocs] = useState<IngestResponse[]>([]);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [tokensUsed, setTokensUsed] = useState<number | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useOpenAI, setUseOpenAI] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await fetch("/api/documents");
        const data = (await response.json()) as {
          documents?: IngestResponse[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load documents");
        }
        setDocs(data.documents ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    loadDocuments();
  }, []);

  const handleIngest = async () => {
    setError(null);
    setIngestStatus(null);

    const fileToUpload = fileInputRef.current?.files?.[0] ?? docFile ?? null;

    if (fileToUpload) {
      if (useOpenAI && !apiKey.trim()) {
        setError("Please provide an API key for OpenAI-compatible mode.");
        return;
      }

      if (!docFile) {
        setDocFile(fileToUpload);
      }

      setIsIngesting(true);
      try {
        const form = new FormData();
        form.append("file", fileToUpload);
        form.append("name", docName.trim() || fileToUpload.name);
        const lowerName = fileToUpload.name.toLowerCase();
        const sourceType = lowerName.endsWith(".pdf")
          ? "pdf"
          : lowerName.endsWith(".md")
            ? "markdown"
            : "text";
        form.append("sourceType", sourceType);
        if (useOpenAI) {
          form.append("apiKey", apiKey.trim());
          if (baseUrl.trim()) {
            form.append("baseUrl", baseUrl.trim());
          }
        }

        const response = await fetch("/api/ingest", {
          method: "POST",
          body: form,
        });

        const data = (await response.json()) as IngestResponse | { error: string };
        if (!response.ok) {
          throw new Error("error" in data ? data.error : "Ingestion failed");
        }

        setDocs((prev) => [...prev, data as IngestResponse]);
        setDocText("");
        setDocFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setIngestStatus(
          `Stored ${data.chunkCount} chunks from "${data.docName}".`
        );
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsIngesting(false);
      }
    }

    if (!docName.trim() || !docText.trim()) {
      setError("Please provide a document name and content or upload a file.");
      return;
    }

    setIsIngesting(true);
    try {
      if (useOpenAI && !apiKey.trim()) {
        setError("Please provide an API key for OpenAI-compatible mode.");
        return;
      }

      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: docName.trim(),
          text: docText.trim(),
          sourceType: "markdown",
          apiKey: useOpenAI ? apiKey.trim() : undefined,
          baseUrl: useOpenAI && baseUrl.trim() ? baseUrl.trim() : undefined,
        }),
      });

      const data = (await response.json()) as IngestResponse | { error: string };
      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Ingestion failed");
      }

      setDocs((prev) => [...prev, data as IngestResponse]);
      setDocText("");
      setDocFile(null);
      setIngestStatus(
        `Stored ${data.chunkCount} chunks from "${docName.trim()}".`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleAsk = async () => {
    setError(null);
    setAnswer(null);
    setSources([]);
    setTokensUsed(null);

    if (!question.trim()) {
      setError("Please enter a question.");
      return;
    }

    setIsQuerying(true);
    try {
      if (useOpenAI && !apiKey.trim()) {
        setError("Please provide an API key for OpenAI-compatible mode.");
        return;
      }

      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          topK: 4,
          apiKey: useOpenAI ? apiKey.trim() : undefined,
          baseUrl: useOpenAI && baseUrl.trim() ? baseUrl.trim() : undefined,
        }),
      });

      const data = (await response.json()) as QueryResponse | { error: string };
      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Query failed");
      }

      const result = data as QueryResponse;
      setAnswer(formatAnswer(result.answer));
      setSources(result.sources ?? []);
      setTokensUsed(result.tokensUsed ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsQuerying(false);
    }
  };

  const handleDelete = async (docId: string) => {
    setError(null);
    setIsDeleting(docId);
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Delete failed");
      }
      setDocs((prev) => prev.filter((doc) => doc.docId !== docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f2efe9,_#e6f0ff_45%,_#f8fafc_100%)] text-slate-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            RAG Desk
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Your focused research desk with real citations.
          </h1>
          <p className="max-w-2xl text-base text-slate-600">
            Upload markdown or text, ask questions, and see exactly which chunks
            informed the answer.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
            <h2 className="text-lg font-semibold">Knowledge Base</h2>
            <p className="text-sm text-slate-500">
              Add documents and build your retrieval memory.
            </p>
            <div className="mt-6 grid gap-4">
              <label className="text-sm font-medium text-slate-700">
                Document name
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
                  placeholder="e.g. onboarding-notes.md"
                  value={docName}
                  onChange={(event) => setDocName(event.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Upload file (optional)
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
                  type="file"
                  accept=".md,.txt,.pdf"
                  ref={fileInputRef}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setDocFile(file);
                    if (file && !docName.trim()) {
                      setDocName(file.name);
                    }
                    if (!file) {
                      setDocText("");
                    }
                  }}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Supports .md, .txt, and .pdf files.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Selected: {docFile ? docFile.name : "none"}
                </p>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Document content
                <textarea
                  className="mt-2 h-44 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
                  placeholder="Paste markdown or plain text here..."
                  value={docText}
                  onChange={(event) => setDocText(event.target.value)}
                  disabled={Boolean(docFile)}
                />
                {docFile ? (
                  <p className="mt-2 text-xs text-slate-500">
                    File selected: {docFile.name}. Remove the file to paste
                    content manually.
                  </p>
                ) : null}
              </label>
              <button
                className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleIngest}
                disabled={isIngesting}
              >
                {isIngesting ? <Spinner /> : null}
                {isIngesting ? "Ingesting..." : "Add to knowledge base"}
              </button>
              {ingestStatus ? (
                <p className="text-sm text-emerald-600">{ingestStatus}</p>
              ) : null}
            </div>
            <div className="mt-8 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Stored documents
              </h3>
              {docs.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No documents ingested yet.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {docs.map((doc, index) => (
                    <li
                      key={`${doc.docId}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {doc.docName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {doc.docId} · {doc.chunkCount} chunks
                        </p>
                      </div>
                      <button
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => handleDelete(doc.docId)}
                        disabled={isDeleting === doc.docId}
                      >
                        {isDeleting === doc.docId ? "Removing..." : "Remove"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
            <h2 className="text-lg font-semibold">Ask a question</h2>
            <p className="text-sm text-slate-500">
              We retrieve top chunks and craft a cited answer.
            </p>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Provider
                  </p>
                  <p className="text-xs text-slate-500">
                    Use Ollama locally or bring your own API key.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
                  <button
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      useOpenAI
                        ? "text-slate-500 hover:text-slate-700"
                        : "bg-slate-900 text-white shadow-sm"
                    }`}
                    onClick={() => setUseOpenAI(false)}
                    type="button"
                  >
                    Ollama local
                  </button>
                  <button
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      useOpenAI
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                    onClick={() => setUseOpenAI(true)}
                    type="button"
                  >
                    OpenAI-compatible
                  </button>
                </div>
              </div>
              {useOpenAI ? (
                <div className="mt-4 grid gap-3 text-sm text-slate-700">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    API key
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
                      type="password"
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Base URL (optional)
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
                      placeholder="https://api.openai.com"
                      value={baseUrl}
                      onChange={(event) => setBaseUrl(event.target.value)}
                    />
                  </label>
                  <p className="text-xs text-slate-500">
                    Key stays in memory and is sent only with your requests.
                  </p>
                </div>
              ) : null}
            </div>
            <div className="mt-6 grid gap-4">
              <label className="text-sm font-medium text-slate-700">
                Question
                <textarea
                  className="mt-2 h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
                  placeholder="Ask something about your docs..."
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                />
              </label>
              <button
                className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleAsk}
                disabled={isQuerying}
              >
                {isQuerying ? <Spinner /> : null}
                {isQuerying ? "Answering..." : "Generate answer"}
              </button>
            </div>
            {answer ? (
              <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                <p className="text-sm text-slate-700">Answer</p>
                <div className="mt-2 text-base leading-relaxed text-slate-900">
                  <ReactMarkdown>{answer}</ReactMarkdown>
                </div>
                {tokensUsed ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Estimated tokens: {tokensUsed}
                  </p>
                ) : null}
              </div>
            ) : null}
            {sources.length > 0 ? (
              <div className="mt-6">
                <p className="text-sm font-semibold text-slate-700">
                  Sources used
                </p>
                <ul className="mt-3 space-y-3 text-xs text-slate-600">
                  {sources.map((source, index) => (
                    <li
                      key={`${source.id}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        [{index + 1}] {source.docName} · chunk {source.index}
                      </p>
                      <details className="mt-2 text-sm text-slate-700">
                        <summary className="cursor-pointer text-xs font-semibold text-slate-500">
                          View chunk text
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap">
                          {source.text}
                        </p>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </main>
    </div>
  );
}
