import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  type PointerEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import { colors, fonts, radii } from "../lib/theme";

interface WorkspaceTreeProps {
  workspace: WorkspaceState;
  activeDocumentId: string;
  onSelectDocument: (documentId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onCreateFolder: (parentId?: string) => void;
  onCreateDocument: (parentId?: string) => void;
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
  return (
    <Feather
      name="folder"
      size={16}
      color={nested ? colors.accent : colors.orange}
    />
  );
}

function DocumentIcon({ active }: { active: boolean }) {
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
  onDeleteNodes,
  onMoveNodes,
}: WorkspaceTreeProps) {
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
  const suppressPressRef = useRef(false);
  const suppressPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchGestureRef = useRef<TouchGestureState | null>(null);
  const draggingNodeIdsRef = useRef<string[]>([]);
  const [selectionState, setSelectionState] = useState<string[]>([
    activeDocumentId,
  ]);
  const [anchorState, setAnchorState] = useState<string | null>(activeDocumentId);
  const [readyToDragNodeId, setReadyToDragNodeId] = useState<string | null>(null);
  const [draggingNodeIds, setDraggingNodeIds] = useState<string[]>([]);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const [actionSheet, setActionSheet] = useState<ActionSheetState | null>(null);

  const selectedNodeIds = useMemo(() => {
    const nextSelection = visibleNodeIds.filter((nodeId) =>
      selectionState.includes(nodeId),
    );
    return nextSelection.length > 0 ? nextSelection : [activeDocumentId];
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
        nextSelection.length > 0 ? nextSelection : [activeDocumentId];

      return areNodeIdArraysEqual(currentSelection, fallbackSelection)
        ? currentSelection
        : fallbackSelection;
    });

    if (actionSheet && !knownNodeIds.has(actionSheet.nodeId)) {
      setActionSheet(null);
    }
  }, [actionSheet, activeDocumentId, visibleNodeIds]);

  useEffect(
    () => () => {
      clearDragState();
      clearTouchGesture();
      if (suppressPressTimerRef.current) {
        clearTimeout(suppressPressTimerRef.current);
      }
    },
    [clearDragState, clearTouchGesture],
  );

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
    (nodeId: string, event: PointerEvent) => {
      pointerModifiersRef.current = {
        capturedAt: Date.now(),
        nodeId,
        modifiers: {
          shiftKey: event.nativeEvent.shiftKey,
          metaKey: event.nativeEvent.metaKey,
          ctrlKey: event.nativeEvent.ctrlKey,
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

  const openActionSheetForNode = useCallback(
    (node: WorkspaceNode) => {
      const nextSelection = selectedNodeSet.has(node.id)
        ? orderedSelection
        : [node.id];
      setSelectionState(nextSelection);
      setAnchorState(node.id);
      setActionSheet({
        nodeId: node.id,
        selection: nextSelection,
      });
    },
    [orderedSelection, selectedNodeSet],
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
      setActionSheet(null);
      setSelectionState(draggedIds);
      setAnchorState(nodeId);
      setDraggingSelection(draggedIds);
      setDropHint(resolvePointDropHint(pageX, pageY, draggedIds));
      clearTouchGesture();
    },
    [
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
          onPress={() => onCreateDocument(createTargetParentId)}
          onLongPress={() => onCreateFolder(createTargetParentId)}
          delayLongPress={250}
          hitSlop={10}
          accessibilityLabel="Create file. Long press to create folder."
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.headerButtonPressed,
          ]}
        >
          <Feather name="plus" size={16} color={colors.accent} />
        </Pressable>
      </View>

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
                onPointerDown={(event) => {
                  capturePointerModifiers(node.id, event);
                }}
                onPressIn={(event) => {
                  touchGestureRef.current = {
                    nodeId: node.id,
                    originPageX: event.nativeEvent.pageX,
                    originPageY: event.nativeEvent.pageY,
                    readyToDrag: false,
                  };
                }}
                onLongPress={(event) => {
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
                  handleNodeSelection(
                    node,
                    resolveSelectionModifiers(node.id, nativeEvent),
                  );
                }}
                accessibilityRole="button"
                accessibilityHint="Long press for file actions. Hold and drag after long press to move."
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
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: colors.text2,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "600",
  },
  headerCaption: {
    color: colors.text3,
    fontFamily: fonts.sans,
    fontSize: 11,
  },
  headerButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonPressed: {
    backgroundColor: colors.hover,
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
    color: colors.text2,
    fontFamily: fonts.sans,
    fontSize: 14,
  },
  rowTextMuted: {
    color: colors.text2,
  },
  rowTextActive: {
    color: colors.text,
    fontWeight: "500",
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
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
    borderColor: colors.separator,
    borderRadius: radii.section,
    backgroundColor: colors.surface,
  },
  actionSheetHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    backgroundColor: colors.surface2,
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
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: "600",
  },
  actionSheetButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  actionSheetButtonText: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: "500",
  },
  actionSheetButtonTextDanger: {
    color: colors.red,
  },
});
