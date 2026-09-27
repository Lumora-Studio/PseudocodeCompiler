import type { Connection, Edge, Node } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import { parseSource } from "@igcse/compiler";
import type {
  ForStatementNode,
  IfStatementNode,
  SourceSpan,
  StatementNode,
  WhileStatementNode,
} from "@igcse/compiler/types";
import { FlowchartNodeData, FlowchartNodeType, NODE_TYPE_CONFIG, NODE_DIMENSIONS, TerminatorKind } from "./types";

export interface FlowchartPaletteItem {
  id: string;
  type: FlowchartNodeType;
  title: string;
  description: string;
  defaults: Partial<FlowchartNodeData>;
}

type PalettePayload = {
  type: FlowchartNodeType;
  defaults?: Partial<FlowchartNodeData>;
};

export interface FlowchartGraphSnapshot {
  nodes: Node[];
  edges: Edge[];
}

type TerminatorItem = { kind: "terminator"; terminatorKind: TerminatorKind; commentLine?: string };

type LayoutItem =
  | TerminatorItem
  | { kind: "comment"; line: string }
  | { kind: "statement"; statement: StatementNode };

type FallbackLayoutItem =
  | TerminatorItem
  | { kind: "processLine"; line: string }
  | { kind: "input"; content: string }
  | { kind: "output"; content: string }
  | { kind: "subroutine"; content: string }
  | {
      kind: "if";
      condition: string;
      thenItems: FallbackLayoutItem[];
      elseItems: FallbackLayoutItem[];
      hasElseBranch: boolean;
    }
  | {
      kind: "loop";
      controlKind: "for" | "while";
      condition: string;
      iterator?: string;
      bodyItems: FallbackLayoutItem[];
    };

type FallbackStopKind = "else" | "endif" | "next" | "endwhile";

interface FallbackParseResult {
  items: FallbackLayoutItem[];
  nextIndex: number;
  stopKind: FallbackStopKind | null;
}

type PendingExit = {
  nodeId: string;
  sourceHandle?: string;
  label?: string;
};

interface LayoutResult {
  entryId: string | null;
  pendingExits: PendingExit[];
  nextY: number;
}

interface LayoutContext {
  nodes: Node[];
  edges: Edge[];
  nextNodeIndex: number;
  nextEdgeIndex: number;
  sourceLines: string[];
}

interface GraphIndex {
  nodeMap: Map<string, Node>;
  outgoing: Map<string, Edge[]>;
  incoming: Map<string, Edge[]>;
}

interface EmitResult {
  lines: string[];
  visited: Set<string>;
}

const FLOWCHART_START_COMMENT_RE = /^\/\/\s*start$/i;
const FLOWCHART_END_COMMENT_RE = /^\/\/\s*end$/i;
const INPUT_LINE_RE = /^INPUT\s+(.+)$/i;
const OUTPUT_LINE_RE = /^OUTPUT\s+(.+)$/i;
const CALL_LINE_RE = /^CALL\s+(.+)$/i;
const IF_LINE_RE = /^IF\s+(.+?)\s+THEN$/i;
const ELSE_LINE_RE = /^ELSE$/i;
const ENDIF_LINE_RE = /^ENDIF$/i;
const FOR_LINE_RE = /^FOR\s+(.+)$/i;
const NEXT_LINE_RE = /^NEXT\b.*$/i;
const WHILE_LINE_RE = /^WHILE\s+(.+?)\s+DO$/i;
const ENDWHILE_LINE_RE = /^ENDWHILE$/i;
const FLOWCHART_VERTICAL_GAP = 76;
const FLOWCHART_BRANCH_HORIZONTAL_GAP = 300;
const FLOWCHART_BRANCH_VERTICAL_GAP = 92;
const FLOWCHART_NODE_X = 96;
const FLOWCHART_NODE_Y = 48;
const FLOWCHART_INDENT = "    ";

function createDefaultNodeData(type: FlowchartNodeType): FlowchartNodeData {
  switch (type) {
    case "terminator":
      return {
        label: NODE_TYPE_CONFIG[type].label,
        type,
      };
    case "process":
      return {
        label: NODE_TYPE_CONFIG[type].label,
        type,
        statements: [],
      };
    case "decision":
      return {
        label: NODE_TYPE_CONFIG[type].label,
        type,
        content: "Value > 10",
        trueLabel: "Yes",
        falseLabel: "No",
      };
    case "inputOutput":
      return {
        label: NODE_TYPE_CONFIG[type].label,
        type,
        ioType: "input",
        content: "Value",
      };
    case "subroutine":
      return {
        label: NODE_TYPE_CONFIG[type].label,
        type,
        content: "ProcedureName()",
        subroutineName: "ProcedureName",
      };
  }
}

export function createFlowchartNodeData(
  type: FlowchartNodeType,
  overrides: Partial<FlowchartNodeData> = {},
): FlowchartNodeData {
  const base = createDefaultNodeData(type);
  const nextData: FlowchartNodeData = {
    ...base,
    ...overrides,
    type,
  };

  if (type === "process") {
    nextData.statements = Array.isArray(overrides.statements)
      ? overrides.statements
      : (base.statements ?? []);
  }

  if (type === "inputOutput") {
    const ioType = overrides.ioType ?? base.ioType ?? "input";
    nextData.ioType = ioType;
    nextData.label = ioType === "input" ? "Input" : "Output";
  }

  return nextData;
}

