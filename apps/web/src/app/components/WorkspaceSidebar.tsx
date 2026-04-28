"use client";

import {
  DragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Folder,
  FileCode,
  File,
  FileText,
  FolderPlus,
  Plus,
} from "lucide-react";
import {
  flattenVisibleNodes,
  getChildNodes,
  type WorkspaceNode,
  type WorkspaceState,
} from "@igcse/workspace";
import packageJson from "../../../package.json";
import { supportsDesktopNativeDragAndDrop } from "@/lib/appleTouch";

interface WorkspaceSidebarProps {
  workspace: WorkspaceState;
  onSelectDocument: (documentId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onExpandFolder: (folderId: string) => void;
  onCreateFolder: (parentId?: string) => void;
  onCreateDocument: (parentId?: string) => void;
  onRenameNode: (nodeId: string) => void;
  onDeleteNodes: (nodeIds: string[]) => void;
  onMoveNodes: (nodeIds: string[], targetFolderId: string, targetIndex: number) => void;
}

type DropPosition = "before" | "after" | "inside";

interface DropHint {
  nodeId: string;
  position: DropPosition;
}

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  selection: string[];
}

interface PointerGestureState {
  pointerId: number;
  nodeId: string;
  originX: number;
  originY: number;
  readyToDrag: boolean;
}

interface SelectionModifierState {
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

const CONTEXT_MENU_WIDTH = 248;
const CONTEXT_MENU_HEIGHT = 320;
const CONTEXT_MENU_MARGIN = 14;
const EXPLORER_RELEASE_LABEL = `${packageJson.version}-Preveiw`;

const contextMenuButtonClassName =
  "block w-full appearance-none rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm transition hover:bg-[var(--hover)] disabled:cursor-not-allowed";
const contextMenuDangerButtonClassName =
  "block w-full appearance-none rounded-lg border-0 bg-transparent px-3 py-2 text-left text-sm transition hover:bg-[var(--danger-hover)] disabled:cursor-not-allowed";

function getFileIcon(name: string, isActive: boolean) {
  const ext = name.split(".").pop()?.toLowerCase();
  const color = isActive ? "text-[var(--accent)]" : "text-[var(--text3)]";
  if (ext === "pseudo" || ext === "ps") {
    return <FileCode size={16} className={isActive ? "text-[var(--accent)]" : "text-[var(--accent)]"} />;
  }
  if (ext === "md" || ext === "txt") {
    return <FileText size={16} className={color} />;
  }
  return <File size={16} className={color} />;
}

function isNodeDescendantOfFolder(workspace: WorkspaceState, nodeId: string, folderId: string): boolean {
  let current = workspace.nodes[nodeId];
  while (current?.parentId) {
    if (current.parentId === folderId) {
      return true;
    }
    current = workspace.nodes[current.parentId];
  }
  return false;
}

function collapseNodeIds(workspace: WorkspaceState, nodeIds: string[]): string[] {
  const uniqueNodeIds = Array.from(new Set(nodeIds)).filter((nodeId) => !!workspace.nodes[nodeId]);
  return uniqueNodeIds.filter(
    (nodeId) =>
      !uniqueNodeIds.some((candidateId) => {
        if (candidateId === nodeId) {
          return false;
        }
        const candidate = workspace.nodes[candidateId];
        return candidate?.type === "folder" && isNodeDescendantOfFolder(workspace, nodeId, candidateId);
      }),
  );
}

function getRangeSelection(nodeIds: string[], anchorId: string, currentId: string): string[] {
  const anchorIndex = nodeIds.indexOf(anchorId);
  const currentIndex = nodeIds.indexOf(currentId);
  if (anchorIndex < 0 || currentIndex < 0) {
    return [currentId];
  }

  const start = Math.min(anchorIndex, currentIndex);
  const end = Math.max(anchorIndex, currentIndex);
  return nodeIds.slice(start, end + 1);
}

function getInitialNativeDragSupport(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const electronWindow = window as Window & { electron?: { isDesktop?: boolean } };
  const isMacDesktopShell =
    Boolean(electronWindow.electron?.isDesktop) &&
    /Mac/i.test(typeof navigator === "undefined" ? "" : navigator.platform ?? "");

  return (
    !isMacDesktopShell &&
    supportsDesktopNativeDragAndDrop(
      typeof window.matchMedia === "function" ? window.matchMedia.bind(window) : undefined,
      typeof navigator === "undefined" ? undefined : navigator,
    )
  );
}

export function WorkspaceSidebar({
  workspace,
  onSelectDocument,
  onToggleFolder,
  onExpandFolder,
  onCreateFolder,
  onCreateDocument,
  onRenameNode,
  onDeleteNodes,
  onMoveNodes,
}: WorkspaceSidebarProps) {
  const flattened = useMemo(() => flattenVisibleNodes(workspace), [workspace]);
  const visibleNodeIds = useMemo(() => flattened.map(({ node }) => node.id), [flattened]);
  const [selectionState, setSelectionState] = useState<string[]>(
    workspace.activeDocumentId ? [workspace.activeDocumentId] : [],
  );
  const [anchorState, setAnchorState] = useState<string | null>(workspace.activeDocumentId);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [supportsNativeDragAndDrop] = useState(() => getInitialNativeDragSupport());
  const draggingNodeIdsRef = useRef<string[]>([]);
  const expandHoverTimerRef = useRef<number | null>(null);
  const expandHoverFolderIdRef = useRef<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerGestureRef = useRef<PointerGestureState | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);
  const treeContainerRef = useRef<HTMLDivElement | null>(null);

