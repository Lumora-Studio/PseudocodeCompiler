import { describe, expect, it } from "vitest";
import {
  createEmptyWorkspace,
  createDefaultWorkspace,
  createDocument,
  createFolder,
  deleteNode,
  deleteNodes,
  getChildNodes,
  getActiveDocument,
  migratePersistedWorkspace,
  moveNode,
  moveNodes,
  renameNode,
  reorderNode,
  ROOT_FOLDER_ID,
  ROOT_FOLDER_NAME,
  setActiveDocument,
  updateDocumentSource,
  validateWorkspaceState,
} from "./index";

const SAMPLE_SOURCE = `OUTPUT "Hello"`;

describe("workspace helpers", () => {
  it("uses the explorer root name for the synthetic project root", () => {
    const state = createDefaultWorkspace({ sampleSource: SAMPLE_SOURCE });

    expect(state.nodes[state.rootFolderId].name).toBe(ROOT_FOLDER_NAME);
  });

  it("creates folders and documents with unique sibling names", () => {
    let state = createDefaultWorkspace({ sampleSource: SAMPLE_SOURCE, now: "2026-03-15T00:00:00.000Z" });
    state = createFolder(state, { name: "New Folder", id: "folder-a", now: "2026-03-15T00:01:00.000Z" });
    state = createFolder(state, { name: "New Folder", id: "folder-b", now: "2026-03-15T00:02:00.000Z" });
    state = createDocument(state, { name: "Untitled", id: "doc-2", now: "2026-03-15T00:03:00.000Z" });
    state = createDocument(state, { name: "Untitled", id: "doc-3", now: "2026-03-15T00:04:00.000Z" });

    expect(state.nodes["folder-a"].name).toBe("New Folder");
    expect(state.nodes["folder-b"].name).toBe("New Folder 2");
    expect(state.nodes["doc-2"].name).toBe("Untitled.pseudo");
    expect(state.nodes["doc-3"].name).toBe("Untitled 2.pseudo");
  });

  it("rejects moving a folder into its own descendant", () => {
    let state = createDefaultWorkspace({ sampleSource: SAMPLE_SOURCE });
    state = createFolder(state, { name: "Parent", id: "folder-parent" });
    state = createFolder(state, { parentId: "folder-parent", name: "Child", id: "folder-child" });

    expect(() => moveNode(state, "folder-parent", "folder-child")).toThrow(
      "A folder cannot be moved into its own descendant.",
    );
  });

  it("allows deleting the last remaining document", () => {
    const state = createDefaultWorkspace({ sampleSource: SAMPLE_SOURCE });
    const documentId = getActiveDocument(state)?.id;

    expect(documentId).toBeDefined();
    const next = deleteNode(state, documentId!);
    expect(getActiveDocument(next)).toBeNull();
    expect(Object.values(next.nodes).filter((node) => node.type === "document")).toHaveLength(0);
  });

  it("supports move and reorder within folders", () => {
    let state = createDefaultWorkspace({ sampleSource: SAMPLE_SOURCE });
    state = createFolder(state, { name: "Archive", id: "folder-archive" });
    state = createDocument(state, { name: "A", id: "doc-a" });
    state = createDocument(state, { name: "B", id: "doc-b" });

    state = moveNode(state, "doc-a", "folder-archive");
    state = reorderNode(state, "doc-b", 0);

    expect(state.nodes["doc-a"].parentId).toBe("folder-archive");
    expect(state.nodes["doc-b"].order).toBe(0);
  });

  it("moves multiple selected nodes together while preserving their order", () => {
    let state = createDefaultWorkspace({ sampleSource: SAMPLE_SOURCE });
    state = createDocument(state, { name: "One", id: "doc-one" });
    state = createDocument(state, { name: "Two", id: "doc-two" });
    state = createDocument(state, { name: "Three", id: "doc-three" });

    state = moveNodes(state, ["doc-one", "doc-two"], state.rootFolderId, 2);

    expect(getChildNodes(state, state.rootFolderId).map((node) => node.id).slice(0, 4)).toEqual([
      "doc-main",
      "doc-three",
      "doc-one",
      "doc-two",
    ]);
  });

  it("deletes multiple nodes in one operation", () => {
    let state = createDefaultWorkspace({ sampleSource: SAMPLE_SOURCE });
    state = createFolder(state, { name: "Archive", id: "folder-archive" });
    state = createDocument(state, { parentId: "folder-archive", name: "Nested", id: "doc-nested" });
    state = createDocument(state, { name: "Spare", id: "doc-spare" });

    state = deleteNodes(state, ["folder-archive", "doc-nested"]);

    expect(state.nodes["folder-archive"]).toBeUndefined();
    expect(state.nodes["doc-nested"]).toBeUndefined();
    expect(state.nodes["doc-spare"]).toBeDefined();
  });

  it("updates active document and source", () => {
    let state = createDefaultWorkspace({ sampleSource: SAMPLE_SOURCE });
    state = createDocument(state, { name: "Test", id: "doc-test", source: "OUTPUT 1" });
    state = setActiveDocument(state, "doc-test");
    state = updateDocumentSource(state, "doc-test", "OUTPUT 2");

    expect(getActiveDocument(state)?.id).toBe("doc-test");
    expect(getActiveDocument(state)?.source).toBe("OUTPUT 2");
  });

  it("supports an empty workspace until a file is created", () => {
    let state = createEmptyWorkspace("2026-03-15T00:00:00.000Z");

    expect(getActiveDocument(state)).toBeNull();

    state = createDocument(state, { id: "doc-first", name: "First" });

    expect(getActiveDocument(state)?.id).toBe("doc-first");
  });

  it("renames with sibling de-duplication", () => {
    let state = createDefaultWorkspace({ sampleSource: SAMPLE_SOURCE });
    state = createDocument(state, { name: "Alpha", id: "doc-alpha" });
    state = createDocument(state, { name: "Beta", id: "doc-beta" });
    state = renameNode(state, "doc-beta", "Alpha");

    expect(state.nodes["doc-beta"].name).toBe("Alpha 2.pseudo");
  });
});