export const FLOWCHART_PALETTE_ITEMS: FlowchartPaletteItem[] = [
  {
    id: "start",
    type: "terminator",
    title: "Start",
    description: "Program entry point",
    defaults: {
      label: "Start",
      terminatorKind: "start",
    },
  },
  {
    id: "input",
    type: "inputOutput",
    title: "Input",
    description: "Read a value into a variable",
    defaults: {
      label: "Input",
      ioType: "input",
      content: "Value",
    },
  },
  {
    id: "process",
    type: "process",
    title: "Process",
    description: "Add editable lines inside the block",
    defaults: {
      label: "Process",
      statements: [""],
    },
  },
  {
    id: "decision",
    type: "decision",
    title: "Decision",
    description: "Branch the flow with a condition",
    defaults: {
      label: "Decision",
      content: "Value > 10",
      trueLabel: "Yes",
      falseLabel: "No",
    },
  },
  {
    id: "output",
    type: "inputOutput",
    title: "Output",
    description: "Show a value or message",
    defaults: {
      label: "Output",
      ioType: "output",
      content: '"Result"',
    },
  },
  {
    id: "end",
    type: "terminator",
    title: "End",
    description: "Program exit point",
    defaults: {
      label: "End",
      terminatorKind: "end",
    },
  },
];

export function serializePaletteItem(item: FlowchartPaletteItem): string {
  return JSON.stringify({
    type: item.type,
    defaults: item.defaults,
  } satisfies PalettePayload);
}

export function parsePalettePayload(raw: string): PalettePayload | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PalettePayload>;
    if (!parsed.type || !NODE_TYPE_CONFIG[parsed.type]) {
      return null;
    }
    return {
      type: parsed.type,
      defaults: parsed.defaults,
    };
  } catch {
    if (raw in NODE_TYPE_CONFIG) {
      return { type: raw as FlowchartNodeType };
    }
    return null;
  }
}

function normalizeSourceForSync(source: string): string {
  return source.replace(/\r\n/g, "\n").trim();
}

function buildProcessNodeData(statements: string[]): FlowchartNodeData {
  const firstStatement = statements.find((statement) => statement.trim().length > 0)?.trim() ?? "";

  return createFlowchartNodeData("process", {
    label: firstStatement || "Process",
    statements,
  });
}

function createSequentialEdge(
  sourceId: string,
  targetId: string,
  index: number,
  options: Pick<Edge, "sourceHandle" | "label"> = {},
): Edge {
  return {
    id: `import-edge-${index}`,
    source: sourceId,
    target: targetId,
    sourceHandle: options.sourceHandle,
    type: "smoothstep",
    animated: true,
    label: options.label,
    style: { stroke: "var(--accent)", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--accent)" },
    labelStyle: { fill: "var(--text2)", fontSize: 11 },
  };
}

function getEstimatedNodeHeight(type: FlowchartNodeType, data: FlowchartNodeData): number {
  switch (type) {
    case "terminator":
      return 60;
    case "inputOutput":
      return Math.max(88, 56 + Math.ceil(getNodePrimaryText(data).length / 22) * 20);
    case "subroutine":
      return 80;
    case "decision":
      return 140;
    case "process": {
      const statements = getProcessStatements(data);
      return Math.max(100, 64 + statements.reduce((height, line) => height + Math.max(1, Math.ceil(line.length / 26)) * 20 + 24, 0));
    }
    default:
      return 100;
  }
}

function createNode(
  context: LayoutContext,
  type: FlowchartNodeType,
  data: FlowchartNodeData,
  x: number,
  y: number,
): Node {
  const node: Node = {
    id: `import-node-${context.nextNodeIndex}`,
    type,
    position: { x: x + (NODE_DIMENSIONS.process.width - NODE_DIMENSIONS[type].width) / 2, y },
    data,
  };

  context.nextNodeIndex += 1;
  context.nodes.push(node);
  return node;
}

function pushEdge(
  context: LayoutContext,
  sourceId: string,
  targetId: string,
  options: Pick<Edge, "sourceHandle" | "label"> = {},
): void {
  context.edges.push(createSequentialEdge(sourceId, targetId, context.nextEdgeIndex, options));
  context.nextEdgeIndex += 1;
}

function connectPendingExits(
  context: LayoutContext,
  pendingExits: PendingExit[],
  targetId: string,
): void {
  for (const pending of pendingExits) {
    pushEdge(context, pending.nodeId, targetId, {
      sourceHandle: pending.sourceHandle,
      label: pending.label,
    });
  }
}

function createDecisionPendingExit(
  nodeId: string,
  sourceHandle: "true" | "false",
  data: FlowchartNodeData,
): PendingExit {
  return {
    nodeId,
    sourceHandle,
    label: sourceHandle === "true" ? data.trueLabel || "Yes" : data.falseLabel || "No",
  };
}

function layoutSimpleNode(
  context: LayoutContext,
  x: number,
  y: number,
  type: FlowchartNodeType,
  data: FlowchartNodeData,
): LayoutResult {
  const node = createNode(context, type, data, x, y);
  return {
    entryId: node.id,
    pendingExits: [{ nodeId: node.id }],
    nextY: y + getEstimatedNodeHeight(type, data) + FLOWCHART_VERTICAL_GAP,
  };
}

function layoutTerminator(context: LayoutContext, x: number, y: number, item: TerminatorItem): LayoutResult {
  return layoutSimpleNode(
    context,
    x,
    y,
    "terminator",
    createFlowchartNodeData("terminator", {
      label: item.terminatorKind === "start" ? "Start" : "End",
      terminatorKind: item.terminatorKind,
      ...(item.commentLine ? { commentLine: item.commentLine } : {}),
    }),
  );
}

function layoutProcessLines(
  context: LayoutContext,
  x: number,
  y: number,
  processLines: string[],
): LayoutResult {
  return layoutSimpleNode(context, x, y, "process", buildProcessNodeData(processLines));
}

// Decision with a loop body on the "true" handle that flows back into the decision.
function layoutLoop(
  context: LayoutContext,
  x: number,
  y: number,
  nodeData: FlowchartNodeData,
  layoutBody: (x: number, y: number) => LayoutResult,
): LayoutResult {
  const decisionNode = createNode(context, "decision", nodeData, x, y);
  const bodyStartY = y + getEstimatedNodeHeight("decision", nodeData) + FLOWCHART_BRANCH_VERTICAL_GAP;
  const body = layoutBody(x + FLOWCHART_BRANCH_HORIZONTAL_GAP, bodyStartY);

  pushEdge(context, decisionNode.id, body.entryId ?? decisionNode.id, {
    sourceHandle: "true",
    label: nodeData.trueLabel || "Yes",
  });
  connectPendingExits(context, body.pendingExits, decisionNode.id);

  return {
    entryId: decisionNode.id,
    pendingExits: [createDecisionPendingExit(decisionNode.id, "false", nodeData)],
    nextY: Math.max(body.nextY, bodyStartY) + FLOWCHART_VERTICAL_GAP,
  };
}

