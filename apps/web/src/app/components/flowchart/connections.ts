import type { Connection, Edge, Node } from '@xyflow/react';
import { getTerminatorKind } from './model';
import type { FlowchartNodeData } from './types';

/** Each output has one successor. Multiple incoming edges are allowed for merges and loops. */
export function isValidFlowchartConnection(connection: Connection | Edge, nodes: Node[], edges: Edge[]): boolean {
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  if (!source || !target || source.id === target.id) return false;
  const sourceData = source.data as FlowchartNodeData;
  const targetData = target.data as FlowchartNodeData;
  if (sourceData.type === 'terminator' && getTerminatorKind(sourceData) === 'end') return false;
  if (targetData.type === 'terminator' && getTerminatorKind(targetData) === 'start') return false;
  if (sourceData.type === 'decision' && !['true', 'false'].includes(connection.sourceHandle ?? '')) return false;
  // A cycle needs a decision as its entry; a process-only cycle cannot generate a loop condition.
  if (targetData.type !== 'decision') {
    const pending = [target.id];
    const seen = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!;
      if (id === source.id) return false;
      if (seen.has(id)) continue;
      seen.add(id);
      pending.push(...edges.filter((edge) => edge.source === id).map((edge) => edge.target));
    }
  }
  return !edges.some((edge) => edge.source === source.id && (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null));
}
