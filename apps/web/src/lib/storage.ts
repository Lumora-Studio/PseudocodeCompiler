import { openDB } from "idb";
import { anyApi } from "convex/server";
import type { WorkspaceState } from "@pseudocode-compiler/workspace";
import { createEmptyWorkspace, migratePersistedWorkspace } from "@pseudocode-compiler/workspace";
import type { BrowserAuditEventPayload, BrowserAuditSaveReason } from "@/lib/audit/events";
import { getConvexClient, isConvexConfigured } from "@/lib/convex/client";

const DB_NAME = "pseudocode-compiler-workspace";
const STORE_NAME = "workspace";
const LEGACY_PRIMARY_KEY = "current";
const LEGACY_SETTINGS_KEY = "settings";
const LEGACY_WORKSPACE_KEY = "pseudocode-compiler-workspace-v1";
const LEGACY_SOURCE_KEY = "pseudocode-compiler-editor-source-v2";
const RESET_WORKSPACE_ON_LOAD = process.env.NEXT_PUBLIC_RESET_WORKSPACE_ON_DEV === "1";
const DEV_RESET_SESSION_KEY = "pseudocode-compiler-reset-workspace-on-dev-applied";

export const DEFAULT_AUTOSAVE_INTERVAL_MINUTES = 5;

export type WorkspacePersistenceScope =
  | {
      kind: "anonymous";
    }
  | {
      kind: "local";
      storageKey?: string;
    }
  | {
      kind: "authenticated";
      userId: string;
    };

export interface WorkspaceSettings {
  autosaveIntervalMinutes: number;
}

interface DesktopElectronBridge {
  isDesktop?: boolean;
  loadLocalWorkspace?: (storageKey: string) => Promise<unknown | null>;
  saveLocalWorkspace?: (storageKey: string, workspace: WorkspaceState) => Promise<void>;
  loadLocalWorkspaceSettings?: (storageKey: string) => Promise<unknown | null>;
  saveLocalWorkspaceSettings?: (
    storageKey: string,
    settings: WorkspaceSettings,
  ) => Promise<void>;
}

interface SaveWorkspaceOptions {
  auditEvent?: {
    action: "workspace.saved";
    saveReason: BrowserAuditSaveReason;
  };
}

let anonymousWorkspaceCache: WorkspaceState | null = null;
let anonymousSettingsCache: WorkspaceSettings = {
  autosaveIntervalMinutes: DEFAULT_AUTOSAVE_INTERVAL_MINUTES,
};

type PersistedWorkspaceScope = Extract<
  WorkspacePersistenceScope,
  { kind: "authenticated" } | { kind: "local" }
>;

function getScopeStorageKey(scope: PersistedWorkspaceScope): string {
  if (scope.kind === "local") {
    return scope.storageKey ?? "local-device";
  }

  return scope.userId;
}

function getWorkspaceKey(scope: PersistedWorkspaceScope): string {
  return `workspace:${getScopeStorageKey(scope)}`;
}

function getSettingsKey(scope: PersistedWorkspaceScope): string {
  return `settings:${getScopeStorageKey(scope)}`;
}

function getDesktopElectronBridge(): DesktopElectronBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  const electronWindow = window as Window & { electron?: DesktopElectronBridge };
  return electronWindow.electron?.isDesktop ? electronWindow.electron : null;
}

function getWorkspaceAuditCounts(state: WorkspaceState): {
  documentCount: number;
  folderCount: number;
} {
  let documentCount = 0;
  let folderCount = 0;

  for (const node of Object.values(state.nodes)) {
    if (node.type === "document") {
      documentCount += 1;
      continue;
    }

    if (node.type === "folder" && node.parentId !== null) {
      folderCount += 1;
    }
  }

  return {
    documentCount,
    folderCount,
  };
}

async function emitBrowserAuditEvent(payload: BrowserAuditEventPayload): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await fetch("/api/audit-log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      credentials: "include",
      cache: "no-store",
      keepalive: true,
    });
  } catch {
    // Audit logging is best-effort and must not block workspace persistence.
  }
}

async function clearLegacyAnonymousPersistence(): Promise<void> {
  const database = await getDatabase();
  await Promise.all([
    database.delete(STORE_NAME, LEGACY_PRIMARY_KEY),
    database.delete(STORE_NAME, LEGACY_SETTINGS_KEY),
  ]);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(LEGACY_WORKSPACE_KEY);
    window.localStorage.removeItem(LEGACY_SOURCE_KEY);
  } catch {
    // Ignore storage access failures so guest mode still loads an empty workspace.
  }
}

