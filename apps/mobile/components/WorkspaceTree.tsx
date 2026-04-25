import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type LayoutRectangle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  flattenVisibleNodes,
  getChildNodes,
  type WorkspaceNode,
  type WorkspaceState,
} from "@igcse/workspace";
import {
  createThemedStyleSheet,
  fonts,
  radii,
  useAppTheme,
  useThemedStyles,
} from "../lib/theme";

interface WorkspaceTreeProps {
  workspace: WorkspaceState;
  activeDocumentId: string | null;
  onSelectDocument: (documentId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onCreateFolder: (parentId?: string) => void;
  onCreateDocument: (parentId?: string) => void;
  onRenameNode: (nodeId: string, name: string) => boolean;
  onDeleteNodes: (nodeIds: string[]) => boolean;
  onMoveNodes: (
    nodeIds: string[],
    targetFolderId: string,
    targetIndex: number,
  ) => boolean;
}

const TREE_INDENT = 22;
const DRAG_LONG_PRESS_DELAY = 260;
const DRAG_MOVE_THRESHOLD = 8;
const FOLDER_EXPAND_DELAY = 420;
const POINTER_MODIFIER_CACHE_MS = 2400;
const DOUBLE_TAP_DELAY = 240;

type DropPosition = "before" | "after" | "inside";

interface DropHint {
  nodeId: string;
  position: DropPosition;
}

interface RowLayout {
  y: number;
  height: number;
}

interface ViewportMetrics {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
}

interface TouchGestureState {
  nodeId: string;
  originPageX: number;
  originPageY: number;
  readyToDrag: boolean;
}

interface ActionSheetState {
  nodeId: string;
  selection: string[];
}

interface RenameDialogState {
  nodeId: string;
}

interface SelectionModifierState {
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

type NativeModifierEvent = GestureResponderEvent["nativeEvent"] &
  Partial<SelectionModifierState>;

interface PointerModifierSnapshot {
  capturedAt: number;
  nodeId: string;
  modifiers: SelectionModifierState;
}

interface PendingPressState {
  nodeId: string;
  timer: ReturnType<typeof setTimeout>;
}

function isNodeDescendantOfFolder(
  workspace: WorkspaceState,
  nodeId: string,
  folderId: string,
): boolean {
  let current = workspace.nodes[nodeId];
  while (current?.parentId) {
    if (current.parentId === folderId) {
      return true;
    }
    current = workspace.nodes[current.parentId];
  }
  return false;
}

function collapseNodeIds(
  workspace: WorkspaceState,
  nodeIds: string[],
): string[] {
  const uniqueNodeIds = Array.from(new Set(nodeIds)).filter(
    (nodeId) => !!workspace.nodes[nodeId],
  );

  return uniqueNodeIds.filter(
    (nodeId) =>
      !uniqueNodeIds.some((candidateId) => {
        if (candidateId === nodeId) {
          return false;
        }

        const candidate = workspace.nodes[candidateId];
        return (
          candidate?.type === "folder" &&
          isNodeDescendantOfFolder(workspace, nodeId, candidateId)
        );
      }),
  );
}

function getRangeSelection(
  nodeIds: string[],
  anchorId: string,
  currentId: string,
): string[] {
  const anchorIndex = nodeIds.indexOf(anchorId);
  const currentIndex = nodeIds.indexOf(currentId);
  if (anchorIndex < 0 || currentIndex < 0) {
    return [currentId];
  }

  const start = Math.min(anchorIndex, currentIndex);
  const end = Math.max(anchorIndex, currentIndex);
  return nodeIds.slice(start, end + 1);
}

function deriveDropPositionFromLayout(
  contentY: number,
  layout: RowLayout,
  targetNode: WorkspaceNode,
): DropPosition {
  if (targetNode.type === "folder") {
    const offset = contentY - layout.y;
    const edgeThreshold = Math.min(8, layout.height * 0.18);
    if (offset <= edgeThreshold) {
      return "before";
    }
    if (offset >= layout.height - edgeThreshold) {
      return "after";
    }
    return "inside";
  }

  return contentY - layout.y < layout.height / 2 ? "before" : "after";
}

function canDropOnNode(
  workspace: WorkspaceState,
  targetNodeId: string,
  draggedNodeIds: string[],
): boolean {
  const draggingNodeSet = new Set(draggedNodeIds);
  if (draggingNodeSet.has(targetNodeId)) {
    return false;
  }

  return !draggedNodeIds.some((draggedNodeId) => {
    const draggedNode = workspace.nodes[draggedNodeId];
    return (
      draggedNode?.type === "folder" &&
      isNodeDescendantOfFolder(workspace, targetNodeId, draggedNodeId)
    );
  });
}

function deriveTarget(
  workspace: WorkspaceState,
  draggedNodeIds: string[],
  targetNode: WorkspaceNode,
  position: DropPosition,
): { targetFolderId: string; targetIndex: number } {
  const draggingNodeSet = new Set(draggedNodeIds);

  if (position === "inside" && targetNode.type === "folder") {
    const children = getChildNodes(workspace, targetNode.id).filter(
      (child) => !draggingNodeSet.has(child.id),
    );
    return {
      targetFolderId: targetNode.id,
      targetIndex: children.length,
    };
  }

  const parentId = targetNode.parentId ?? workspace.rootFolderId;
  const siblings = getChildNodes(workspace, parentId).filter(
    (child) => !draggingNodeSet.has(child.id),
  );
  const siblingIndex = siblings.findIndex((child) => child.id === targetNode.id);

  return {
    targetFolderId: parentId,
    targetIndex: position === "before" ? siblingIndex : siblingIndex + 1,
  };
}

function FolderIcon({ nested }: { nested: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Feather
      name="folder"
      size={16}
      color={nested ? colors.accent : colors.orange}
    />
  );
}

function DocumentIcon({ active }: { active: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Feather
      name="file-text"
      size={16}
      color={active ? colors.accent : colors.text3}
    />
  );
}

function areNodeIdArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

export function WorkspaceTree({
  workspace,
  activeDocumentId,
  onSelectDocument,
  onToggleFolder,
  onCreateFolder,
  onCreateDocument,
  onRenameNode,
  onDeleteNodes,
  onMoveNodes,
}: WorkspaceTreeProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(useStyles);
  const flattened = useMemo(() => flattenVisibleNodes(workspace), [workspace]);
  const visibleNodeIds = useMemo(
    () => flattened.map(({ node }) => node.id),
    [flattened],
  );
  const expandedFolders = useMemo(
    () => new Set(workspace.expandedFolderIds ?? []),
    [workspace.expandedFolderIds],
  );
  const viewportRef = useRef<View | null>(null);
  const rowLayoutsRef = useRef<Record<string, RowLayout>>({});
  const viewportMetricsRef = useRef<ViewportMetrics | null>(null);
  const scrollOffsetRef = useRef(0);
  const expandHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandHoverFolderIdRef = useRef<string | null>(null);
  const pointerModifiersRef = useRef<PointerModifierSnapshot | null>(null);
  const pendingPressRef = useRef<PendingPressState | null>(null);
  const pendingRenameNodeIdRef = useRef<string | null>(null);
  const renameInputRef = useRef<TextInput | null>(null);
  const renameFocusTaskRef = useRef<
    ReturnType<typeof InteractionManager.runAfterInteractions> | null
  >(null);
  const suppressPressRef = useRef(false);
  const suppressPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchGestureRef = useRef<TouchGestureState | null>(null);
  const draggingNodeIdsRef = useRef<string[]>([]);
  const [selectionState, setSelectionState] = useState<string[]>([
    ...(activeDocumentId ? [activeDocumentId] : []),
  ]);
  const [anchorState, setAnchorState] = useState<string | null>(activeDocumentId);
  const [readyToDragNodeId, setReadyToDragNodeId] = useState<string | null>(null);
  const [draggingNodeIds, setDraggingNodeIds] = useState<string[]>([]);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const [actionSheet, setActionSheet] = useState<ActionSheetState | null>(null);
  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  const clearPendingPress = useCallback(() => {
    if (pendingPressRef.current) {
      clearTimeout(pendingPressRef.current.timer);
      pendingPressRef.current = null;
    }
  }, []);

  const selectedNodeIds = useMemo(() => {
    const nextSelection = visibleNodeIds.filter((nodeId) =>
      selectionState.includes(nodeId),
    );
    return nextSelection.length > 0
      ? nextSelection
      : activeDocumentId
        ? [activeDocumentId]
        : [];
  }, [activeDocumentId, selectionState, visibleNodeIds]);
  const selectedNodeSet = useMemo(
    () => new Set(selectedNodeIds),
    [selectedNodeIds],
  );
  const orderedSelection = useMemo(
    () => visibleNodeIds.filter((nodeId) => selectedNodeSet.has(nodeId)),
    [selectedNodeSet, visibleNodeIds],
  );
  const anchorNodeId =
    anchorState && workspace.nodes[anchorState] ? anchorState : activeDocumentId;
  const createTargetParentId = useMemo(() => {
    if (selectedNodeIds.length < 1) {
      return undefined;
    }

    const selectedNode = workspace.nodes[selectedNodeIds[0]];
    if (selectedNode?.type === "folder") {
      return selectedNode.id;
    }

    return selectedNode?.parentId ?? undefined;
  }, [selectedNodeIds, workspace.nodes]);

  const setDraggingSelection = useCallback((nodeIds: string[]) => {
    draggingNodeIdsRef.current = nodeIds;
    setDraggingNodeIds(nodeIds);
  }, []);

  const clearTouchGesture = useCallback(() => {
    touchGestureRef.current = null;
    setReadyToDragNodeId(null);
  }, []);

  const clearExpandHover = useCallback(() => {
    if (expandHoverTimerRef.current) {
      clearTimeout(expandHoverTimerRef.current);
      expandHoverTimerRef.current = null;
    }
    expandHoverFolderIdRef.current = null;
  }, []);

  const clearDragState = useCallback(() => {
    clearExpandHover();
    setDraggingSelection([]);
    setDropHint(null);
  }, [clearExpandHover, setDraggingSelection]);

  const suppressNextPress = useCallback(() => {
    suppressPressRef.current = true;
    if (suppressPressTimerRef.current) {
      clearTimeout(suppressPressTimerRef.current);
    }
    suppressPressTimerRef.current = setTimeout(() => {
      suppressPressRef.current = false;
      suppressPressTimerRef.current = null;
    }, 360);
  }, []);

  const measureViewport = useCallback(() => {
    viewportRef.current?.measureInWindow((pageX, pageY, width, height) => {
      viewportMetricsRef.current = {
        pageX,
        pageY,
        width,
        height,
      };
    });
  }, []);

  useEffect(() => {
    const knownNodeIds = new Set(visibleNodeIds);
    rowLayoutsRef.current = Object.fromEntries(
      Object.entries(rowLayoutsRef.current).filter(([nodeId]) =>
        knownNodeIds.has(nodeId),
      ),
    );

    setSelectionState((currentSelection) => {
      const nextSelection = visibleNodeIds.filter((nodeId) =>
        currentSelection.includes(nodeId),
      );
      const fallbackSelection =
        nextSelection.length > 0
          ? nextSelection
          : activeDocumentId
            ? [activeDocumentId]
            : [];

      return areNodeIdArraysEqual(currentSelection, fallbackSelection)
        ? currentSelection
        : fallbackSelection;
    });

    if (actionSheet && !knownNodeIds.has(actionSheet.nodeId)) {
      setActionSheet(null);
    }

    if (renameDialog && !knownNodeIds.has(renameDialog.nodeId)) {
      setRenameDialog(null);
      setRenameValue("");
    }
  }, [actionSheet, activeDocumentId, renameDialog, visibleNodeIds]);

  useEffect(() => {
    if (actionSheet) {
      setCreateMenuOpen(false);
    }
  }, [actionSheet]);

  useEffect(
    () => () => {
      clearPendingPress();
      clearDragState();
      clearTouchGesture();
      renameFocusTaskRef.current?.cancel?.();
      if (suppressPressTimerRef.current) {
        clearTimeout(suppressPressTimerRef.current);
      }
    },
    [clearDragState, clearPendingPress, clearTouchGesture],
  );

  const dismissRenameDialog = useCallback(() => {
    renameFocusTaskRef.current?.cancel?.();
    renameFocusTaskRef.current = null;
    renameInputRef.current?.blur();
    setRenameDialog(null);
    setRenameValue("");
  }, []);

  const focusRenameInput = useCallback(() => {
    renameFocusTaskRef.current?.cancel?.();
    renameFocusTaskRef.current = InteractionManager.runAfterInteractions(() => {
      renameInputRef.current?.focus();
    });
  }, []);

  const scheduleFolderExpand = useCallback(
    (folderId: string) => {
      if (expandedFolders.has(folderId)) {
        clearExpandHover();
        return;
      }

      if (expandHoverFolderIdRef.current === folderId) {
        return;
      }

      clearExpandHover();
      expandHoverFolderIdRef.current = folderId;
      expandHoverTimerRef.current = setTimeout(() => {
        expandHoverTimerRef.current = null;
        expandHoverFolderIdRef.current = null;
        onToggleFolder(folderId);
      }, FOLDER_EXPAND_DELAY);
    },
    [clearExpandHover, expandedFolders, onToggleFolder],
  );

  const resolvePointDropHint = useCallback(
    (pageX: number, pageY: number, draggedIds: string[]): DropHint | null => {
      const viewport = viewportMetricsRef.current;
      if (!viewport) {
        return null;
      }

      const insideViewport =
        pageX >= viewport.pageX &&
        pageX <= viewport.pageX + viewport.width &&
        pageY >= viewport.pageY &&
        pageY <= viewport.pageY + viewport.height;
      const contentY = pageY - viewport.pageY + scrollOffsetRef.current;

      for (const { node } of flattened) {
        const layout = rowLayoutsRef.current[node.id];
        if (!layout) {
          continue;
        }

        if (contentY < layout.y || contentY > layout.y + layout.height) {
          continue;
        }

        if (!canDropOnNode(workspace, node.id, draggedIds)) {
          clearExpandHover();
          return null;
        }

        if (node.type === "folder") {
          scheduleFolderExpand(node.id);
        } else {
          clearExpandHover();
        }

        return {
          nodeId: node.id,
          position: deriveDropPositionFromLayout(contentY, layout, node),
        };
      }

      clearExpandHover();
      if (!insideViewport) {
        return null;
      }

      return {
        nodeId: workspace.rootFolderId,
        position: "inside",
      };
    },
    [clearExpandHover, flattened, scheduleFolderExpand, workspace],
  );

  const resolveDraggedNodeIds = useCallback(
    (nodeId: string) => {
      const currentSelection = selectedNodeSet.has(nodeId)
        ? orderedSelection
        : [nodeId];
      return collapseNodeIds(workspace, currentSelection);
    },
    [orderedSelection, selectedNodeSet, workspace],
  );

  const capturePointerModifiers = useCallback(
    (nodeId: string, event: GestureResponderEvent) => {
      const nativeEvent = event.nativeEvent as NativeModifierEvent;
      pointerModifiersRef.current = {
        capturedAt: Date.now(),
        nodeId,
        modifiers: {
          shiftKey: !!nativeEvent.shiftKey,
          metaKey: !!nativeEvent.metaKey,
          ctrlKey: !!nativeEvent.ctrlKey,
        },
      };
    },
    [],
  );

  const resolveSelectionModifiers = useCallback(
    (
      nodeId: string,
      nativeEvent?: NativeModifierEvent,
    ): SelectionModifierState => {
      const pointerSnapshot = pointerModifiersRef.current;
      if (
        pointerSnapshot?.nodeId === nodeId &&
        Date.now() - pointerSnapshot.capturedAt <= POINTER_MODIFIER_CACHE_MS
      ) {
        return pointerSnapshot.modifiers;
      }

      return {
        shiftKey: !!nativeEvent?.shiftKey,
        metaKey: !!nativeEvent?.metaKey,
        ctrlKey: !!nativeEvent?.ctrlKey,
      };
    },
    [],
  );

  const selectSingleNode = useCallback(
    (node: WorkspaceNode) => {
      setSelectionState([node.id]);
      setAnchorState(node.id);
      if (node.type === "document") {
        onSelectDocument(node.id);
      }
    },
    [onSelectDocument],
  );

  const presentRenameDialog = useCallback(
    (nodeId: string) => {
      const node = workspace.nodes[nodeId];
      if (!node) {
        return;
      }

      clearPendingPress();
      setSelectionState([node.id]);
      setAnchorState(node.id);
      setRenameValue(node.name);
      setRenameDialog({ nodeId: node.id });
    },
    [clearPendingPress, workspace.nodes],
  );

  const openRenameDialog = useCallback(
    (node: WorkspaceNode) => {
      if (Platform.OS === "ios" && actionSheet) {
        clearPendingPress();
        pendingRenameNodeIdRef.current = node.id;
        setActionSheet(null);
        return;
      }

      pendingRenameNodeIdRef.current = null;
      setActionSheet(null);
      presentRenameDialog(node.id);
    },
    [actionSheet, clearPendingPress, presentRenameDialog],
  );

  const openActionSheetForNode = useCallback(
    (node: WorkspaceNode) => {
      clearPendingPress();
      const nextSelection = selectedNodeSet.has(node.id)
        ? orderedSelection
        : [node.id];
      setSelectionState(nextSelection);
      setAnchorState(node.id);
      if (Platform.OS === "ios") {
        requestAnimationFrame(() => {
          setActionSheet({
            nodeId: node.id,
            selection: nextSelection,
          });
        });
        return;
      }

      setActionSheet({
        nodeId: node.id,
        selection: nextSelection,
      });
    },
    [clearPendingPress, orderedSelection, selectedNodeSet],
  );

  const handleNodeSelection = useCallback(
    (node: WorkspaceNode, modifiers: SelectionModifierState) => {
      setActionSheet(null);

      if (modifiers.shiftKey && anchorNodeId) {
        setSelectionState(getRangeSelection(visibleNodeIds, anchorNodeId, node.id));
        return;
      }

      if (modifiers.metaKey || modifiers.ctrlKey) {
        setSelectionState((currentSelection) => {
          const nextSelection = currentSelection.includes(node.id)
            ? currentSelection.filter(
                (currentNodeId) => currentNodeId !== node.id,
              )
            : visibleNodeIds.filter(
                (nodeId) =>
                  nodeId === node.id || currentSelection.includes(nodeId),
              );

          return nextSelection.length > 0 ? nextSelection : [node.id];
        });
        setAnchorState(node.id);
        return;
      }

      selectSingleNode(node);
    },
    [anchorNodeId, selectSingleNode, visibleNodeIds],
  );

  const startDrag = useCallback(
    (nodeId: string, pageX: number, pageY: number) => {
      const draggedIds = resolveDraggedNodeIds(nodeId);
      if (draggedIds.length === 0) {
        return;
      }

      measureViewport();
      suppressNextPress();
      clearPendingPress();
      setActionSheet(null);
      setSelectionState(draggedIds);
      setAnchorState(nodeId);
      setDraggingSelection(draggedIds);
      setDropHint(resolvePointDropHint(pageX, pageY, draggedIds));
      clearTouchGesture();
    },
    [
      clearPendingPress,
      clearTouchGesture,
      measureViewport,
      resolveDraggedNodeIds,
      resolvePointDropHint,
      setDraggingSelection,
      suppressNextPress,
    ],
  );

  const handleDragMove = useCallback(
    (event: GestureResponderEvent) => {
      const draggedIds = draggingNodeIdsRef.current;
      if (draggedIds.length > 0) {
        setDropHint(
          resolvePointDropHint(
            event.nativeEvent.pageX,
            event.nativeEvent.pageY,
            draggedIds,
          ),
        );
        return;
      }

      const gesture = touchGestureRef.current;
      if (!gesture) {
        return;
      }

      const movedPastThreshold =
        Math.abs(event.nativeEvent.pageX - gesture.originPageX) >
          DRAG_MOVE_THRESHOLD ||
        Math.abs(event.nativeEvent.pageY - gesture.originPageY) >
          DRAG_MOVE_THRESHOLD;

      if (!gesture.readyToDrag) {
        if (movedPastThreshold) {
          clearTouchGesture();
        }
        return;
      }

      if (movedPastThreshold) {
        startDrag(
          gesture.nodeId,
          event.nativeEvent.pageX,
          event.nativeEvent.pageY,
        );
      }
    },
    [clearTouchGesture, resolvePointDropHint, startDrag],
  );

  const handleDragEnd = useCallback(
    (event: GestureResponderEvent) => {
      const draggedIds = draggingNodeIdsRef.current;
      if (draggedIds.length === 0) {
        clearTouchGesture();
        return;
      }

      const resolvedHint = resolvePointDropHint(
        event.nativeEvent.pageX,
        event.nativeEvent.pageY,
        draggedIds,
      );
      clearDragState();

      if (!resolvedHint) {
        return;
      }

      if (resolvedHint.nodeId === workspace.rootFolderId) {
        const draggingNodeSet = new Set(draggedIds);
        const children = getChildNodes(workspace, workspace.rootFolderId).filter(
          (child) => !draggingNodeSet.has(child.id),
        );
        onMoveNodes(draggedIds, workspace.rootFolderId, children.length);
        return;
      }

      const targetNode = workspace.nodes[resolvedHint.nodeId];
      if (!targetNode || !canDropOnNode(workspace, targetNode.id, draggedIds)) {
        return;
      }

      const target = deriveTarget(
        workspace,
        draggedIds,
        targetNode,
        resolvedHint.position,
      );
      onMoveNodes(draggedIds, target.targetFolderId, target.targetIndex);
    },
    [
      clearDragState,
      clearTouchGesture,
      onMoveNodes,
      resolvePointDropHint,
      workspace,
    ],
  );

  const handleDeleteSelection = useCallback(
    (nodeIds: string[]) => {
      const deletableNodeIds = collapseNodeIds(workspace, nodeIds);
      if (deletableNodeIds.length === 0) {
        return;
      }

      const deleteMessage =
        deletableNodeIds.length === 1
          ? `Delete "${workspace.nodes[deletableNodeIds[0]]?.name ?? "item"}"?`
          : `Delete ${deletableNodeIds.length} selected items?`;

      setActionSheet(null);
      Alert.alert("Confirm Delete", deleteMessage, [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDeleteNodes(deletableNodeIds);
          },
        },
      ]);
    },
    [onDeleteNodes, workspace],
  );

