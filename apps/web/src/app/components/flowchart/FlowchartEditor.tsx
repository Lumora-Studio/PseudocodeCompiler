'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './FlowchartNodes';
import {
  buildFlowchartFromPseudocode,
  FLOWCHART_PALETTE_ITEMS,
  createFlowchartNodeData,
  generatePseudocodeFromFlowchart,
  getDecisionEdgeLabel,
  parsePalettePayload,
  serializePaletteItem,
} from './model';
import { FlowchartNodeData, FlowchartNodeType, NODE_DIMENSIONS, NODE_TYPE_CONFIG } from './types';
import {
  ArrowRightLeft,
  Box,
  Cpu,
  Download,
  GitBranch,
  Layout,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';

const iconMap = {
  Play,
  Cpu,
  GitBranch,
  ArrowRightLeft,
  Box,
};

// Shape preview components for palette
function ShapePreview({ type, color }: { type: FlowchartNodeType; color: string }) {
  switch (type) {
    case 'terminator':
      return (
        <div
          className="h-6 w-10 rounded-lg border-2"
          style={{ borderColor: color, background: 'transparent' }}
        />
      );
    case 'process':
      return (
        <div
          className="h-7 w-9 rounded-sm border-2"
          style={{ borderColor: color, background: 'transparent' }}
        />
      );
    case 'decision':
      return (
        <svg width="28" height="28" viewBox="0 0 28 28">
          <polygon
            points="14,2 26,14 14,26 2,14"
            fill="transparent"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'inputOutput':
      return (
        <svg width="28" height="20" viewBox="0 0 28 20">
          <polygon
            points="6,1 27,1 22,19 1,19"
            fill="transparent"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'subroutine':
      return (
        <div className="relative h-6 w-10">
          <div
            className="absolute inset-0 rounded-sm border-2"
            style={{ borderColor: color, background: 'transparent' }}
          />
          <div
            className="absolute left-0.5 top-0.5 bottom-0.5 w-0.5"
            style={{ background: color }}
          />
          <div
            className="absolute right-0.5 top-0.5 bottom-0.5 w-0.5"
            style={{ background: color }}
          />
        </div>
      );
    default:
      return null;
  }
}

interface FlowchartEditorProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  source?: string;
  onCodeChange?: (code: string) => void;
  onGenerateCode?: (code: string) => void;
  onSave?: (nodes: Node[], edges: Edge[]) => void;
}

function FlowchartEditorInner({
  initialNodes = [],
  initialEdges = [],
  source,
  onCodeChange,
  onGenerateCode,
  onSave,
}: FlowchartEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showPalette, setShowPalette] = useState(true);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const hasInitializedCodeSyncRef = useRef(false);
  const isHydratingFromSourceRef = useRef(false);
  const lastPublishedCodeRef = useRef<string>('');
  const nodesRef = useRef<Node[]>(initialNodes);
  const edgesRef = useRef<Edge[]>(initialEdges);
  const { screenToFlowPosition } = useReactFlow();

  const selectedNode = useMemo(() => nodes.find((node) => node.selected) ?? null, [nodes]);
  const selectedNodeData = selectedNode ? (selectedNode.data as FlowchartNodeData) : null;

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [edges, nodes]);

  useEffect(() => {
    if (onSave) {
      onSave(nodes, edges);
    }
  }, [edges, nodes, onSave]);

  useEffect(() => {
    if (typeof source !== 'string') {
      return;
    }

    const nextSource = source.replace(/\r\n/g, '\n').trim();
    const currentCode = generatePseudocodeFromFlowchart(nodesRef.current, edgesRef.current)
      .replace(/\r\n/g, '\n')
      .trim();

    if (nextSource === currentCode) {
      lastPublishedCodeRef.current = currentCode;
      return;
    }

    const imported = buildFlowchartFromPseudocode(source);
    const importedCode = generatePseudocodeFromFlowchart(imported.nodes, imported.edges)
      .replace(/\r\n/g, '\n')
      .trim();

    isHydratingFromSourceRef.current = true;
    lastPublishedCodeRef.current = importedCode;
    setNodes(imported.nodes);
    setEdges(imported.edges);
  }, [setEdges, setNodes, source]);

  useEffect(() => {
    const code = generatePseudocodeFromFlowchart(nodes, edges);
    if (!hasInitializedCodeSyncRef.current) {
      hasInitializedCodeSyncRef.current = true;
      lastPublishedCodeRef.current = code;
      return;
    }

    if (isHydratingFromSourceRef.current) {
      isHydratingFromSourceRef.current = false;
      lastPublishedCodeRef.current = code;
      return;
    }

    if (code === lastPublishedCodeRef.current) {
      return;
    }

    lastPublishedCodeRef.current = code;
    onCodeChange?.(code);
  }, [edges, nodes, onCodeChange]);

  const syncDecisionEdges = useCallback(
    (nodeId: string, nextData: FlowchartNodeData) => {
      setEdges((currentEdges) =>
        currentEdges.map((edge) => {
          if (edge.source !== nodeId) {
            return edge;
          }

          if (edge.sourceHandle === 'true') {
            return { ...edge, label: nextData.trueLabel || 'Yes' };
          }

          if (edge.sourceHandle === 'false') {
            return { ...edge, label: nextData.falseLabel || 'No' };
          }

          return edge;
        }),
      );
    },
    [setEdges],
  );

  const updateSelectedNodeData = useCallback(
    (updates: Partial<FlowchartNodeData>) => {
      if (!selectedNode || !selectedNodeData) {
        return;
      }

      const nextData = {
        ...selectedNodeData,
        ...updates,
      } satisfies FlowchartNodeData;

      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === selectedNode.id
            ? {
                ...node,
                data: nextData,
              }
            : node,
        ),
      );

      if (
        nextData.type === 'decision' &&
        (Object.prototype.hasOwnProperty.call(updates, 'trueLabel') ||
          Object.prototype.hasOwnProperty.call(updates, 'falseLabel'))
      ) {
        syncDecisionEdges(selectedNode.id, nextData);
      }
    },
    [selectedNode, selectedNodeData, setNodes, syncDecisionEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const sourceData = sourceNode ? (sourceNode.data as FlowchartNodeData) : null;
      const branchLabel = sourceData ? getDecisionEdgeLabel(connection, sourceData) : undefined;

      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: true,
            label: branchLabel,
            style: { stroke: 'var(--accent)', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)' },
            labelStyle: { fill: 'var(--text2)', fontSize: 11 },
          },
          currentEdges,
        ),
      );
    },
    [nodes, setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const payload = parsePalettePayload(event.dataTransfer.getData('application/reactflow'));
      if (!payload) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const dimensions = NODE_DIMENSIONS[payload.type];
      const newNode: Node = {
        id: `${payload.type}-${Date.now()}`,
        type: payload.type,
        position: {
          x: position.x - dimensions.width / 2,
          y: position.y - dimensions.height / 2,
        },
        data: createFlowchartNodeData(payload.type, payload.defaults),
      };

      setNodes((currentNodes) => currentNodes.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  const onDragStart = (event: React.DragEvent, payload: string) => {
    event.dataTransfer.setData('application/reactflow', payload);
    event.dataTransfer.effectAllowed = 'move';
  };

  const generatePseudocode = useCallback(() => {
    const code = generatePseudocodeFromFlowchart(nodes, edges);
    lastPublishedCodeRef.current = code;

    if (onGenerateCode) {
      onGenerateCode(code);
    }

    return code;
  }, [edges, nodes, onGenerateCode]);

  const deleteSelected = useCallback(() => {
    setNodes((currentNodes) => currentNodes.filter((node) => !node.selected));
    setEdges((currentEdges) => currentEdges.filter((edge) => !edge.selected));
  }, [setEdges, setNodes]);

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, [setEdges, setNodes]);

  const processStatements = useMemo(() => {
    if (!selectedNodeData || selectedNodeData.type !== 'process') {
      return [];
    }

    return Array.isArray(selectedNodeData.statements) ? selectedNodeData.statements : [];
  }, [selectedNodeData]);

  const updateProcessStatement = useCallback(
    (index: number, value: string) => {
      if (!selectedNodeData || selectedNodeData.type !== 'process') {
        return;
      }

      const nextStatements = [...processStatements];
      nextStatements[index] = value;
      updateSelectedNodeData({ statements: nextStatements });
    },
    [processStatements, selectedNodeData, updateSelectedNodeData],
  );

  const addProcessStatement = useCallback(() => {
    if (!selectedNodeData || selectedNodeData.type !== 'process') {
      return;
    }

    updateSelectedNodeData({ statements: [...processStatements, ''] });
  }, [processStatements, selectedNodeData, updateSelectedNodeData]);

  const removeProcessStatement = useCallback(
    (index: number) => {
      if (!selectedNodeData || selectedNodeData.type !== 'process') {
        return;
      }

      const nextStatements = processStatements.filter((_, statementIndex) => statementIndex !== index);
      updateSelectedNodeData({ statements: nextStatements.length > 0 ? nextStatements : [''] });
    },
    [processStatements, selectedNodeData, updateSelectedNodeData],
  );

  return (
    <div className="flex h-full w-full">
      <div
        className={`
          flex flex-col border-r border-[var(--separator)] bg-[var(--sidebar)]
          transition-all duration-300 ease-in-out
          ${showPalette ? 'w-64' : 'w-0 overflow-hidden'}
        `}
      >
        <div className="flex items-center justify-between border-b border-[var(--separator)] p-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Blocks</h3>
            <p className="mt-0.5 text-xs text-[var(--text2)]">Drag onto the flow</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {FLOWCHART_PALETTE_ITEMS.map((item) => {
            const config = NODE_TYPE_CONFIG[item.type];
            const Icon = iconMap[config.icon as keyof typeof iconMap];

            return (
              <div
                key={item.id}
                draggable
                onDragStart={(event) => onDragStart(event, serializePaletteItem(item))}
                className="
                  flex items-center gap-3 rounded-lg border border-[var(--separator)] bg-[var(--surface)] p-3
                  cursor-move transition-all duration-200 group
                  hover:border-[var(--accent)] hover:bg-[var(--surface2)]
                "
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${config.color}20` }}
                >
                  <ShapePreview type={item.type} color={config.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text)]">{item.title}</p>
                  <p className="text-xs text-[var(--text2)]">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-[var(--separator)] p-3 space-y-2">
          <button
            onClick={generatePseudocode}
            className="
              flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5
              bg-[var(--accent)] text-sm font-medium text-white transition-opacity hover:opacity-90
            "
          >
            <Download className="h-4 w-4" />
            Generate Code
          </button>

          <button
            onClick={clearCanvas}
            className="
              flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2
              bg-[var(--surface)] text-sm text-[var(--text2)] transition-colors
              hover:bg-red-500/10 hover:text-red-400
            "
          >
            <Trash2 className="h-4 w-4" />
            Clear Canvas
          </button>
        </div>
      </div>

      <button
        onClick={() => setShowPalette((current) => !current)}
        className={`
          absolute left-0 top-1/2 z-10 flex h-12 w-6 -translate-y-1/2 items-center justify-center rounded-r-lg
          border border-l-0 border-[var(--separator)] bg-[var(--sidebar)] text-[var(--text2)]
          transition-all duration-300 hover:text-[var(--text)]
          ${showPalette ? 'translate-x-64' : 'translate-x-0'}
        `}
        title={showPalette ? 'Hide palette' : 'Show palette'}
      >
        <Layout className="h-3 w-3" />
      </button>

      <div className="relative flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-right"
          deleteKeyCode={['Backspace', 'Delete']}
          className="flowchart-canvas bg-[var(--bg)]"
        >
          <Background gap={20} size={1} color="var(--separator)" className="opacity-20" />

          <Controls className="flowchart-controls" />

          <MiniMap
            className="flowchart-minimap"
            nodeColor={(node) => {
              const data = node.data as FlowchartNodeData;
              return NODE_TYPE_CONFIG[data.type]?.color || 'var(--text3)';
            }}
            pannable
            zoomable
          />
        </ReactFlow>
      </div>

      <aside className="flex w-80 shrink-0 flex-col border-l border-[var(--separator)] bg-[var(--sidebar)]">
        <div className="border-b border-[var(--separator)] p-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">Inspector</h3>
          <p className="mt-0.5 text-xs text-[var(--text2)]">
            {selectedNodeData
              ? 'Edit the selected block and its visible content.'
              : 'Select a block to configure input, output, or the lines inside a process.'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {selectedNodeData && selectedNode ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--separator)] bg-[var(--surface)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text3)]">
                  Selected
                </p>
                <h4 className="mt-2 text-base font-semibold text-[var(--text)]">
                  {NODE_TYPE_CONFIG[selectedNodeData.type].label}
                </h4>
                <p className="mt-2 text-xs leading-5 text-[var(--text2)]">
                  {NODE_TYPE_CONFIG[selectedNodeData.type].description}
                </p>
              </div>

              {selectedNodeData.type === 'terminator' ? (
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text3)]">
                    Label
                  </span>
                  <input
                    value={selectedNodeData.label}
                    onChange={(event) => updateSelectedNodeData({ label: event.target.value })}
                    className="w-full rounded-lg border border-[var(--separator)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
                    placeholder="Start"
                  />
                </label>
              ) : null}

              {selectedNodeData.type === 'inputOutput' ? (
                <>
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text3)]">
                      Mode
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {(['input', 'output'] as const).map((mode) => {
                        const active = selectedNodeData.ioType === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() =>
                              updateSelectedNodeData({
                                ioType: mode,
                                label: mode === 'input' ? 'Input' : 'Output',
                              })
                            }
                            className={`
                              rounded-lg border px-3 py-2 text-sm font-medium transition
                              ${
                                active
                                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                  : 'border-[var(--separator)] bg-[var(--surface)] text-[var(--text2)] hover:text-[var(--text)]'
                              }
                            `}
                          >
                            {mode === 'input' ? 'Input' : 'Output'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text3)]">
                      {selectedNodeData.ioType === 'input' ? 'Variable' : 'Value or expression'}
                    </span>
                    <textarea
                      value={typeof selectedNodeData.content === 'string' ? selectedNodeData.content : ''}
                      onChange={(event) => updateSelectedNodeData({ content: event.target.value })}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-[var(--separator)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
                      placeholder={selectedNodeData.ioType === 'input' ? 'UserName' : '"Hello world"'}
                    />
                  </label>
                </>
              ) : null}

              {selectedNodeData.type === 'process' ? (
                <>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text3)]">
                      Block title
                    </span>
                    <input
                      value={selectedNodeData.label}
                      onChange={(event) => updateSelectedNodeData({ label: event.target.value })}
                      className="w-full rounded-lg border border-[var(--separator)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
                      placeholder="Process"
                    />
                  </label>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text3)]">
                        Block lines
                      </span>
                      <button
                        type="button"
                        onClick={addProcessStatement}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--separator)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--text2)] transition hover:text-[var(--text)]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add line
                      </button>
                    </div>

                    <div className="space-y-3">
                      {processStatements.map((statement, index) => (
                        <div
                          key={`statement-${index}`}
                          className="rounded-xl border border-[var(--separator)] bg-[var(--surface)] p-3"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text3)]">
                              Line {index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeProcessStatement(index)}
                              className="rounded-lg p-1 text-[var(--text3)] transition hover:bg-red-500/10 hover:text-red-400"
                              aria-label={`Remove process line ${index + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <textarea
                            value={statement}
                            onChange={(event) => updateProcessStatement(index, event.target.value)}
                            rows={2}
                            className="w-full resize-none rounded-lg border border-[var(--separator)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
                            placeholder="Total <- Total + Value"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {selectedNodeData.type === 'decision' ? (
                <>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text3)]">
                      Condition
                    </span>
                    <textarea
                      value={typeof selectedNodeData.content === 'string' ? selectedNodeData.content : ''}
                      onChange={(event) => updateSelectedNodeData({ content: event.target.value })}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-[var(--separator)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
                      placeholder="Score >= 50"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text3)]">
                        Side branch
                      </span>
                      <input
                        value={selectedNodeData.trueLabel ?? 'Yes'}
                        onChange={(event) => updateSelectedNodeData({ trueLabel: event.target.value })}
                        className="w-full rounded-lg border border-[var(--separator)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text3)]">
                        Down branch
                      </span>
                      <input
                        value={selectedNodeData.falseLabel ?? 'No'}
                        onChange={(event) => updateSelectedNodeData({ falseLabel: event.target.value })}
                        className="w-full rounded-lg border border-[var(--separator)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
                      />
                    </label>
                  </div>
                </>
              ) : null}

              {selectedNodeData.type === 'subroutine' ? (
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text3)]">
                    Call target
                  </span>
                  <input
                    value={typeof selectedNodeData.content === 'string' ? selectedNodeData.content : ''}
                    onChange={(event) => updateSelectedNodeData({ content: event.target.value })}
                    className="w-full rounded-lg border border-[var(--separator)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
                    placeholder="ProcedureName()"
                  />
                </label>
              ) : null}

              <button
                type="button"
                onClick={deleteSelected}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--separator)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text2)] transition hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
                Delete selected block
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--separator)] bg-[var(--surface)] p-4">
                <p className="text-sm font-semibold text-[var(--text)]">Build it like blocks.</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text2)]">
                  Drop an Input or Output block, select it, then set the text it should read or show.
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text2)]">
                  For Process blocks, add one or more lines inside the block. That gives you a basic visual flow without adding separate built-in functions yet.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function FlowchartEditor(props: FlowchartEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowchartEditorInner {...props} />
    </ReactFlowProvider>
  );
}