function normalizeAutosaveIntervalMinutes(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_AUTOSAVE_INTERVAL_MINUTES;
  }

  const rounded = Math.round(value);
  return Math.min(60, Math.max(1, rounded));
}

function normalizeWorkspaceSettings(value: unknown): WorkspaceSettings {
  if (!value || typeof value !== "object") {
    return {
      autosaveIntervalMinutes: DEFAULT_AUTOSAVE_INTERVAL_MINUTES,
    };
  }

  const candidate = value as Partial<WorkspaceSettings>;
  return {
    autosaveIntervalMinutes: normalizeAutosaveIntervalMinutes(candidate.autosaveIntervalMinutes),
  };
}

function shouldResetWorkspaceForDevSession(): boolean {
  if (!RESET_WORKSPACE_ON_LOAD || typeof window === "undefined") {
    return false;
  }

  try {
    if (window.sessionStorage.getItem(DEV_RESET_SESSION_KEY) === "1") {
      return false;
    }

    window.sessionStorage.setItem(DEV_RESET_SESSION_KEY, "1");
    return true;
  } catch {
    return true;
  }
}

async function getDatabase() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    },
  });
}

async function loadCachedWorkspace(
  sampleSource: string,
  scope: PersistedWorkspaceScope,
): Promise<WorkspaceState> {
  const database = await getDatabase();
  const scopedWorkspaceKey = getWorkspaceKey(scope);

  if (shouldResetWorkspaceForDevSession()) {
    const emptyWorkspace = createEmptyWorkspace();
    await database.put(STORE_NAME, emptyWorkspace, scopedWorkspaceKey);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LEGACY_WORKSPACE_KEY);
      window.localStorage.removeItem(LEGACY_SOURCE_KEY);
    }
    return emptyWorkspace;
  }

  const persisted = await database.get(STORE_NAME, scopedWorkspaceKey);
  const legacyPersisted = persisted ? null : await database.get(STORE_NAME, LEGACY_PRIMARY_KEY);
  const legacyWorkspaceRaw =
    typeof window !== "undefined" ? window.localStorage.getItem(LEGACY_WORKSPACE_KEY) : null;
  const legacySource =
    typeof window !== "undefined" ? window.localStorage.getItem(LEGACY_SOURCE_KEY) : null;

  let legacyWorkspace: unknown = null;
  if (legacyWorkspaceRaw) {
    try {
      legacyWorkspace = JSON.parse(legacyWorkspaceRaw);
    } catch {
      legacyWorkspace = null;
    }
  }

  const state =
    persisted || legacyPersisted || legacyWorkspace || legacySource
      ? migratePersistedWorkspace(persisted ?? legacyPersisted ?? legacyWorkspace, {
          sampleSource,
          legacySource,
        })
      : createEmptyWorkspace();

  if (!persisted) {
    await database.put(STORE_NAME, state, scopedWorkspaceKey);
  }

  if (!persisted && legacyPersisted) {
    await database.delete(STORE_NAME, LEGACY_PRIMARY_KEY);
  }

  if (!persisted && (legacyWorkspaceRaw || legacySource) && typeof window !== "undefined") {
    window.localStorage.removeItem(LEGACY_WORKSPACE_KEY);
    window.localStorage.removeItem(LEGACY_SOURCE_KEY);
  }

  return state;
}

async function saveCachedWorkspace(
  state: WorkspaceState,
  scope: PersistedWorkspaceScope,
): Promise<void> {
  const database = await getDatabase();
  await database.put(STORE_NAME, state, getWorkspaceKey(scope));
}

async function loadDesktopWorkspace(
  sampleSource: string,
  scope: Extract<WorkspacePersistenceScope, { kind: "local" }>,
): Promise<WorkspaceState> {
  const bridge = getDesktopElectronBridge();
  const storageKey = getScopeStorageKey(scope);

  if (bridge?.loadLocalWorkspace) {
    try {
      const persisted = await bridge.loadLocalWorkspace(storageKey);
      if (persisted) {
        return migratePersistedWorkspace(persisted, { sampleSource });
      }
    } catch {
      // Fall back to legacy browser storage below if the desktop file read fails.
    }
  }

  const fallback = await loadCachedWorkspace(sampleSource, scope);

  if (bridge?.saveLocalWorkspace) {
    try {
      await bridge.saveLocalWorkspace(storageKey, fallback);
    } catch {
      // Keep the workspace open even if the migration write fails.
    }
  }

  return fallback;
}