// Decision whose "true" and "false" branches rejoin after the node.
function layoutBranches(
  context: LayoutContext,
  x: number,
  y: number,
  nodeData: FlowchartNodeData,
  layoutThen: (x: number, y: number) => LayoutResult,
  layoutElse: (x: number, y: number) => LayoutResult,
): LayoutResult {
  const decisionNode = createNode(context, "decision", nodeData, x, y);
  const branchStartY = y + getEstimatedNodeHeight("decision", nodeData) + FLOWCHART_BRANCH_VERTICAL_GAP;
  const thenStart = context.nodes.length;
  const thenLayout = layoutThen(x + FLOWCHART_BRANCH_HORIZONTAL_GAP, branchStartY);
  const elseStart = context.nodes.length;
  const elseLayout = layoutElse(x, branchStartY);
  const thenNodes = context.nodes.slice(thenStart, elseStart);
  const elseNodes = context.nodes.slice(elseStart);
  if (thenNodes.length && elseNodes.length) {
    const rightmostElse = Math.max(...elseNodes.map((node) => node.position.x + NODE_DIMENSIONS[(node.data as FlowchartNodeData).type].width));
    const leftmostThen = Math.min(...thenNodes.map((node) => node.position.x));
    const shift = Math.max(0, rightmostElse + 64 - leftmostThen);
    for (const node of thenNodes) node.position.x += shift;
  }

  if (thenLayout.entryId) {
    pushEdge(context, decisionNode.id, thenLayout.entryId, {
      sourceHandle: "true",
      label: nodeData.trueLabel || "Yes",
    });
  }

  if (elseLayout.entryId) {
    pushEdge(context, decisionNode.id, elseLayout.entryId, {
      sourceHandle: "false",
      label: nodeData.falseLabel || "No",
    });
  }

  return {
    entryId: decisionNode.id,
    pendingExits: [
      ...(thenLayout.entryId
        ? thenLayout.pendingExits
        : [createDecisionPendingExit(decisionNode.id, "true", nodeData)]),
      ...(elseLayout.entryId
        ? elseLayout.pendingExits
        : [createDecisionPendingExit(decisionNode.id, "false", nodeData)]),
    ],
    nextY: Math.max(thenLayout.nextY, elseLayout.nextY, branchStartY) + FLOWCHART_VERTICAL_GAP,
  };
}

// Lays out items in order, merging consecutive plain lines into one process block.
function layoutSequence<T>(
  context: LayoutContext,
  x: number,
  y: number,
  items: T[],
  getProcessLines: (item: T) => string[] | null,
  layoutItem: (item: T, x: number, y: number) => LayoutResult,
): LayoutResult {
  let entryId: string | null = null;
  let pendingExits: PendingExit[] = [];
  let currentY = y;
  let processLines: string[] = [];

  const append = (layout: LayoutResult) => {
    if (layout.entryId) {
      connectPendingExits(context, pendingExits, layout.entryId);
      entryId ??= layout.entryId;
      pendingExits = layout.pendingExits;
      currentY = layout.nextY;
    }
  };

  const flushProcessLines = () => {
    if (processLines.length > 0) {
      append(layoutProcessLines(context, x, currentY, processLines));
      processLines = [];
    }
  };

  for (const item of items) {
    const lines = getProcessLines(item);
    if (lines) {
      processLines.push(...lines);
      continue;
    }

    flushProcessLines();
    append(layoutItem(item, x, currentY));
  }

  flushProcessLines();

  return {
    entryId,
    pendingExits,
    nextY: currentY,
  };
}

function withImplicitTerminators<T extends { kind: string }>(items: T[]): Array<T | TerminatorItem> {
  if (items.length === 0) {
    return [];
  }

  const isTerminator = (item: T, terminatorKind: TerminatorKind) =>
    item.kind === "terminator" && (item as unknown as TerminatorItem).terminatorKind === terminatorKind;

  return [
    ...(isTerminator(items[0], "start") ? [] : [{ kind: "terminator", terminatorKind: "start" } as const]),
    ...items,
    ...(isTerminator(items[items.length - 1], "end") ? [] : [{ kind: "terminator", terminatorKind: "end" } as const]),
  ];
}

function getLineIndent(line: string): number {
  return line.length - line.trimStart().length;
}

// Source lines of a statement, kept whole (including trailing comments) and dedented.
// Falls back to the exact span when the statement shares its first line with earlier code.
function extractStatementLines(sourceLines: string[], span: SourceSpan): string[] {
  const lines = sourceLines.slice(span.startLine - 1, span.endLine);
  const indent = span.startColumn - 1;

  if ((lines[0] ?? "").slice(0, indent).trim().length > 0) {
    return lines.map((line, index) =>
      line.slice(index === 0 ? indent : 0, index === lines.length - 1 ? span.endColumn : undefined).trimEnd(),
    );
  }

  return lines.map((line) => line.slice(Math.min(indent, getLineIndent(line))).trimEnd());
}

// Exact source text from the start of one span to the end of another, so literals keep their lexemes.
function sliceSource(sourceLines: string[], from: SourceSpan, to: SourceSpan = from): string {
  return sourceLines
    .slice(from.startLine - 1, to.endLine)
    .map((line, index, lines) =>
      line.slice(index === 0 ? from.startColumn - 1 : 0, index === lines.length - 1 ? to.endColumn : undefined).trim(),
    )
    .join(" ");
}