describe("workspace migration", () => {
  it("migrates a legacy source string into a default workspace", () => {
    const state = migratePersistedWorkspace(null, {
      sampleSource: SAMPLE_SOURCE,
      legacySource: 'OUTPUT "Legacy"',
      now: "2026-03-15T00:00:00.000Z",
    });

    expect(getActiveDocument(state)?.name).toBe("main.pseudo");
    expect(getActiveDocument(state)?.source).toBe('OUTPUT "Legacy"');
  });

  it("migrates a legacy workspace snapshot", () => {
    const state = migratePersistedWorkspace(
      { source: 'OUTPUT "Saved"', stdinText: "", virtualFiles: {} },
      { sampleSource: SAMPLE_SOURCE },
    );

    expect(getActiveDocument(state)?.source).toBe('OUTPUT "Saved"');
  });

  it("creates a default workspace when persisted data is missing", () => {
    const state = migratePersistedWorkspace(undefined, { sampleSource: SAMPLE_SOURCE });

    expect(state.rootFolderId).toBe(ROOT_FOLDER_ID);
    expect(getActiveDocument(state)?.source).toBe(SAMPLE_SOURCE);
  });

  it("normalizes persisted root folders to the explorer root name", () => {
    const state = validateWorkspaceState({
      version: 2,
      rootFolderId: ROOT_FOLDER_ID,
      activeDocumentId: "doc-main",
      nodes: {
        [ROOT_FOLDER_ID]: {
          id: ROOT_FOLDER_ID,
          type: "folder",
          parentId: null,
          name: "Workspace",
          order: 0,
          createdAt: "2026-03-15T00:00:00.000Z",
          updatedAt: "2026-03-15T00:00:00.000Z",
        },
        "doc-main": {
          id: "doc-main",
          type: "document",
          parentId: ROOT_FOLDER_ID,
          name: "main.pseudo",
          source: SAMPLE_SOURCE,
          order: 0,
          createdAt: "2026-03-15T00:00:00.000Z",
          updatedAt: "2026-03-15T00:00:00.000Z",
        },
      },
      expandedFolderIds: [ROOT_FOLDER_ID],
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

    expect(state?.nodes[ROOT_FOLDER_ID].name).toBe(ROOT_FOLDER_NAME);
  });

  it("rejects unknown future versions", () => {
    const invalid = validateWorkspaceState({
      version: 999,
      rootFolderId: ROOT_FOLDER_ID,
      activeDocumentId: "doc-main",
      nodes: {},
    });

    expect(invalid).toBeNull();
  });
});