async function saveDesktopWorkspace(
  state: WorkspaceState,
  scope: Extract<WorkspacePersistenceScope, { kind: "local" }>,
): Promise<void> {
  const bridge = getDesktopElectronBridge();
  const storageKey = getScopeStorageKey(scope);

  if (bridge?.saveLocalWorkspace) {
    await bridge.saveLocalWorkspace(storageKey, state);
    try {
      await saveCachedWorkspace(state, scope);
    } catch {
      // The filesystem copy is authoritative for the desktop shell.
    }
    return;
  }

  await saveCachedWorkspace(state, scope);
}

async function loadCachedWorkspaceSettings(
  scope: PersistedWorkspaceScope,
): Promise<WorkspaceSettings> {
  const database = await getDatabase();
  const scopedKey = getSettingsKey(scope);
  const stored = await database.get(STORE_NAME, scopedKey);

  if (stored) {
    return normalizeWorkspaceSettings(stored);
  }

  const legacyStored = await database.get(STORE_NAME, LEGACY_SETTINGS_KEY);
  const normalized = normalizeWorkspaceSettings(legacyStored);

  if (legacyStored) {
    await database.put(STORE_NAME, normalized, scopedKey);
    await database.delete(STORE_NAME, LEGACY_SETTINGS_KEY);
  }

  return normalized;
}

async function saveCachedWorkspaceSettings(
  settings: WorkspaceSettings,
  scope: PersistedWorkspaceScope,
): Promise<void> {
  const database = await getDatabase();
  await database.put(STORE_NAME, normalizeWorkspaceSettings(settings), getSettingsKey(scope));
}

async function loadDesktopWorkspaceSettings(
  scope: Extract<WorkspacePersistenceScope, { kind: "local" }>,
): Promise<WorkspaceSettings> {
  const bridge = getDesktopElectronBridge();
  const storageKey = getScopeStorageKey(scope);

  if (bridge?.loadLocalWorkspaceSettings) {
    try {
      const persisted = await bridge.loadLocalWorkspaceSettings(storageKey);
      if (persisted) {
        return normalizeWorkspaceSettings(persisted);
      }
    } catch {
      // Fall back to legacy browser storage below if the desktop file read fails.
    }
  }

  const fallback = await loadCachedWorkspaceSettings(scope);

  if (bridge?.saveLocalWorkspaceSettings) {
    try {
      await bridge.saveLocalWorkspaceSettings(storageKey, fallback);
    } catch {
      // Keep the current settings in memory even if the migration write fails.
    }
  }

  return fallback;
}

async function saveDesktopWorkspaceSettings(
  settings: WorkspaceSettings,
  scope: Extract<WorkspacePersistenceScope, { kind: "local" }>,
): Promise<void> {
  const normalized = normalizeWorkspaceSettings(settings);
  const bridge = getDesktopElectronBridge();
  const storageKey = getScopeStorageKey(scope);

  if (bridge?.saveLocalWorkspaceSettings) {
    await bridge.saveLocalWorkspaceSettings(storageKey, normalized);
    try {
      await saveCachedWorkspaceSettings(normalized, scope);
    } catch {
      // The filesystem copy is authoritative for the desktop shell.
    }
    return;
  }

  await saveCachedWorkspaceSettings(normalized, scope);
}

async function loadRemoteWorkspace(
  sampleSource: string,
  scope: Extract<WorkspacePersistenceScope, { kind: "authenticated" }>,
): Promise<WorkspaceState> {
  const convexClient = getConvexClient();
  if (!convexClient) {
    return loadCachedWorkspace(sampleSource, scope);
  }

  try {
    const persisted = await convexClient.query(anyApi.workspaces.getCurrentWorkspace, {});

    if (persisted) {
      const migrated = migratePersistedWorkspace(persisted, { sampleSource });
      await saveCachedWorkspace(migrated, scope);
      return migrated;
    }

    const fallback = await loadCachedWorkspace(sampleSource, scope);
    await convexClient.mutation(anyApi.workspaces.saveCurrentWorkspace, {
      workspace: fallback,
    });
    await saveCachedWorkspace(fallback, scope);
    await emitBrowserAuditEvent({
      action: "workspace.created",
      metadata: getWorkspaceAuditCounts(fallback),
    });
    return fallback;
  } catch {
    return loadCachedWorkspace(sampleSource, scope);
  }
}