// Statement text after its keyword, e.g. `Name // ask` for `INPUT Name // ask`.
function getStatementTail(sourceLines: string[], statement: StatementNode): string {
  return extractStatementLines(sourceLines, statement.span).join(" ").trim().replace(/^\S+\s*/, "");
}

// The `// ...` part of a line, ignoring `//` inside string and character literals.
function getLineComment(line: string): string | null {
  let quote: string | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote) {
      quote = char === quote ? null : quote;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "/" && line[index + 1] === "/") {
      return line.slice(index).trim();
    }
  }

  return null;
}

// The line holding this IF's own ELSE, searched only between its THEN and ELSE children.
function findElseLine(sourceLines: string[], statement: IfStatementNode): number | null {
  const fromLine = (statement.thenBody[statement.thenBody.length - 1]?.span.endLine ?? statement.span.startLine) + 1;
  const toLine = statement.elseBody[0]?.span.startLine ?? statement.span.endLine;
  for (let lineNumber = fromLine; lineNumber < toLine; lineNumber += 1) {
    if (/^ELSE\b/i.test(sourceLines[lineNumber - 1]?.trim() ?? "")) {
      return lineNumber;
    }
  }

  return null;
}

function extractForIteratorFromHeader(header: string): string | undefined {
  return header.match(/^([A-Za-z][A-Za-z0-9]*)\s*(?:←|<-)/)?.[1];
}

function isStructuredStatement(statement: StatementNode): boolean {
  return (
    statement.kind === "input" ||
    statement.kind === "output" ||
    statement.kind === "callStatement" ||
    statement.kind === "if" ||
    statement.kind === "for" ||
    statement.kind === "while"
  );
}

function toStatementItems(statements: StatementNode[]): LayoutItem[] {
  return statements.map((statement) => ({ kind: "statement", statement }));
}

// Statements in lines [fromLine, toLine] plus the comments on lines no child statement owns
// (own-line comments and trailing comments such as `ENDIF // done`).
function collectItems(
  sourceLines: string[],
  statements: StatementNode[],
  fromLine: number,
  toLine: number,
  topLevel = false,
): LayoutItem[] {
  const items: LayoutItem[] = [];
  const pushComments = (from: number, to: number) => {
    for (let lineNumber = from; lineNumber <= to; lineNumber += 1) {
      const line = sourceLines[lineNumber - 1]?.trim() ?? "";
      const comment = getLineComment(line);
      if (!comment) {
        continue;
      }

      if (topLevel && comment === line && (FLOWCHART_START_COMMENT_RE.test(line) || FLOWCHART_END_COMMENT_RE.test(line))) {
        items.push({
          kind: "terminator",
          terminatorKind: FLOWCHART_START_COMMENT_RE.test(line) ? "start" : "end",
          commentLine: line,
        });
      } else {
        items.push({ kind: "comment", line: comment });
      }
    }
  };

  let lineCursor = fromLine;
  for (const statement of statements) {
    pushComments(lineCursor, statement.span.startLine - 1);
    items.push({ kind: "statement", statement });
    lineCursor = Math.max(lineCursor, statement.span.endLine + 1);
  }

  pushComments(lineCursor, toLine);
  return items;
}

function layoutLoopStatement(
  context: LayoutContext,
  x: number,
  y: number,
  statement: WhileStatementNode | ForStatementNode,
): LayoutResult {
  const { sourceLines } = context;
  const items = collectItems(sourceLines, statement.body, statement.span.startLine, statement.span.endLine);
  const nodeData = createFlowchartNodeData("decision", {
    ...(statement.kind === "for"
      ? {
          content: sliceSource(sourceLines, statement.iterator.span, (statement.stepValue ?? statement.endValue).span),
          controlKind: "for",
          forIterator: statement.iterator.name,
        }
      : {
          content: sliceSource(sourceLines, statement.condition.span),
          controlKind: "while",
        }),
    loopBodyHandle: "true",
    trueBranchEmpty: items.length === 0,
    falseBranchEmpty: true,
  });

  return layoutLoop(context, x, y, nodeData, (bodyX, bodyY) => layoutItems(context, bodyX, bodyY, items));
}

function layoutIfStatement(
  context: LayoutContext,
  x: number,
  y: number,
  statement: IfStatementNode,
): LayoutResult {
  const { sourceLines } = context;
  const elseLine = findElseLine(sourceLines, statement);
  const thenItems = collectItems(
    sourceLines,
    statement.thenBody,
    statement.span.startLine,
    elseLine ? elseLine - 1 : statement.span.endLine,
  );
  const elseItems = elseLine
    ? collectItems(sourceLines, statement.elseBody, elseLine, statement.span.endLine)
    : toStatementItems(statement.elseBody);
  const nodeData = createFlowchartNodeData("decision", {
    content: sliceSource(sourceLines, statement.condition.span),
    controlKind: "if",
    hasElseBranch: elseLine !== null || elseItems.length > 0,
    trueBranchEmpty: thenItems.length === 0,
    falseBranchEmpty: elseItems.length === 0,
  });

  return layoutBranches(
    context,
    x,
    y,
    nodeData,
    (branchX, branchY) => layoutItems(context, branchX, branchY, thenItems),
    (branchX, branchY) => layoutItems(context, branchX, branchY, elseItems),
  );
}

function layoutStatement(
  context: LayoutContext,
  x: number,
  y: number,
  statement: StatementNode,
): LayoutResult {
  switch (statement.kind) {
    case "input":
    case "output":
      return layoutSimpleNode(
        context,
        x,
        y,
        "inputOutput",
        createFlowchartNodeData("inputOutput", {
          ioType: statement.kind,
          content: getStatementTail(context.sourceLines, statement),
        }),
      );
    case "callStatement":
      return layoutSimpleNode(
        context,
        x,
        y,
        "subroutine",
        createFlowchartNodeData("subroutine", {
          label: "Subroutine",
          content: getStatementTail(context.sourceLines, statement),
          subroutineName: statement.name,
        }),
      );
    case "if":
      return layoutIfStatement(context, x, y, statement);
    case "for":
    case "while":
      return layoutLoopStatement(context, x, y, statement);
    default:
      return layoutProcessLines(context, x, y, extractStatementLines(context.sourceLines, statement.span));
  }
}

