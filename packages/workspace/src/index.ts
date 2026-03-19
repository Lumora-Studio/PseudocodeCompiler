export const WORKSPACE_VERSION = 2;
export const ROOT_FOLDER_ID = "root";
export const ROOT_FOLDER_NAME = "Explorer";
export const DEFAULT_DOCUMENT_NAME = "main.pseudo";
export const NEW_DOCUMENT_BASENAME = "Untitled.pseudo";
export const NEW_FOLDER_BASENAME = "New Folder";

export type WorkspacePanelKind = "explorer" | "editor" | "terminal" | "diagnostics" | "files";
export type WorkspaceLayoutAxis = "horizontal" | "vertical";
export type WorkspaceDockPosition = "center" | "left" | "right" | "top" | "bottom";

export interface CompileSummary {
  severity: "error" | "warning" | "info" | "success";
  errorCount: number;
  warningCount: number;
  updatedAt: string;
}

export interface WorkspaceFolderNode {
  id: string;
  type: "folder";
  parentId: string | null;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceDocumentNode {
  id: string;
  type: "document";
  parentId: string;
  name: string;
  source: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  lastCompileSummary?: CompileSummary;
}

export type WorkspaceNode = WorkspaceFolderNode | WorkspaceDocumentNode;

interface WorkspacePanelInstanceBase {
  id: string;
  kind: WorkspacePanelKind;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceExplorerPanelInstance extends WorkspacePanelInstanceBase {
  kind: "explorer";
}

export interface WorkspaceEditorPanelInstance extends WorkspacePanelInstanceBase {
  kind: "editor";
  openDocumentIds: string[];
  activeDocumentId: string;
}

export interface WorkspaceTerminalPanelInstance extends WorkspacePanelInstanceBase {
  kind: "terminal";
}

export interface WorkspaceDiagnosticsPanelInstance extends WorkspacePanelInstanceBase {
  kind: "diagnostics";
}

export interface WorkspaceFilesPanelInstance extends WorkspacePanelInstanceBase {
  kind: "files";
  selectedFileName?: string;
}

export type WorkspacePanelInstance =
  | WorkspaceExplorerPanelInstance
  | WorkspaceEditorPanelInstance
  | WorkspaceTerminalPanelInstance
  | WorkspaceDiagnosticsPanelInstance
  | WorkspaceFilesPanelInstance;

export interface WorkspaceLayoutStackNode {
  id: string;
  type: "stack";
  panelIds: string[];
  activePanelId: string | null;
}

export interface WorkspaceLayoutSplitNode {
  id: string;
  type: "split";
  axis: WorkspaceLayoutAxis;
  sizes: number[];
  children: WorkspaceLayoutNode[];
}

export type WorkspaceLayoutNode = WorkspaceLayoutStackNode | WorkspaceLayoutSplitNode;

export interface WorkspaceState {
  version: number;
  rootFolderId: string;
  activeDocumentId: string;
  nodes: Record<string, WorkspaceNode>;
  expandedFolderIds?: string[];
  recentDocumentIds?: string[];
  virtualFiles: Record<string, string[]>;
  panelInstances: Record<string, WorkspacePanelInstance>;
  layout: WorkspaceLayoutNode;
  lastFocusedEditorPanelId: string | null;
  lastFocusedTerminalPanelId: string | null;
}

interface WorkspaceStateV1 {
  version: 1;
  rootFolderId: string;
  activeDocumentId: string;
  nodes: Record<string, WorkspaceNode>;
  expandedFolderIds?: string[];
  recentDocumentIds?: string[];
}

export interface LegacyWorkspaceSnapshot {
  source?: unknown;
  stdinText?: unknown;
  virtualFiles?: unknown;
}

export interface WorkspaceStorageAdapter {
  loadWorkspace(): Promise<WorkspaceState>;
  saveWorkspace(state: WorkspaceState): Promise<void>;
  migrateWorkspace(): Promise<WorkspaceState>;
}

export interface CreateWorkspaceOptions {
  sampleSource: string;
  documentName?: string;
  now?: string;
}

export interface CreateNodeOptions {
  parentId?: string;
  name?: string;
  now?: string;
  id?: string;
}

export interface CreatePanelOptions {
  targetStackId?: string;
  position?: WorkspaceDockPosition;
  now?: string;
}

export interface WorkspacePanelMutationResult {
  state: WorkspaceState;
  panelId: string;
  stackId: string;
}

const DEFAULT_EXPLORER_PANEL_ID = "panel-explorer";
const DEFAULT_EDITOR_PANEL_ID = "panel-editor-main";
const DEFAULT_TERMINAL_PANEL_ID = "panel-terminal-main";
const DEFAULT_DIAGNOSTICS_PANEL_ID = "panel-diagnostics-main";
const DEFAULT_FILES_PANEL_ID = "panel-files-main";
const DEFAULT_EXPLORER_STACK_ID = "stack-explorer";
const DEFAULT_EDITOR_STACK_ID = "stack-editor";
const DEFAULT_UTILITY_STACK_ID = "stack-utility";
const DEFAULT_ROOT_SPLIT_ID = "split-root";
const DEFAULT_MAIN_SPLIT_ID = "split-main";

export function createDefaultWorkspace(options: CreateWorkspaceOptions): WorkspaceState {
  const now = options.now ?? new Date().toISOString();
  const root: WorkspaceFolderNode = {
    id: ROOT_FOLDER_ID,
    type: "folder",
    parentId: null,
    name: ROOT_FOLDER_NAME,
    order: 0,
    createdAt: now,
    updatedAt: now,
  };

  const documentId = "doc-main";
  const document: WorkspaceDocumentNode = {
    id: documentId,
    type: "document",
    parentId: root.id,
    name: normalizeDocumentName(options.documentName ?? DEFAULT_DOCUMENT_NAME),
    source: options.sampleSource,
    order: 0,
    createdAt: now,
    updatedAt: now,
  };

  const docking = createDefaultDockingState(documentId, now);

  return normalizeWorkspace({
    version: WORKSPACE_VERSION,
    rootFolderId: root.id,
    activeDocumentId: document.id,
    nodes: {
      [root.id]: root,
      [document.id]: document,
    },
    expandedFolderIds: [root.id],
    recentDocumentIds: [document.id],
    virtualFiles: {},
    panelInstances: docking.panelInstances,
    layout: docking.layout,
    lastFocusedEditorPanelId: docking.lastFocusedEditorPanelId,
    lastFocusedTerminalPanelId: docking.lastFocusedTerminalPanelId,
  });
}

export function migratePersistedWorkspace(
  rawWorkspace: unknown,
  options: CreateWorkspaceOptions & { legacySource?: string | null },
): WorkspaceState {
  const migrated = validateWorkspaceState(rawWorkspace);
  if (migrated) {
    return migrated;
  }

  const migratedV1 = migrateWorkspaceStateV1(rawWorkspace, options.now);
  if (migratedV1) {
    return migratedV1;
  }

  const legacySource = options.legacySource?.trim().length ? options.legacySource : null;
  if (legacySource) {
    return createDefaultWorkspace({
      sampleSource: legacySource,
      documentName: DEFAULT_DOCUMENT_NAME,
      now: options.now,
    });
  }

  if (isLegacyWorkspaceSnapshot(rawWorkspace) && typeof rawWorkspace.source === "string") {
    const base = createDefaultWorkspace({
      sampleSource: rawWorkspace.source,
      documentName: DEFAULT_DOCUMENT_NAME,
      now: options.now,
    });
    return updateVirtualFiles(base, coerceVirtualFiles(rawWorkspace.virtualFiles), options.now);
  }

  return createDefaultWorkspace(options);
}

export function validateWorkspaceState(raw: unknown): WorkspaceState | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<WorkspaceState>;
  if (candidate.version !== WORKSPACE_VERSION) {
    return null;
  }

  if (
    typeof candidate.rootFolderId !== "string" ||
    typeof candidate.activeDocumentId !== "string" ||
    !candidate.nodes ||
    typeof candidate.nodes !== "object" ||
    !candidate.panelInstances ||
    typeof candidate.panelInstances !== "object" ||
    !candidate.layout
  ) {
    return null;
  }

  const nodes = candidate.nodes as Record<string, WorkspaceNode>;
  const rootNode = nodes[candidate.rootFolderId];
  const activeNode = nodes[candidate.activeDocumentId];
  if (!rootNode || rootNode.type !== "folder" || !activeNode || activeNode.type !== "document") {
    return null;
  }

  const normalizedNodes: Record<string, WorkspaceNode> = {};
  for (const [id, node] of Object.entries(nodes)) {
    if (!isWorkspaceNode(node)) {
      return null;
    }
    normalizedNodes[id] = node;
  }

  const layout = coerceLayoutNode(candidate.layout);
  if (!layout) {
    return null;
  }

  const panelInstances = coercePanelInstances(candidate.panelInstances);
  if (!panelInstances) {
    return null;
  }

