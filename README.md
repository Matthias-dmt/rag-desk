# RAG Desk

RAG Desk is a small, credible Retrieval-Augmented Generation (RAG) demo built to show real-world engineering choices: document ingestion, chunking, embeddings, vector search, prompt construction, and cited answers.

This project favors clarity and correctness over flashy features. It ships with a working local stack (Qdrant + Ollama) and a deployment-ready BYOK (Bring-Your-Own-Key) mode for OpenAI-compatible APIs.

## Product Summary

- Upload markdown or text
- Organize into a lightweight knowledge base
- Ask natural-language questions
- Receive answers with citations
- Inspect which chunks were retrieved

## Why RAG (not just an LLM)

LLMs do not know your private or recent documents. RAG addresses this by:
1. Indexing your documents into a vector store
2. Retrieving the most relevant chunks
3. Providing that context to the model at query time

This reduces hallucinations and makes answers traceable through citations.

## Architecture Overview

UI (Next.js App Router)
- Knowledge base ingest
- Query + answer display
- Source list with chunks

API Routes (Next.js route handlers)
- POST /api/ingest: document -> chunk -> embed -> store
- POST /api/query: embed question -> retrieve -> prompt -> generate
- GET /api/documents: list document registry
- DELETE /api/documents/:docId: remove document chunks

Core RAG Library
- Chunking with overlap
- Embedding providers (Ollama local, OpenAI-compatible BYOK)
- VectorStore interface (Qdrant or file-backed)
- Prompt assembly with citations

Vector Stores
- Qdrant (local dev, real vector DB)
- File store (deploy stability, zero-cost)

## Folder Structure (high level)

- src/app/api: route handlers
- src/lib/rag: chunking, retrieval, prompt, ingestion
- src/lib/providers: Ollama + OpenAI-compatible
- src/lib/vector: vector store interface + adapters
- tests: unit + integration tests

## Chunking Strategy

Default chunking:
- chunkSize: 1000 characters
- overlap: 200 characters

Why:
- Larger chunks reduce embedding calls (faster ingest, fewer vectors)
- Overlap preserves context across boundaries

Tradeoffs:
- Smaller chunks improve retrieval precision for specific facts
- Too small increases storage and may fragment meaning
- Too large increases answer noise and cost

Adjusting chunk size is a primary knob for relevance vs. performance.

## Vector DB Role and Scaling Considerations

Vector DBs enable fast similarity search over embeddings. As data grows:
- naive in-memory search stops scaling
- ANN (approximate nearest neighbor) indexes become necessary
- Qdrant handles filtering, metadata, and efficient search

Scaling concerns:
- vector dimensionality affects storage and speed
- retrieval latency grows with collection size
- filtering by metadata becomes important

## Why Qdrant Locally vs File Store for Demo

Local dev:
- Qdrant proves real vector DB integration
- reflects production-like retrieval behavior

Deployed demo:
- file store avoids running a paid DB
- zero-cost, stable, and enough for small demos

This split keeps the demo free while showing real-world readiness.

## Prompt Design

Prompt contains:
- system instructions
- retrieved context chunks
- user question

Constraints:
- citations must map to retrieved chunk list
- if answer is not in context, say "I do not know"

We also ask for concise markdown formatting so the UI renders clean output.

## Observability

- API responses include retrieved chunks
- tokensUsed is returned by providers when available
- failures surface as explicit API errors

## Limitations

- No PDF ingestion yet
- No auth or multi-user isolation
- Retrieval quality depends on chunking and embedding model
- File store is not suitable for large datasets

## What I Would Do Next (Production)

- Per-user collections with auth
- Background ingestion queue
- Streaming responses with partial citations
- Reranking step (cross-encoder)
- Better evaluation tooling and feedback loops
- Hybrid search (keyword + vector)

## Local Development

### Requirements

- Node 22 (nvm recommended)
- pnpm
- Docker (for Qdrant)
- Ollama (for local LLM + embeddings)

### Install

```bash
pnpm install
```

### Start Qdrant

```bash
docker compose up -d
```

### Start Ollama (local)

```bash
ollama serve
ollama pull nomic-embed-text
ollama pull llama3.2:1b
```

Optional env overrides:

```bash
OLLAMA_HOST=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_CHAT_MODEL=llama3.2:1b
```

### Run the app

```bash
pnpm dev
```

Open http://localhost:3000

## Environment Variables

Local (Qdrant + Ollama):

```bash
VECTOR_STORE=qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=rag_chunks
```

Deploy (file store + BYOK):

```bash
VECTOR_STORE=file
OPENAI_BASE_URL=https://api.openai.com
OPENAI_EMBED_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4o-mini
```

## Tests

Unit tests:

```bash
pnpm test
```

Qdrant integration test:

```bash
RUN_QDRANT_TESTS=true pnpm test -- tests/qdrant.test.ts
```

## API Usage (optional)

Ingest:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"name":"doc.md","text":"hello world"}'
```

Query:

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"What is this about?"}'
```

BYOK Query:

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"What is this about?","apiKey":"YOUR_KEY","baseUrl":"https://api.openai.com"}'
```

## Deployment: Cloudflare Pages (Free Tier)

This app is deployable to Cloudflare Pages using a static build + functions.

### 1) Create a new Pages project

- Go to https://dash.cloudflare.com
- Pages -> Create a project -> Connect to Git
- Pick this repo

### 2) Build settings

- Build command: `pnpm build`
- Build output directory: `.next`

### 3) Environment variables

Set the following in Cloudflare Pages:

```
VECTOR_STORE=file
OPENAI_BASE_URL=https://api.openai.com
OPENAI_EMBED_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4o-mini
```

### 4) Deploy

- Trigger deploy from Cloudflare UI
- The deployed UI will allow BYOK keys from users

If Cloudflare Pages cannot run the Next.js route handlers as needed, the $0 fallback is:
- Deploy frontend to Cloudflare Pages
- Deploy API to Cloudflare Workers (free tier)

## Notes

- The local UI stores document list in `.rag-docs.json`
- File-backed vectors stored in `.rag-store.json`
- Qdrant stores vectors in a Docker volume (`qdrant_data`)

---

Built with Next.js, Qdrant, and Ollama for a practical RAG demo.
