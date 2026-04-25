/**
 * IGCSE Flowchart Node Types
 * Based on Cambridge IGCSE Computer Science syllabus flowchart symbols
 */

export type FlowchartNodeType = 
  | 'terminator'      // Start/Stop - rounded rectangle
  | 'process'         // Process - rectangle
  | 'decision'        // Decision - diamond
  | 'inputOutput'     // Input/Output - parallelogram
  | 'subroutine';     // Subroutine - rectangle with side bars

export interface FlowchartNodeData extends Record<string, unknown> {
  label: string;
  type: FlowchartNodeType;
  content?: string;
  // For decision nodes
  trueLabel?: string;
  falseLabel?: string;
  controlKind?: 'if' | 'while' | 'for';
  loopBodyHandle?: 'true' | 'false';
  forIterator?: string;
  hasElseBranch?: boolean;
  trueBranchEmpty?: boolean;
  falseBranchEmpty?: boolean;
  // For input/output
  ioType?: 'input' | 'output';
  // For process
  operation?: string;
  statements?: string[];
  // For subroutine
  subroutineName?: string;
}

export interface FlowchartEdgeData {
  label?: string;
}

export const NODE_TYPE_CONFIG: Record<FlowchartNodeType, {
  label: string;
  description: string;
  shape: string;
  color: string;
  icon: string;
}> = {
  terminator: {
    label: 'Start / Stop',
    description: 'Beginning or end of the process',
    shape: 'rounded-rectangle',
    color: 'var(--flowchart-terminator)',
    icon: 'Play',
  },
  process: {
    label: 'Process',
    description: 'A visual block that can hold one or more steps',
    shape: 'rectangle',
    color: 'var(--flowchart-process)',
    icon: 'Cpu',
  },
  decision: {
    label: 'Decision',
    description: 'Yes/No or True/False branching',
    shape: 'diamond',
    color: 'var(--flowchart-decision)',
    icon: 'GitBranch',
  },
  inputOutput: {
    label: 'Input / Output',
    description: 'Read data in or write data out',
    shape: 'parallelogram',
    color: 'var(--flowchart-io)',
    icon: 'ArrowRightLeft',
  },
  subroutine: {
    label: 'Subroutine',
    description: 'Call to a separate procedure or function',
    shape: 'subroutine-rectangle',
    color: 'var(--flowchart-subroutine)',
    icon: 'Box',
  },
};

// Default node dimensions
export const NODE_DIMENSIONS = {
  terminator: { width: 160, height: 60 },
  process: { width: 220, height: 140 },
  decision: { width: 160, height: 120 },
  inputOutput: { width: 180, height: 80 },
  subroutine: { width: 180, height: 80 },
};
