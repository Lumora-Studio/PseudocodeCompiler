import { openDB } from "idb";
import type { WorkspaceState } from "@igcse/workspace";
import { createEmptyWorkspace, migratePersistedWorkspace } from "@igcse/workspace";

const DB_NAME = "igcse-pseudocode-workspace";
const STORE_NAME = "workspace";
const PRIMARY_KEY = "current";
const SETTINGS_KEY = "settings";
const LEGACY_WORKSPACE_KEY = "igcse-pseudocode-workspace-v1";
const LEGACY_SOURCE_KEY = "igcse-editor-source-v2";
const RESET_WORKSPACE_ON_LOAD = process.env.NEXT_PUBLIC_RESET_WORKSPACE_ON_DEV === "1";
const DEV_RESET_SESSION_KEY = "igcse-reset-workspace-on-dev-applied";

export const DEFAULT_AUTOSAVE_INTERVAL_MINUTES = 5;

export interface WorkspaceSettings {
  autosaveIntervalMinutes: number;
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

export async function loadWorkspace(sampleSource: string): Promise<WorkspaceState> {
  return migrateWorkspace(sampleSource);
}

export async function saveWorkspace(state: WorkspaceState): Promise<void> {
  const database = await getDatabase();
  await database.put(STORE_NAME, state, PRIMARY_KEY);
}

export async function loadWorkspaceSettings(): Promise<WorkspaceSettings> {
  const database = await getDatabase();
  const stored = await database.get(STORE_NAME, SETTINGS_KEY);
  return normalizeWorkspaceSettings(stored);
}

export async function saveWorkspaceSettings(settings: WorkspaceSettings): Promise<void> {
  const database = await getDatabase();
  await database.put(STORE_NAME, normalizeWorkspaceSettings(settings), SETTINGS_KEY);
}

export async function migrateWorkspace(sampleSource: string): Promise<WorkspaceState> {
  const database = await getDatabase();

  if (shouldResetWorkspaceForDevSession()) {
    const emptyWorkspace = createEmptyWorkspace();
    await database.put(STORE_NAME, emptyWorkspace, PRIMARY_KEY);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LEGACY_WORKSPACE_KEY);
      window.localStorage.removeItem(LEGACY_SOURCE_KEY);
    }
    return emptyWorkspace;
  }

  const persisted = await database.get(STORE_NAME, PRIMARY_KEY);
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
    persisted || legacyWorkspace || legacySource
      ? migratePersistedWorkspace(persisted ?? legacyWorkspace, {
          sampleSource,
          legacySource,
        })
      : createEmptyWorkspace();

  if (!persisted) {
    await database.put(STORE_NAME, state, PRIMARY_KEY);
  }

  return state;
}
