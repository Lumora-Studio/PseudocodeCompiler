import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WorkspaceState } from "@igcse/workspace";
import {
  createEmptyWorkspace,
  migratePersistedWorkspace,
} from "@igcse/workspace";

const STORAGE_KEY = "igcse-workspace-v3";
const LEGACY_SOURCE_KEY = "igcse-editor-source-v2";

export async function loadWorkspace(sampleSource: string): Promise<WorkspaceState> {
  try {
    return await migrateWorkspace(sampleSource);
  } catch {
    return createEmptyWorkspace();
  }
}

export async function saveWorkspace(state: WorkspaceState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silently ignore storage errors
  }
}

export async function migrateWorkspace(sampleSource: string): Promise<WorkspaceState> {
  try {
    const [persistedRaw, legacySource] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(LEGACY_SOURCE_KEY),
    ]);

    let persisted: unknown = null;
    if (persistedRaw) {
      try {
        persisted = JSON.parse(persistedRaw);
      } catch {
        persisted = null;
      }
    }

    if (!persistedRaw && !legacySource) {
      const emptyWorkspace = createEmptyWorkspace();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(emptyWorkspace));
      return emptyWorkspace;
    }

    const state = migratePersistedWorkspace(persisted, {
      sampleSource,
      legacySource,
    });

    if (!persistedRaw) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    return state;
  } catch {
    return createEmptyWorkspace();
  }
}