function layoutItems(
  context: LayoutContext,
  x: number,
  y: number,
  items: LayoutItem[],
): LayoutResult {
  return layoutSequence(
    context,
    x,
    y,
    items,
    (item) => {
      if (item.kind === "comment") {
        return [item.line];
      }
      if (item.kind === "statement" && !isStructuredStatement(item.statement)) {
        return extractStatementLines(context.sourceLines, item.statement.span);
      }
      return null;
    },
    (item, itemX, itemY) =>
      item.kind === "statement"
        ? layoutStatement(context, itemX, itemY, item.statement)
        : item.kind === "terminator"
          ? layoutTerminator(context, itemX, itemY, item)
          : layoutProcessLines(context, itemX, itemY, [item.line]),
  );
}

function buildAstFlowchart(source: string): FlowchartGraphSnapshot | null {
  const { ast, diagnostics } = parseSource(source);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return null;
  }

  const sourceLines = source.replace(/\r\n/g, "\n").split("\n");
  const context: LayoutContext = {
    nodes: [],
    edges: [],
    nextNodeIndex: 0,
    nextEdgeIndex: 0,
    sourceLines,
  };

  layoutItems(
    context,
    FLOWCHART_NODE_X,
    FLOWCHART_NODE_Y,
    withImplicitTerminators(collectItems(sourceLines, ast.body, 1, sourceLines.length, true)),
  );
  return {
    nodes: context.nodes,
    edges: context.edges,
  };
}

function getFallbackStopKind(trimmed: string): FallbackStopKind | null {
  if (ELSE_LINE_RE.test(trimmed)) {
    return "else";
  }
  if (ENDIF_LINE_RE.test(trimmed)) {
    return "endif";
  }
  if (NEXT_LINE_RE.test(trimmed)) {
    return "next";
  }
  if (ENDWHILE_LINE_RE.test(trimmed)) {
    return "endwhile";
  }

  return null;
}

function parseFallbackItems(
  lines: string[],
  startIndex = 0,
  stopKinds: ReadonlySet<FallbackStopKind> = new Set(),
): FallbackParseResult {
  const items: FallbackLayoutItem[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index].trimEnd();
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      index += 1;
      continue;
    }

    const stopKind = getFallbackStopKind(trimmed);
    if (stopKind && stopKinds.has(stopKind)) {
      return { items, nextIndex: index, stopKind };
    }

    if (FLOWCHART_START_COMMENT_RE.test(trimmed) || FLOWCHART_END_COMMENT_RE.test(trimmed)) {
      items.push({
        kind: "terminator",
        terminatorKind: FLOWCHART_START_COMMENT_RE.test(trimmed) ? "start" : "end",
        commentLine: trimmed,
      });
      index += 1;
      continue;
    }

    const ifMatch = trimmed.match(IF_LINE_RE);
    if (ifMatch) {
      const thenResult = parseFallbackItems(lines, index + 1, new Set(["else", "endif"]));
      let elseItems: FallbackLayoutItem[] = [];
      let nextIndex = thenResult.nextIndex;
      let hasElseBranch = false;

      if (thenResult.stopKind === "else") {
        hasElseBranch = true;
        const elseResult = parseFallbackItems(lines, thenResult.nextIndex + 1, new Set(["endif"]));
        elseItems = elseResult.items;
        nextIndex = elseResult.nextIndex;
      }

      items.push({
        kind: "if",
        condition: ifMatch[1].trim(),
        thenItems: thenResult.items,
        elseItems,
        hasElseBranch,
      });
      index = nextIndex < lines.length && ENDIF_LINE_RE.test(lines[nextIndex].trim()) ? nextIndex + 1 : nextIndex;
      continue;
    }

    const forMatch = trimmed.match(FOR_LINE_RE);
    if (forMatch) {
      const header = forMatch[1].trim();
      const bodyResult = parseFallbackItems(lines, index + 1, new Set(["next"]));
      items.push({
        kind: "loop",
        controlKind: "for",
        condition: header,
        iterator: extractForIteratorFromHeader(header),
        bodyItems: bodyResult.items,
      });
      index =
        bodyResult.nextIndex < lines.length && NEXT_LINE_RE.test(lines[bodyResult.nextIndex].trim())
          ? bodyResult.nextIndex + 1
          : bodyResult.nextIndex;
      continue;
    }

    const whileMatch = trimmed.match(WHILE_LINE_RE);
    if (whileMatch) {
      const bodyResult = parseFallbackItems(lines, index + 1, new Set(["endwhile"]));
      items.push({
        kind: "loop",
        controlKind: "while",
        condition: whileMatch[1].trim(),
        bodyItems: bodyResult.items,
      });
      index =
        bodyResult.nextIndex < lines.length && ENDWHILE_LINE_RE.test(lines[bodyResult.nextIndex].trim())
          ? bodyResult.nextIndex + 1
          : bodyResult.nextIndex;
      continue;
    }

    const inputMatch = trimmed.match(INPUT_LINE_RE);
    if (inputMatch) {
      items.push({ kind: "input", content: inputMatch[1].trim() });
      index += 1;
      continue;
    }

    const outputMatch = trimmed.match(OUTPUT_LINE_RE);
    if (outputMatch) {
      items.push({ kind: "output", content: outputMatch[1].trim() });
      index += 1;
      continue;
    }

    const callMatch = trimmed.match(CALL_LINE_RE);
    if (callMatch) {
      items.push({ kind: "subroutine", content: callMatch[1].trim() });
      index += 1;
      continue;
    }

    items.push({ kind: "processLine", line });
    index += 1;
  }

  return { items, nextIndex: index, stopKind: null };
}

