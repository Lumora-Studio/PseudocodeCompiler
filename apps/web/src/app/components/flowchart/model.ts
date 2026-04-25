import type { Connection, Edge, Node } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import { parseSource } from "@igcse/compiler";
import type {
  ArrayAccessNode,
  ExpressionNode,
  ForStatementNode,
  IdentifierNode,
  IfStatementNode,
  SourceSpan,
  StatementNode,
  WhileStatementNode,
} from "@igcse/compiler/types";
import { FlowchartNodeData, FlowchartNodeType, NODE_TYPE_CONFIG } from "./types";

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

type LayoutItem =
  | { kind: "terminator"; label: "Start" | "End" }
  | { kind: "statement"; statement: StatementNode };

type FallbackLayoutItem =
  | { kind: "terminator"; label: "Start" | "End" }
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
const FLOWCHART_BRANCH_COMMENT_RE = /^\/\/\s*(.+?)\s+branch$/i;
const FLOWCHART_VERTICAL_GAP = 76;
const FLOWCHART_BRANCH_HORIZONTAL_GAP = 300;
const FLOWCHART_BRANCH_VERTICAL_GAP = 92;
const FLOWCHART_NODE_X = 96;
const FLOWCHART_NODE_Y = 48;
const FLOWCHART_INDENT = "    ";
const UNARY_PRECEDENCE = 7;
const BINARY_PRECEDENCE: Record<string, number> = {
  OR: 1,
  AND: 2,
  "=": 3,
  "<": 3,
  "<=": 3,
  ">": 3,
  ">=": 3,
  "<>": 3,
  "+": 4,
  "-": 4,
  "*": 5,
  "/": 5,
  "^": 6,
};

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
      return 88;
    case "subroutine":
      return 80;
    case "decision":
      return 140;
    case "process": {
      const statements = getProcessStatements(data);
      return Math.max(100, 64 + statements.length * 40);
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
    position: { x, y },
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

function quoteLiteral(value: string, quote: '"' | "'"): string {
  const escapedSlash = value.replace(/\\/g, "\\\\");
  return `${quote}${escapedSlash.split(quote).join(`\\${quote}`)}${quote}`;
}

function getExpressionPrecedence(expression: ExpressionNode): number {
  if (expression.kind === "binary") {
    return BINARY_PRECEDENCE[expression.operator] ?? 0;
  }

  if (expression.kind === "unary") {
    return UNARY_PRECEDENCE;
  }

  return Number.POSITIVE_INFINITY;
}

function serializeExpression(expression: ExpressionNode, parentPrecedence = 0): string {
  switch (expression.kind) {
    case "identifier":
      return expression.name;
    case "arrayAccess":
      return `${expression.name}[${expression.indices
        .map((indexExpression) => serializeExpression(indexExpression))
        .join(", ")}]`;
    case "call":
      return `${expression.name}(${expression.args.map((arg) => serializeExpression(arg)).join(", ")})`;
    case "literal": {
      if (expression.literalType === "STRING") {
        return quoteLiteral(String(expression.value), '"');
      }

      if (expression.literalType === "CHAR") {
        return quoteLiteral(String(expression.value), "'");
      }

      if (expression.literalType === "BOOLEAN") {
        return expression.value ? "TRUE" : "FALSE";
      }

      return String(expression.value);
    }
    case "unary": {
      const operand = serializeExpression(expression.operand, UNARY_PRECEDENCE);
      const serialized = expression.operator === "NOT" ? `NOT ${operand}` : `-${operand}`;
      return UNARY_PRECEDENCE < parentPrecedence ? `(${serialized})` : serialized;
    }
    case "binary": {
      const precedence = getExpressionPrecedence(expression);
      const isRightAssociative = expression.operator === "^";
      const left = serializeExpression(expression.left, isRightAssociative ? precedence + 1 : precedence);
      const right = serializeExpression(expression.right, isRightAssociative ? precedence : precedence + 1);
      const serialized = `${left} ${expression.operator} ${right}`;
      return precedence < parentPrecedence ? `(${serialized})` : serialized;
    }
    default:
      return "";
  }
}

function serializeAssignableTarget(target: IdentifierNode | ArrayAccessNode): string {
  if (target.kind === "identifier") {
    return target.name;
  }

  return `${target.name}[${target.indices
    .map((indexExpression) => serializeExpression(indexExpression))
    .join(", ")}]`;
}

function extractNormalizedSpanLines(sourceLines: string[], span: SourceSpan): string[] {
  const startIndex = Math.max(0, span.startLine - 1);
  const endIndex = Math.min(sourceLines.length - 1, span.endLine - 1);
  if (sourceLines.length === 0 || startIndex > endIndex) {
    return [];
  }

  const lines = sourceLines.slice(startIndex, endIndex + 1).map((line, index, allLines) => {
    if (allLines.length === 1) {
      return line.slice(Math.max(0, span.startColumn - 1), Math.max(0, span.endColumn));
    }

    if (index === 0) {
      return line.slice(Math.max(0, span.startColumn - 1));
    }

    if (index === allLines.length - 1) {
      return line.slice(0, Math.max(0, span.endColumn));
    }

    return line;
  });

  return lines.map((line) => line.trimEnd());
}

function extractProcessLines(sourceLines: string[], statements: StatementNode[]): string[] {
  return statements.flatMap((statement) => extractNormalizedSpanLines(sourceLines, statement.span));
}

function extractIfMetadata(
  sourceLines: string[],
  statement: IfStatementNode,
): Pick<FlowchartNodeData, "trueLabel" | "falseLabel" | "hasElseBranch"> {
  const lines = extractNormalizedSpanLines(sourceLines, statement.span);
  const branchComments = lines
    .map((line) => line.trim())
    .map((line) => line.match(FLOWCHART_BRANCH_COMMENT_RE))
    .filter((match): match is RegExpMatchArray => Boolean(match));

  return {
    trueLabel: branchComments[0]?.[1]?.trim() || "Yes",
    falseLabel: branchComments[1]?.[1]?.trim() || "No",
    hasElseBranch: lines.some((line) => line.trim().toUpperCase() === "ELSE"),
  };
}

function serializeForLoopHeader(statement: ForStatementNode): string {
  const step = statement.stepValue ? ` STEP ${serializeExpression(statement.stepValue)}` : "";
  return `${statement.iterator.name} <- ${serializeExpression(statement.startValue)} TO ${serializeExpression(
    statement.endValue,
  )}${step}`;
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

function collectTopLevelItems(sourceLines: string[], statements: StatementNode[]): LayoutItem[] {
  const items: LayoutItem[] = [];
  let lineCursor = 1;

  const appendTerminatorComments = (fromLine: number, toLine: number) => {
    for (let lineNumber = fromLine; lineNumber <= toLine; lineNumber += 1) {
      const line = sourceLines[lineNumber - 1]?.trim() ?? "";
      if (FLOWCHART_START_COMMENT_RE.test(line)) {
        items.push({ kind: "terminator", label: "Start" });
      } else if (FLOWCHART_END_COMMENT_RE.test(line)) {
        items.push({ kind: "terminator", label: "End" });
      }
    }
  };

  for (const statement of statements) {
    appendTerminatorComments(lineCursor, statement.span.startLine - 1);
    items.push({ kind: "statement", statement });
    lineCursor = statement.span.endLine + 1;
  }

  appendTerminatorComments(lineCursor, sourceLines.length);
  return items;
}

function withImplicitTopLevelTerminators(items: LayoutItem[]): LayoutItem[] {
  if (items.length === 0) {
    return [];
  }

  const nextItems = [...items];
  const firstItem = nextItems[0];
  const lastItem = nextItems[nextItems.length - 1];

  if (!(firstItem.kind === "terminator" && firstItem.label === "Start")) {
    nextItems.unshift({ kind: "terminator", label: "Start" });
  }

  if (!(lastItem.kind === "terminator" && lastItem.label === "End")) {
    nextItems.push({ kind: "terminator", label: "End" });
  }

  return nextItems;
}

function layoutProcessLines(
  context: LayoutContext,
  x: number,
  y: number,
  processLines: string[],
): LayoutResult {
  const processData = buildProcessNodeData(processLines);
  const processNode = createNode(context, "process", processData, x, y);
  return {
    entryId: processNode.id,
    pendingExits: [{ nodeId: processNode.id }],
    nextY: y + getEstimatedNodeHeight("process", processData) + FLOWCHART_VERTICAL_GAP,
  };
}

function layoutWhileStatement(
  context: LayoutContext,
  x: number,
  y: number,
  statement: WhileStatementNode,
): LayoutResult {
  const nodeData = createFlowchartNodeData("decision", {
    content: serializeExpression(statement.condition),
    trueLabel: "Yes",
    falseLabel: "No",
    controlKind: "while",
    loopBodyHandle: "true",
    trueBranchEmpty: statement.body.length === 0,
    falseBranchEmpty: true,
  });
  const decisionNode = createNode(context, "decision", nodeData, x, y);
  const bodyStartY = y + getEstimatedNodeHeight("decision", nodeData) + FLOWCHART_BRANCH_VERTICAL_GAP;
  let bodyNextY = bodyStartY;

  if (statement.body.length === 0) {
    pushEdge(context, decisionNode.id, decisionNode.id, {
      sourceHandle: "true",
      label: nodeData.trueLabel || "Yes",
    });
  } else {
    const bodyLayout = layoutItems(
      context,
      x + FLOWCHART_BRANCH_HORIZONTAL_GAP,
      bodyStartY,
      statement.body.map((bodyStatement) => ({ kind: "statement", statement: bodyStatement })),
    );
    bodyNextY = bodyLayout.nextY;

    if (bodyLayout.entryId) {
      pushEdge(context, decisionNode.id, bodyLayout.entryId, {
        sourceHandle: "true",
        label: nodeData.trueLabel || "Yes",
      });
    }

    for (const exit of bodyLayout.pendingExits) {
      pushEdge(context, exit.nodeId, decisionNode.id, {
        sourceHandle: exit.sourceHandle,
        label: exit.label,
      });
    }
  }

  return {
    entryId: decisionNode.id,
    pendingExits: [createDecisionPendingExit(decisionNode.id, "false", nodeData)],
    nextY: Math.max(bodyNextY, bodyStartY) + FLOWCHART_VERTICAL_GAP,
  };
}

function layoutForStatement(
  context: LayoutContext,
  x: number,
  y: number,
  statement: ForStatementNode,
): LayoutResult {
  const nodeData = createFlowchartNodeData("decision", {
    content: serializeForLoopHeader(statement),
    trueLabel: "Yes",
    falseLabel: "No",
    controlKind: "for",
    loopBodyHandle: "true",
    forIterator: statement.iterator.name,
    trueBranchEmpty: statement.body.length === 0,
    falseBranchEmpty: true,
  });
  const decisionNode = createNode(context, "decision", nodeData, x, y);
  const bodyStartY = y + getEstimatedNodeHeight("decision", nodeData) + FLOWCHART_BRANCH_VERTICAL_GAP;
  let bodyNextY = bodyStartY;

  if (statement.body.length === 0) {
    pushEdge(context, decisionNode.id, decisionNode.id, {
      sourceHandle: "true",
      label: nodeData.trueLabel || "Yes",
    });
  } else {
    const bodyLayout = layoutItems(
      context,
      x + FLOWCHART_BRANCH_HORIZONTAL_GAP,
      bodyStartY,
      statement.body.map((bodyStatement) => ({ kind: "statement", statement: bodyStatement })),
    );
    bodyNextY = bodyLayout.nextY;

    if (bodyLayout.entryId) {
      pushEdge(context, decisionNode.id, bodyLayout.entryId, {
        sourceHandle: "true",
        label: nodeData.trueLabel || "Yes",
      });
    }

    for (const exit of bodyLayout.pendingExits) {
      pushEdge(context, exit.nodeId, decisionNode.id, {
        sourceHandle: exit.sourceHandle,
        label: exit.label,
      });
    }
  }

  return {
    entryId: decisionNode.id,
    pendingExits: [createDecisionPendingExit(decisionNode.id, "false", nodeData)],
    nextY: Math.max(bodyNextY, bodyStartY) + FLOWCHART_VERTICAL_GAP,
  };
}

function layoutIfStatement(
  context: LayoutContext,
  x: number,
  y: number,
  statement: IfStatementNode,
): LayoutResult {
  const metadata = extractIfMetadata(context.sourceLines, statement);
  const nodeData = createFlowchartNodeData("decision", {
    content: serializeExpression(statement.condition),
    trueLabel: metadata.trueLabel,
    falseLabel: metadata.falseLabel,
    controlKind: "if",
    hasElseBranch: metadata.hasElseBranch,
    trueBranchEmpty: statement.thenBody.length === 0,
    falseBranchEmpty: statement.elseBody.length === 0,
  });
  const decisionNode = createNode(context, "decision", nodeData, x, y);
  const branchStartY = y + getEstimatedNodeHeight("decision", nodeData) + FLOWCHART_BRANCH_VERTICAL_GAP;
  const thenLayout = layoutItems(
    context,
    x + FLOWCHART_BRANCH_HORIZONTAL_GAP,
    branchStartY,
    statement.thenBody.map((bodyStatement) => ({ kind: "statement", statement: bodyStatement })),
  );
  const elseLayout = layoutItems(
    context,
    x,
    branchStartY,
    statement.elseBody.map((bodyStatement) => ({ kind: "statement", statement: bodyStatement })),
  );

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

function layoutStatement(
  context: LayoutContext,
  x: number,
  y: number,
  statement: StatementNode,
): LayoutResult {
  switch (statement.kind) {
    case "input": {
      const nodeData = createFlowchartNodeData("inputOutput", {
        ioType: "input",
        label: "Input",
        content: serializeAssignableTarget(statement.target),
      });
      const inputNode = createNode(context, "inputOutput", nodeData, x, y);
      return {
        entryId: inputNode.id,
        pendingExits: [{ nodeId: inputNode.id }],
        nextY: y + getEstimatedNodeHeight("inputOutput", nodeData) + FLOWCHART_VERTICAL_GAP,
      };
    }
    case "output": {
      const nodeData = createFlowchartNodeData("inputOutput", {
        ioType: "output",
        label: "Output",
        content: statement.values.map((value) => serializeExpression(value)).join(", "),
      });
      const outputNode = createNode(context, "inputOutput", nodeData, x, y);
      return {
        entryId: outputNode.id,
        pendingExits: [{ nodeId: outputNode.id }],
        nextY: y + getEstimatedNodeHeight("inputOutput", nodeData) + FLOWCHART_VERTICAL_GAP,
      };
    }
    case "callStatement": {
      const content = `${statement.name}(${statement.args
        .map((argument) => serializeExpression(argument))
        .join(", ")})`;
      const nodeData = createFlowchartNodeData("subroutine", {
        label: "Subroutine",
        content,
        subroutineName: statement.name,
      });
      const subroutineNode = createNode(context, "subroutine", nodeData, x, y);
      return {
        entryId: subroutineNode.id,
        pendingExits: [{ nodeId: subroutineNode.id }],
        nextY: y + getEstimatedNodeHeight("subroutine", nodeData) + FLOWCHART_VERTICAL_GAP,
      };
    }
    case "if":
      return layoutIfStatement(context, x, y, statement);
    case "for":
      return layoutForStatement(context, x, y, statement);
    case "while":
      return layoutWhileStatement(context, x, y, statement);
    default:
      return layoutProcessLines(context, x, y, extractProcessLines(context.sourceLines, [statement]));
  }
}

function layoutItems(
  context: LayoutContext,
  x: number,
  y: number,
  items: LayoutItem[],
): LayoutResult {
  let entryId: string | null = null;
  let pendingExits: PendingExit[] = [];
  let currentY = y;
  let processStatements: StatementNode[] = [];

  const flushProcessStatements = () => {
    if (processStatements.length === 0) {
      return;
    }

    const processLayout = layoutProcessLines(
      context,
      x,
      currentY,
      extractProcessLines(context.sourceLines, processStatements),
    );
    if (processLayout.entryId) {
      connectPendingExits(context, pendingExits, processLayout.entryId);
      entryId ??= processLayout.entryId;
      pendingExits = processLayout.pendingExits;
      currentY = processLayout.nextY;
    }
    processStatements = [];
  };

  for (const item of items) {
    if (item.kind === "statement" && !isStructuredStatement(item.statement)) {
      processStatements.push(item.statement);
      continue;
    }

    flushProcessStatements();

    const layout =
      item.kind === "terminator"
        ? (() => {
            const nodeData = createFlowchartNodeData("terminator", { label: item.label });
            const node = createNode(context, "terminator", nodeData, x, currentY);
            return {
              entryId: node.id,
              pendingExits: [{ nodeId: node.id }],
              nextY: currentY + getEstimatedNodeHeight("terminator", nodeData) + FLOWCHART_VERTICAL_GAP,
            } satisfies LayoutResult;
          })()
        : layoutStatement(context, x, currentY, item.statement);

    if (layout.entryId) {
      connectPendingExits(context, pendingExits, layout.entryId);
      entryId ??= layout.entryId;
      pendingExits = layout.pendingExits;
      currentY = layout.nextY;
    }
  }

  flushProcessStatements();

  return {
    entryId,
    pendingExits,
    nextY: currentY,
  };
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
    withImplicitTopLevelTerminators(collectTopLevelItems(sourceLines, ast.body)),
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
        label: FLOWCHART_START_COMMENT_RE.test(trimmed) ? "Start" : "End",
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

function withImplicitFallbackTerminators(items: FallbackLayoutItem[]): FallbackLayoutItem[] {
  if (items.length === 0) {
    return [];
  }

  const nextItems = [...items];
  const firstItem = nextItems[0];
  const lastItem = nextItems[nextItems.length - 1];

  if (!(firstItem.kind === "terminator" && firstItem.label === "Start")) {
    nextItems.unshift({ kind: "terminator", label: "Start" });
  }

  if (!(lastItem.kind === "terminator" && lastItem.label === "End")) {
    nextItems.push({ kind: "terminator", label: "End" });
  }

  return nextItems;
}

function layoutFallbackLoop(
  context: LayoutContext,
  x: number,
  y: number,
  item: Extract<FallbackLayoutItem, { kind: "loop" }>,
): LayoutResult {
  const nodeData = createFlowchartNodeData("decision", {
    content: item.condition,
    trueLabel: "Yes",
    falseLabel: "No",
    controlKind: item.controlKind,
    loopBodyHandle: "true",
    forIterator: item.iterator,
    trueBranchEmpty: item.bodyItems.length === 0,
    falseBranchEmpty: true,
  });
  const decisionNode = createNode(context, "decision", nodeData, x, y);
  const bodyStartY = y + getEstimatedNodeHeight("decision", nodeData) + FLOWCHART_BRANCH_VERTICAL_GAP;
  let bodyNextY = bodyStartY;

  if (item.bodyItems.length === 0) {
    pushEdge(context, decisionNode.id, decisionNode.id, {
      sourceHandle: "true",
      label: nodeData.trueLabel || "Yes",
    });
  } else {
    const bodyLayout = layoutFallbackItems(context, x + FLOWCHART_BRANCH_HORIZONTAL_GAP, bodyStartY, item.bodyItems);
    bodyNextY = bodyLayout.nextY;

    if (bodyLayout.entryId) {
      pushEdge(context, decisionNode.id, bodyLayout.entryId, {
        sourceHandle: "true",
        label: nodeData.trueLabel || "Yes",
      });
    }

    for (const exit of bodyLayout.pendingExits) {
      pushEdge(context, exit.nodeId, decisionNode.id, {
        sourceHandle: exit.sourceHandle,
        label: exit.label,
      });
    }
  }

  return {
    entryId: decisionNode.id,
    pendingExits: [createDecisionPendingExit(decisionNode.id, "false", nodeData)],
    nextY: Math.max(bodyNextY, bodyStartY) + FLOWCHART_VERTICAL_GAP,
  };
}

function layoutFallbackIf(
  context: LayoutContext,
  x: number,
  y: number,
  item: Extract<FallbackLayoutItem, { kind: "if" }>,
): LayoutResult {
  const nodeData = createFlowchartNodeData("decision", {
    content: item.condition,
    trueLabel: "Yes",
    falseLabel: "No",
    controlKind: "if",
    hasElseBranch: item.hasElseBranch,
    trueBranchEmpty: item.thenItems.length === 0,
    falseBranchEmpty: item.elseItems.length === 0,
  });
  const decisionNode = createNode(context, "decision", nodeData, x, y);
  const branchStartY = y + getEstimatedNodeHeight("decision", nodeData) + FLOWCHART_BRANCH_VERTICAL_GAP;
  const thenLayout = layoutFallbackItems(context, x + FLOWCHART_BRANCH_HORIZONTAL_GAP, branchStartY, item.thenItems);
  const elseLayout = layoutFallbackItems(context, x, branchStartY, item.elseItems);

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

function layoutFallbackItem(
  context: LayoutContext,
  x: number,
  y: number,
  item: Exclude<FallbackLayoutItem, { kind: "processLine" }>,
): LayoutResult {
  switch (item.kind) {
    case "terminator": {
      const nodeData = createFlowchartNodeData("terminator", { label: item.label });
      const node = createNode(context, "terminator", nodeData, x, y);
      return {
        entryId: node.id,
        pendingExits: [{ nodeId: node.id }],
        nextY: y + getEstimatedNodeHeight("terminator", nodeData) + FLOWCHART_VERTICAL_GAP,
      };
    }
    case "input": {
      const nodeData = createFlowchartNodeData("inputOutput", {
        ioType: "input",
        label: "Input",
        content: item.content,
      });
      const node = createNode(context, "inputOutput", nodeData, x, y);
      return {
        entryId: node.id,
        pendingExits: [{ nodeId: node.id }],
        nextY: y + getEstimatedNodeHeight("inputOutput", nodeData) + FLOWCHART_VERTICAL_GAP,
      };
    }
    case "output": {
      const nodeData = createFlowchartNodeData("inputOutput", {
        ioType: "output",
        label: "Output",
        content: item.content,
      });
      const node = createNode(context, "inputOutput", nodeData, x, y);
      return {
        entryId: node.id,
        pendingExits: [{ nodeId: node.id }],
        nextY: y + getEstimatedNodeHeight("inputOutput", nodeData) + FLOWCHART_VERTICAL_GAP,
      };
    }
    case "subroutine": {
      const nodeData = createFlowchartNodeData("subroutine", {
        label: "Subroutine",
        content: item.content,
      });
      const node = createNode(context, "subroutine", nodeData, x, y);
      return {
        entryId: node.id,
        pendingExits: [{ nodeId: node.id }],
        nextY: y + getEstimatedNodeHeight("subroutine", nodeData) + FLOWCHART_VERTICAL_GAP,
      };
    }
    case "if":
      return layoutFallbackIf(context, x, y, item);
    case "loop":
      return layoutFallbackLoop(context, x, y, item);
  }
}

function layoutFallbackItems(
  context: LayoutContext,
  x: number,
  y: number,
  items: FallbackLayoutItem[],
): LayoutResult {
  let entryId: string | null = null;
  let pendingExits: PendingExit[] = [];
  let currentY = y;
  let processLines: string[] = [];

  const flushProcessLines = () => {
    if (processLines.length === 0) {
      return;
    }

    const processLayout = layoutProcessLines(context, x, currentY, processLines);
    if (processLayout.entryId) {
      connectPendingExits(context, pendingExits, processLayout.entryId);
      entryId ??= processLayout.entryId;
      pendingExits = processLayout.pendingExits;
      currentY = processLayout.nextY;
    }
    processLines = [];
  };

  for (const item of items) {
    if (item.kind === "processLine") {
      processLines.push(item.line);
      continue;
    }

    flushProcessLines();
    const layout = layoutFallbackItem(context, x, currentY, item);
    if (layout.entryId) {
      connectPendingExits(context, pendingExits, layout.entryId);
      entryId ??= layout.entryId;
      pendingExits = layout.pendingExits;
      currentY = layout.nextY;
    }
  }

  flushProcessLines();

  return {
    entryId,
    pendingExits,
    nextY: currentY,
  };
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
    withImplicitFallbackTerminators(parsed.items),
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

function isStartNode(data: FlowchartNodeData): boolean {
  return data.type === "terminator" && data.label.trim().toLowerCase().includes("start");
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
      return [isStartNode(data) ? "// Start" : "// End"];
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

function branchReachesNode(
  index: GraphIndex,
  startId: string | null,
  targetId: string,
): boolean {
  if (!startId) {
    return false;
  }

  if (startId === targetId) {
    return true;
  }

  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    for (const edge of index.outgoing.get(currentId) ?? []) {
      if (edge.target === targetId) {
        return true;
      }
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
      const trueLoops = branchReachesNode(index, trueStartId, node.id);
      const falseLoops = branchReachesNode(index, falseStartId, node.id);
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