  return normalizeWorkspace({
    version: WORKSPACE_VERSION,
    rootFolderId: candidate.rootFolderId,
    activeDocumentId: candidate.activeDocumentId,
    nodes: normalizedNodes,
    expandedFolderIds: Array.isArray(candidate.expandedFolderIds) ? candidate.expandedFolderIds.filter(isString) : [],
    recentDocumentIds: Array.isArray(candidate.recentDocumentIds) ? candidate.recentDocumentIds.filter(isString) : [],
    virtualFiles: coerceVirtualFiles(candidate.virtualFiles),
    panelInstances,
    layout,
    lastFocusedEditorPanelId:
      typeof candidate.lastFocusedEditorPanelId === "string" ? candidate.lastFocusedEditorPanelId : null,
    lastFocusedTerminalPanelId:
      typeof candidate.lastFocusedTerminalPanelId === "string" ? candidate.lastFocusedTerminalPanelId : null,
  });
}

export function createFolder(state: WorkspaceState, options: CreateNodeOptions = {}): WorkspaceState {
  const parentId = options.parentId ?? state.rootFolderId;
  const parent = getFolderOrThrow(state, parentId);
  const now = options.now ?? new Date().toISOString();
  const id = options.id ?? createNodeId("folder", now);
  const name = resolveSiblingName(state, parent.id, options.name?.trim() || NEW_FOLDER_BASENAME);
  const order = getNextOrder(state, parent.id);

  const next = cloneState(state);
  next.nodes[id] = {
    id,
    type: "folder",
    parentId: parent.id,
    name,
    order,
    createdAt: now,
    updatedAt: now,
  };
  next.expandedFolderIds = uniqueIds([...(next.expandedFolderIds ?? []), parent.id]);
  touchFolder(next, parent.id, now);
  return normalizeWorkspace(next);
}

export function createDocument(
  state: WorkspaceState,
  options: CreateNodeOptions & { source?: string },
): WorkspaceState {
  const parentId = options.parentId ?? state.rootFolderId;
  const parent = getFolderOrThrow(state, parentId);
  const now = options.now ?? new Date().toISOString();
  const id = options.id ?? createNodeId("document", now);
  const name = resolveSiblingName(state, parent.id, normalizeDocumentName(options.name?.trim() || NEW_DOCUMENT_BASENAME));
  const order = getNextOrder(state, parent.id);

  let next = cloneState(state);
  next.nodes[id] = {
    id,
    type: "document",
    parentId: parent.id,
    name,
    source: options.source ?? "",
    order,
    createdAt: now,
    updatedAt: now,
  };
  next.activeDocumentId = id;
  next.recentDocumentIds = uniqueIds([id, ...(next.recentDocumentIds ?? [])]).slice(0, 10);
  next.expandedFolderIds = uniqueIds([...(next.expandedFolderIds ?? []), parent.id]);
  touchFolder(next, parent.id, now);
  next = attachDocumentToPreferredEditor(next, id, now);
  return normalizeWorkspace(next);
}

export function renameNode(state: WorkspaceState, nodeId: string, name: string, now?: string): WorkspaceState {
  const node = getNodeOrThrow(state, nodeId);
  if (node.id === state.rootFolderId) {
    throw new Error("The root folder cannot be renamed.");
  }

  const timestamp = now ?? new Date().toISOString();
  const next = cloneState(state);
  const trimmed = name.trim();
  const normalizedName = node.type === "document" ? normalizeDocumentName(trimmed || node.name) : trimmed || node.name;
  const resolvedName = resolveSiblingName(next, node.parentId ?? state.rootFolderId, normalizedName, node.id);
  next.nodes[node.id] = {
    ...node,
    name: resolvedName,
    updatedAt: timestamp,
  };
  touchFolder(next, node.parentId ?? state.rootFolderId, timestamp);
  return normalizeWorkspace(next);
}

export function deleteNode(state: WorkspaceState, nodeId: string): WorkspaceState {
  return deleteNodes(state, [nodeId]);
}

export function deleteNodes(state: WorkspaceState, nodeIds: string[]): WorkspaceState {
  const topLevelNodeIds = collapseNodeIds(state, nodeIds);
  if (topLevelNodeIds.length === 0) {
    return normalizeWorkspace(cloneState(state));
  }

  const removeIds = new Set<string>();
  for (const nodeId of topLevelNodeIds) {
    const node = getNodeOrThrow(state, nodeId);
    if (node.id === state.rootFolderId) {
      throw new Error("The root folder cannot be deleted.");
    }

    removeIds.add(nodeId);
    if (node.type === "folder") {
      collectDescendantIds(state, nodeId, removeIds);
    }
  }

  if (countRemainingDocuments(state, removeIds) === 0) {
    throw new Error("At least one document must remain.");
  }

  const next = cloneState(state);
  for (const id of removeIds) {
    delete next.nodes[id];
  }

  next.expandedFolderIds = (next.expandedFolderIds ?? []).filter((id) => !removeIds.has(id));
  next.recentDocumentIds = (next.recentDocumentIds ?? []).filter((id) => !removeIds.has(id));

  if (removeIds.has(next.activeDocumentId)) {
    const fallbackDocument = listDocuments(next)[0];
    if (!fallbackDocument) {
      throw new Error("At least one document must remain.");
    }
    next.activeDocumentId = fallbackDocument.id;
  }

  return normalizeWorkspace(next);
}

export function moveNode(
  state: WorkspaceState,
  nodeId: string,
  targetFolderId: string,
  targetIndex?: number,
  now?: string,
): WorkspaceState {
  return moveNodes(state, [nodeId], targetFolderId, targetIndex, now);
}

export function moveNodes(
  state: WorkspaceState,
  nodeIds: string[],
  targetFolderId: string,
  targetIndex?: number,
  now?: string,
): WorkspaceState {
  const topLevelNodeIds = collapseNodeIds(state, nodeIds);
  if (topLevelNodeIds.length === 0) {
    return normalizeWorkspace(cloneState(state));
  }

  const targetFolder = getFolderOrThrow(state, targetFolderId);
  for (const nodeId of topLevelNodeIds) {
    const node = getNodeOrThrow(state, nodeId);
    if (node.id === state.rootFolderId) {
      throw new Error("The root folder cannot be moved.");
    }
    if (node.type === "folder" && isDescendantOf(state, targetFolder.id, node.id)) {
      throw new Error("A folder cannot be moved into its own descendant.");
    }
  }

  const timestamp = now ?? new Date().toISOString();
  const next = cloneState(state);
  const movingNodeIds = new Set(topLevelNodeIds);
  const sourceParentIds = new Set<string>();
  for (const nodeId of topLevelNodeIds) {
    const node = getNodeOrThrow(state, nodeId);
    sourceParentIds.add(node.parentId ?? state.rootFolderId);
  }

  for (const nodeId of topLevelNodeIds) {
    const existing = next.nodes[nodeId];
    const normalizedName = resolveSiblingName(
      next,
      targetFolder.id,
      existing.name,
      existing.parentId === targetFolder.id ? existing.id : undefined,
    );

    next.nodes[nodeId] = {
      ...existing,
      parentId: targetFolder.id,
      name: normalizedName,
      updatedAt: timestamp,
    } as WorkspaceNode;
  }

  for (const sourceParentId of sourceParentIds) {
    if (sourceParentId !== targetFolder.id) {
      reassignOrders(next, sourceParentId);
      touchFolder(next, sourceParentId, timestamp);
    }
  }

  const destinationChildren = getChildNodes(next, targetFolder.id).filter((child) => !movingNodeIds.has(child.id));
  const insertIndex = clampIndex(targetIndex ?? destinationChildren.length, destinationChildren.length);
  const orderedChildren = [
    ...destinationChildren.slice(0, insertIndex),
    ...topLevelNodeIds.map((nodeId) => next.nodes[nodeId]),
    ...destinationChildren.slice(insertIndex),
  ];

  orderedChildren.forEach((node, index) => {
    next.nodes[node.id] = {
      ...next.nodes[node.id],
      order: index,
    } as WorkspaceNode;
  });

  touchFolder(next, targetFolder.id, timestamp);
  next.expandedFolderIds = uniqueIds([...(next.expandedFolderIds ?? []), targetFolder.id]);
  return normalizeWorkspace(next);
}

export function reorderNode(
  state: WorkspaceState,
  nodeId: string,
  targetIndex: number,
  now?: string,
): WorkspaceState {
  const node = getNodeOrThrow(state, nodeId);
  if (node.id === state.rootFolderId) {
    throw new Error("The root folder cannot be reordered.");
  }

  const next = cloneState(state);
  reassignOrders(next, node.parentId ?? state.rootFolderId, nodeId, targetIndex);
  touchFolder(next, node.parentId ?? state.rootFolderId, now ?? new Date().toISOString());
  return normalizeWorkspace(next);
}

export function setActiveDocument(state: WorkspaceState, documentId: string, now?: string): WorkspaceState {
  const document = getNodeOrThrow(state, documentId);
  if (document.type !== "document") {
    throw new Error("Only documents can be activated.");
  }

  const timestamp = now ?? new Date().toISOString();
  const next = cloneState(state);
  next.activeDocumentId = documentId;
  next.recentDocumentIds = uniqueIds([documentId, ...(state.recentDocumentIds ?? [])]).slice(0, 10);
  const editorPanelId = resolveEditorPanelId(next);
  if (editorPanelId) {
    const panel = next.panelInstances[editorPanelId];
    if (panel?.kind === "editor") {
      next.panelInstances[editorPanelId] = {
        ...panel,
        openDocumentIds: uniqueIds([...(panel.openDocumentIds ?? []), documentId]),
        activeDocumentId: documentId,
        updatedAt: timestamp,
      };
      next.lastFocusedEditorPanelId = editorPanelId;
      next.layout = setStackActivePanel(next.layout, getStackContainingPanel(next, editorPanelId)?.id ?? null, editorPanelId);
    }
  }

  return normalizeWorkspace(next);
}

export function updateDocumentSource(
  state: WorkspaceState,
  documentId: string,
  source: string,
  now?: string,
): WorkspaceState {
  const document = getNodeOrThrow(state, documentId);
  if (document.type !== "document") {
    throw new Error("Only documents have source code.");
  }

  const timestamp = now ?? new Date().toISOString();
  const next = cloneState(state);
  next.nodes[documentId] = {
    ...document,
    source,
    updatedAt: timestamp,
  };
  touchFolder(next, document.parentId, timestamp);
  return next;
}

export function setDocumentCompileSummary(
  state: WorkspaceState,
  documentId: string,
  summary: CompileSummary | undefined,
  now?: string,
): WorkspaceState {
  const document = getNodeOrThrow(state, documentId);
  if (document.type !== "document") {
    throw new Error("Only documents can store compile summaries.");
  }

  const timestamp = now ?? new Date().toISOString();
  const next = cloneState(state);
  next.nodes[documentId] = {
    ...document,
    lastCompileSummary: summary,
    updatedAt: timestamp,
  };
  return next;
}

export function setExpandedFolders(state: WorkspaceState, folderIds: string[]): WorkspaceState {
  return normalizeWorkspace({
    ...cloneState(state),
    expandedFolderIds: uniqueIds(folderIds.filter((id) => state.nodes[id]?.type === "folder")),
  });
}

export function getActiveDocument(state: WorkspaceState): WorkspaceDocumentNode {
  const active = state.nodes[state.activeDocumentId];
  if (!active || active.type !== "document") {
    throw new Error("The active document is missing.");
  }
  return active;
}

export function getChildNodes(state: WorkspaceState, folderId: string): WorkspaceNode[] {
  return Object.values(state.nodes)
    .filter((node) => node.parentId === folderId)
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
}

export function listDocuments(state: WorkspaceState): WorkspaceDocumentNode[] {
  return Object.values(state.nodes)
    .filter((node): node is WorkspaceDocumentNode => node.type === "document")
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
}

export function getNodePath(state: WorkspaceState, nodeId: string): WorkspaceNode[] {
  const path: WorkspaceNode[] = [];
  let current = getNodeOrThrow(state, nodeId);
  path.unshift(current);
  while (current.parentId) {
    current = getNodeOrThrow(state, current.parentId);
    path.unshift(current);
  }
  return path;
}

export function flattenVisibleNodes(state: WorkspaceState): Array<{ node: WorkspaceNode; depth: number }> {
  const expanded = new Set(state.expandedFolderIds ?? []);
  const result: Array<{ node: WorkspaceNode; depth: number }> = [];

  const visit = (folderId: string, depth: number) => {
    for (const child of getChildNodes(state, folderId)) {
      result.push({ node: child, depth });
      if (child.type === "folder" && expanded.has(child.id)) {
        visit(child.id, depth + 1);
      }
    }
  };

  visit(state.rootFolderId, 0);
  return result;
}

export function workspaceHasFolder(state: WorkspaceState, folderId: string): boolean {
  return state.nodes[folderId]?.type === "folder";
}

export function getPanelInstance(state: WorkspaceState, panelId: string): WorkspacePanelInstance | null {
  return state.panelInstances[panelId] ?? null;
}

export function getPanelInstancesByKind(state: WorkspaceState, kind: WorkspacePanelKind): WorkspacePanelInstance[] {
  return Object.values(state.panelInstances).filter((panel) => panel.kind === kind);
}

export function getLayoutPanelIds(state: WorkspaceState): string[] {
  return collectLayoutPanelIds(state.layout);
}

export function findStackById(state: WorkspaceState, stackId: string): WorkspaceLayoutStackNode | null {
  return findStackNode(state.layout, stackId);
}

export function getStackContainingPanel(state: WorkspaceState, panelId: string): WorkspaceLayoutStackNode | null {
  return findStackContainingPanelNode(state.layout, panelId);
}

export function focusPanel(state: WorkspaceState, panelId: string, now?: string): WorkspaceState {
  const panel = getPanelOrThrow(state, panelId);
  const stack = getStackContainingPanel(state, panelId);
  if (!stack) {
    throw new Error(`Panel "${panelId}" is not docked.`);
  }

  const timestamp = now ?? new Date().toISOString();
  const next = cloneState(state);
  next.layout = setStackActivePanel(next.layout, stack.id, panelId);
  const existing = next.panelInstances[panelId];
  next.panelInstances[panelId] = {
    ...existing,
    updatedAt: timestamp,
  } as WorkspacePanelInstance;

  if (panel.kind === "editor") {
    next.lastFocusedEditorPanelId = panelId;
    next.activeDocumentId = panel.activeDocumentId;
    next.recentDocumentIds = uniqueIds([panel.activeDocumentId, ...(next.recentDocumentIds ?? [])]).slice(0, 10);
  }

  if (panel.kind === "terminal") {
    next.lastFocusedTerminalPanelId = panelId;
  }

  return normalizeWorkspace(next);
}

export function createPanel(
  state: WorkspaceState,
  kind: WorkspacePanelKind,
  options: CreatePanelOptions = {},
): WorkspacePanelMutationResult {
  if (kind === "explorer") {
    const existing = getPanelInstancesByKind(state, "explorer")[0];
    const existingStack = existing ? getStackContainingPanel(state, existing.id) : null;
    if (existing && existingStack) {
      return {
        state: focusPanel(state, existing.id, options.now),
        panelId: existing.id,
        stackId: existingStack.id,
      };
    }
  }

  const timestamp = options.now ?? new Date().toISOString();
  const next = cloneState(state);
  const panel = createPanelInstance(next, kind, timestamp);
  next.panelInstances[panel.id] = panel;

  const target = resolvePanelCreationTarget(next, kind, options.targetStackId, options.position);
  const docked = dockPanel(next, panel.id, target.stackId, target.position, undefined, timestamp);
  return {
    state: focusPanel(docked, panel.id, timestamp),
    panelId: panel.id,
    stackId: getStackContainingPanel(docked, panel.id)?.id ?? target.stackId,
  };
}

export function dockPanel(
  state: WorkspaceState,
  panelId: string,
  targetStackId: string,
  position: WorkspaceDockPosition,
  targetIndex?: number,
  now?: string,
): WorkspaceState {
  const panel = getPanelOrThrow(state, panelId);
  const sourceStack = getStackContainingPanel(state, panelId);

  if (sourceStack?.id === targetStackId && position !== "center") {
    return state;
  }

  if (sourceStack?.id === targetStackId && position === "center") {
    return focusPanel(reorderPanelInStack(state, sourceStack.id, panelId, targetIndex, now), panelId, now);
  }

  const timestamp = now ?? new Date().toISOString();
  const next = cloneState(state);
  next.layout = removePanelFromLayout(next.layout, panelId) ?? next.layout;

  const targetAfterRemoval = findStackNode(next.layout, targetStackId);
  if (!targetAfterRemoval) {
    return focusPanel(state, panelId, timestamp);
  }

  let updatedLayout: WorkspaceLayoutNode | null = null;
  if (position === "center") {
    updatedLayout = insertPanelIntoStack(next.layout, targetStackId, panelId, targetIndex);
  } else {
    updatedLayout = insertPanelBesideStack(next.layout, targetStackId, panelId, position, panel.kind, timestamp);
  }

  if (!updatedLayout) {
    return state;
  }

  next.layout = updatedLayout;
  next.panelInstances[panelId] = {
    ...next.panelInstances[panelId],
    updatedAt: timestamp,
  } as WorkspacePanelInstance;
  return focusPanel(normalizeWorkspace(next), panelId, timestamp);
}

export function closePanel(state: WorkspaceState, panelId: string, now?: string): WorkspaceState {
  const panel = getPanelOrThrow(state, panelId);
  if (panel.kind === "editor" && getPanelInstancesByKind(state, "editor").length <= 1) {
    return openDocumentInEditorPanel(state, panelId, state.activeDocumentId, now);
  }

  const next = cloneState(state);
  next.layout = removePanelFromLayout(next.layout, panelId) ?? next.layout;
  delete next.panelInstances[panelId];

  if (next.lastFocusedEditorPanelId === panelId) {
    next.lastFocusedEditorPanelId = null;
  }
  if (next.lastFocusedTerminalPanelId === panelId) {
    next.lastFocusedTerminalPanelId = null;
  }

  return normalizeWorkspace(next);
}

export function resizeSplit(
  state: WorkspaceState,
  splitId: string,
  sizes: number[],
  now?: string,
): WorkspaceState {
  const next = cloneState(state);
  next.layout = updateLayoutNode(next.layout, splitId, (node) => {
    if (!node || node.type !== "split") {
      return node;
    }
    return {
      ...node,
      sizes: normalizeSplitSizes(sizes, node.children.length),
    };
  });
  return normalizeWorkspace(next, now);
}

export function resetWorkspaceLayout(state: WorkspaceState, now?: string): WorkspaceState {
  const timestamp = now ?? new Date().toISOString();
  const docking = createDefaultDockingState(state.activeDocumentId, timestamp);
  return normalizeWorkspace({
    ...cloneState(state),
    panelInstances: docking.panelInstances,
    layout: docking.layout,
    lastFocusedEditorPanelId: docking.lastFocusedEditorPanelId,
    lastFocusedTerminalPanelId: docking.lastFocusedTerminalPanelId,
  });
}

export function openDocumentInFocusedEditor(state: WorkspaceState, documentId: string, now?: string): WorkspaceState {
  const editorPanelId = resolveEditorPanelId(state);
  if (editorPanelId) {
    return openDocumentInEditorPanel(state, editorPanelId, documentId, now);
  }

  const created = createPanel(state, "editor", { now });
  return openDocumentInEditorPanel(created.state, created.panelId, documentId, now);
}

export function openDocumentInEditorPanel(
  state: WorkspaceState,
  panelId: string,
  documentId: string,
  now?: string,
): WorkspaceState {
  const panel = getPanelOrThrow(state, panelId);
  if (panel.kind !== "editor") {
    throw new Error("Only editor panels can open documents.");
  }
  getDocumentOrThrow(state, documentId);

  const timestamp = now ?? new Date().toISOString();
  const next = cloneState(state);
  next.panelInstances[panelId] = {
    ...panel,
    openDocumentIds: uniqueIds([...panel.openDocumentIds, documentId]),
    activeDocumentId: documentId,
    updatedAt: timestamp,
  };
  next.activeDocumentId = documentId;
  next.lastFocusedEditorPanelId = panelId;
  next.recentDocumentIds = uniqueIds([documentId, ...(next.recentDocumentIds ?? [])]).slice(0, 10);
  next.layout = setStackActivePanel(next.layout, getStackContainingPanel(next, panelId)?.id ?? null, panelId);
  return normalizeWorkspace(next);
}

export function setEditorPanelActiveDocument(
  state: WorkspaceState,
  panelId: string,
  documentId: string,
  now?: string,
): WorkspaceState {
  return openDocumentInEditorPanel(state, panelId, documentId, now);
}

export function splitEditorPanel(
  state: WorkspaceState,
  panelId: string,
  direction: "right" | "bottom",
  now?: string,
): WorkspacePanelMutationResult {
  const panel = getPanelOrThrow(state, panelId);
  if (panel.kind !== "editor") {
    throw new Error("Only editor panels can be split.");
  }

  const stack = getStackContainingPanel(state, panelId);
  if (!stack) {
    throw new Error("The editor panel is not docked.");
  }

  const created = createPanel(state, "editor", {
    targetStackId: stack.id,
    position: direction,
    now,
  });
  return openDocumentPanelMutationResult(created, panel.activeDocumentId, now);
}

export function moveEditorTab(
  state: WorkspaceState,
  fromPanelId: string,
  toPanelId: string,
  documentId: string,
  targetIndex?: number,
  now?: string,
): WorkspaceState {
  const fromPanel = getPanelOrThrow(state, fromPanelId);
  const toPanel = getPanelOrThrow(state, toPanelId);
  if (fromPanel.kind !== "editor" || toPanel.kind !== "editor") {
    throw new Error("Only editor panels support document tabs.");
  }
  getDocumentOrThrow(state, documentId);

  const timestamp = now ?? new Date().toISOString();
  const next = cloneState(state);
  const fromDocuments = fromPanel.openDocumentIds.filter((id) => id !== documentId);

  let toDocuments = toPanel.openDocumentIds.filter((id) => id !== documentId);
  const insertIndex = clampIndex(targetIndex ?? toDocuments.length, toDocuments.length);
  toDocuments = [...toDocuments.slice(0, insertIndex), documentId, ...toDocuments.slice(insertIndex)];

  next.panelInstances[toPanelId] = {
    ...toPanel,
    openDocumentIds: toDocuments,
    activeDocumentId: documentId,
    updatedAt: timestamp,
  };

  const editorCount = getPanelInstancesByKind(next, "editor").length;
  if (fromPanelId === toPanelId) {
    next.activeDocumentId = documentId;
    next.lastFocusedEditorPanelId = toPanelId;
    return normalizeWorkspace(next);
  }

  if (fromDocuments.length === 0) {
    if (editorCount > 1) {
      next.layout = removePanelFromLayout(next.layout, fromPanelId) ?? next.layout;
      delete next.panelInstances[fromPanelId];
      if (next.lastFocusedEditorPanelId === fromPanelId) {
        next.lastFocusedEditorPanelId = toPanelId;
      }
    } else {
      const fallbackId = resolveFallbackDocumentId(next, documentId);
      next.panelInstances[fromPanelId] = {
        ...fromPanel,
        openDocumentIds: [fallbackId],
        activeDocumentId: fallbackId,
        updatedAt: timestamp,
      };
    }
  } else {
    next.panelInstances[fromPanelId] = {
      ...fromPanel,
      openDocumentIds: fromDocuments,
      activeDocumentId:
        fromPanel.activeDocumentId === documentId ? fromDocuments[Math.max(0, fromDocuments.length - 1)] : fromPanel.activeDocumentId,
      updatedAt: timestamp,
    };
  }

  next.activeDocumentId = documentId;
  next.lastFocusedEditorPanelId = toPanelId;
  return normalizeWorkspace(next);
}

export function closeEditorTab(
  state: WorkspaceState,
  panelId: string,
  documentId: string,
  now?: string,
): WorkspaceState {
  const panel = getPanelOrThrow(state, panelId);
  if (panel.kind !== "editor") {
    throw new Error("Only editor panels support document tabs.");
  }

  if (!panel.openDocumentIds.includes(documentId)) {
    return state;
  }

  const timestamp = now ?? new Date().toISOString();
  const remaining = panel.openDocumentIds.filter((id) => id !== documentId);
  const editorCount = getPanelInstancesByKind(state, "editor").length;

  if (remaining.length === 0 && editorCount > 1) {
    return closePanel(state, panelId, timestamp);
  }

  const fallbackId = remaining[remaining.length - 1] ?? resolveFallbackDocumentId(state, documentId);
  const next = cloneState(state);
  next.panelInstances[panelId] = {
    ...panel,
    openDocumentIds: remaining.length > 0 ? remaining : [fallbackId],
    activeDocumentId: panel.activeDocumentId === documentId ? fallbackId : panel.activeDocumentId,
    updatedAt: timestamp,
  };

  if (next.activeDocumentId === documentId && next.lastFocusedEditorPanelId === panelId) {
    next.activeDocumentId = fallbackId;
  }

  return normalizeWorkspace(next);
}

export function setFilesPanelSelection(
  state: WorkspaceState,
  panelId: string,
  fileName: string | undefined,
  now?: string,
): WorkspaceState {
  const panel = getPanelOrThrow(state, panelId);
  if (panel.kind !== "files") {
    throw new Error("Only file panels track a selected file.");
  }

  const next = cloneState(state);
  next.panelInstances[panelId] = {
    ...panel,
    selectedFileName: fileName,
    updatedAt: now ?? new Date().toISOString(),
  };
  return normalizeWorkspace(next);
}

export function updateVirtualFiles(
  state: WorkspaceState,
  virtualFiles: Record<string, string[]>,
  now?: string,
): WorkspaceState {
  const timestamp = now ?? new Date().toISOString();
  const next = cloneState(state);
  next.virtualFiles = cloneVirtualFiles(virtualFiles);
  for (const [panelId, panel] of Object.entries(next.panelInstances)) {
    if (panel.kind !== "files") {
      continue;
    }
    if (panel.selectedFileName && !next.virtualFiles[panel.selectedFileName]) {
      next.panelInstances[panelId] = {
        ...panel,
        selectedFileName: getFirstVirtualFileName(next.virtualFiles),
        updatedAt: timestamp,
      };
    }
  }
  return normalizeWorkspace(next);
}

export function ensureTerminalPanel(state: WorkspaceState, now?: string): WorkspacePanelMutationResult {
  const focusedTerminalId = state.lastFocusedTerminalPanelId;
  if (focusedTerminalId) {
    const focusedStack = getStackContainingPanel(state, focusedTerminalId);
    if (focusedStack) {
      return {
        state: focusPanel(state, focusedTerminalId, now),
        panelId: focusedTerminalId,
        stackId: focusedStack.id,
      };
    }
  }

  const existing = getPanelInstancesByKind(state, "terminal")[0];
  if (existing) {
    const existingStack = getStackContainingPanel(state, existing.id);
    if (existingStack) {
      return {
        state: focusPanel(state, existing.id, now),
        panelId: existing.id,
        stackId: existingStack.id,
      };
    }
  }

  return createPanel(state, "terminal", { now });
}

export function getPrimaryUtilityStackId(state: WorkspaceState): string | null {
  const focusedTerminal = state.lastFocusedTerminalPanelId ? getStackContainingPanel(state, state.lastFocusedTerminalPanelId) : null;
  if (focusedTerminal) {
    return focusedTerminal.id;
  }

  return findFirstUtilityStackId(state.layout, state.panelInstances);
}

function openDocumentPanelMutationResult(
  result: WorkspacePanelMutationResult,
  documentId: string,
  now?: string,
): WorkspacePanelMutationResult {
  return {
    ...result,
    state: openDocumentInEditorPanel(result.state, result.panelId, documentId, now),
  };
}

function resolvePanelCreationTarget(
  state: WorkspaceState,
  kind: WorkspacePanelKind,
  requestedStackId?: string,
  requestedPosition?: WorkspaceDockPosition,
): { stackId: string; position: WorkspaceDockPosition } {
  if (requestedStackId && findStackById(state, requestedStackId)) {
    return {
      stackId: requestedStackId,
      position: requestedPosition ?? "center",
    };
  }

  if (kind === "explorer") {
    const anchor = getPrimaryEditorStackId(state) ?? getAnyStackId(state.layout);
    if (anchor) {
      return { stackId: anchor, position: "left" };
    }
  }

  if (kind === "editor") {
    const anchor = getPrimaryEditorStackId(state) ?? getAnyStackId(state.layout);
    if (anchor) {
      return { stackId: anchor, position: "right" };
    }
  }

  const utilityStackId = getPrimaryUtilityStackId(state);
  if (utilityStackId) {
    return { stackId: utilityStackId, position: "center" };
  }

  const editorStackId = getPrimaryEditorStackId(state) ?? getAnyStackId(state.layout);
  if (editorStackId) {
    return { stackId: editorStackId, position: "right" };
  }

  return { stackId: DEFAULT_EDITOR_STACK_ID, position: "center" };
}

function normalizeWorkspace(state: WorkspaceState, now?: string): WorkspaceState {
  const timestamp = now ?? new Date().toISOString();
  const next = cloneState(state);
  const rootNode = next.nodes[next.rootFolderId];
  if (!rootNode || rootNode.type !== "folder") {
    throw new Error("A workspace must contain a valid root folder.");
  }

  if (rootNode.parentId !== null || rootNode.name !== ROOT_FOLDER_NAME) {
    next.nodes[next.rootFolderId] = {
      ...rootNode,
      parentId: null,
      name: ROOT_FOLDER_NAME,
    };
  }

  for (const folder of Object.values(next.nodes)) {
    if (folder.type !== "folder") {
      continue;
    }
    reassignOrders(next, folder.id);
  }

  if (!next.expandedFolderIds?.includes(next.rootFolderId)) {
    next.expandedFolderIds = uniqueIds([next.rootFolderId, ...(next.expandedFolderIds ?? [])]);
  }

  if (!next.nodes[next.activeDocumentId] || next.nodes[next.activeDocumentId].type !== "document") {
    const firstDocument = listDocuments(next)[0];
    if (!firstDocument) {
      throw new Error("A workspace must contain at least one document.");
    }
    next.activeDocumentId = firstDocument.id;
  }

  next.recentDocumentIds = uniqueIds(
    (next.recentDocumentIds ?? []).filter((id) => next.nodes[id]?.type === "document"),
  ).slice(0, 10);

  next.virtualFiles = cloneVirtualFiles(next.virtualFiles);

  const normalizedPanels = normalizePanelInstances(next.panelInstances, next, timestamp);
  let normalizedLayout = normalizeLayoutNode(next.layout, normalizedPanels);
  let panelInstances = normalizedPanels;

  if (normalizedLayout && isLegacyThreeColumnDockLayout(normalizedLayout, panelInstances)) {
    const docking = createDefaultDockingState(next.activeDocumentId, timestamp, panelInstances);
    normalizedLayout = docking.layout;
    panelInstances = docking.panelInstances;
    next.lastFocusedEditorPanelId = docking.lastFocusedEditorPanelId;
    next.lastFocusedTerminalPanelId = docking.lastFocusedTerminalPanelId;
  }

  if (!normalizedLayout || !layoutContainsPanelKind(normalizedLayout, panelInstances, "editor")) {
    const docking = createDefaultDockingState(next.activeDocumentId, timestamp, panelInstances);
    normalizedLayout = docking.layout;
    panelInstances = docking.panelInstances;
    next.lastFocusedEditorPanelId = docking.lastFocusedEditorPanelId;
    next.lastFocusedTerminalPanelId = docking.lastFocusedTerminalPanelId;
  } else {
    const referencedPanelIds = new Set(collectLayoutPanelIds(normalizedLayout));
    panelInstances = Object.fromEntries(
      Object.entries(panelInstances).filter(([panelId]) => referencedPanelIds.has(panelId)),
    );
  }

  next.layout = normalizedLayout;
  next.panelInstances = panelInstances;

  if (!next.lastFocusedEditorPanelId || !panelInstances[next.lastFocusedEditorPanelId]) {
    next.lastFocusedEditorPanelId = getPanelInstancesByKind({ ...next, panelInstances }, "editor")[0]?.id ?? null;
  }

  if (!next.lastFocusedTerminalPanelId || !panelInstances[next.lastFocusedTerminalPanelId]) {
    next.lastFocusedTerminalPanelId = getPanelInstancesByKind({ ...next, panelInstances }, "terminal")[0]?.id ?? null;
  }

  const activeEditor = next.lastFocusedEditorPanelId ? next.panelInstances[next.lastFocusedEditorPanelId] : null;
  if (activeEditor?.kind === "editor") {
    next.activeDocumentId = activeEditor.activeDocumentId;
  }

  return next;
}

function migrateWorkspaceStateV1(raw: unknown, now?: string): WorkspaceState | null {
  const legacy = validateWorkspaceStateV1(raw);
  if (!legacy) {
    return null;
  }

  const timestamp = now ?? new Date().toISOString();
  const docking = createDefaultDockingState(legacy.activeDocumentId, timestamp);
  return normalizeWorkspace({
    version: WORKSPACE_VERSION,
    rootFolderId: legacy.rootFolderId,
    activeDocumentId: legacy.activeDocumentId,
    nodes: cloneNodes(legacy.nodes),
    expandedFolderIds: [...(legacy.expandedFolderIds ?? [])],
    recentDocumentIds: [...(legacy.recentDocumentIds ?? [])],
    virtualFiles:
      isLegacyWorkspaceSnapshot(raw) && raw.virtualFiles ? coerceVirtualFiles(raw.virtualFiles) : {},
    panelInstances: docking.panelInstances,
    layout: docking.layout,
    lastFocusedEditorPanelId: docking.lastFocusedEditorPanelId,
    lastFocusedTerminalPanelId: docking.lastFocusedTerminalPanelId,
  });
}

function validateWorkspaceStateV1(raw: unknown): WorkspaceStateV1 | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<WorkspaceStateV1>;
  if (candidate.version !== 1) {
    return null;
  }