  const submitRename = useCallback(() => {
    if (!renameDialog) {
      return;
    }

    renameInputRef.current?.blur();
    if (onRenameNode(renameDialog.nodeId, renameValue)) {
      dismissRenameDialog();
    }
  }, [dismissRenameDialog, onRenameNode, renameDialog, renameValue]);

  const moveSelectionToTopLevel = useCallback(
    (nodeIds: string[]) => {
      const collapsedNodeIds = collapseNodeIds(workspace, nodeIds);
      if (collapsedNodeIds.length === 0) {
        return;
      }

      const movingNodeSet = new Set(collapsedNodeIds);
      const rootChildren = getChildNodes(workspace, workspace.rootFolderId).filter(
        (child) => !movingNodeSet.has(child.id),
      );
      onMoveNodes(collapsedNodeIds, workspace.rootFolderId, rootChildren.length);
      setActionSheet(null);
    },
    [onMoveNodes, workspace],
  );

  const contextNode = actionSheet ? workspace.nodes[actionSheet.nodeId] : null;
  const canMoveSelectionToRoot =
    actionSheet?.selection.some((nodeId) => {
      const node = workspace.nodes[nodeId];
      return (
        !!node &&
        (node.parentId ?? workspace.rootFolderId) !== workspace.rootFolderId
      );
    }) ?? false;

