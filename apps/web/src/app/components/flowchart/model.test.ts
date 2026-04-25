import { describe, expect, it } from "vitest";
import {
  buildFlowchartFromPseudocode,
  createFlowchartNodeData,
  generatePseudocodeFromFlowchart,
  getDecisionEdgeLabel,
} from "@/app/components/flowchart/model";
import type { FlowchartNodeData } from "@/app/components/flowchart/types";
import type { Edge, Node } from "@xyflow/react";

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

  it("generates pseudocode from configured flowchart blocks", () => {
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
      [
        "// Start",
        "INPUT Value",
        "Total <- Total + Value",
        "Count <- Count + 1",
        "OUTPUT Total",
        "// End",
      ].join("\n"),
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
    const body = [
      "IF Value > 10 THEN",
      '    OUTPUT "High"',
      "ELSE",
      "    INPUT Value",
      "ENDIF",
      'OUTPUT "Done"',
    ].join("\n");
    const expected = ["// Start", body, "// End"].join("\n");

    const snapshot = buildFlowchartFromPseudocode(body);
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
    expect(generatePseudocodeFromFlowchart(snapshot.nodes, snapshot.edges)).toBe(expected);
  });

  it("round-trips WHILE loops through a decision node with a back edge", () => {
    const body = [
      "WHILE Number > 9 DO",
      "    OUTPUT Number",
      "    INPUT Number",
      "ENDWHILE",
      'OUTPUT "Done"',
    ].join("\n");
    const expected = ["// Start", body, "// End"].join("\n");

    const snapshot = buildFlowchartFromPseudocode(body);
    const decisionNode = snapshot.nodes.find((node) => node.type === "decision");
    const backEdge = snapshot.edges.find((edge) => edge.target === decisionNode?.id);

    expect(decisionNode).toBeTruthy();
    expect(backEdge).toBeTruthy();
    expect(generatePseudocodeFromFlowchart(snapshot.nodes, snapshot.edges)).toBe(expected);
  });

  it("round-trips FOR loops through a decision node with a back edge", () => {
    const source = [
      "Total <- 0",
      "FOR Index <- 1 TO 5",
      '    OUTPUT "Pass"',
      "NEXT Index",
    ].join("\n");

    const snapshot = buildFlowchartFromPseudocode(source);
    const decisionNode = snapshot.nodes.find((node) => node.type === "decision");
    const backEdge = snapshot.edges.find((edge) => edge.target === decisionNode?.id);

    expect(snapshot.nodes.map((node) => node.type)).toContain("terminator");
    expect(decisionNode).toBeTruthy();
    expect((decisionNode?.data as FlowchartNodeData | undefined)?.controlKind).toBe("for");
    expect(backEdge).toBeTruthy();
    expect(generatePseudocodeFromFlowchart(snapshot.nodes, snapshot.edges)).toBe(
      ["// Start", source, "// End"].join("\n"),
    );
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
        "// Start",
        "DECLARE invalid_name : INTEGER",
        "FOR Index <- 1 TO 5",
        "    IF Index = 1 THEN",
        '        OUTPUT "First"',
        "    ENDIF",
        "NEXT Index",
        "// End",
      ].join("\n"),
    );
  });
});
