import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDocument, getActiveDocument, updateDocumentSource } from "@igcse/workspace";

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
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => localStore.get(`session:${key}`) ?? null,
        setItem: (key: string, value: string) => {
          localStore.set(`session:${key}`, value);
        },
        removeItem: (key: string) => {
          localStore.delete(`session:${key}`);
        },
        clear: () => {
          for (const key of [...localStore.keys()]) {
            if (key.startsWith("session:")) {
              localStore.delete(key);
            }
          }
        },
      },
    });
    vi.resetModules();
  });

  it("loads and saves the current workspace snapshot", async () => {
    const storage = await import("@/lib/storage");
    const loaded = await storage.loadWorkspace('OUTPUT "Hello"');
    const created = createDocument(loaded, { name: "main", source: 'OUTPUT "Hello"' });
    const updated = updateDocumentSource(created, getActiveDocument(created)!.id, 'OUTPUT "Saved"');

    await storage.saveWorkspace(updated);
    const reloaded = await storage.loadWorkspace('OUTPUT "Fallback"');

    expect(getActiveDocument(reloaded)?.source).toBe('OUTPUT "Saved"');
  });

  it("falls back to the default workspace when persisted data is malformed", async () => {
    dbStore.set("current", { version: 999 });
    const storage = await import("@/lib/storage");

    const loaded = await storage.loadWorkspace('OUTPUT "Fallback"');

    expect(getActiveDocument(loaded)?.source).toBe('OUTPUT "Fallback"');
  });

  it("resets only once per dev session when the dev reset flag is enabled", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_RESET_WORKSPACE_ON_DEV", "1");
    dbStore.set("current", {
      version: 2,
      rootFolderId: "root",
      activeDocumentId: "doc-main",
      nodes: {
        root: {
          id: "root",
          type: "folder",
          parentId: null,
          name: "Explorer",
          order: 0,
          createdAt: "2026-03-15T00:00:00.000Z",
          updatedAt: "2026-03-15T00:00:00.000Z",
        },
        "doc-main": {
          id: "doc-main",
          type: "document",
          parentId: "root",
          name: "main.pseudo",
          source: 'OUTPUT "Persisted"',
          order: 0,
          createdAt: "2026-03-15T00:00:00.000Z",
          updatedAt: "2026-03-15T00:00:00.000Z",
        },
      },
      expandedFolderIds: ["root"],
      recentDocumentIds: ["doc-main"],
      virtualFiles: {},
      panelInstances: {
        "panel-editor-main": {
          id: "panel-editor-main",
          kind: "editor",
          openDocumentIds: ["doc-main"],
          activeDocumentId: "doc-main",
          createdAt: "2026-03-15T00:00:00.000Z",
          updatedAt: "2026-03-15T00:00:00.000Z",
        },
      },
      layout: {
        id: "stack-editor",
        type: "stack",
        panelIds: ["panel-editor-main"],
        activePanelId: "panel-editor-main",
      },
      lastFocusedEditorPanelId: "panel-editor-main",
      lastFocusedTerminalPanelId: null,
    });
    localStore.set("igcse-editor-source-v2", 'OUTPUT "Legacy"');

    const storage = await import("@/lib/storage");
    const loaded = await storage.loadWorkspace('OUTPUT "Fallback"');

    expect(getActiveDocument(loaded)).toBeNull();
    expect(Object.values(loaded.nodes).filter((node) => node.type === "document")).toHaveLength(0);
    expect(localStore.has("igcse-editor-source-v2")).toBe(false);

    const savedWorkspace = createDocument(loaded, { name: "main", source: 'OUTPUT "Saved"' });
    await storage.saveWorkspace(savedWorkspace);

    const reloaded = await storage.loadWorkspace('OUTPUT "Fallback"');
    expect(getActiveDocument(reloaded)?.source).toBe('OUTPUT "Saved"');

    vi.unstubAllEnvs();
  });
});