function layoutFallbackItem(
  context: LayoutContext,
  x: number,
  y: number,
  item: FallbackLayoutItem,
): LayoutResult {
  switch (item.kind) {
    case "terminator":
      return layoutTerminator(context, x, y, item);
    case "processLine":
      return layoutProcessLines(context, x, y, [item.line]);
    case "input":
    case "output":
      return layoutSimpleNode(
        context,
        x,
        y,
        "inputOutput",
        createFlowchartNodeData("inputOutput", { ioType: item.kind, content: item.content }),
      );
    case "subroutine":
      return layoutSimpleNode(
        context,
        x,
        y,
        "subroutine",
        createFlowchartNodeData("subroutine", { label: "Subroutine", content: item.content }),
      );
    case "if":
      return layoutBranches(
        context,
        x,
        y,
        createFlowchartNodeData("decision", {
          content: item.condition,
          controlKind: "if",
          hasElseBranch: item.hasElseBranch,
          trueBranchEmpty: item.thenItems.length === 0,
          falseBranchEmpty: item.elseItems.length === 0,
        }),
        (branchX, branchY) => layoutFallbackItems(context, branchX, branchY, item.thenItems),
        (branchX, branchY) => layoutFallbackItems(context, branchX, branchY, item.elseItems),
      );
    case "loop":
      return layoutLoop(
        context,
        x,
        y,
        createFlowchartNodeData("decision", {
          content: item.condition,
          controlKind: item.controlKind,
          loopBodyHandle: "true",
          forIterator: item.iterator,
          trueBranchEmpty: item.bodyItems.length === 0,
          falseBranchEmpty: true,
        }),
        (bodyX, bodyY) => layoutFallbackItems(context, bodyX, bodyY, item.bodyItems),
      );
  }
}

function layoutFallbackItems(
  context: LayoutContext,
  x: number,
  y: number,
  items: FallbackLayoutItem[],
): LayoutResult {
  return layoutSequence(
    context,
    x,
    y,
    items,
    (item) => (item.kind === "processLine" ? [item.line] : null),
    (item, itemX, itemY) => layoutFallbackItem(context, itemX, itemY, item),
  );
}

function buildFallbackFlowchart(source: string): FlowchartGraphSnapshot {
  const normalized = source.replace(/\r\n/g, "\n");
  if (normalizeSourceForSync(normalized).length === 0) {
    return { nodes: [], edges: [] };
  }

  const sourceLines = normalized.split("\n");
  const context: LayoutContext = {
    nodes: [],
    edges: [],
    nextNodeIndex: 0,
    nextEdgeIndex: 0,
    sourceLines,
  };

  const parsed = parseFallbackItems(sourceLines);
  layoutFallbackItems(
    context,
    FLOWCHART_NODE_X,
    FLOWCHART_NODE_Y,
    withImplicitTerminators(parsed.items),
  );

  return {
    nodes: context.nodes,
    edges: context.edges,
  };
}

export function buildFlowchartFromPseudocode(source: string): FlowchartGraphSnapshot {
  const normalized = source.replace(/\r\n/g, "\n");
  if (normalizeSourceForSync(normalized).length === 0) {
    return { nodes: [], edges: [] };
  }

  return buildAstFlowchart(normalized) ?? buildFallbackFlowchart(normalized);
}

export function getProcessStatements(data: FlowchartNodeData): string[] {
  if (!Array.isArray(data.statements)) {
    return [];
  }

  return data.statements
    .map((statement) => statement.trimEnd())
    .filter((statement) => statement.trim().length > 0);
}

export function getNodePrimaryText(data: FlowchartNodeData): string {
  const content = typeof data.content === "string" ? data.content.trim() : "";
  if (content.length > 0) {
    return content;
  }

  const label = typeof data.label === "string" ? data.label.trim() : "";
  return label;
}

// Nodes saved before `terminatorKind` existed fall back to their label.
export function getTerminatorKind(data: FlowchartNodeData): TerminatorKind {
  return data.terminatorKind ?? (data.label.trim().toLowerCase().includes("start") ? "start" : "end");
}

function isStartNode(data: FlowchartNodeData): boolean {
  return data.type === "terminator" && getTerminatorKind(data) === "start";
}

function compareNodes(a: Node, b: Node): number {
  if (a.position.y !== b.position.y) {
    return a.position.y - b.position.y;
  }
  return a.position.x - b.position.x;
}

function buildNodeLines(data: FlowchartNodeData): string[] {
  switch (data.type) {
    case "terminator":
      // Terminators only appear in code when the source already had a `// Start` / `// End` line.
      return typeof data.commentLine === "string" && data.commentLine ? [data.commentLine] : [];
    case "process": {
      const statements = getProcessStatements(data);
      if (statements.length > 0) {
        return statements;
      }

      const content = typeof data.content === "string" ? data.content.trim() : "";
      if (content.length > 0) {
        return [content];
      }

      return ["// Process"];
    }
    case "inputOutput": {
      const payload = getNodePrimaryText(data) || (data.ioType === "input" ? "Value" : '"Output"');
      return [data.ioType === "input" ? `INPUT ${payload}` : `OUTPUT ${payload}`];
    }
    case "decision": {
      const condition = getNodePrimaryText(data) || "Condition";
      if (data.controlKind === "for") {
        const iterator = typeof data.forIterator === "string" && data.forIterator.trim() ? data.forIterator.trim() : "";
        return [`FOR ${condition}`, `NEXT ${iterator}`.trimEnd()];
      }

      if (data.controlKind === "while") {
        return [`WHILE ${condition} DO`, "ENDWHILE"];
      }

      return [`IF ${condition} THEN`, ...(data.hasElseBranch ? ["ELSE"] : []), "ENDIF"];
    }
    case "subroutine": {
      const target = getNodePrimaryText(data) || "ProcedureName()";
      return [`CALL ${target}`];
    }
    default:
      return [];
  }
}