  if (
    typeof candidate.rootFolderId !== "string" ||
    typeof candidate.activeDocumentId !== "string" ||
    !candidate.nodes ||
    typeof candidate.nodes !== "object"
  ) {
    return null;
  }

  const nodes = candidate.nodes as Record<string, WorkspaceNode>;
  const rootNode = nodes[candidate.rootFolderId];
  const activeNode = nodes[candidate.activeDocumentId];
  if (!rootNode || rootNode.type !== "folder" || !activeNode || activeNode.type !== "document") {
    return null;
  }

  const normalizedNodes: Record<string, WorkspaceNode> = {};
  for (const [id, node] of Object.entries(nodes)) {
    if (!isWorkspaceNode(node)) {
      return null;
    }
    normalizedNodes[id] = node;
  }

  return {
    version: 1,
    rootFolderId: candidate.rootFolderId,
    activeDocumentId: candidate.activeDocumentId,
    nodes: normalizedNodes,
    expandedFolderIds: Array.isArray(candidate.expandedFolderIds) ? candidate.expandedFolderIds.filter(isString) : [],
    recentDocumentIds: Array.isArray(candidate.recentDocumentIds) ? candidate.recentDocumentIds.filter(isString) : [],
  };
}

function normalizePanelInstances(
  panelInstances: Record<string, WorkspacePanelInstance>,
  state: WorkspaceState,
  now: string,
): Record<string, WorkspacePanelInstance> {
  const normalized: Record<string, WorkspacePanelInstance> = {};
  for (const panel of Object.values(panelInstances)) {
    const base = {
      id: panel.id,
      kind: panel.kind,
      createdAt: panel.createdAt || now,
      updatedAt: panel.updatedAt || now,
    };

    if (panel.kind === "editor") {
      const openDocumentIds = uniqueIds(panel.openDocumentIds.filter((documentId) => state.nodes[documentId]?.type === "document"));
      const resolvedOpenDocumentIds = openDocumentIds.length > 0 ? openDocumentIds : [state.activeDocumentId];
      normalized[panel.id] = {
        ...base,
        kind: "editor",
        openDocumentIds: resolvedOpenDocumentIds,
        activeDocumentId: resolvedOpenDocumentIds.includes(panel.activeDocumentId)
          ? panel.activeDocumentId
          : resolvedOpenDocumentIds[0],
      };
      continue;
    }

    if (panel.kind === "files") {
      normalized[panel.id] = {
        ...base,
        kind: "files",
        selectedFileName:
          panel.selectedFileName && state.virtualFiles[panel.selectedFileName]
            ? panel.selectedFileName
            : getFirstVirtualFileName(state.virtualFiles),
      };
      continue;
    }

    normalized[panel.id] = base as WorkspacePanelInstance;
  }
  return normalized;
}

