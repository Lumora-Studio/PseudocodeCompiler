import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDocument, createEmptyWorkspace, getActiveDocument, updateDocumentSource } from "@pseudocode-compiler/workspace";

const dbStore = new Map<string, unknown>();
const localStore = new Map<string, string>();
const AUTH_SCOPE = { kind: "authenticated", userId: "test-user" } as const;
const LOCAL_SCOPE = { kind: "local", storageKey: "desktop-local" } as const;
const idbState = vi.hoisted(() => ({
  failPutKeys: new Set<string>(),
}));
const convexState = vi.hoisted(() => ({
  isConfigured: false,
  client: null as null | {
    query: ReturnType<typeof vi.fn>;
    mutation: ReturnType<typeof vi.fn>;
  },
}));
const fetchState = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

interface MockDatabase {
  objectStoreNames: {
    contains: () => boolean;
  };
  createObjectStore: ReturnType<typeof vi.fn>;
  get: (_storeName: string, key: string) => Promise<unknown>;
  put: (_storeName: string, value: unknown, key: string) => Promise<void>;
  delete: (_storeName: string, key: string) => Promise<void>;
}

interface MockOpenDbOptions {
  upgrade?: (database: MockDatabase) => void;
}

function restoreProperty<T extends object>(
  target: T,
  key: keyof T,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  delete (target as Record<PropertyKey, unknown>)[key];
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
        if (idbState.failPutKeys.has(key)) {
          throw new Error(`Failed to write ${key}`);
        }
        dbStore.set(key, value);
      },
      async delete(_storeName: string, key: string) {
        dbStore.delete(key);
      },
    };

    options?.upgrade?.(database);
    return database;
  }),
}));

vi.mock("@/lib/convex/client", () => ({
  getConvexClient: () => convexState.client,
  isConvexConfigured: () => convexState.isConfigured,
}));

