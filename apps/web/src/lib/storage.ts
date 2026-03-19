import { openDB } from "idb";
import type { WorkspaceState } from "@igcse/workspace";
import { migratePersistedWorkspace } from "@igcse/workspace";

const DB_NAME = "igcse-pseudocode-workspace";
const STORE_NAME = "workspace";
const PRIMARY_KEY = "current";
const LEGACY_WORKSPACE_KEY = "igcse-pseudocode-workspace-v1";
const LEGACY_SOURCE_KEY = "igcse-editor-source-v2";

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

export async function migrateWorkspace(sampleSource: string): Promise<WorkspaceState> {
  const database = await getDatabase();
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

  const state = migratePersistedWorkspace(persisted ?? legacyWorkspace, {
    sampleSource,
    legacySource,
  });

  if (!persisted) {
    await database.put(STORE_NAME, state, PRIMARY_KEY);
  }

  return state;
}