function normalizeLayoutNode(
  node: WorkspaceLayoutNode,
  panelInstances: Record<string, WorkspacePanelInstance>,
): WorkspaceLayoutNode | null {
  if (node.type === "stack") {
    const seen = new Set<string>();
    const panelIds = node.panelIds.filter((panelId) => {
      if (!panelInstances[panelId] || seen.has(panelId)) {
        return false;
      }
      seen.add(panelId);
      return true;
    });
    if (panelIds.length === 0) {
      return null;
    }
    return {
      ...node,
      panelIds,
      activePanelId: panelIds.includes(node.activePanelId ?? "") ? node.activePanelId : panelIds[0],
    };
  }

  const children = node.children
    .map((child) => normalizeLayoutNode(child, panelInstances))
    .filter((child): child is WorkspaceLayoutNode => !!child);

  if (children.length === 0) {
    return null;
  }

  if (children.length === 1) {
    return children[0];
  }

  const flattenedChildren: WorkspaceLayoutNode[] = [];
  for (const child of children) {
    if (child.type === "split" && child.axis === node.axis) {
      flattenedChildren.push(...child.children);
      continue;
    }
    flattenedChildren.push(child);
  }

  return {
    ...node,
    children: flattenedChildren,
    sizes: normalizeSplitSizes(node.sizes, flattenedChildren.length),
  };
}