describe("workspace storage", () => {
  beforeEach(() => {
    dbStore.clear();
    localStore.clear();
    idbState.failPutKeys.clear();
    convexState.isConfigured = false;
    convexState.client = null;
    fetchState.fetchMock.mockReset();
    fetchState.fetchMock.mockResolvedValue({
      ok: true,
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchState.fetchMock,
    });
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
    const loaded = await storage.loadWorkspace('OUTPUT "Hello"', LOCAL_SCOPE);
    const created = createDocument(loaded, { name: "main", source: 'OUTPUT "Hello"' });
    const updated = updateDocumentSource(created, getActiveDocument(created)!.id, 'OUTPUT "Saved"');

    await storage.saveWorkspace(updated, LOCAL_SCOPE);
    const reloaded = await storage.loadWorkspace('OUTPUT "Fallback"', LOCAL_SCOPE);

    expect(getActiveDocument(reloaded)?.source).toBe('OUTPUT "Saved"');
  });

  it("uses the Electron bridge for desktop local workspace persistence", async () => {
    const desktopWindow = window as Window & {
      electron?: {
        isDesktop?: boolean;
        loadLocalWorkspace?: (storageKey: string) => Promise<unknown>;
        saveLocalWorkspace?: (storageKey: string, workspace: unknown) => Promise<void>;
        loadLocalWorkspaceSettings?: (storageKey: string) => Promise<unknown>;
        saveLocalWorkspaceSettings?: (storageKey: string, settings: unknown) => Promise<void>;
      };
    };
    const originalElectronDescriptor = Object.getOwnPropertyDescriptor(desktopWindow, "electron");
    const workspaceFromDisk = createDocument(createEmptyWorkspace("2026-03-15T00:00:00.000Z"), {
      name: "main",
      source: 'OUTPUT "Disk"',
      now: "2026-03-15T00:01:00.000Z",
    });
    const loadLocalWorkspaceMock = vi.fn(async () => workspaceFromDisk);
    const saveLocalWorkspaceMock = vi.fn(async () => undefined);
    const loadLocalWorkspaceSettingsMock = vi.fn(async () => ({
      autosaveIntervalMinutes: 10,
    }));
    const saveLocalWorkspaceSettingsMock = vi.fn(async () => undefined);

    Object.defineProperty(desktopWindow, "electron", {
      configurable: true,
      value: {
        isDesktop: true,
        loadLocalWorkspace: loadLocalWorkspaceMock,
        saveLocalWorkspace: saveLocalWorkspaceMock,
        loadLocalWorkspaceSettings: loadLocalWorkspaceSettingsMock,
        saveLocalWorkspaceSettings: saveLocalWorkspaceSettingsMock,
      },
    });

    try {
      const storage = await import("@/lib/storage");
      const loaded = await storage.loadWorkspace('OUTPUT "Fallback"', LOCAL_SCOPE);

      expect(getActiveDocument(loaded)?.source).toBe('OUTPUT "Disk"');
      expect(loadLocalWorkspaceMock).toHaveBeenCalledWith("desktop-local");

      await storage.saveWorkspace(loaded, LOCAL_SCOPE);
      expect(saveLocalWorkspaceMock).toHaveBeenCalledWith("desktop-local", loaded);

      await expect(storage.loadWorkspaceSettings(LOCAL_SCOPE)).resolves.toEqual({
        autosaveIntervalMinutes: 10,
      });
      await storage.saveWorkspaceSettings({ autosaveIntervalMinutes: 15 }, LOCAL_SCOPE);
      expect(saveLocalWorkspaceSettingsMock).toHaveBeenCalledWith("desktop-local", {
        autosaveIntervalMinutes: 15,
      });
    } finally {
      restoreProperty(desktopWindow, "electron", originalElectronDescriptor);
    }
  });

  it("treats Electron file persistence as authoritative when the IndexedDB mirror fails", async () => {
    const desktopWindow = window as Window & {
      electron?: {
        isDesktop?: boolean;
        loadLocalWorkspace?: (storageKey: string) => Promise<unknown>;
        saveLocalWorkspace?: (storageKey: string, workspace: unknown) => Promise<void>;
      };
    };
    const originalElectronDescriptor = Object.getOwnPropertyDescriptor(desktopWindow, "electron");
    const saveLocalWorkspaceMock = vi.fn(async () => undefined);

    Object.defineProperty(desktopWindow, "electron", {
      configurable: true,
      value: {
        isDesktop: true,
        loadLocalWorkspace: vi.fn(async () => null),
        saveLocalWorkspace: saveLocalWorkspaceMock,
      },
    });

    try {
      const storage = await import("@/lib/storage");
      const loaded = await storage.loadWorkspace('OUTPUT "Hello"', LOCAL_SCOPE);
      const created = createDocument(loaded, { name: "main", source: 'OUTPUT "Hello"' });
      idbState.failPutKeys.add("workspace:desktop-local");

      await expect(storage.saveWorkspace(created, LOCAL_SCOPE)).resolves.toBeUndefined();
      expect(saveLocalWorkspaceMock).toHaveBeenCalledWith("desktop-local", created);
    } finally {
      restoreProperty(desktopWindow, "electron", originalElectronDescriptor);
    }
  });

  it("falls back to the default workspace when persisted data is malformed", async () => {
    dbStore.set("workspace:test-user", { version: 999 });
    const storage = await import("@/lib/storage");

    const loaded = await storage.loadWorkspace('OUTPUT "Fallback"', AUTH_SCOPE);

    expect(getActiveDocument(loaded)?.source).toBe('OUTPUT "Fallback"');
  });

  it("loads and saves workspace settings with a five minute default", async () => {
    const storage = await import("@/lib/storage");

    expect(await storage.loadWorkspaceSettings(LOCAL_SCOPE)).toEqual({
      autosaveIntervalMinutes: 5,
    });

    await storage.saveWorkspaceSettings(
      {
        autosaveIntervalMinutes: 10,
      },
      LOCAL_SCOPE,
    );

    await expect(storage.loadWorkspaceSettings(LOCAL_SCOPE)).resolves.toEqual({
      autosaveIntervalMinutes: 10,
    });
  });

  it("normalizes malformed workspace settings back to a safe autosave interval", async () => {
    dbStore.set("settings:test-user", {
      autosaveIntervalMinutes: "often",
    });
    const storage = await import("@/lib/storage");

    await expect(storage.loadWorkspaceSettings(AUTH_SCOPE)).resolves.toEqual({
      autosaveIntervalMinutes: 5,
    });
  });

  it("keeps anonymous sessions in memory only", async () => {
    const storage = await import("@/lib/storage");
    const anonymousScope = { kind: "anonymous" } as const;
    const loaded = await storage.loadWorkspace('OUTPUT "Hello"', anonymousScope);
    const created = createDocument(loaded, { name: "main", source: 'OUTPUT "Hello"' });
    const updated = updateDocumentSource(created, getActiveDocument(created)!.id, 'OUTPUT "Unsaved"');

    await storage.saveWorkspace(updated, anonymousScope);
    const reloaded = await storage.loadWorkspace('OUTPUT "Fallback"', anonymousScope);

    expect(getActiveDocument(reloaded)?.source).toBe('OUTPUT "Unsaved"');
    expect([...dbStore.keys()]).toHaveLength(0);
  });

  it("loads and saves authenticated workspaces through Convex when configured", async () => {
    const remoteQueryMock = vi.fn();
    const remoteMutationMock = vi.fn();
    convexState.isConfigured = true;
    convexState.client = {
      query: remoteQueryMock,
      mutation: remoteMutationMock,
    };

    const seededWorkspace = createDocument(createEmptyWorkspace("2026-03-15T00:00:00.000Z"), {
      name: "main",
      source: 'OUTPUT "Remote"',
      now: "2026-03-15T00:01:00.000Z",
    });
    const remoteWorkspace = updateDocumentSource(
      seededWorkspace,
      getActiveDocument(seededWorkspace)!.id,
      'OUTPUT "Remote"',
    );
    remoteQueryMock.mockResolvedValue(remoteWorkspace);
    const storage = await import("@/lib/storage");

    const loaded = await storage.loadWorkspace('OUTPUT "Fallback"', AUTH_SCOPE);
    await storage.saveWorkspace(loaded, AUTH_SCOPE);

    expect(getActiveDocument(loaded)?.source).toBe('OUTPUT "Remote"');
    expect(remoteMutationMock).toHaveBeenCalledWith(expect.anything(), {
      workspace: loaded,
    });
    expect(fetchState.fetchMock).not.toHaveBeenCalled();
  });

  it("emits a WorkOS audit event when provisioning a new remote workspace", async () => {
    const remoteQueryMock = vi.fn().mockResolvedValue(null);
    const remoteMutationMock = vi.fn();
    convexState.isConfigured = true;
    convexState.client = {
      query: remoteQueryMock,
      mutation: remoteMutationMock,
    };

    const storage = await import("@/lib/storage");
    await storage.loadWorkspace('OUTPUT "Fallback"', AUTH_SCOPE);

    expect(remoteMutationMock).toHaveBeenCalledTimes(1);
    expect(fetchState.fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchState.fetchMock).toHaveBeenCalledWith(
      "/api/audit-log",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        cache: "no-store",
        keepalive: true,
      }),
    );

    const [, requestInit] = fetchState.fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toEqual({
      action: "workspace.created",
      metadata: {
        documentCount: 0,
        folderCount: 0,
      },
    });
  });

  it("emits a WorkOS audit event for manual authenticated saves", async () => {
    const remoteQueryMock = vi.fn();
    const remoteMutationMock = vi.fn();
    convexState.isConfigured = true;
    convexState.client = {
      query: remoteQueryMock,
      mutation: remoteMutationMock,
    };

    const seededWorkspace = createDocument(createEmptyWorkspace("2026-03-15T00:00:00.000Z"), {
      name: "main",
      source: 'OUTPUT "Remote"',
      now: "2026-03-15T00:01:00.000Z",
    });
    remoteQueryMock.mockResolvedValue(seededWorkspace);
    const storage = await import("@/lib/storage");

    const loaded = await storage.loadWorkspace('OUTPUT "Fallback"', AUTH_SCOPE);
    fetchState.fetchMock.mockClear();

    await storage.saveWorkspace(loaded, AUTH_SCOPE, {
      auditEvent: {
        action: "workspace.saved",
        saveReason: "manual",
      },
    });

    expect(fetchState.fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchState.fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toEqual({
      action: "workspace.saved",
      metadata: {
        documentCount: 1,
        folderCount: 0,
        saveReason: "manual",
      },
    });
  });

  it("emits a WorkOS audit event when authenticated workspace settings change", async () => {
    const remoteMutationMock = vi.fn();
    convexState.isConfigured = true;
    convexState.client = {
      query: vi.fn(),
      mutation: remoteMutationMock,
    };

    const storage = await import("@/lib/storage");
    await storage.saveWorkspaceSettings(
      {
        autosaveIntervalMinutes: 10,
      },
      AUTH_SCOPE,
    );

    expect(remoteMutationMock).toHaveBeenCalledTimes(1);
    expect(fetchState.fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchState.fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toEqual({
      action: "workspace.settings_updated",
      metadata: {
        autosaveIntervalMinutes: 10,
      },
    });
  });

  it("purges legacy guest persistence when loading an anonymous session", async () => {
    dbStore.set("current", { version: 2 });
    dbStore.set("settings", { autosaveIntervalMinutes: 30 });
    dbStore.set("workspace:test-user", { version: 2, rootFolderId: "root" });
    localStore.set("pseudocode-compiler-workspace-v1", JSON.stringify({ version: 2 }));
    localStore.set("pseudocode-compiler-editor-source-v2", 'OUTPUT "Legacy"');

    const storage = await import("@/lib/storage");
    const anonymousScope = { kind: "anonymous" } as const;

    await storage.loadWorkspace('OUTPUT "Fallback"', anonymousScope);
    await storage.loadWorkspaceSettings(anonymousScope);

    expect(dbStore.has("current")).toBe(false);
    expect(dbStore.has("settings")).toBe(false);
    expect(dbStore.has("workspace:test-user")).toBe(true);
    expect(localStore.has("pseudocode-compiler-workspace-v1")).toBe(false);
    expect(localStore.has("pseudocode-compiler-editor-source-v2")).toBe(false);
  });

  it("resets only once per dev session when the dev reset flag is enabled", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_RESET_WORKSPACE_ON_DEV", "1");
    dbStore.set("workspace:test-user", {
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
    localStore.set("pseudocode-compiler-editor-source-v2", 'OUTPUT "Legacy"');

    const storage = await import("@/lib/storage");
    const loaded = await storage.loadWorkspace('OUTPUT "Fallback"', AUTH_SCOPE);

    expect(getActiveDocument(loaded)).toBeNull();
    expect(Object.values(loaded.nodes).filter((node) => node.type === "document")).toHaveLength(0);
    expect(localStore.has("pseudocode-compiler-editor-source-v2")).toBe(false);

    const savedWorkspace = createDocument(loaded, { name: "main", source: 'OUTPUT "Saved"' });
    await storage.saveWorkspace(savedWorkspace, AUTH_SCOPE);

    const reloaded = await storage.loadWorkspace('OUTPUT "Fallback"', AUTH_SCOPE);
    expect(getActiveDocument(reloaded)?.source).toBe('OUTPUT "Saved"');

    vi.unstubAllEnvs();
  });
});
