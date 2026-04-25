'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { getNodePrimaryText, getProcessStatements } from './model';
import { FlowchartNodeData } from './types';

// Custom node components for each IGCSE flowchart symbol

const HANDLE_CLASS_NAME =
  '!z-20 !pointer-events-auto !w-2.5 !h-2.5 !bg-[var(--bg)] !border-2 !border-[var(--text)] transition-colors hover:!bg-[var(--accent)]';

const BaseNode = memo(({
  selected,
  children,
  style,
  hideDefaultHandles = false,
}: {
  selected: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  hideDefaultHandles?: boolean;
}) => {
  return (
    <div
      className="relative"
      style={{
        ...style,
        background: 'transparent',
      }}
    >
      {children}
      {!hideDefaultHandles && (
        <>
          <Handle
            type="target"
            position={Position.Top}
            className={HANDLE_CLASS_NAME}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            className={HANDLE_CLASS_NAME}
          />
        </>
      )}
    </div>
  );
});
BaseNode.displayName = 'BaseNode';

// Terminator Node - Rounded Rectangle (Start/Stop)
export const TerminatorNode = memo((props: NodeProps) => {
  const { data, selected } = props;
  const nodeData = data as FlowchartNodeData;
  
  return (
    <BaseNode selected={selected}>
      <div
        className="flex items-center justify-center px-8 py-3"
        style={{
          background: 'var(--flowchart-terminator)',
          border: '2px solid var(--flowchart-terminator)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--bg)',
          minWidth: '140px',
        }}
      >
        <span className="font-medium text-sm">{nodeData.label}</span>
      </div>
    </BaseNode>
  );
});
TerminatorNode.displayName = 'TerminatorNode';

// Process Node - Rectangle
export const ProcessNode = memo((props: NodeProps) => {
  const { data, selected } = props;
  const nodeData = data as FlowchartNodeData;
  const statements = getProcessStatements(nodeData);
  
  return (
    <BaseNode selected={selected}>
      <div
        className="min-w-[220px] max-w-[300px] px-5 py-4"
        style={{
          background: 'var(--flowchart-process)',
          border: '2px solid var(--flowchart-process)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--bg)',
          minHeight: '100px',
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)]">
              Process
            </span>
            {nodeData.label ? (
              <span className="text-xs font-medium text-[var(--bg)]">{nodeData.label}</span>
            ) : null}
          </div>

          {statements.length > 0 ? (
            <div className="space-y-2">
              {statements.map((statement, index) => (
                <div
                  key={`${statement}-${index}`}
                  className="rounded-lg border border-[var(--bg)] bg-transparent px-3 py-2 text-left"
                >
                  <span className="block text-xs leading-5 text-[var(--bg)]">{statement}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--bg)] px-3 py-4 text-center">
              <span className="block text-xs leading-5 text-[var(--bg)]">
                Select this block and add lines inside it.
              </span>
            </div>
          )}
        </div>
      </div>
    </BaseNode>
  );
});
ProcessNode.displayName = 'ProcessNode';

// Decision Node - Diamond
export const DecisionNode = memo((props: NodeProps) => {
  const { data, selected } = props;
  const nodeData = data as FlowchartNodeData;
  const content = getNodePrimaryText(nodeData) || 'Condition';
  
  return (
    <BaseNode 
      selected={selected}
      hideDefaultHandles
    >
        <div className="relative" style={{ width: 140, height: 140 }}>
        {/* Diamond shape using SVG for proper geometry */}
        <svg
          width="140"
          height="140"
          viewBox="0 0 140 140"
          className="absolute inset-0"
        >
          <polygon
            points="70,5 135,70 70,135 5,70"
            fill="var(--orange)"
            stroke="var(--orange)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        
        {/* Label - centered */}
        <div 
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ padding: '20px' }}
        >
          <span 
            className="font-medium text-sm text-center leading-tight" 
            style={{ color: 'var(--bg)' }}
          >
            {content}
          </span>
        </div>

        {/* Handles positioned on diamond corners */}
        <Handle
          type="target"
          position={Position.Top}
          className={HANDLE_CLASS_NAME}
          style={{ top: 5, left: '50%', transform: 'translateX(-50%)' }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="true"
          className={HANDLE_CLASS_NAME}
          style={{ right: 5, top: '50%', transform: 'translateY(-50%)' }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="false"
          className={HANDLE_CLASS_NAME}
          style={{ bottom: 5, left: '50%', transform: 'translateX(-50%)' }}
        />

        {/* Yes/No labels */}
        <div 
          className="pointer-events-none absolute text-[10px] font-semibold text-[var(--orange)]"
          style={{ right: -28, top: '50%', transform: 'translateY(-50%)' }}
        >
          {nodeData.trueLabel || 'Yes'}
        </div>
        <div 
          className="pointer-events-none absolute text-[10px] font-semibold text-[var(--orange)]"
          style={{ bottom: -20, left: '50%', transform: 'translateX(-50%)' }}
        >
          {nodeData.falseLabel || 'No'}
        </div>
      </div>
    </BaseNode>
  );
});
DecisionNode.displayName = 'DecisionNode';

// Input/Output Node - Parallelogram
export const InputOutputNode = memo((props: NodeProps) => {
  const { data, selected } = props;
  const nodeData = data as FlowchartNodeData;
  const isInput = nodeData.ioType !== 'output';
  const content = getNodePrimaryText(nodeData) || (isInput ? 'Value' : '"Result"');

  return (
    <BaseNode selected={selected}>
      <div
        className="relative flex flex-col items-center justify-center gap-2 px-5 py-3 text-center"
        style={{
          width: 220,
          minHeight: 88,
          background: 'var(--flowchart-io)',
          clipPath: 'polygon(20px 0, 100% 0, calc(100% - 20px) 100%, 0 100%)',
        }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)]">
          {isInput ? 'Input' : 'Output'}
        </span>
        <span className="font-medium text-sm leading-5" style={{ color: 'var(--bg)' }}>
          {content}
        </span>
      </div>
    </BaseNode>
  );
});
InputOutputNode.displayName = 'InputOutputNode';

// Subroutine Node - Rectangle with side bars
export const SubroutineNode = memo((props: NodeProps) => {
  const { data, selected } = props;
  const nodeData = data as FlowchartNodeData;
  const content = getNodePrimaryText(nodeData) || nodeData.label;
  
  return (
    <BaseNode selected={selected}>
      <div className="relative" style={{ width: 180, height: 80 }}>
        {/* Main rectangle */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
          background: 'var(--flowchart-subroutine)',
          border: '2px solid var(--flowchart-subroutine)',
          borderRadius: 'var(--radius-sm)',
          }}
        />
        {/* Side bars */}
        <div
          className="absolute left-2 top-2 bottom-2 w-1"
          style={{ background: 'var(--flowchart-subroutine)', borderRadius: 'var(--radius-xs)' }}
        />
        <div
          className="absolute right-2 top-2 bottom-2 w-1"
          style={{ background: 'var(--flowchart-subroutine)', borderRadius: 'var(--radius-xs)' }}
        />
        {/* Label */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="font-medium text-sm" style={{ color: 'var(--bg)' }}>
            {content}
          </span>
        </div>
      </div>
    </BaseNode>
  );
});
SubroutineNode.displayName = 'SubroutineNode';

// Node type registry
export const nodeTypes = {
  terminator: TerminatorNode,
  process: ProcessNode,
  decision: DecisionNode,
  inputOutput: InputOutputNode,
  subroutine: SubroutineNode,
};