function createDefaultDockingState(
  activeDocumentId: string,
  now: string,
  existingPanels?: Record<string, WorkspacePanelInstance>,
): Pick<WorkspaceState, "panelInstances" | "layout" | "lastFocusedEditorPanelId" | "lastFocusedTerminalPanelId"> {
  const explorer =
    Object.values(existingPanels ?? {}).find((panel) => panel.kind === "explorer") ??
    ({
      id: DEFAULT_EXPLORER_PANEL_ID,
      kind: "explorer",
      createdAt: now,
      updatedAt: now,
    } as WorkspaceExplorerPanelInstance);

  const editor =
    Object.values(existingPanels ?? {}).find((panel) => panel.kind === "editor") ??
    ({
      id: DEFAULT_EDITOR_PANEL_ID,
      kind: "editor",
      openDocumentIds: [activeDocumentId],
      activeDocumentId,
      createdAt: now,
      updatedAt: now,
    } as WorkspaceEditorPanelInstance);

  const terminal =
    Object.values(existingPanels ?? {}).find((panel) => panel.kind === "terminal") ??
    ({
      id: DEFAULT_TERMINAL_PANEL_ID,
      kind: "terminal",
      createdAt: now,
      updatedAt: now,
    } as WorkspaceTerminalPanelInstance);

  const diagnostics =
    Object.values(existingPanels ?? {}).find((panel) => panel.kind === "diagnostics") ??
    ({
      id: DEFAULT_DIAGNOSTICS_PANEL_ID,
      kind: "diagnostics",
      createdAt: now,
      updatedAt: now,
    } as WorkspaceDiagnosticsPanelInstance);

  const files =
    Object.values(existingPanels ?? {}).find((panel) => panel.kind === "files") ??
    ({
      id: DEFAULT_FILES_PANEL_ID,
      kind: "files",
      createdAt: now,
      updatedAt: now,
    } as WorkspaceFilesPanelInstance);

  return {
    panelInstances: {
      [explorer.id]: explorer,
      [editor.id]: editor.kind === "editor" ? { ...editor, openDocumentIds: [activeDocumentId], activeDocumentId } : editor,
      [terminal.id]: terminal,
      [diagnostics.id]: diagnostics,
      [files.id]: files,
    },
    layout: {
      id: DEFAULT_ROOT_SPLIT_ID,
      type: "split",
      axis: "horizontal",
      sizes: [0.24, 0.76],
      children: [
        {
          id: DEFAULT_EXPLORER_STACK_ID,
          type: "stack",
          panelIds: [explorer.id],
          activePanelId: explorer.id,
        },
        {
          id: DEFAULT_MAIN_SPLIT_ID,
          type: "split",
          axis: "vertical",
          sizes: [0.7, 0.3],
          children: [
            {
              id: DEFAULT_EDITOR_STACK_ID,
              type: "stack",
              panelIds: [editor.id],
              activePanelId: editor.id,
            },
            {
              id: DEFAULT_UTILITY_STACK_ID,
              type: "stack",
              panelIds: [terminal.id, diagnostics.id, files.id],
              activePanelId: terminal.id,
            },
          ],
        },
      ],
    },
    lastFocusedEditorPanelId: editor.id,
    lastFocusedTerminalPanelId: terminal.id,
  };
}

