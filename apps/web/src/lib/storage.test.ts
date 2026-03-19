import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveDocument, updateDocumentSource } from "@igcse/workspace";

const dbStore = new Map<string, unknown>();
const localStore = new Map<string, string>();

interface MockDatabase {
  objectStoreNames: {
    contains: () => boolean;
  };
  createObjectStore: ReturnType<typeof vi.fn>;
  get: (_storeName: string, key: string) => Promise<unknown>;
  put: (_storeName: string, value: unknown, key: string) => Promise<void>;
}

interface MockOpenDbOptions {
  upgrade?: (database: MockDatabase) => void;
}

vi.mock("idb", () => ({
  openDB: vi.fn(async (_name: string, _version: number, options?: MockOpenDbOptions) => {
    const database: MockDatabase = {
      objectStoreNames: {
        contains: () => true,
      },
      createObjectStore: vi.fn(),
      async get(_storeName: string, key: string) {
        return dbStore.get(key);
      },
      async put(_storeName: string, value: unknown, key: string) {
        dbStore.set(key, value);
      },
    };

    options?.upgrade?.(database);
    return database;
  }),
}));

describe("workspace storage", () => {
  beforeEach(() => {
    dbStore.clear();
    localStore.clear();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => localStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
          localStore.set(key, value);
        },
        removeItem: (key: string) => {
          localStore.delete(key);
        },
        clear: () => {
          localStore.clear();
        },
      },
    });
    vi.resetModules();
  });

  it("loads and saves the current workspace snapshot", async () => {
    const storage = await import("@/lib/storage");
    const loaded = await storage.loadWorkspace('OUTPUT "Hello"');
    const updated = updateDocumentSource(loaded, getActiveDocument(loaded).id, 'OUTPUT "Saved"');

    await storage.saveWorkspace(updated);
    const reloaded = await storage.loadWorkspace('OUTPUT "Fallback"');

    expect(getActiveDocument(reloaded).source).toBe('OUTPUT "Saved"');
  });

  it("falls back to the default workspace when persisted data is malformed", async () => {
    dbStore.set("current", { version: 999 });
    const storage = await import("@/lib/storage");

    const loaded = await storage.loadWorkspace('OUTPUT "Fallback"');

    expect(getActiveDocument(loaded).source).toBe('OUTPUT "Fallback"');
  });
});
