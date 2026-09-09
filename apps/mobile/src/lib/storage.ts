// IndexedDB persistence for OpenCut mobile. Written from scratch, no deps.
// MIT-compatible; no GPL code.

import type { TimelineClip, TimelineMarker, TimelineTrack } from "../stores/timeline";
import type { ProjectAspect } from "./presets";

export interface ProjectDoc {
  id: string;
  name: string;
  updatedAt: number;
  /** CapCut-style canvas aspect. Optional for backwards compat (default 16:9). */
  aspect?: ProjectAspect;
  timeline: {
    tracks: TimelineTrack[];
    clips: TimelineClip[];
    /** Optional for backwards compat with docs saved before markers existed. */
    markers?: TimelineMarker[];
    playhead: number;
  };
}

const DB_NAME = "opencut-mobile";
const DB_VERSION = 1;
const PROJECT_STORE = "projects";
const BLOB_STORE = "blobs";

let dbPromise: Promise<IDBDatabase> | null = null;

function getFactory(): IDBFactory {
  const factory =
    globalThis.indexedDB ??
    (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB;
  if (!factory) throw new Error("storage: indexedDB is not available");
  return factory;
}

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = getFactory().open(DB_NAME, DB_VERSION);
      } catch (err) {
        dbPromise = null;
        reject(err);
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PROJECT_STORE)) {
          db.createObjectStore(PROJECT_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(BLOB_STORE)) {
          db.createObjectStore(BLOB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error ?? new Error("storage: failed to open IndexedDB"));
      };
      request.onblocked = () => {
        // Leave the promise pending; callers will still resolve on success.
      };
    });
  }
  return dbPromise;
}

/** Test helper: close + drop the cached connection so fake-indexeddb can reset. */
export function __closeStorageForTests(): void {
  if (dbPromise) {
    void dbPromise.then((db) => {
      try {
        db.close();
      } catch {
        // ignore
      }
    });
    dbPromise = null;
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("storage: IndexedDB request failed"));
  });
}

function tx(store: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then((db) => db.transaction(store, mode).objectStore(store));
}

export async function saveProject(doc: ProjectDoc): Promise<void> {
  const objectStore = await tx(PROJECT_STORE, "readwrite");
  await requestToPromise(objectStore.put(doc));
}

export async function loadProject(id: string): Promise<ProjectDoc | null> {
  const objectStore = await tx(PROJECT_STORE, "readonly");
  const result = await requestToPromise<ProjectDoc | undefined>(
    objectStore.get(id) as IDBRequest<ProjectDoc | undefined>,
  );
  return result ?? null;
}

export async function listProjects(): Promise<ProjectDoc[]> {
  const objectStore = await tx(PROJECT_STORE, "readonly");
  const result = await requestToPromise<ProjectDoc[]>(
    objectStore.getAll() as IDBRequest<ProjectDoc[]>,
  );
  return [...(result ?? [])].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id: string): Promise<void> {
  const objectStore = await tx(PROJECT_STORE, "readwrite");
  await requestToPromise(objectStore.delete(id));
}

interface StoredBlobRecord {
  buffer: ArrayBuffer;
  type: string;
}

function isArrayBufferLike(value: unknown): value is ArrayBuffer {
  if (typeof value !== "object" || value === null) return false;
  if (value instanceof ArrayBuffer) return true;
  // Cross-realm ArrayBuffers (e.g. fake-indexeddb's structured clone in
  // jsdom tests) fail `instanceof` but keep the [[ArrayBuffer]] brand.
  if (Object.prototype.toString.call(value) !== "[object ArrayBuffer]") {
    return false;
  }
  return (
    typeof (value as { byteLength?: unknown }).byteLength === "number"
  );
}

function isStoredBlobRecord(value: unknown): value is StoredBlobRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { buffer?: unknown; type?: unknown };
  return isArrayBufferLike(record.buffer) && typeof record.type === "string";
}

export async function saveBlob(id: string, blob: Blob): Promise<void> {
  // Stored as {buffer, type} rather than a raw Blob: some IndexedDB
  // shims (fake-indexeddb) cannot structured-clone Blobs, while
  // ArrayBuffers round-trip everywhere real IndexedDB does.
  const buffer = await blob.arrayBuffer();
  // Slice a copy so the stored bytes are detached from caller mutations.
  const copy = buffer.slice(0);
  const record: StoredBlobRecord = { buffer: copy, type: blob.type };
  const objectStore = await tx(BLOB_STORE, "readwrite");
  await requestToPromise(objectStore.put(record, id));
}

export async function getBlob(id: string): Promise<Blob | null> {
  const objectStore = await tx(BLOB_STORE, "readonly");
  const result = await requestToPromise<unknown>(
    objectStore.get(id) as IDBRequest<unknown>,
  );
  if (result instanceof Blob) return result;
  if (isStoredBlobRecord(result)) {
    // Copy into a same-realm buffer: shims may hand back a cross-realm
    // ArrayBuffer that DOM Blob constructors reject.
    const view = new Uint8Array(result.buffer.byteLength);
    view.set(new Uint8Array(result.buffer));
    return new Blob([view.buffer], { type: result.type });
  }
  return null;
}