function isLegacyThreeColumnDockLayout(
  layout: WorkspaceLayoutNode,
  panelInstances: Record<string, WorkspacePanelInstance>,
): boolean {
  if (layout.type !== "split" || layout.axis !== "horizontal" || layout.children.length !== 3) {
    return false;
  }

  const [explorerNode, editorNode, utilityNode] = layout.children;
  if (
    explorerNode.type !== "stack" ||
    editorNode.type !== "stack" ||
    utilityNode.type !== "stack" ||
    explorerNode.panelIds.length !== 1 ||
    editorNode.panelIds.length !== 1
  ) {
    return false;
  }

  return (
    panelInstances[explorerNode.panelIds[0]]?.kind === "explorer" &&
    panelInstances[editorNode.panelIds[0]]?.kind === "editor" &&
    utilityNode.panelIds.some((panelId) => panelInstances[panelId]?.kind === "terminal")
  );
}

function createPanelInstance(state: WorkspaceState, kind: WorkspacePanelKind, now: string): WorkspacePanelInstance {
  const id = createPanelId(kind, now);
  if (kind === "editor") {
    return {
      id,
      kind,
      openDocumentIds: [state.activeDocumentId],
      activeDocumentId: state.activeDocumentId,
      createdAt: now,
      updatedAt: now,
    };
  }

  if (kind === "files") {
    return {
      id,
      kind,
      selectedFileName: getFirstVirtualFileName(state.virtualFiles),
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    id,
    kind,
    createdAt: now,
    updatedAt: now,
  } as WorkspacePanelInstance;
}

function cloneState(state: WorkspaceState): WorkspaceState {
  return {
    ...state,
    nodes: cloneNodes(state.nodes),
    expandedFolderIds: [...(state.expandedFolderIds ?? [])],
    recentDocumentIds: [...(state.recentDocumentIds ?? [])],
    virtualFiles: cloneVirtualFiles(state.virtualFiles),
    panelInstances: clonePanelInstances(state.panelInstances),
    layout: cloneLayoutNode(state.layout),
  };
}

function cloneNodes(nodes: Record<string, WorkspaceNode>): Record<string, WorkspaceNode> {
  return Object.fromEntries(Object.entries(nodes).map(([id, node]) => [id, { ...node }]));
}

function cloneVirtualFiles(virtualFiles: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(virtualFiles ?? {}).map(([fileName, lines]) => [fileName, Array.isArray(lines) ? [...lines] : []]),
  );
}

function clonePanelInstances(
  panelInstances: Record<string, WorkspacePanelInstance>,
): Record<string, WorkspacePanelInstance> {
  return Object.fromEntries(
    Object.entries(panelInstances).map(([panelId, panel]) => {
      if (panel.kind === "editor") {
        return [panelId, { ...panel, openDocumentIds: [...panel.openDocumentIds] }];
      }
      if (panel.kind === "files") {
        return [panelId, { ...panel }];
      }
      return [panelId, { ...panel }];
    }),
  );
}