async function saveRemoteWorkspace(
  state: WorkspaceState,
  scope: Extract<WorkspacePersistenceScope, { kind: "authenticated" }>,
  options?: SaveWorkspaceOptions,
): Promise<void> {
  const convexClient = getConvexClient();
  if (!convexClient) {
    await saveCachedWorkspace(state, scope);
    return;
  }

  await convexClient.mutation(anyApi.workspaces.saveCurrentWorkspace, {
    workspace: state,
  });
  await saveCachedWorkspace(state, scope);

  if (options?.auditEvent?.action === "workspace.saved") {
    await emitBrowserAuditEvent({
      action: "workspace.saved",
      metadata: {
        ...getWorkspaceAuditCounts(state),
        saveReason: options.auditEvent.saveReason,
      },
    });
  }
}

async function loadRemoteWorkspaceSettings(
  scope: Extract<WorkspacePersistenceScope, { kind: "authenticated" }>,
): Promise<WorkspaceSettings> {
  const convexClient = getConvexClient();
  if (!convexClient) {
    return loadCachedWorkspaceSettings(scope);
  }

  try {
    const settings = normalizeWorkspaceSettings(
      await convexClient.query(anyApi.workspaces.getCurrentWorkspaceSettings, {}),
    );
    await saveCachedWorkspaceSettings(settings, scope);
    return settings;
  } catch {
    return loadCachedWorkspaceSettings(scope);
  }
}

async function saveRemoteWorkspaceSettings(
  settings: WorkspaceSettings,
  scope: Extract<WorkspacePersistenceScope, { kind: "authenticated" }>,
): Promise<void> {
  const normalized = normalizeWorkspaceSettings(settings);
  const convexClient = getConvexClient();

  if (!convexClient) {
    await saveCachedWorkspaceSettings(normalized, scope);
    return;
  }

  await convexClient.mutation(anyApi.workspaces.saveCurrentWorkspaceSettings, normalized);
  await saveCachedWorkspaceSettings(normalized, scope);
  await emitBrowserAuditEvent({
    action: "workspace.settings_updated",
    metadata: {
      autosaveIntervalMinutes: normalized.autosaveIntervalMinutes,
    },
  });
}

export async function loadWorkspace(
  sampleSource: string,
  scope: WorkspacePersistenceScope = { kind: "anonymous" },
): Promise<WorkspaceState> {
  if (scope.kind === "anonymous") {
    await clearLegacyAnonymousPersistence();
    if (!anonymousWorkspaceCache) {
      anonymousWorkspaceCache = createEmptyWorkspace();
    }
    return anonymousWorkspaceCache;
  }

  if (scope.kind === "local") {
    return loadDesktopWorkspace(sampleSource, scope);
  }

  if (!isConvexConfigured()) {
    return loadCachedWorkspace(sampleSource, scope);
  }

  return loadRemoteWorkspace(sampleSource, scope);
}

export async function saveWorkspace(
  state: WorkspaceState,
  scope: WorkspacePersistenceScope = { kind: "anonymous" },
  options?: SaveWorkspaceOptions,
): Promise<void> {
  if (scope.kind === "anonymous") {
    anonymousWorkspaceCache = state;
    return;
  }

  if (scope.kind === "local") {
    await saveDesktopWorkspace(state, scope);
    return;
  }

  if (!isConvexConfigured()) {
    await saveCachedWorkspace(state, scope);
    return;
  }

  await saveRemoteWorkspace(state, scope, options);
}

export async function loadWorkspaceSettings(
  scope: WorkspacePersistenceScope = { kind: "anonymous" },
): Promise<WorkspaceSettings> {
  if (scope.kind === "anonymous") {
    await clearLegacyAnonymousPersistence();
    return anonymousSettingsCache;
  }

  if (scope.kind === "local") {
    return loadDesktopWorkspaceSettings(scope);
  }

  if (!isConvexConfigured()) {
    return loadCachedWorkspaceSettings(scope);
  }

  return loadRemoteWorkspaceSettings(scope);
}

export async function saveWorkspaceSettings(
  settings: WorkspaceSettings,
  scope: WorkspacePersistenceScope = { kind: "anonymous" },
): Promise<void> {
  if (scope.kind === "anonymous") {
    anonymousSettingsCache = normalizeWorkspaceSettings(settings);
    return;
  }

  if (scope.kind === "local") {
    await saveDesktopWorkspaceSettings(settings, scope);
    return;
  }

  if (!isConvexConfigured()) {
    await saveCachedWorkspaceSettings(settings, scope);
    return;
  }

  await saveRemoteWorkspaceSettings(settings, scope);
}

export async function migrateWorkspace(
  sampleSource: string,
  scope: WorkspacePersistenceScope = { kind: "anonymous" },
): Promise<WorkspaceState> {
  return loadWorkspace(sampleSource, scope);
}
