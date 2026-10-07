import { describe, expect, it } from "vitest";
import { parseSource } from "@igcse/compiler";
import {
  buildFlowchartFromPseudocode,
  createFlowchartNodeData,
  generatePseudocodeFromFlowchart,
  getDecisionEdgeLabel,
  getTerminatorKind,
} from "@/app/components/flowchart/model";
import type { FlowchartNodeData } from "@/app/components/flowchart/types";
import type { Edge, Node } from "@xyflow/react";

function roundTrip(source: string, transform: (nodes: Node[]) => Node[] = (nodes) => nodes): string {
  const snapshot = buildFlowchartFromPseudocode(source);
  return generatePseudocodeFromFlowchart(transform(snapshot.nodes), snapshot.edges);
}

function parseWithoutSpans(source: string) {
  const { ast, diagnostics } = parseSource(source);
  expect(diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  return JSON.parse(JSON.stringify(ast, (key, value) => (key === "span" ? undefined : value)));
}

function mapNodeData(nodes: Node[], update: (data: FlowchartNodeData) => Partial<FlowchartNodeData>): Node[] {
  return nodes.map((node) => {
    const data = node.data as FlowchartNodeData;
    return { ...node, data: { ...data, ...update(data) } };
  });
}

// Each sample must regenerate the exact same text (and therefore the same AST).
const EXACT_ROUND_TRIP_SAMPLES: Record<string, string> = {
  comments: [
    "// compute total",
    "DECLARE Total : INTEGER",
    "Total <- 0 // init",
    "INPUT Total // ask",
    "WHILE Total < 10 DO",
    "    // grow",
    "    Total <- Total + 1",
    "ENDWHILE",
    "// done",
    "OUTPUT Total",
  ].join("\n"),
  realLiterals: ["DECLARE R : REAL", "R <- 2.50", "OUTPUT 5.0, R * 1.0"].join("\n"),
  backslashes: ['OUTPUT "C:\\temp"', "OUTPUT '\\'"].join("\n"),
  commentMarkersInStrings: ['DECLARE S : STRING', 'S <- "a//b"', 'IF S = "//" THEN', '    OUTPUT "x//y"', "ENDIF"].join(
    "\n",
  ),
  nestedIfWithoutElse: [
    "DECLARE X : INTEGER",
    "X <- 5",
    "IF X > 1 THEN",
    "    IF X > 3 THEN",
    '        OUTPUT "big"',
    "    ELSE",
    '        OUTPUT "mid"',
    "    ENDIF",
    "ENDIF",
    'OUTPUT "done"',
  ].join("\n"),
  nestedWhileInWhile: [
    "DECLARE I : INTEGER",
    "DECLARE J : INTEGER",
    "I <- 0",
    "WHILE I < 3 DO",
    "    J <- 0",
    "    WHILE J < 2 DO",
    "        J <- J + 1",
    "    ENDWHILE",
    "    I <- I + 1",
    "ENDWHILE",
    "OUTPUT I",
  ].join("\n"),
  nestedForInFor: [
    "DECLARE I : INTEGER",
    "DECLARE J : INTEGER",
    "FOR I <- 1 TO 3",
    "    FOR J <- 1 TO 2",
    "        OUTPUT I, J",
    "    NEXT J",
    "NEXT I",
  ].join("\n"),
  whileInFor: [
    "DECLARE I : INTEGER",
    "DECLARE N : INTEGER",
    "FOR I <- 10 TO 1 STEP -3",
    "    N <- I",
    "    WHILE N > 0 DO",
    "        N <- N - 1",
    "    ENDWHILE",
    "NEXT I",
    "OUTPUT N",
  ].join("\n"),
  ifElseInWhile: [
    "DECLARE N : INTEGER",
    "N <- 0",
    "WHILE N < 5 DO",
    "    IF MOD(N, 2) = 0 THEN",
    '        OUTPUT "even"',
    "    ELSE",
    '        OUTPUT "odd"',
    "    ENDIF",
    "    N <- N + 1",
    "ENDWHILE",
  ].join("\n"),
  ifAsLastStatementInLoop: [
    "DECLARE N : INTEGER",
    "FOR N <- 1 TO 4",
    "    IF N > 2 THEN",
    "        OUTPUT N",
    "    ENDIF",
    "NEXT N",
  ].join("\n"),
  operators: ["DECLARE X : INTEGER", "X <- 7", "OUTPUT (1 + 2) * 3, MOD(X, 2), DIV(X, 2), NOT (X > 1 AND X < 9), 2 ^ 3 ^ 2"].join("\n"),
  repeatUntil: ["DECLARE X : INTEGER", "X <- 0", "REPEAT", "    X <- X + 1", "UNTIL X > 3", "OUTPUT X"].join("\n"),
  caseOf: [
    "DECLARE Grade : CHAR",
    "Grade <- 'A'",
    "CASE OF Grade",
    "    'A' : OUTPUT \"Top\" // best",
    "    OTHERWISE OUTPUT \"Other\"",
    "ENDCASE",
  ].join("\n"),
  procedures: [
    "PROCEDURE Greet(Name : STRING)",
    '    OUTPUT "Hello ", Name // inside',
    "ENDPROCEDURE",
    "FUNCTION Twice(N : INTEGER) RETURNS INTEGER",
    "    RETURN N * 2",
    "ENDFUNCTION",
    'CALL Greet("Ada")',
    "OUTPUT Twice(4)",
  ].join("\n"),
  legacyStartEndMarkers: ["// Start", "INPUT Value", "OUTPUT Value", "// End"].join("\n"),
};

describe("flowchart model helpers", () => {
  it("creates input and output nodes with the correct defaults", () => {
    const inputNode = createFlowchartNodeData("inputOutput", {
      ioType: "input",
      content: "UserName",
    });
    const outputNode = createFlowchartNodeData("inputOutput", {
      ioType: "output",
      content: '"Done"',
    });

    expect(inputNode.label).toBe("Input");
    expect(inputNode.ioType).toBe("input");
    expect(outputNode.label).toBe("Output");
    expect(outputNode.ioType).toBe("output");
  });

  it("generates pseudocode from configured flowchart blocks without injecting terminator comments", () => {
    const nodes: Node[] = [
      {
        id: "start",
        type: "terminator",
        position: { x: 0, y: 0 },
        data: createFlowchartNodeData("terminator", { label: "Start" }),
      },
      {
        id: "input",
        type: "inputOutput",
        position: { x: 0, y: 120 },
        data: createFlowchartNodeData("inputOutput", {
          ioType: "input",
          content: "Value",
        }),
      },
      {
        id: "process",
        type: "process",
        position: { x: 0, y: 240 },
        data: createFlowchartNodeData("process", {
          label: "Process",
          statements: ["Total <- Total + Value", "Count <- Count + 1"],
        }),
      },
      {
        id: "output",
        type: "inputOutput",
        position: { x: 0, y: 360 },
        data: createFlowchartNodeData("inputOutput", {
          ioType: "output",
          content: "Total",
        }),
      },
      {
        id: "end",
        type: "terminator",
        position: { x: 0, y: 480 },
        data: createFlowchartNodeData("terminator", { label: "End" }),
      },
    ];

    const edges: Edge[] = [
      { id: "e1", source: "start", target: "input" },
      { id: "e2", source: "input", target: "process" },
      { id: "e3", source: "process", target: "output" },
      { id: "e4", source: "output", target: "end" },
    ];

    expect(generatePseudocodeFromFlowchart(nodes, edges)).toBe(
      ["INPUT Value", "Total <- Total + Value", "Count <- Count + 1", "OUTPUT Total"].join("\n"),
    );
  });

  it("uses configured branch labels for decision connections", () => {
    const label = getDecisionEdgeLabel(
      { sourceHandle: "true" },
      createFlowchartNodeData("decision", {
        content: "Score >= 50",
        trueLabel: "Pass",
        falseLabel: "Retry",
      }),
    );

    expect(label).toBe("Pass");
  });

  it("hydrates a block graph from structured IF / ELSE pseudocode", () => {
    const source = [
      "// Start",
      "INPUT Value",
      "IF Score >= 50 THEN",
      '    OUTPUT "Pass"',
      "ELSE",
      '    OUTPUT "Retry"',
      "ENDIF",
      'OUTPUT "Done"',
      "// End",
    ].join("\n");

    const snapshot = buildFlowchartFromPseudocode(source);

    expect(snapshot.nodes.map((node) => node.type)).toEqual([
      "terminator",
      "inputOutput",
      "decision",
      "inputOutput",
      "inputOutput",
      "inputOutput",
      "terminator",
    ]);
    expect(generatePseudocodeFromFlowchart(snapshot.nodes, snapshot.edges)).toBe(source);
  });

  it("builds a real branched graph for IF / ELSE blocks and reconnects both branches", () => {
    const source = [
      "IF Value > 10 THEN",
      '    OUTPUT "High"',
      "ELSE",
      "    INPUT Value",
      "ENDIF",
      'OUTPUT "Done"',
    ].join("\n");

    const snapshot = buildFlowchartFromPseudocode(source);
    const decisionNode = snapshot.nodes.find((node) => node.type === "decision");
    const finalOutputNode = snapshot.nodes.find((node) => {
      const data = node.data as FlowchartNodeData;
      return node.type === "inputOutput" && data.ioType === "output" && data.content === '"Done"';
    });

    expect(decisionNode).toBeTruthy();
    expect(finalOutputNode).toBeTruthy();

    const trueEdge = snapshot.edges.find((edge) => edge.source === decisionNode?.id && edge.sourceHandle === "true");
    const falseEdge = snapshot.edges.find((edge) => edge.source === decisionNode?.id && edge.sourceHandle === "false");
    const mergeEdges = snapshot.edges.filter((edge) => edge.target === finalOutputNode?.id);

    expect(trueEdge?.label).toBe("Yes");
    expect(falseEdge?.label).toBe("No");
    expect(mergeEdges).toHaveLength(2);

    const trueTarget = snapshot.nodes.find((node) => node.id === trueEdge?.target);
    const falseTarget = snapshot.nodes.find((node) => node.id === falseEdge?.target);

    expect((trueTarget?.position.x ?? 0) > (decisionNode?.position.x ?? 0)).toBe(true);
    expect((falseTarget?.position.y ?? 0) > (decisionNode?.position.y ?? 0)).toBe(true);
    expect(generatePseudocodeFromFlowchart(snapshot.nodes, snapshot.edges)).toBe(source);
  });

  it("round-trips WHILE loops through a decision node with a back edge", () => {
    const source = [
      "WHILE Number > 9 DO",
      "    OUTPUT Number",
      "    INPUT Number",
      "ENDWHILE",
      'OUTPUT "Done"',
    ].join("\n");

    const snapshot = buildFlowchartFromPseudocode(source);
    const decisionNode = snapshot.nodes.find((node) => node.type === "decision");
    const backEdge = snapshot.edges.find((edge) => edge.target === decisionNode?.id);

    expect(decisionNode).toBeTruthy();
    expect(backEdge).toBeTruthy();
    expect(generatePseudocodeFromFlowchart(snapshot.nodes, snapshot.edges)).toBe(source);
  });

  it("round-trips FOR loops through a decision node with a back edge", () => {
    const source = ["Total <- 0", "FOR Index <- 1 TO 5", '    OUTPUT "Pass"', "NEXT Index"].join("\n");

    const snapshot = buildFlowchartFromPseudocode(source);
    const decisionNode = snapshot.nodes.find((node) => node.type === "decision");
    const backEdge = snapshot.edges.find((edge) => edge.target === decisionNode?.id);

    expect(snapshot.nodes.map((node) => node.type)).toContain("terminator");
    expect(decisionNode).toBeTruthy();
    expect((decisionNode?.data as FlowchartNodeData | undefined)?.controlKind).toBe("for");
    expect(backEdge).toBeTruthy();
    expect(generatePseudocodeFromFlowchart(snapshot.nodes, snapshot.edges)).toBe(source);
  });

  it("keeps control structures as decisions when falling back to line parsing", () => {
    const source = [
      "DECLARE invalid_name : INTEGER",
      "FOR Index <- 1 TO 5",
      "IF Index = 1 THEN",
      'OUTPUT "First"',
      "ENDIF",
      "NEXT Index",
    ].join("\n");

    const snapshot = buildFlowchartFromPseudocode(source);
    const decisionNodes = snapshot.nodes.filter((node) => node.type === "decision");

    expect(decisionNodes.map((node) => (node.data as FlowchartNodeData).controlKind)).toEqual(["for", "if"]);
    expect(generatePseudocodeFromFlowchart(snapshot.nodes, snapshot.edges)).toBe(
      [
        "DECLARE invalid_name : INTEGER",
        "FOR Index <- 1 TO 5",
        "    IF Index = 1 THEN",
        '        OUTPUT "First"',
        "    ENDIF",
        "NEXT Index",
      ].join("\n"),
    );
  });
});

describe("flowchart round trip", () => {
  it.each(Object.entries(EXACT_ROUND_TRIP_SAMPLES))("regenerates %s exactly", (_name, source) => {
    const generated = roundTrip(source);

    expect(generated).toBe(source);
    expect(parseWithoutSpans(generated)).toEqual(parseWithoutSpans(source));
    expect(roundTrip(generated)).toBe(generated);
  });

  it("keeps trailing comments on control lines and the program's AST", () => {
    const source = [
      "DECLARE X : INTEGER",
      "X <- 1",
      "IF X > 0 THEN // positive",
      "    OUTPUT X",
      "ELSE // other",
      "    OUTPUT 0",
      "ENDIF // after if",
      "WHILE X < 3 DO // loop",
      "    X <- X + 1",
      "ENDWHILE",
    ].join("\n");

    const generated = roundTrip(source);

    expect(parseWithoutSpans(generated)).toEqual(parseWithoutSpans(source));
    for (const comment of ["// positive", "// other", "// after if", "// loop"]) {
      expect(generated).toContain(comment);
    }
    expect(roundTrip(generated)).toBe(generated);
  });

  it("reads loops from loopBodyHandle even when a user-drawn nested loop has no controlKind", () => {
    const source = EXACT_ROUND_TRIP_SAMPLES.nestedWhileInWhile;
    const generated = roundTrip(source, (nodes) =>
      mapNodeData(nodes, (data) => (data.type === "decision" ? { controlKind: undefined, loopBodyHandle: undefined } : {})),
    );

    expect(generated).toBe(source);
  });

  it("emits a loop whose body sits on the false handle with a negated condition", () => {
    const source = ["DECLARE N : INTEGER", "N <- 0", "WHILE N < 3 DO", "    N <- N + 1", "ENDWHILE"].join("\n");
    const snapshot = buildFlowchartFromPseudocode(source);
    const decision = snapshot.nodes.find((node) => node.type === "decision");
    const edges = snapshot.edges.map((edge) =>
      edge.source === decision?.id && edge.sourceHandle
        ? { ...edge, sourceHandle: edge.sourceHandle === "true" ? "false" : "true" }
        : edge,
    );
    const nodes = mapNodeData(snapshot.nodes, (data) => (data.type === "decision" ? { loopBodyHandle: "false" } : {}));

    expect(generatePseudocodeFromFlowchart(nodes, edges)).toContain("WHILE NOT (N < 3) DO");
  });
});

describe("terminator kinds", () => {
  it("stores the terminator kind on imported and palette nodes", () => {
    const snapshot = buildFlowchartFromPseudocode('OUTPUT "hi"');
    const kinds = snapshot.nodes
      .filter((node) => node.type === "terminator")
      .map((node) => (node.data as FlowchartNodeData).terminatorKind);

    expect(kinds).toEqual(["start", "end"]);
  });

  it.each(["Begin", "开始"])("still generates correctly after renaming Start to %s", (label) => {
    const source = EXACT_ROUND_TRIP_SAMPLES.legacyStartEndMarkers;
    const generated = roundTrip(source, (nodes) =>
      mapNodeData(nodes, (data) =>
        data.type !== "terminator" ? {} : data.terminatorKind === "start" ? { label } : { label: "Restart" },
      ),
    );

    expect(generated).toBe(source);
  });

  it("falls back to the label for nodes saved without terminatorKind", () => {
    expect(getTerminatorKind(createFlowchartNodeData("terminator", { label: "Start" }))).toBe("start");
    expect(getTerminatorKind(createFlowchartNodeData("terminator", { label: "Stop" }))).toBe("end");
    expect(getTerminatorKind(createFlowchartNodeData("terminator", { label: "Start", terminatorKind: "end" }))).toBe(
      "end",
    );
  });
});


describe("nested branch layout", () => {
  it("keeps sibling branch columns apart even when both contain nested decisions", () => {
    const source = 'IF A > 0 THEN\n    IF B > 0 THEN\n        OUTPUT "AB"\n    ENDIF\nELSE\n    IF C > 0 THEN\n        OUTPUT "C"\n    ENDIF\nENDIF';
    const { nodes, edges } = buildFlowchartFromPseudocode(source);
    const decisions = nodes.filter((node) => node.type === 'decision');
    const thenBranch = nodes.find((node) => node.id === edges.find((edge) => edge.source === decisions[0].id && edge.sourceHandle === 'true')?.target)!;
    const elseOutput = nodes.find((node) => node.data.content === '"C"')!;
    expect(thenBranch.position.x).toBeGreaterThan(elseOutput.position.x + 220);
    expect(generatePseudocodeFromFlowchart(nodes, edges)).toBe(source);
  });
});