  return (
    <View
      style={styles.shell}
      onLayout={measureViewport}
      onTouchMove={handleDragMove}
      onTouchEnd={handleDragEnd}
      onTouchCancel={() => {
        clearDragState();
        clearTouchGesture();
      }}
    >
      <View style={styles.header}>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Explorer</Text>
          {selectedNodeIds.length > 1 ? (
            <Text style={styles.headerCaption}>
              {selectedNodeIds.length} selected
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => setCreateMenuOpen((current) => !current)}
          hitSlop={10}
          accessibilityLabel="Open create menu."
          style={({ pressed }) => [
            styles.headerButton,
            (pressed || createMenuOpen) && styles.headerButtonPressed,
          ]}
        >
          <Feather name="plus" size={16} color={colors.accent} />
        </Pressable>
      </View>

      {createMenuOpen ? (
        <View style={styles.createMenuLayer} pointerEvents="box-none">
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCreateMenuOpen(false)}
          />
          <View style={styles.createMenuWrap} pointerEvents="box-none">
            <View style={styles.createMenuCard}>
              <Pressable
                style={({ pressed }) => [
                  styles.createMenuButton,
                  pressed && styles.createMenuButtonPressed,
                ]}
                onPress={() => {
                  onCreateDocument(createTargetParentId);
                  setCreateMenuOpen(false);
                }}
              >
                <Feather
                  name="file-text"
                  size={15}
                  color={colors.accent}
                  style={styles.createMenuButtonIcon}
                />
                <Text style={styles.createMenuButtonText}>Add a code file</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.createMenuButton,
                  pressed && styles.createMenuButtonPressed,
                ]}
                onPress={() => {
                  onCreateFolder(createTargetParentId);
                  setCreateMenuOpen(false);
                }}
              >
                <Feather
                  name="folder-plus"
                  size={15}
                  color={colors.accent}
                  style={styles.createMenuButtonIcon}
                />
                <Text style={styles.createMenuButtonText}>Add a folder</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <View ref={viewportRef} style={styles.listViewport}>
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={draggingNodeIds.length === 0 && readyToDragNodeId === null}
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          {flattened.map(({ node, depth }) => {
            const isFolder = node.type === "folder";
            const isExpanded = isFolder && expandedFolders.has(node.id);
            const isActiveDocument = !isFolder && node.id === activeDocumentId;
            const isSelected = selectedNodeSet.has(node.id);
            const isDragging = draggingNodeIds.includes(node.id);
            const rowDropPosition =
              dropHint?.nodeId === node.id ? dropHint.position : null;

            return (
              <Pressable
                key={node.id}
                delayLongPress={DRAG_LONG_PRESS_DELAY}
                onPressIn={(event) => {
                  capturePointerModifiers(node.id, event);
                  touchGestureRef.current = {
                    nodeId: node.id,
                    originPageX: event.nativeEvent.pageX,
                    originPageY: event.nativeEvent.pageY,
                    readyToDrag: false,
                  };
                }}
                onLongPress={(event) => {
                  clearPendingPress();
                  const gesture = touchGestureRef.current;
                  if (!gesture || gesture.nodeId !== node.id) {
                    touchGestureRef.current = {
                      nodeId: node.id,
                      originPageX: event.nativeEvent.pageX,
                      originPageY: event.nativeEvent.pageY,
                      readyToDrag: true,
                    };
                    setReadyToDragNodeId(node.id);
                    return;
                  }

                  touchGestureRef.current = {
                    ...gesture,
                    readyToDrag: true,
                  };
                  setReadyToDragNodeId(node.id);
                }}
                onPressOut={() => {
                  const gesture = touchGestureRef.current;
                  if (
                    gesture &&
                    gesture.nodeId === node.id &&
                    gesture.readyToDrag &&
                    draggingNodeIdsRef.current.length === 0
                  ) {
                    suppressNextPress();
                    openActionSheetForNode(node);
                  }

                  clearTouchGesture();
                }}
                onLayout={(event) => {
                  const { y, height } = event.nativeEvent.layout as LayoutRectangle;
                  rowLayoutsRef.current[node.id] = { y, height };
                }}
                onPress={(event) => {
                  if (
                    suppressPressRef.current ||
                    draggingNodeIdsRef.current.length > 0
                  ) {
                    return;
                  }

                  const nativeEvent = event.nativeEvent as NativeModifierEvent;
                  const modifiers = resolveSelectionModifiers(node.id, nativeEvent);
                  const isPlainTap =
                    !modifiers.shiftKey && !modifiers.metaKey && !modifiers.ctrlKey;

                  if (!isPlainTap) {
                    clearPendingPress();
                    handleNodeSelection(node, modifiers);
                    return;
                  }

                  if (pendingPressRef.current?.nodeId === node.id) {
                    openRenameDialog(node);
                    return;
                  }

                  clearPendingPress();
                  pendingPressRef.current = {
                    nodeId: node.id,
                    timer: setTimeout(() => {
                      pendingPressRef.current = null;
                      handleNodeSelection(node, modifiers);
                    }, DOUBLE_TAP_DELAY),
                  };
                }}
                accessibilityRole="button"
                accessibilityHint="Long press for file actions. Tap twice quickly to rename. Hold and drag after long press to move."
                accessibilityState={
                  isFolder
                    ? { expanded: isExpanded, selected: isSelected }
                    : { selected: isSelected }
                }
                style={({ pressed }) => [
                  styles.row,
                  { paddingLeft: 10 + depth * TREE_INDENT },
                  isSelected && styles.rowActive,
                  rowDropPosition === "inside" && styles.rowDropInside,
                  rowDropPosition === "before" && styles.rowDropBefore,
                  rowDropPosition === "after" && styles.rowDropAfter,
                  isDragging && styles.rowDragging,
                  pressed &&
                    !isSelected &&
                    draggingNodeIds.length === 0 &&
                    styles.rowPressed,
                ]}
              >
                {isFolder ? (
                  <Pressable
                    hitSlop={8}
                    onPress={(event) => {
                      event.stopPropagation();
                      clearPendingPress();
                      onToggleFolder(node.id);
                    }}
                    style={styles.disclosureButton}
                    accessibilityLabel={
                      isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`
                    }
                  >
                    <Feather
                      name={isExpanded ? "chevron-down" : "chevron-right"}
                      size={14}
                      color={colors.text3}
                    />
                  </Pressable>
                ) : (
                  <View style={styles.disclosureSpacer} />
                )}

                {isFolder ? (
                  <FolderIcon nested={depth > 0} />
                ) : (
                  <DocumentIcon active={isActiveDocument || isSelected} />
                )}

                <Text
                  numberOfLines={1}
                  style={[
                    styles.rowText,
                    isSelected ? styles.rowTextActive : undefined,
                    isFolder && isExpanded ? styles.rowTextActive : undefined,
                    !isFolder && !isActiveDocument && !isSelected
                      ? styles.rowTextMuted
                      : undefined,
                    isActiveDocument ? styles.rowTextActive : undefined,
                  ]}
                >
                  {node.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Modal
        visible={actionSheet !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActionSheet(null)}
        onDismiss={() => {
          if (Platform.OS !== "ios") {
            return;
          }

          const pendingRenameNodeId = pendingRenameNodeIdRef.current;
          if (!pendingRenameNodeId) {
            return;
          }

          pendingRenameNodeIdRef.current = null;
          requestAnimationFrame(() => {
            presentRenameDialog(pendingRenameNodeId);
          });
        }}
      >
        <View style={styles.actionSheetOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setActionSheet(null)}
          />
          <View style={styles.actionSheetWrap}>
            <View style={styles.actionSheetCard}>
              <View style={styles.actionSheetHeader}>
                <Text style={styles.actionSheetEyebrow}>
                  {actionSheet && actionSheet.selection.length > 1
                    ? `${actionSheet.selection.length} items selected`
                    : contextNode?.type === "folder"
                      ? "Folder actions"
                      : "File actions"}
                </Text>
                <Text style={styles.actionSheetTitle} numberOfLines={1}>
                  {actionSheet && actionSheet.selection.length > 1
                    ? "Batch actions"
                    : contextNode?.name ?? "Actions"}
                </Text>
              </View>

              {actionSheet?.selection.length === 1 && contextNode?.type === "folder" ? (
                <>
                  <Pressable
                    style={styles.actionSheetButton}
                    onPress={() => {
                      onCreateDocument(contextNode.id);
                      setActionSheet(null);
                    }}
                  >
                    <Text style={styles.actionSheetButtonText}>New File Here</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionSheetButton}
                    onPress={() => {
                      onCreateFolder(contextNode.id);
                      setActionSheet(null);
                    }}
                  >
                    <Text style={styles.actionSheetButtonText}>New Folder Here</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionSheetButton}
                    onPress={() => {
                      onToggleFolder(contextNode.id);
                      setActionSheet(null);
                    }}
                  >
                    <Text style={styles.actionSheetButtonText}>
                      {expandedFolders.has(contextNode.id)
                        ? "Collapse Folder"
                        : "Expand Folder"}
                    </Text>
                  </Pressable>
                </>
              ) : null}

              {actionSheet?.selection.length === 1 && contextNode ? (
                <Pressable
                  style={styles.actionSheetButton}
                  onPress={() => openRenameDialog(contextNode)}
                >
                  <Text style={styles.actionSheetButtonText}>
                    {contextNode.type === "folder" ? "Rename Folder" : "Rename File"}
                  </Text>
                </Pressable>
              ) : null}

              {canMoveSelectionToRoot && actionSheet ? (
                <Pressable
                  style={styles.actionSheetButton}
                  onPress={() => moveSelectionToTopLevel(actionSheet.selection)}
                >
                  <Text style={styles.actionSheetButtonText}>Move to Top Level</Text>
                </Pressable>
              ) : null}

              {actionSheet ? (
                <Pressable
                  style={styles.actionSheetButton}
                  onPress={() => handleDeleteSelection(actionSheet.selection)}
                >
                  <Text
                    style={[
                      styles.actionSheetButtonText,
                      styles.actionSheetButtonTextDanger,
                    ]}
                  >
                    {actionSheet.selection.length > 1
                      ? `Delete ${actionSheet.selection.length} items`
                      : "Delete"}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                style={styles.actionSheetButton}
                onPress={() => setActionSheet(null)}
              >
                <Text style={styles.actionSheetButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={renameDialog !== null}
        transparent
        animationType="fade"
        onShow={focusRenameInput}
        onRequestClose={dismissRenameDialog}
      >
        <View style={styles.actionSheetOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissRenameDialog}
          />
          <View style={styles.renameDialogWrap}>
            <View style={styles.renameDialogCard}>
              <View style={styles.renameDialogHeader}>
                <Text style={styles.actionSheetEyebrow}>Rename</Text>
                <Text style={styles.renameDialogTitle}>
                  {renameDialog
                    ? workspace.nodes[renameDialog.nodeId]?.type === "folder"
                      ? "Rename Folder"
                      : "Rename File"
                    : "Rename Item"}
                </Text>
                <Text style={styles.renameDialogCaption} numberOfLines={1}>
                  {renameDialog
                    ? workspace.nodes[renameDialog.nodeId]?.name ?? "Selected item"
                    : "Selected item"}
                </Text>
              </View>

              <View style={styles.renameDialogBody}>
                <TextInput
                  ref={renameInputRef}
                  value={renameValue}
                  onChangeText={setRenameValue}
                  selectTextOnFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  placeholder="Enter a name"
                  placeholderTextColor={colors.text3}
                  onSubmitEditing={submitRename}
                  style={styles.renameInput}
                />
              </View>

              <View style={styles.renameDialogFooter}>
                <Pressable
                  style={[
                    styles.renameDialogButton,
                    styles.renameDialogButtonSecondary,
                  ]}
                  onPress={dismissRenameDialog}
                >
                  <Text style={styles.renameDialogButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.renameDialogButton,
                    !renameValue.trim() && styles.renameDialogButtonDisabled,
                  ]}
                  disabled={!renameValue.trim()}
                  onPress={submitRename}
                >
                  <Text style={styles.renameDialogButtonText}>Rename</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = createThemedStyleSheet(({ colors, isDark }) => ({
  shell: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.sidebar,
  },
  header: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 16,
  },
  headerMeta: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
  },
  headerTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "600",
  },
  headerCaption: {
    color: colors.textTertiary,
    fontFamily: fonts.sans,
    fontSize: 11,
  },
  headerButton: {
    width: 22,
    height: 22,
    borderRadius: radii.row,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonPressed: {
    backgroundColor: colors.hover,
  },
  createMenuLayer: {
    ...StyleSheet.absoluteFillObject,
    top: 44,
    zIndex: 20,
  },
  createMenuWrap: {
    flex: 1,
    alignItems: "flex-end",
    paddingTop: 8,
    paddingRight: 12,
  },
  createMenuCard: {
    minWidth: 188,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.section,
    backgroundColor: colors.panel,
    shadowColor: colors.shadow,
    shadowOpacity: isDark ? 0.22 : 0.14,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 12,
  },
  createMenuButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  createMenuButtonPressed: {
    backgroundColor: colors.hover,
  },
  createMenuButtonIcon: {
    width: 18,
    textAlign: "center",
  },
  createMenuButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "500",
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listViewport: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 2,
    paddingTop: 4,
    paddingRight: 10,
    paddingBottom: 12,
    paddingLeft: 10,
  },
  row: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 10,
    borderRadius: radii.row,
  },
  rowActive: {
    backgroundColor: colors.selected,
  },
  rowPressed: {
    backgroundColor: colors.hover,
  },
  rowDragging: {
    opacity: 0.46,
  },
  rowDropInside: {
    backgroundColor: colors.selected,
  },
  rowDropBefore: {
    borderTopWidth: 2,
    borderTopColor: colors.accent,
  },
  rowDropAfter: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  disclosureButton: {
    width: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  disclosureSpacer: {
    width: 16,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 14,
  },
  rowTextMuted: {
    color: colors.textSecondary,
  },
  rowTextActive: {
    color: colors.textPrimary,
    fontWeight: "500",
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  actionSheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  actionSheetCard: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.section,
    backgroundColor: colors.panel,
  },
  actionSheetHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.panelRaised,
  },
  actionSheetEyebrow: {
    color: colors.accent,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  actionSheetTitle: {
    marginTop: 4,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: "600",
  },
  actionSheetButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionSheetButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: "500",
  },
  actionSheetButtonTextDanger: {
    color: colors.danger,
  },
  renameDialogWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: colors.overlay,
  },
  renameDialogCard: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.section,
    backgroundColor: colors.panel,
  },
  renameDialogHeader: {
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: colors.panelRaised,
  },
  renameDialogTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 17,
    fontWeight: "600",
  },
  renameDialogCaption: {
    color: colors.textTertiary,
    fontFamily: fonts.sans,
    fontSize: 13,
  },
  renameDialogBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  renameInput: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.compactButton,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  renameDialogFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  renameDialogButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.button,
    backgroundColor: colors.accent,
  },
  renameDialogButtonSecondary: {
    backgroundColor: colors.panelRaised,
  },
  renameDialogButtonDisabled: {
    opacity: 0.45,
  },
  renameDialogButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "600",
  },
}));
