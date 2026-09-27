import { describe, expect, it } from 'vitest';
import { buildFlowchartFromPseudocode } from './model';
import { isValidFlowchartConnection } from './connections';

const { nodes, edges } = buildFlowchartFromPseudocode('INPUT Score\nIF Score > 0 THEN\n    OUTPUT Score\nENDIF');
const [start, input, decision, output, end] = nodes;
const connection = (source: string, target: string, sourceHandle: string | null = null) => ({ source, target, sourceHandle, targetHandle: null });

describe('flowchart connections', () => {
  it('rejects dangling, self, incoming Start and outgoing End connections', () => {
    for (const candidate of [connection('missing', input.id), connection(input.id, input.id), connection(input.id, start.id), connection(end.id, input.id)]) {
      expect(isValidFlowchartConnection(candidate, nodes, [])).toBe(false);
    }
  });
  it('rejects duplicate successors and unlabeled decision outputs', () => {
    expect(isValidFlowchartConnection(connection(input.id, output.id), nodes, edges)).toBe(false);
    expect(isValidFlowchartConnection(connection(decision.id, output.id), nodes, [])).toBe(false);
    expect(isValidFlowchartConnection(connection(decision.id, output.id, 'true'), nodes, edges)).toBe(false);
  });
  it('allows branch merges and loop back edges', () => {
    expect(isValidFlowchartConnection(connection(output.id, decision.id), nodes, [])).toBe(true);
    expect(isValidFlowchartConnection(connection(decision.id, end.id, 'false'), nodes, [])).toBe(true);
  });
});