function cloneLayoutNode(node: WorkspaceLayoutNode): WorkspaceLayoutNode {
  if (node.type === "stack") {
    return {
      ...node,
      panelIds: [...node.panelIds],
    };
  }

  return {
    ...node,
    sizes: [...node.sizes],
    children: node.children.map(cloneLayoutNode),
  };
}

function reassignOrders(state: WorkspaceState, folderId: string, moveNodeId?: string, moveIndex?: number) {
  const siblings = Object.values(state.nodes)
    .filter((node) => node.parentId === folderId)
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));

  let ordered = siblings;
  if (moveNodeId) {
    const moving = siblings.find((node) => node.id === moveNodeId) ?? state.nodes[moveNodeId];
    const remaining = siblings.filter((node) => node.id !== moveNodeId);
    const insertIndex = clampIndex(moveIndex ?? remaining.length, remaining.length);
    ordered = [...remaining.slice(0, insertIndex), moving, ...remaining.slice(insertIndex)];
  }

  ordered.forEach((node, index) => {
    state.nodes[node.id] = {
      ...node,
      order: index,
    } as WorkspaceNode;
  });
}

function reorderPanelInStack(
  state: WorkspaceState,
  stackId: string,
  panelId: string,
  targetIndex?: number,
  now?: string,
): WorkspaceState {
  const stack = findStackById(state, stackId);
  if (!stack) {
    return state;
  }

  const next = cloneState(state);
  next.layout = updateLayoutNode(next.layout, stackId, (node) => {
    if (!node || node.type !== "stack") {
      return node;
    }
    const remaining = node.panelIds.filter((id) => id !== panelId);
    const insertIndex = clampIndex(targetIndex ?? remaining.length, remaining.length);
    const panelIds = [...remaining.slice(0, insertIndex), panelId, ...remaining.slice(insertIndex)];
    return {
      ...node,
      panelIds,
      activePanelId: panelId,
    };
  });

  return normalizeWorkspace(next, now);
}

function updateLayoutNode(
  node: WorkspaceLayoutNode,
  nodeId: string,
  updater: (node: WorkspaceLayoutNode | null) => WorkspaceLayoutNode | null,
): WorkspaceLayoutNode {
  if (node.id === nodeId) {
    return updater(node) ?? node;
  }

  if (node.type === "stack") {
    return node;
  }

  return {
    ...node,
    children: node.children.map((child) => updateLayoutNode(child, nodeId, updater)),
  };
}

function setStackActivePanel(layout: WorkspaceLayoutNode, stackId: string | null, panelId: string): WorkspaceLayoutNode {
  if (!stackId) {
    return layout;
  }
  return updateLayoutNode(layout, stackId, (node) => {
    if (!node || node.type !== "stack") {
      return node;
    }
    if (!node.panelIds.includes(panelId)) {
      return node;
    }
    return {
      ...node,
      activePanelId: panelId,
    };
  });
}

function removePanelFromLayout(node: WorkspaceLayoutNode, panelId: string): WorkspaceLayoutNode | null {
  if (node.type === "stack") {
    const panelIds = node.panelIds.filter((id) => id !== panelId);
    if (panelIds.length === 0) {
      return null;
    }
    return {
      ...node,
      panelIds,
      activePanelId: panelIds.includes(node.activePanelId ?? "") ? node.activePanelId : panelIds[0],
    };
  }

  const children = node.children
    .map((child) => removePanelFromLayout(child, panelId))
    .filter((child): child is WorkspaceLayoutNode => !!child);

  if (children.length === 0) {
    return null;
  }

  if (children.length === 1) {
    return children[0];
  }

  return {
    ...node,
    children,
    sizes: normalizeSplitSizes(node.sizes, children.length),
  };
}

function insertPanelIntoStack(
  node: WorkspaceLayoutNode,
  targetStackId: string,
  panelId: string,
  targetIndex?: number,
): WorkspaceLayoutNode | null {
  if (node.type === "stack") {
    if (node.id !== targetStackId) {
      return node;
    }
    const remaining = node.panelIds.filter((id) => id !== panelId);
    const insertIndex = clampIndex(targetIndex ?? remaining.length, remaining.length);
    return {
      ...node,
      panelIds: [...remaining.slice(0, insertIndex), panelId, ...remaining.slice(insertIndex)],
      activePanelId: panelId,
    };
  }

  return {
    ...node,
    children: node.children.map((child) => insertPanelIntoStack(child, targetStackId, panelId, targetIndex) ?? child),
  };
}

function insertPanelBesideStack(
  node: WorkspaceLayoutNode,
  targetStackId: string,
  panelId: string,
  position: Exclude<WorkspaceDockPosition, "center">,
  panelKind: WorkspacePanelKind,
  now: string,
): WorkspaceLayoutNode | null {
  if (node.type === "stack") {
    if (node.id !== targetStackId) {
      return node;
    }

    const newStack: WorkspaceLayoutStackNode = {
      id: createLayoutNodeId("stack", now),
      type: "stack",
      panelIds: [panelId],
      activePanelId: panelId,
    };
    const axis: WorkspaceLayoutAxis = position === "left" || position === "right" ? "horizontal" : "vertical";
    const [leading, trailing] =
      position === "left" || position === "top" ? [newStack, node] : [node, newStack];

    return {
      id: createLayoutNodeId("split", now),
      type: "split",
      axis,
      sizes: getDefaultSplitSizesForPanel(panelKind, position),
      children: [leading, trailing],
    };
  }

  return {
    ...node,
    children: node.children.map((child) =>
      insertPanelBesideStack(child, targetStackId, panelId, position, panelKind, now) ?? child,
    ),
  };
}

function findStackNode(node: WorkspaceLayoutNode, stackId: string): WorkspaceLayoutStackNode | null {
  if (node.type === "stack") {
    return node.id === stackId ? node : null;
  }

  for (const child of node.children) {
    const found = findStackNode(child, stackId);
    if (found) {
      return found;
    }
  }
  return null;
}

function findStackContainingPanelNode(node: WorkspaceLayoutNode, panelId: string): WorkspaceLayoutStackNode | null {
  if (node.type === "stack") {
    return node.panelIds.includes(panelId) ? node : null;
  }

  for (const child of node.children) {
    const found = findStackContainingPanelNode(child, panelId);
    if (found) {
      return found;
    }
  }
  return null;
}

function getPrimaryEditorStackId(state: WorkspaceState): string | null {
  const panelId = resolveEditorPanelId(state);
  return panelId ? getStackContainingPanel(state, panelId)?.id ?? null : null;
}

function getAnyStackId(node: WorkspaceLayoutNode): string | null {
  if (node.type === "stack") {
    return node.id;
  }
  for (const child of node.children) {
    const found = getAnyStackId(child);
    if (found) {
      return found;
    }
  }
  return null;
}

function findFirstUtilityStackId(
  node: WorkspaceLayoutNode,
  panelInstances: Record<string, WorkspacePanelInstance>,
): string | null {
  if (node.type === "stack") {
    const utilityPanel = node.panelIds
      .map((panelId) => panelInstances[panelId])
      .find((panel) => panel && panel.kind !== "editor" && panel.kind !== "explorer");
    return utilityPanel ? node.id : null;
  }
  for (const child of node.children) {
    const found = findFirstUtilityStackId(child, panelInstances);
    if (found) {
      return found;
    }
  }
  return null;
}

function collectLayoutPanelIds(node: WorkspaceLayoutNode): string[] {
  if (node.type === "stack") {
    return [...node.panelIds];
  }
  return node.children.flatMap(collectLayoutPanelIds);
}

function layoutContainsPanelKind(
  node: WorkspaceLayoutNode,
  panelInstances: Record<string, WorkspacePanelInstance>,
  kind: WorkspacePanelKind,
): boolean {
  return collectLayoutPanelIds(node).some((panelId) => panelInstances[panelId]?.kind === kind);
}

function resolveEditorPanelId(state: WorkspaceState): string | null {
  if (state.lastFocusedEditorPanelId && state.panelInstances[state.lastFocusedEditorPanelId]?.kind === "editor") {
    return state.lastFocusedEditorPanelId;
  }
  return getPanelInstancesByKind(state, "editor")[0]?.id ?? null;
}

function attachDocumentToPreferredEditor(state: WorkspaceState, documentId: string, now: string): WorkspaceState {
  const editorPanelId = resolveEditorPanelId(state);
  if (!editorPanelId) {
    return state;
  }
  return openDocumentInEditorPanel(state, editorPanelId, documentId, now);
}

function resolveFallbackDocumentId(state: WorkspaceState, excludingDocumentId?: string): string {
  const availableDocuments = listDocuments(state).filter((document) => document.id !== excludingDocumentId);
  return availableDocuments[0]?.id ?? state.activeDocumentId;
}

function getPanelOrThrow(state: WorkspaceState, panelId: string): WorkspacePanelInstance {
  const panel = state.panelInstances[panelId];
  if (!panel) {
    throw new Error(`Unknown panel "${panelId}".`);
  }
  return panel;
}

