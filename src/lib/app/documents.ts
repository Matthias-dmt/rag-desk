import { promises as fs } from "fs";
import path from "path";
import { QdrantClient } from "@qdrant/js-client-rest";

export type DocumentEntry = {
  docId: string;
  docName: string;
  chunkCount: number;
};

type RegistryFile = {
  documents: DocumentEntry[];
};

type FileStoreRecord = {
  id: string;
  embedding: number[];
  metadata: {
    docId: string;
    docName: string;
    chunkIndex: number;
    start: number;
    end: number;
    text: string;
  };
};

type FileStore = {
  records: FileStoreRecord[];
};

const DOCS_FILE = resolveDocsPath();
const STORE_FILE = resolveStorePath();
const DEFAULT_COLLECTION = "rag_chunks";

function resolveDocsPath() {
  if (process.env.RAG_DOCS_PATH) {
    return process.env.RAG_DOCS_PATH;
  }
  if (process.env.CF_PAGES || process.env.NODE_ENV === "production") {
    return "/tmp/rag-docs.json";
  }
  return path.join(process.cwd(), ".rag-docs.json");
}

function resolveStorePath() {
  if (process.env.RAG_STORE_PATH) {
    return process.env.RAG_STORE_PATH;
  }
  if (process.env.CF_PAGES || process.env.NODE_ENV === "production") {
    return "/tmp/rag-store.json";
  }
  return path.join(process.cwd(), ".rag-store.json");
}

export async function listDocuments(): Promise<DocumentEntry[]> {
  const existing = await loadRegistry();
  if (existing) {
    return existing.documents;
  }

  const rebuilt = await rebuildRegistryFromStore();
  await saveRegistry({ documents: rebuilt });
  return rebuilt;
}

export async function addDocument(entry: DocumentEntry): Promise<void> {
  const registry = (await loadRegistry()) ?? { documents: [] };
  const next = registry.documents.filter((doc) => doc.docId !== entry.docId);
  next.push(entry);
  await saveRegistry({ documents: next });
}

export async function removeDocument(docId: string): Promise<void> {
  const registry = (await loadRegistry()) ?? { documents: [] };
  const next = registry.documents.filter((doc) => doc.docId !== docId);
  await saveRegistry({ documents: next });
}

async function loadRegistry(): Promise<RegistryFile | null> {
  try {
    const raw = await fs.readFile(DOCS_FILE, "utf8");
    const data = JSON.parse(raw) as RegistryFile;
    if (!Array.isArray(data.documents)) {
      return { documents: [] };
    }
    return data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function saveRegistry(registry: RegistryFile): Promise<void> {
  await fs.writeFile(DOCS_FILE, JSON.stringify(registry, null, 2), "utf8");
}

async function rebuildRegistryFromStore(): Promise<DocumentEntry[]> {
  const storeMode = process.env.VECTOR_STORE ?? "file";
  if (storeMode === "qdrant") {
    return rebuildFromQdrant();
  }

  return rebuildFromFileStore();
}

async function rebuildFromFileStore(): Promise<DocumentEntry[]> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const data = JSON.parse(raw) as FileStore;
    if (!Array.isArray(data.records)) {
      return [];
    }

    const counts = new Map<string, DocumentEntry>();
    for (const record of data.records) {
      const existing = counts.get(record.metadata.docId);
      if (existing) {
        existing.chunkCount += 1;
      } else {
        counts.set(record.metadata.docId, {
          docId: record.metadata.docId,
          docName: record.metadata.docName,
          chunkCount: 1,
        });
      }
    }

    return Array.from(counts.values());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function rebuildFromQdrant(): Promise<DocumentEntry[]> {
  const url = process.env.QDRANT_URL ?? "http://localhost:6333";
  const collection = process.env.QDRANT_COLLECTION ?? DEFAULT_COLLECTION;
  const client = new QdrantClient({ url });

  const counts = new Map<string, DocumentEntry>();
  let offset: number | undefined;

  while (true) {
    const result = await client.scroll(collection, {
      limit: 128,
      offset,
      with_payload: true,
    });

    for (const point of result.points) {
      const payload = point.payload as { docId?: string; docName?: string };
      if (!payload?.docId || !payload?.docName) {
        continue;
      }
      const existing = counts.get(payload.docId);
      if (existing) {
        existing.chunkCount += 1;
      } else {
        counts.set(payload.docId, {
          docId: payload.docId,
          docName: payload.docName,
          chunkCount: 1,
        });
      }
    }

    if (!result.next_page_offset) {
      break;
    }

    offset = result.next_page_offset as number;
  }

  return Array.from(counts.values());
}
