import { useCallback, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';

export interface GraphSnapshot {
  nodes: Node[];
  edges: Edge[];
  detached: boolean;
}

/** Keep history local to this document, with a bounded number of immutable graph snapshots. */
export function useGraphHistory() {
  const past = useRef<GraphSnapshot[]>([]);
  const future = useRef<GraphSnapshot[]>([]);
  const [availability, setAvailability] = useState({ canUndo: false, canRedo: false });
  const update = useCallback(() => setAvailability({ canUndo: past.current.length > 0, canRedo: future.current.length > 0 }), []);
  const reset = useCallback(() => {
    past.current = [];
    future.current = [];
    update();
  }, [update]);
  const record = useCallback((snapshot: GraphSnapshot) => {
    const last = past.current.at(-1);
    if (last?.nodes === snapshot.nodes && last.edges === snapshot.edges && last.detached === snapshot.detached) return;
    past.current = [...past.current.slice(-49), snapshot];
    future.current = [];
    update();
  }, [update]);
  const move = useCallback((direction: 'undo' | 'redo', current: GraphSnapshot) => {
    const from = direction === 'undo' ? past : future;
    const to = direction === 'undo' ? future : past;
    const snapshot = from.current.pop();
    if (!snapshot) return null;
    to.current.push(current);
    update();
    return snapshot;
  }, [update]);
  return { ...availability, record, reset, move };
}