function getDocumentOrThrow(state: WorkspaceState, documentId: string): WorkspaceDocumentNode {
  const document = state.nodes[documentId];
  if (!document || document.type !== "document") {
    throw new Error(`Unknown document "${documentId}".`);
  }
  return document;
}

function getNodeOrThrow(state: WorkspaceState, nodeId: string): WorkspaceNode {
  const node = state.nodes[nodeId];
  if (!node) {
    throw new Error(`Unknown workspace node "${nodeId}".`);
  }
  return node;
}

function getFolderOrThrow(state: WorkspaceState, nodeId: string): WorkspaceFolderNode {
  const node = getNodeOrThrow(state, nodeId);
  if (node.type !== "folder") {
    throw new Error("Only folders can contain children.");
  }
  return node;
}

function getNextOrder(state: WorkspaceState, parentId: string): number {
  return getChildNodes(state, parentId).length;
}

function touchFolder(state: WorkspaceState, folderId: string, updatedAt: string) {
  const folder = state.nodes[folderId];
  if (folder?.type !== "folder") {
    return;
  }
  state.nodes[folderId] = {
    ...folder,
    updatedAt,
  };
}

function resolveSiblingName(
  state: WorkspaceState,
  parentId: string,
  proposedName: string,
  preserveId?: string,
): string {
  const normalized = proposedName.trim() || "Untitled";
  const siblings = getChildNodes(state, parentId)
    .filter((node) => node.id !== preserveId)
    .map((node) => node.name.toLowerCase());

  if (!siblings.includes(normalized.toLowerCase())) {
    return normalized;
  }

  const extensionIndex = normalized.lastIndexOf(".");
  const hasExtension = extensionIndex > 0;
  const baseName = hasExtension ? normalized.slice(0, extensionIndex) : normalized;
  const extension = hasExtension ? normalized.slice(extensionIndex) : "";

  let suffix = 2;
  while (siblings.includes(`${baseName} ${suffix}${extension}`.toLowerCase())) {
    suffix += 1;
  }

  return `${baseName} ${suffix}${extension}`;
}

function normalizeDocumentName(name: string): string {
  if (!name) {
    return NEW_DOCUMENT_BASENAME;
  }
  return name.endsWith(".pseudo") ? name : `${name}.pseudo`;
}

function collectDescendantIds(state: WorkspaceState, parentId: string, target: Set<string>) {
  for (const child of Object.values(state.nodes)) {
    if (child.parentId !== parentId) {
      continue;
    }
    target.add(child.id);
    if (child.type === "folder") {
      collectDescendantIds(state, child.id, target);
    }
  }
}

function countRemainingDocuments(state: WorkspaceState, removedIds: Set<string>): number {
  return Object.values(state.nodes).filter((node) => node.type === "document" && !removedIds.has(node.id)).length;
}

function collapseNodeIds(state: WorkspaceState, nodeIds: string[]): string[] {
  const uniqueNodeIds = uniqueIds(nodeIds);
  return uniqueNodeIds.filter((nodeId) => {
    const node = getNodeOrThrow(state, nodeId);
    if (node.id === state.rootFolderId) {
      return true;
    }

    return !uniqueNodeIds.some((candidateId) => {
      if (candidateId === nodeId) {
        return false;
      }
      const candidate = getNodeOrThrow(state, candidateId);
      return candidate.type === "folder" && isDescendantOf(state, nodeId, candidateId);
    });
  });
}

function isDescendantOf(state: WorkspaceState, nodeId: string, ancestorId: string): boolean {
  let current = state.nodes[nodeId];
  while (current?.parentId) {
    if (current.parentId === ancestorId) {
      return true;
    }
    current = state.nodes[current.parentId];
  }
  return false;
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}

function createNodeId(prefix: "folder" | "document", now: string): string {
  return `${prefix}-${now.replace(/[^0-9]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createPanelId(kind: WorkspacePanelKind, now: string): string {
  return `panel-${kind}-${now.replace(/[^0-9]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createLayoutNodeId(prefix: "stack" | "split", now: string): string {
  return `${prefix}-${now.replace(/[^0-9]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`;
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function getDefaultSplitSizesForPanel(
  panelKind: WorkspacePanelKind,
  position: Exclude<WorkspaceDockPosition, "center">,
): number[] {
  if (panelKind === "explorer" || panelKind === "files") {
    return position === "left" || position === "top" ? [0.24, 0.76] : [0.76, 0.24];
  }
  if (panelKind === "terminal" || panelKind === "diagnostics") {
    return position === "left" || position === "top" ? [0.32, 0.68] : [0.68, 0.32];
  }
  return [0.5, 0.5];
}

function normalizeSplitSizes(sizes: number[], childCount: number): number[] {
  if (childCount <= 0) {
    return [];
  }

  const normalized = sizes
    .slice(0, childCount)
    .map((size) => (typeof size === "number" && Number.isFinite(size) && size > 0 ? size : 1));

  while (normalized.length < childCount) {
    normalized.push(1);
  }

  const total = normalized.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return Array.from({ length: childCount }, () => 1 / childCount);
  }

  return normalized.map((value) => value / total);
}

function getFirstVirtualFileName(virtualFiles: Record<string, string[]>): string | undefined {
  return Object.keys(virtualFiles).sort()[0];
}

function isLegacyWorkspaceSnapshot(raw: unknown): raw is LegacyWorkspaceSnapshot {
  return !!raw && typeof raw === "object";
}

function isWorkspaceNode(raw: unknown): raw is WorkspaceNode {
  if (!raw || typeof raw !== "object") {
    return false;
  }

  const candidate = raw as WorkspaceNode;
  if (
    typeof candidate.id !== "string" ||
    (candidate.parentId !== null && typeof candidate.parentId !== "string") ||
    typeof candidate.name !== "string" ||
    typeof candidate.order !== "number" ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.updatedAt !== "string"
  ) {
    return false;
  }

  if (candidate.type === "folder") {
    return true;
  }

  return typeof candidate.source === "string";
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function coerceLayoutNode(raw: unknown): WorkspaceLayoutNode | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const candidate = raw as Partial<WorkspaceLayoutNode>;
  if (candidate.type === "stack") {
    if (typeof candidate.id !== "string" || !Array.isArray(candidate.panelIds)) {
      return null;
    }
    const panelIds = candidate.panelIds.filter(isString);
    return {
      id: candidate.id,
      type: "stack",
      panelIds,
      activePanelId: typeof candidate.activePanelId === "string" ? candidate.activePanelId : panelIds[0] ?? null,
    };
  }

  if (candidate.type === "split") {
    if (
      typeof candidate.id !== "string" ||
      (candidate.axis !== "horizontal" && candidate.axis !== "vertical") ||
      !Array.isArray(candidate.children)
    ) {
      return null;
    }
    const children = candidate.children
      .map((child) => coerceLayoutNode(child))
      .filter((child): child is WorkspaceLayoutNode => !!child);
    if (children.length === 0) {
      return null;
    }
    return {
      id: candidate.id,
      type: "split",
      axis: candidate.axis,
      sizes: normalizeSplitSizes(Array.isArray(candidate.sizes) ? candidate.sizes.filter(isFiniteNumber) : [], children.length),
      children,
    };
  }

  return null;
}

function coercePanelInstances(raw: unknown): Record<string, WorkspacePanelInstance> | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const panelInstances: Record<string, WorkspacePanelInstance> = {};
  for (const [panelId, panel] of Object.entries(raw as Record<string, unknown>)) {
    const coerced = coercePanelInstance(panelId, panel);
    if (!coerced) {
      return null;
    }
    panelInstances[panelId] = coerced;
  }
  return panelInstances;
}

function coercePanelInstance(panelId: string, raw: unknown): WorkspacePanelInstance | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<WorkspacePanelInstance>;
  if (typeof candidate.id !== "string" || candidate.id !== panelId || typeof candidate.createdAt !== "string" || typeof candidate.updatedAt !== "string") {
    return null;
  }

  if (candidate.kind === "editor") {
    if (!Array.isArray(candidate.openDocumentIds) || typeof candidate.activeDocumentId !== "string") {
      return null;
    }
    return {
      id: candidate.id,
      kind: "editor",
      openDocumentIds: candidate.openDocumentIds.filter(isString),
      activeDocumentId: candidate.activeDocumentId,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    };
  }

  if (candidate.kind === "files") {
    return {
      id: candidate.id,
      kind: "files",
      selectedFileName: typeof candidate.selectedFileName === "string" ? candidate.selectedFileName : undefined,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    };
  }

  if (
    candidate.kind === "explorer" ||
    candidate.kind === "terminal" ||
    candidate.kind === "diagnostics"
  ) {
    return {
      id: candidate.id,
      kind: candidate.kind,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    } as WorkspacePanelInstance;
  }

  return null;
}

function coerceVirtualFiles(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([fileName, value]) => [
      fileName,
      Array.isArray(value) ? value.filter(isString) : [],
    ]),
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