  const selectedNodeIds = useMemo(() => {
    const nextSelection = visibleNodeIds.filter((nodeId) => selectionState.includes(nodeId));
    return nextSelection.length > 0 ? nextSelection : workspace.activeDocumentId ? [workspace.activeDocumentId] : [];
  }, [selectionState, visibleNodeIds, workspace.activeDocumentId]);
  const createTargetParentId = useMemo(() => {
    if (selectedNodeIds.length >= 1) {
      const selected = workspace.nodes[selectedNodeIds[0]];
      if (selected?.type === "folder") return selected.id;
      if (selected?.parentId) return selected.parentId;
    }
    return undefined;
  }, [selectedNodeIds, workspace.nodes]);
  const anchorNodeId =
    anchorState && workspace.nodes[anchorState] ? anchorState : workspace.activeDocumentId;
  const selectedNodeSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const handleClose = () => setContextMenu(null);
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    window.addEventListener("pointerdown", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("blur", handleClose);

    return () => {
      window.removeEventListener("pointerdown", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("blur", handleClose);
    };
  }, [contextMenu]);

  useEffect(
    () => () => {
      if (expandHoverTimerRef.current !== null) {
        window.clearTimeout(expandHoverTimerRef.current);
      }
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
      }
    },
    [],
  );

  const orderedSelection = useMemo(
    () => visibleNodeIds.filter((nodeId) => selectedNodeSet.has(nodeId)),
    [selectedNodeSet, visibleNodeIds],
  );

  const handleDeleteSelection = () => {
    const deletableNodeIds = collapseNodeIds(workspace, orderedSelection);
    if (deletableNodeIds.length === 0) {
      return;
    }
    onDeleteNodes(deletableNodeIds);
    setContextMenu(null);
  };

  const selectSingleNode = (node: WorkspaceNode) => {
    setSelectionState([node.id]);
    setAnchorState(node.id);
    if (node.type === "document") {
      onSelectDocument(node.id);
    }
  };

  const clearPointerGesture = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerGestureRef.current = null;
    dragPointerIdRef.current = null;
  };

  const suppressNextClick = () => {
    suppressClickRef.current = true;
    if (suppressClickTimerRef.current !== null) {
      window.clearTimeout(suppressClickTimerRef.current);
    }
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, 400);
  };

  const openContextMenuForNode = (node: WorkspaceNode, x: number, y: number) => {
    const nextSelection = selectedNodeSet.has(node.id) ? orderedSelection : [node.id];
    const maxX = Math.max(CONTEXT_MENU_MARGIN, window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN);
    const maxY = Math.max(CONTEXT_MENU_MARGIN, window.innerHeight - CONTEXT_MENU_HEIGHT - CONTEXT_MENU_MARGIN);
    const clampedX = Math.min(Math.max(x, CONTEXT_MENU_MARGIN), maxX);
    const clampedY = Math.min(Math.max(y, CONTEXT_MENU_MARGIN), maxY);

    setSelectionState(nextSelection);
    setAnchorState(node.id);
    setContextMenu({
      x: clampedX,
      y: clampedY,
      nodeId: node.id,
      selection: nextSelection,
    });
  };

  const handleNodeSelection = (node: WorkspaceNode, modifiers: SelectionModifierState) => {
    setContextMenu(null);

    if (modifiers.shiftKey && anchorNodeId) {
      setSelectionState(getRangeSelection(visibleNodeIds, anchorNodeId, node.id));
      return;
    }

    if (modifiers.metaKey || modifiers.ctrlKey) {
      setSelectionState((currentSelection) => {
        const nextSelection = currentSelection.includes(node.id)
          ? currentSelection.filter((currentNodeId) => currentNodeId !== node.id)
          : visibleNodeIds.filter((nodeId) => nodeId === node.id || currentSelection.includes(nodeId));
        return nextSelection.length > 0 ? nextSelection : [node.id];
      });
      setAnchorState(node.id);
      return;
    }

    selectSingleNode(node);
  };

  const handleNodeClick = (event: MouseEvent<HTMLElement>, node: WorkspaceNode) => {
    event.stopPropagation();

    if (suppressClickRef.current) {
      event.preventDefault();
      return;
    }

    handleNodeSelection(node, {
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
    });
  };

  const handleNodeDoubleClick = (node: WorkspaceNode) => {
    if (node.type === "folder") {
      onToggleFolder(node.id);
      return;
    }
    onSelectDocument(node.id);
  };

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>, node: WorkspaceNode) => {
    event.preventDefault();
    event.stopPropagation();
    clearPointerGesture();
    openContextMenuForNode(node, event.clientX, event.clientY);
  };

  const deriveDropPositionFromBounds = (
    clientY: number,
    bounds: DOMRect,
    targetNode: WorkspaceNode,
  ): DropPosition => {
    if (targetNode.type === "folder") {
      if (clientY === 0 || bounds.height === 0) {
        return "inside";
      }

      const offset = clientY - bounds.top;
      const edgeThreshold = Math.min(8, bounds.height * 0.18);
      if (offset <= edgeThreshold) {
        return "before";
      }
      if (offset >= bounds.height - edgeThreshold) {
        return "after";
      }
      return "inside";
    }

    return clientY - bounds.top < bounds.height / 2 ? "before" : "after";
  };

  const canDropOnNode = (targetNodeId: string, draggedNodeIds: string[]) => {
    const draggingNodeSet = new Set(draggedNodeIds);
    if (draggingNodeSet.has(targetNodeId)) {
      return false;
    }

    return !draggedNodeIds.some((draggedNodeId) => {
      const draggedNode = workspace.nodes[draggedNodeId];
      return draggedNode?.type === "folder" && isNodeDescendantOfFolder(workspace, targetNodeId, draggedNodeId);
    });
  };

  const resolvePointDropHint = (clientX: number, clientY: number, draggedNodeIds: string[]): DropHint | null => {
    const rowElement = document.elementFromPoint(clientX, clientY)?.closest("[data-workspace-row-id]") as HTMLElement | null;
    const targetNodeId = rowElement?.dataset.workspaceRowId;
    if (targetNodeId) {
      const targetNode = workspace.nodes[targetNodeId];
      if (targetNode && canDropOnNode(targetNode.id, draggedNodeIds)) {
        if (targetNode.type === "folder") {
          scheduleFolderExpand(targetNode.id);
        }
        return {
          nodeId: targetNode.id,
          position: deriveDropPositionFromBounds(
            clientY,
            rowElement.getBoundingClientRect(),
            targetNode,
          ),
        };
      }
    }

    const treeBounds = treeContainerRef.current?.getBoundingClientRect();
    if (
      treeBounds &&
      clientX >= treeBounds.left &&
      clientX <= treeBounds.right &&
      clientY >= treeBounds.top &&
      clientY <= treeBounds.bottom
    ) {
      return {
        nodeId: workspace.rootFolderId,
        position: "inside",
      };
    }

    return null;
  };

  const startPointerDrag = (nodeId: string, pointerId: number) => {
    const draggedNodeIds = resolveDraggedNodeIds(nodeId);
    if (draggedNodeIds.length === 0) {
      return;
    }

    setSelectionState(draggedNodeIds);
    setAnchorState(nodeId);
    setContextMenu(null);
    draggingNodeIdsRef.current = draggedNodeIds;
    dragPointerIdRef.current = pointerId;
    pointerGestureRef.current = null;
    suppressNextClick();
  };

  const handlePointerDrop = (clientX: number, clientY: number) => {
    const draggedNodeIds = draggingNodeIdsRef.current;
    if (draggedNodeIds.length === 0) {
      clearDragState();
      return;
    }

    const resolvedHint = resolvePointDropHint(clientX, clientY, draggedNodeIds);
    if (!resolvedHint) {
      clearDragState();
      return;
    }

    if (resolvedHint.nodeId === workspace.rootFolderId) {
      const draggingNodeSet = new Set(draggedNodeIds);
      const children = getChildNodes(workspace, workspace.rootFolderId).filter((child) => !draggingNodeSet.has(child.id));
      onMoveNodes(draggedNodeIds, workspace.rootFolderId, children.length);
      clearDragState();
      return;
    }

    const targetNode = workspace.nodes[resolvedHint.nodeId];
    if (!targetNode || !canDropOnNode(targetNode.id, draggedNodeIds)) {
      clearDragState();
      return;
    }

    const target = deriveTarget(draggedNodeIds, targetNode, resolvedHint.position);
    onMoveNodes(draggedNodeIds, target.targetFolderId, target.targetIndex);
    clearDragState();
  };

  const handleRowPointerDown = (event: ReactPointerEvent<HTMLDivElement>, node: WorkspaceNode) => {
    if (event.pointerType === "mouse") {
      if (supportsNativeDragAndDrop || event.button !== 0) {
        return;
      }

      clearPointerGesture();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pointerGestureRef.current = {
        pointerId: event.pointerId,
        nodeId: node.id,
        originX: event.clientX,
        originY: event.clientY,
        readyToDrag: true,
      };
      return;
    }

    clearPointerGesture();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerGestureRef.current = {
      pointerId: event.pointerId,
      nodeId: node.id,
      originX: event.clientX,
      originY: event.clientY,
      readyToDrag: false,
    };
    longPressTimerRef.current = window.setTimeout(() => {
      const gesture = pointerGestureRef.current;
      longPressTimerRef.current = null;
      if (!gesture || gesture.pointerId !== event.pointerId || gesture.nodeId !== node.id) {
        return;
      }
      pointerGestureRef.current = {
        ...gesture,
        readyToDrag: true,
      };
    }, 420);
  };

  const handleRowPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current === event.pointerId) {
      event.preventDefault();
      setDropHint(resolvePointDropHint(event.clientX, event.clientY, draggingNodeIdsRef.current));
      return;
    }

    const pointerGesture = pointerGestureRef.current;
    if (!pointerGesture || pointerGesture.pointerId !== event.pointerId) {
      return;
    }

    const movedPastThreshold =
      Math.abs(event.clientX - pointerGesture.originX) > 8 ||
      Math.abs(event.clientY - pointerGesture.originY) > 8;

    if (!pointerGesture.readyToDrag) {
      if (movedPastThreshold) {
        clearPointerGesture();
      }
      return;
    }

    if (movedPastThreshold) {
      event.preventDefault();
      startPointerDrag(pointerGesture.nodeId, event.pointerId);
      setDropHint(resolvePointDropHint(event.clientX, event.clientY, draggingNodeIdsRef.current));
    }
  };

  const handleRowPointerUp = (event: ReactPointerEvent<HTMLDivElement>, node: WorkspaceNode) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (dragPointerIdRef.current === event.pointerId) {
      event.preventDefault();
      handlePointerDrop(event.clientX, event.clientY);
      clearPointerGesture();
      return;
    }

    const pointerGesture = pointerGestureRef.current;
    if (
      event.pointerType !== "mouse" &&
      pointerGesture &&
      pointerGesture.pointerId === event.pointerId &&
      pointerGesture.readyToDrag
    ) {
      event.preventDefault();
      suppressNextClick();
      openContextMenuForNode(node, event.clientX, event.clientY);
    }

    clearPointerGesture();
  };

  const clearDragState = () => {
    if (expandHoverTimerRef.current !== null) {
      window.clearTimeout(expandHoverTimerRef.current);
      expandHoverTimerRef.current = null;
    }
    expandHoverFolderIdRef.current = null;
    draggingNodeIdsRef.current = [];
    dragPointerIdRef.current = null;
    setDropHint(null);
  };

  const getDraggingNodeIds = (event?: DragEvent<HTMLDivElement>): string[] => {
    if (draggingNodeIdsRef.current.length > 0) {
      return draggingNodeIdsRef.current;
    }

    const payload = event?.dataTransfer.getData("application/x-workspace-node-ids");
    if (!payload) {
      return [];
    }

    try {
      const parsed = JSON.parse(payload);
      return Array.isArray(parsed) ? parsed.filter((nodeId): nodeId is string => typeof nodeId === "string") : [];
    } catch {
      return [];
    }
  };

  const scheduleFolderExpand = (folderId: string) => {
    const expandedFolders = new Set(workspace.expandedFolderIds ?? []);
    if (expandedFolders.has(folderId)) {
      if (expandHoverTimerRef.current !== null) {
        window.clearTimeout(expandHoverTimerRef.current);
        expandHoverTimerRef.current = null;
      }
      expandHoverFolderIdRef.current = null;
      return;
    }

    if (expandHoverFolderIdRef.current === folderId) {
      return;
    }

    if (expandHoverTimerRef.current !== null) {
      window.clearTimeout(expandHoverTimerRef.current);
    }

    expandHoverFolderIdRef.current = folderId;
    expandHoverTimerRef.current = window.setTimeout(() => {
      expandHoverTimerRef.current = null;
      expandHoverFolderIdRef.current = null;
      onExpandFolder(folderId);
    }, 420);
  };

  const moveSelectionToTopLevel = (nodeIds: string[]) => {
    const collapsedNodeIds = collapseNodeIds(workspace, nodeIds);
    if (collapsedNodeIds.length === 0) {
      return;
    }

    const movingNodeSet = new Set(collapsedNodeIds);
    const rootChildren = getChildNodes(workspace, workspace.rootFolderId).filter((child) => !movingNodeSet.has(child.id));
    onMoveNodes(collapsedNodeIds, workspace.rootFolderId, rootChildren.length);
    setContextMenu(null);
  };

  const handleTreeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.key === "Delete" || event.key === "Backspace") && orderedSelection.length > 0) {
      event.preventDefault();
      handleDeleteSelection();
      return;
    }

    if (orderedSelection.length !== 1) {
      return;
    }

    const selectedNode = workspace.nodes[orderedSelection[0]];
    if (!selectedNode) {
      return;
    }

    if (event.key === "F2") {
      event.preventDefault();
      onRenameNode(selectedNode.id);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleNodeDoubleClick(selectedNode);
      return;
    }

    if (selectedNode.type !== "folder") {
      return;
    }

    const expandedFolders = new Set(workspace.expandedFolderIds ?? []);
    if (event.key === "ArrowRight" && !expandedFolders.has(selectedNode.id)) {
      event.preventDefault();
      onExpandFolder(selectedNode.id);
      return;
    }

    if (event.key === "ArrowLeft" && expandedFolders.has(selectedNode.id)) {
      event.preventDefault();
      onToggleFolder(selectedNode.id);
    }
  };

  const contextNode = contextMenu ? workspace.nodes[contextMenu.nodeId] : null;
  const contextNodeSiblings = contextNode
    ? getChildNodes(workspace, contextNode.parentId ?? workspace.rootFolderId)
    : [];
  const contextNodeIndex = contextNodeSiblings.findIndex((sibling) => sibling.id === contextNode?.id);
  const canMoveContextNodeUp = contextMenu?.selection.length === 1 && contextNodeIndex > 0;
  const canMoveContextNodeDown =
    contextMenu?.selection.length === 1 && contextNodeIndex >= 0 && contextNodeIndex < contextNodeSiblings.length - 1;

  const deriveDropPosition = (event: DragEvent<HTMLDivElement>, targetNode: WorkspaceNode): DropPosition =>
    deriveDropPositionFromBounds(event.clientY, event.currentTarget.getBoundingClientRect(), targetNode);

  const deriveTarget = (draggedNodeIds: string[], targetNode: WorkspaceNode, position: DropPosition) => {
    const draggedNodeSet = new Set(draggedNodeIds);

    if (position === "inside" && targetNode.type === "folder") {
      const children = getChildNodes(workspace, targetNode.id).filter((child) => !draggedNodeSet.has(child.id));
      return { targetFolderId: targetNode.id, targetIndex: children.length };
    }

    const parentId = targetNode.parentId ?? workspace.rootFolderId;
    const siblings = getChildNodes(workspace, parentId).filter((child) => !draggedNodeSet.has(child.id));
    const siblingIndex = siblings.findIndex((child) => child.id === targetNode.id);
    const targetIndex = position === "before" ? siblingIndex : siblingIndex + 1;
    return { targetFolderId: parentId, targetIndex };
  };

  const resolveDraggedNodeIds = (nodeId: string) => {
    const currentSelection = selectedNodeSet.has(nodeId) ? orderedSelection : [nodeId];
    return collapseNodeIds(workspace, currentSelection);
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, nodeId: string) => {
    const draggedNodeIds = resolveDraggedNodeIds(nodeId);
    setSelectionState(draggedNodeIds);
    setAnchorState(nodeId);
    draggingNodeIdsRef.current = draggedNodeIds;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-workspace-node-ids", JSON.stringify(draggedNodeIds));
    event.dataTransfer.setData("text/plain", draggedNodeIds.join(","));
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, targetNode: WorkspaceNode) => {
    const draggedNodeIds = getDraggingNodeIds(event);
    if (draggedNodeIds.length === 0 || !canDropOnNode(targetNode.id, draggedNodeIds)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    if (targetNode.type === "folder") {
      scheduleFolderExpand(targetNode.id);
    }
    setDropHint({
      nodeId: targetNode.id,
      position: deriveDropPosition(event, targetNode),
    });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetNode: WorkspaceNode) => {
    const draggedNodeIds = getDraggingNodeIds(event);
    if (draggedNodeIds.length === 0 || !canDropOnNode(targetNode.id, draggedNodeIds)) {
      clearDragState();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const resolvedPosition =
      dropHint && dropHint.nodeId === targetNode.id
        ? dropHint.position
        : deriveDropPosition(event, targetNode);
    const target = deriveTarget(draggedNodeIds, targetNode, resolvedPosition);
    onMoveNodes(draggedNodeIds, target.targetFolderId, target.targetIndex);
    clearDragState();
  };

  const handleRootDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (getDraggingNodeIds(event).length === 0) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropHint({
      nodeId: workspace.rootFolderId,
      position: "inside",
    });
  };

  const handleRootDrop = (event: DragEvent<HTMLDivElement>) => {
    const draggedNodeIds = getDraggingNodeIds(event);
    if (draggedNodeIds.length === 0) {
      clearDragState();
      return;
    }

    event.preventDefault();
    const draggingNodeSet = new Set(draggedNodeIds);
    const children = getChildNodes(workspace, workspace.rootFolderId).filter((child) => !draggingNodeSet.has(child.id));
    onMoveNodes(draggedNodeIds, workspace.rootFolderId, children.length);
    clearDragState();
  };

  const moveByOffset = (node: WorkspaceNode, offset: -1 | 1) => {
    const parentId = node.parentId ?? workspace.rootFolderId;
    const siblings = getChildNodes(workspace, parentId);
    const currentIndex = siblings.findIndex((child) => child.id === node.id);
    if (currentIndex < 0) {
      return;
    }
    const targetIndex = currentIndex + offset;
    if (targetIndex < 0 || targetIndex >= siblings.length) {
      return;
    }
    onMoveNodes([node.id], parentId, targetIndex);
  };

  return (
    <aside
      className="relative flex h-full min-h-0 flex-col bg-[var(--sidebar)]"
      onClick={() => setContextMenu(null)}
    >
      {/* Sidebar Header */}
      <div className="flex h-10 items-center gap-2 px-4">
        <div className="flex min-w-0 flex-col items-start">
          <span className="text-[11px] font-semibold tracking-[0.8px] text-[var(--text2)]">Explorer</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-7 items-center gap-1 rounded-lg px-2 text-[var(--text3)] transition hover:bg-[var(--hover)] hover:text-[var(--text2)]"
            aria-label="Create File"
            title="Create File"
            onClick={() => onCreateDocument(createTargetParentId)}
          >
            <Plus size={16} />
            <span className="text-[11px] font-medium">File</span>
          </button>
          <button
            type="button"
            className="flex h-7 items-center gap-1 rounded-lg px-2 text-[var(--text3)] transition hover:bg-[var(--hover)] hover:text-[var(--text2)]"
            aria-label="Create Folder"
            title="Create Folder"
            onClick={() => onCreateFolder(createTargetParentId)}
          >
            <FolderPlus size={16} />
            <span className="text-[11px] font-medium">Folder</span>
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div
        ref={treeContainerRef}
        className="min-h-0 flex-1 overflow-auto px-2 py-1"
        tabIndex={0}
        onKeyDown={handleTreeKeyDown}
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
      >
        <div className="space-y-px">
          {flattened.map(({ node, depth }) => {
            const isActive = node.type === "document" && node.id === workspace.activeDocumentId;
            const isSelected = selectedNodeSet.has(node.id);
            const isFolderOpen =
              node.type === "folder" && (workspace.expandedFolderIds ?? []).includes(node.id);
            const isDropTarget = dropHint?.nodeId === node.id;

            return (
              <div key={node.id}>
                {isDropTarget && dropHint.position === "before" ? (
                  <div className="ml-2 h-0.5 rounded-full bg-[var(--accent)]" />
                ) : null}

                <div
                  draggable={supportsNativeDragAndDrop}
                  data-workspace-row="true"
                  data-workspace-row-id={node.id}
                  onClick={(event) => handleNodeClick(event, node)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    handleNodeDoubleClick(node);
                  }}
                  onContextMenu={(event) => handleContextMenu(event, node)}
                  onPointerDown={(event) => handleRowPointerDown(event, node)}
                  onPointerMove={handleRowPointerMove}
                  onPointerUp={(event) => handleRowPointerUp(event, node)}
                  onPointerCancel={() => {
                    clearDragState();
                    clearPointerGesture();
                  }}
                  onDragStart={(event) => handleDragStart(event, node.id)}
                  onDragEnd={clearDragState}
                  onDragOver={(event) => handleDragOver(event, node)}
                  onDrop={(event) => handleDrop(event, node)}
                  className={`flex h-7 items-center gap-1.5 rounded-lg transition ${
                    isSelected
                      ? "bg-[var(--selected)]"
                      : isDropTarget && dropHint?.position === "inside"
                        ? "bg-[var(--selected)]"
                        : "hover:bg-[var(--hover)]"
                  }`}
                  style={{ paddingLeft: `${depth * 20 + 8}px`, paddingRight: 8 }}
                >
                  {node.type === "folder" ? (
                    <button
                      type="button"
                      className="flex h-5 w-3.5 items-center justify-center text-[var(--text3)]"
                      onPointerDown={(event) => {
                        if (event.pointerType === "mouse") {
                          event.stopPropagation();
                        }
                      }}
                      onClick={(event) => {
                        if (suppressClickRef.current) {
                          event.preventDefault();
                          return;
                        }
                        event.stopPropagation();
                        onToggleFolder(node.id);
                      }}
                      aria-label={isFolderOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
                    >
                      {isFolderOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  ) : (
                    <span className="inline-flex h-5 w-3.5" />
                  )}

                  {node.type === "folder" ? (
                    isFolderOpen ? (
                      <FolderOpen size={16} className="text-[var(--orange)]" />
                    ) : (
                      <Folder size={16} className="text-[var(--orange)]" />
                    )
                  ) : (
                    getFileIcon(node.name, isActive || isSelected)
                  )}

                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={(event) => handleNodeClick(event, node)}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      handleNodeDoubleClick(node);
                    }}
                  >
                    <span
                      className={`truncate text-[13px] ${
                        isActive || isSelected
                          ? "text-[var(--text)]"
                          : node.type === "folder" && !isFolderOpen
                            ? "text-[var(--text2)]"
                            : "text-[var(--text)]"
                      }`}
                    >
                      {node.name}
                    </span>
                  </button>
                </div>

                {isDropTarget && dropHint.position === "after" ? (
                  <div className="ml-2 h-0.5 rounded-full bg-[var(--accent)]" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex h-7 items-center border-t border-[var(--separator)] bg-[var(--surface-ghost)] px-3">
        <span className="truncate text-[10px] font-semibold tracking-[0.12em] text-[var(--text3)]">
          {EXPLORER_RELEASE_LABEL}
        </span>
      </div>

      {/* Context Menu */}
      {contextMenu ? (
        <div
          role="menu"
          aria-label="Explorer actions"
          className="fixed z-[var(--z-dropdown)] w-[248px] overflow-hidden rounded-lg border border-[var(--surface3)] bg-[var(--surface)] shadow-[var(--shadow-dropdown)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="border-b border-[var(--separator)] bg-[var(--surface2)] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
              {contextMenu.selection.length > 1
                ? `${contextMenu.selection.length} items selected`
                : contextNode?.type === "folder"
                  ? "Folder actions"
                  : "File actions"}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[var(--text)]">
              {contextMenu.selection.length > 1 ? "Batch actions" : contextNode?.name}
            </p>
          </div>
          <div className="p-1.5">
            {contextMenu.selection.length === 1 && contextNode?.type === "folder" ? (
              <>
                <button
                  type="button"
                  className={contextMenuButtonClassName}
                  style={{ color: "var(--text)" }}
                  onClick={() => {
                    onCreateDocument(contextNode.id);
                    setContextMenu(null);
                  }}
                >
                  New File Here
                </button>
                <button
                  type="button"
                  className={contextMenuButtonClassName}
                  style={{ color: "var(--text)" }}
                  onClick={() => {
                    onCreateFolder(contextNode.id);
                    setContextMenu(null);
                  }}
                >
                  New Folder Here
                </button>
                <button
                  type="button"
                  className={contextMenuButtonClassName}
                  style={{ color: "var(--text)" }}
                  onClick={() => {
                    onToggleFolder(contextNode.id);
                    setContextMenu(null);
                  }}
                >
                  {(workspace.expandedFolderIds ?? []).includes(contextNode.id) ? "Collapse Folder" : "Expand Folder"}
                </button>
                <div className="my-1 h-px bg-[var(--separator)]" />
              </>
            ) : null}
            {contextMenu.selection.length === 1 ? (
              <>
                <button
                  type="button"
                  className={contextMenuButtonClassName}
                  disabled={!canMoveContextNodeUp}
                  style={{
                    color: "var(--text)",
                    opacity: canMoveContextNodeUp ? 1 : 0.38,
                  }}
                  onClick={() => {
                    if (!contextNode) return;
                    moveByOffset(contextNode, -1);
                    setContextMenu(null);
                  }}
                >
                  Move Up
                </button>
                <button
                  type="button"
                  className={contextMenuButtonClassName}
                  disabled={!canMoveContextNodeDown}
                  style={{
                    color: "var(--text)",
                    opacity: canMoveContextNodeDown ? 1 : 0.38,
                  }}
                  onClick={() => {
                    if (!contextNode) return;
                    moveByOffset(contextNode, 1);
                    setContextMenu(null);
                  }}
                >
                  Move Down
                </button>
              </>
            ) : null}
            <button
              type="button"
              className={contextMenuButtonClassName}
              style={{ color: "var(--text)" }}
              onClick={() => moveSelectionToTopLevel(contextMenu.selection)}
            >
              Move to Top Level
            </button>
            {contextMenu.selection.length === 1 ? (
              <button
                type="button"
                className={contextMenuButtonClassName}
                style={{ color: "var(--text)" }}
                onClick={() => {
                  onRenameNode(contextMenu.nodeId);
                  setContextMenu(null);
                }}
              >
                Rename
              </button>
            ) : null}
            <div className="my-1 h-px bg-[var(--separator)]" />
            <button
              type="button"
              className={contextMenuDangerButtonClassName}
              style={{ color: "var(--red)" }}
              onClick={handleDeleteSelection}
            >
              {contextMenu.selection.length > 1 ? `Delete ${contextMenu.selection.length} items` : "Delete"}
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
