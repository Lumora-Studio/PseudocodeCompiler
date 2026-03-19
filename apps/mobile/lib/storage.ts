import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WorkspaceState } from "@igcse/workspace";
import {
  ROOT_FOLDER_ID,
  createDefaultWorkspace,
  createDocument,
  createFolder,
  migratePersistedWorkspace,
  moveNode,
  setActiveDocument,
  setExpandedFolders,
} from "@igcse/workspace";

const STORAGE_KEY = "igcse-workspace-v3";
const LEGACY_SOURCE_KEY = "igcse-editor-source-v2";

const STARTER_LAYOUT_SOURCE = `DECLARE name : STRING
DECLARE value : INTEGER
DECLARE active : BOOLEAN

INPUT name
OUTPUT "Hello, ", name

IF name = "Alex" THEN
    OUTPUT "Welcome User"
ENDIF

FOR count ← 1 TO 5
    OUTPUT count
NEXT count

WHILE total < limit DO
    OUTPUT "looping"
ENDWHILE`;

const STARTER_PAGE_SOURCE = `DECLARE pageTitle : STRING
DECLARE pageReady : BOOLEAN

pageTitle ← "Compiler"
pageReady ← TRUE

IF pageReady = TRUE THEN
    OUTPUT pageTitle
ENDIF`;

function createStarterWorkspace(sampleSource: string): WorkspaceState {
  let state = createDefaultWorkspace({
    sampleSource,
    documentName: "layout.pseudo",
  });

  state = createFolder(state, {
    id: "folder-src",
    parentId: ROOT_FOLDER_ID,
    name: "src",
  });
  state = createFolder(state, {
    id: "folder-app",
    parentId: "folder-src",
    name: "app",
  });
  state = createFolder(state, {
    id: "folder-components",
    parentId: "folder-app",
    name: "components",
  });
  state = createFolder(state, {
    id: "folder-compiler",
    parentId: "folder-src",
    name: "compiler",
  });
  state = createFolder(state, {
    id: "folder-runtime",
    parentId: "folder-src",
    name: "runtime",
  });

  state = moveNode(state, "doc-main", "folder-app");
  state = createDocument(state, {
    id: "doc-page",
    parentId: "folder-app",
    name: "page.pseudo",
    source: STARTER_PAGE_SOURCE,
  });
  state = setExpandedFolders(state, [
    ROOT_FOLDER_ID,
    "folder-src",
    "folder-app",
  ]);

  return setActiveDocument(state, "doc-main");
}

export async function loadWorkspace(sampleSource: string): Promise<WorkspaceState> {
  try {
    return await migrateWorkspace(sampleSource);
  } catch {
    return createStarterWorkspace(sampleSource || STARTER_LAYOUT_SOURCE);
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
  const starterSource = sampleSource || STARTER_LAYOUT_SOURCE;

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
      const starterWorkspace = createStarterWorkspace(starterSource);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(starterWorkspace));
      return starterWorkspace;
    }

    const state = migratePersistedWorkspace(persisted, {
      sampleSource: starterSource,
      legacySource,
    });

    if (!persistedRaw) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    return state;
  } catch {
    return createStarterWorkspace(starterSource);
  }
}