function buildGraphIndex(nodes: Node[], edges: Edge[]): GraphIndex {
  const sortedNodes = [...nodes].sort(compareNodes);
  const nodeMap = new Map(sortedNodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, Edge[]>();
  const incoming = new Map<string, Edge[]>();

  const compareOutgoingEdges = (left: Edge, right: Edge) => {
    const handlePriority = (edge: Edge) => {
      if (edge.sourceHandle === "true") {
        return 0;
      }
      if (edge.sourceHandle === "false") {
        return 1;
      }
      return 2;
    };

    const handleDelta = handlePriority(left) - handlePriority(right);
    if (handleDelta !== 0) {
      return handleDelta;
    }

    const leftNode = nodeMap.get(left.target);
    const rightNode = nodeMap.get(right.target);
    if (!leftNode || !rightNode) {
      return left.id.localeCompare(right.id);
    }

    return compareNodes(leftNode, rightNode);
  };

  for (const edge of edges) {
    const outgoingBucket = outgoing.get(edge.source) ?? [];
    outgoingBucket.push(edge);
    outgoing.set(edge.source, outgoingBucket);

    const incomingBucket = incoming.get(edge.target) ?? [];
    incomingBucket.push(edge);
    incoming.set(edge.target, incomingBucket);
  }

  for (const edgeList of outgoing.values()) {
    edgeList.sort(compareOutgoingEdges);
  }

  return { nodeMap, outgoing, incoming };
}

function getSortedNodes(nodes: Node[]): Node[] {
  return [...nodes].sort(compareNodes);
}

function getDecisionBranchEdges(index: GraphIndex, nodeId: string): {
  trueEdge: Edge | null;
  falseEdge: Edge | null;
} {
  const outgoing = index.outgoing.get(nodeId) ?? [];
  return {
    trueEdge: outgoing.find((edge) => edge.sourceHandle === "true") ?? null,
    falseEdge: outgoing.find((edge) => edge.sourceHandle === "false") ?? null,
  };
}

function getReachableDistances(
  index: GraphIndex,
  startId: string | null,
  stopIds: ReadonlySet<string>,
  forbiddenId: string,
): Map<string, number> {
  const distances = new Map<string, number>();
  if (!startId) {
    return distances;
  }

  const queue: Array<{ id: string; distance: number }> = [{ id: startId, distance: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || distances.has(current.id)) {
      continue;
    }

    if (current.id === forbiddenId && current.distance > 0) {
      continue;
    }

    distances.set(current.id, current.distance);
    if (stopIds.has(current.id) && current.distance > 0) {
      continue;
    }

    for (const edge of index.outgoing.get(current.id) ?? []) {
      if (!distances.has(edge.target)) {
        queue.push({ id: edge.target, distance: current.distance + 1 });
      }
    }
  }

  return distances;
}

// Whether a branch flows back into `targetId` without passing through `blockedIds`
// (enclosing decisions and stop nodes), so an outer loop's back edge doesn't count.
function branchReachesNode(
  index: GraphIndex,
  startId: string | null,
  targetId: string,
  blockedIds: ReadonlySet<string>,
): boolean {
  const visited = new Set<string>();
  const queue = startId ? [startId] : [];

  for (let position = 0; position < queue.length; position += 1) {
    const currentId = queue[position];
    if (currentId === targetId) {
      return true;
    }
    if (visited.has(currentId) || blockedIds.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    for (const edge of index.outgoing.get(currentId) ?? []) {
      queue.push(edge.target);
    }
  }

  return false;
}

function findDecisionMergeNode(
  index: GraphIndex,
  decisionId: string,
  trueStartId: string | null,
  falseStartId: string | null,
  stopIds: ReadonlySet<string>,
): string | null {
  if (!trueStartId || !falseStartId) {
    return null;
  }

  if (trueStartId === falseStartId) {
    return trueStartId;
  }

  const trueReachable = getReachableDistances(index, trueStartId, stopIds, decisionId);
  const falseReachable = getReachableDistances(index, falseStartId, stopIds, decisionId);
  const candidates: Array<{ id: string; maxDistance: number; totalDistance: number }> = [];

  for (const [nodeId, trueDistance] of trueReachable) {
    if (nodeId === decisionId || !falseReachable.has(nodeId)) {
      continue;
    }

    const falseDistance = falseReachable.get(nodeId);
    if (typeof falseDistance !== "number") {
      continue;
    }

    candidates.push({
      id: nodeId,
      maxDistance: Math.max(trueDistance, falseDistance),
      totalDistance: trueDistance + falseDistance,
    });
  }

  candidates.sort((left, right) => {
    if (left.maxDistance !== right.maxDistance) {
      return left.maxDistance - right.maxDistance;
    }

    if (left.totalDistance !== right.totalDistance) {
      return left.totalDistance - right.totalDistance;
    }

    const leftNode = index.nodeMap.get(left.id);
    const rightNode = index.nodeMap.get(right.id);
    if (!leftNode || !rightNode) {
      return left.id.localeCompare(right.id);
    }

    return compareNodes(leftNode, rightNode);
  });

  return candidates[0]?.id ?? null;
}

function indentLines(lines: string[]): string[] {
  return lines.map((line) => `${FLOWCHART_INDENT}${line}`);
}

function getNextLinearTarget(index: GraphIndex, nodeId: string): string | null {
  return (index.outgoing.get(nodeId) ?? [])[0]?.target ?? null;
}

function negateConditionText(condition: string): string {
  const trimmed = condition.trim();
  const wrappedMatch = trimmed.match(/^NOT\s+\((.+)\)$/i);
  if (wrappedMatch) {
    return wrappedMatch[1].trim();
  }

  if (/^NOT\s+/i.test(trimmed)) {
    return trimmed.replace(/^NOT\s+/i, "").trim();
  }

  return `NOT (${trimmed})`;
}

function emitSequence(
  index: GraphIndex,
  startId: string | null,
  stopIds: ReadonlySet<string>,
  globallyVisited: ReadonlySet<string>,
  activePath: ReadonlySet<string> = new Set(),
): EmitResult {
  const lines: string[] = [];
  const visited = new Set<string>();
  let currentId = startId;

  while (currentId && !stopIds.has(currentId) && !visited.has(currentId)) {
    if (globallyVisited.has(currentId) || activePath.has(currentId)) {
      break;
    }

    const node = index.nodeMap.get(currentId);
    if (!node) {
      break;
    }

    const nodeData = node.data as FlowchartNodeData;
    if (nodeData.type === "decision") {
      const { trueEdge, falseEdge } = getDecisionBranchEdges(index, node.id);
      const trueStartId = trueEdge?.target ?? null;
      const falseStartId = falseEdge?.target ?? null;
      const isLoopNode = nodeData.controlKind === "for" || nodeData.controlKind === "while";
      const blockedIds = new Set([...stopIds, ...activePath]);
      // Imported loops say which handle is the body; only user-drawn decisions are inferred.
      const trueLoops = isLoopNode
        ? nodeData.loopBodyHandle !== "false"
        : branchReachesNode(index, trueStartId, node.id, blockedIds);
      const falseLoops = isLoopNode
        ? nodeData.loopBodyHandle === "false"
        : branchReachesNode(index, falseStartId, node.id, blockedIds);
      visited.add(node.id);

      if (trueLoops !== falseLoops && (trueLoops || falseLoops)) {
        const loopHandle = trueLoops ? "true" : "false";
        const loopStartId = loopHandle === "true" ? trueStartId : falseStartId;
        const exitStartId = loopHandle === "true" ? falseStartId : trueStartId;
        const baseCondition = getNodePrimaryText(nodeData) || "Condition";
        const nextActivePath = new Set(activePath);
        nextActivePath.add(node.id);
        const loopBody =
          loopStartId && loopStartId !== node.id
            ? emitSequence(index, loopStartId, new Set([...stopIds, node.id]), globallyVisited, nextActivePath)
            : { lines: [], visited: new Set<string>() } satisfies EmitResult;

        if (nodeData.controlKind === "for") {
          const iterator =
            typeof nodeData.forIterator === "string" && nodeData.forIterator.trim().length > 0
              ? nodeData.forIterator.trim()
              : "";
          lines.push(`FOR ${baseCondition}`, ...indentLines(loopBody.lines), `NEXT ${iterator}`.trimEnd());
        } else {
          const loopCondition = loopHandle === "true" ? baseCondition : negateConditionText(baseCondition);
          lines.push(`WHILE ${loopCondition} DO`, ...indentLines(loopBody.lines), "ENDWHILE");
        }

        for (const visitedId of loopBody.visited) {
          visited.add(visitedId);
        }
        currentId = exitStartId;
        continue;
      }

      const mergeNodeId = findDecisionMergeNode(index, node.id, trueStartId, falseStartId, stopIds);
      const branchStopIds = mergeNodeId ? new Set([...stopIds, mergeNodeId]) : stopIds;
      const nextActivePath = new Set(activePath);
      nextActivePath.add(node.id);
      const trueBranch =
        trueStartId && trueStartId !== mergeNodeId
          ? emitSequence(index, trueStartId, branchStopIds, globallyVisited, nextActivePath)
          : { lines: [], visited: new Set<string>() } satisfies EmitResult;
      const falseBranch =
        falseStartId && falseStartId !== mergeNodeId
          ? emitSequence(index, falseStartId, branchStopIds, globallyVisited, nextActivePath)
          : { lines: [], visited: new Set<string>() } satisfies EmitResult;

      for (const visitedId of trueBranch.visited) {
        visited.add(visitedId);
      }
      for (const visitedId of falseBranch.visited) {
        visited.add(visitedId);
      }

      const shouldEmitElse =
        Boolean(nodeData.hasElseBranch) ||
        falseBranch.lines.length > 0 ||
        (Boolean(falseStartId) && falseStartId !== mergeNodeId);

      lines.push(`IF ${getNodePrimaryText(nodeData) || "Condition"} THEN`, ...indentLines(trueBranch.lines));
      if (shouldEmitElse) {
        lines.push("ELSE", ...indentLines(falseBranch.lines));
      }
      lines.push("ENDIF");

      currentId = mergeNodeId;
      continue;
    }

    lines.push(...buildNodeLines(nodeData));
    visited.add(node.id);
    currentId = getNextLinearTarget(index, node.id);
  }

  return { lines, visited };
}

export function generatePseudocodeFromFlowchart(nodes: Node[], edges: Edge[]): string {
  const sortedNodes = getSortedNodes(nodes);
  if (sortedNodes.length === 0) {
    return "";
  }

  const index = buildGraphIndex(nodes, edges);
  const visited = new Set<string>();
  const sections: string[] = [];
  const startCandidates = [
    ...sortedNodes.filter((node) => isStartNode(node.data as FlowchartNodeData)),
    ...sortedNodes.filter((node) => (index.incoming.get(node.id) ?? []).length === 0),
    ...sortedNodes,
  ];

  for (const candidate of startCandidates) {
    if (visited.has(candidate.id)) {
      continue;
    }

    const emitted = emitSequence(index, candidate.id, new Set(), visited);
    if (emitted.lines.length > 0) {
      sections.push(emitted.lines.join("\n"));
    }
    for (const visitedId of emitted.visited) {
      visited.add(visitedId);
    }
  }

  for (const node of sortedNodes) {
    if (visited.has(node.id)) {
      continue;
    }

    sections.push(buildNodeLines(node.data as FlowchartNodeData).join("\n"));
    visited.add(node.id);
  }

  return sections.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function getDecisionEdgeLabel(
  connection: Pick<Connection, "sourceHandle">,
  data: FlowchartNodeData,
): string | undefined {
  if (data.type !== "decision") {
    return undefined;
  }

  if (connection.sourceHandle === "true") {
    return data.trueLabel || "Yes";
  }

  if (connection.sourceHandle === "false") {
    return data.falseLabel || "No";
  }

  return undefined;
}
