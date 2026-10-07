import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import FlowchartEditor from "@/app/components/flowchart/FlowchartEditor";

vi.mock("@xyflow/react", () => ({
  MarkerType: { ArrowClosed: "arrowclosed" },
  Position: { Top: "top", Right: "right", Bottom: "bottom" },
  Handle: () => null,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ReactFlow: ({ nodes }: { nodes: Node[] }) => (
    <div>
      {nodes.map((node) => (
        <div key={node.id} data-testid="flow-node">
          {node.type}
        </div>
      ))}
    </div>
  ),
  useNodesInitialized: () => true,
  useReactFlow: () => ({ fitView: vi.fn(), screenToFlowPosition: (position: { x: number; y: number }) => position }),
  useNodesState: (initial: unknown[]) => {
    const [value, setValue] = React.useState(initial);
    return [value, setValue, () => {}];
  },
  useEdgesState: (initial: unknown[]) => {
    const [value, setValue] = React.useState(initial);
    return [value, setValue, () => {}];
  },
  addEdge: (edge: unknown, edges: unknown[]) => [...edges, edge],
}));

const SOURCE = "DECLARE X : INTEGER\nX <- 5.0 // keep\nOUTPUT X";

describe("FlowchartEditor", () => {
  afterEach(cleanup);

  it("skips importing while hidden and catches up without rewriting the source", () => {
    const onCodeChange = vi.fn();
    const { rerender } = render(<FlowchartEditor source={SOURCE} onCodeChange={onCodeChange} isVisible={false} />);

    expect(screen.queryAllByTestId("flow-node")).toHaveLength(0);

    rerender(<FlowchartEditor source={SOURCE} onCodeChange={onCodeChange} isVisible />);

    expect(screen.getAllByTestId("flow-node").map((node) => node.textContent)).toEqual([
      "terminator",
      "process",
      "inputOutput",
      "terminator",
    ]);
    expect(onCodeChange).not.toHaveBeenCalled();
  });

  it("adds palette blocks by click or keyboard and publishes the edit", () => {
    const onCodeChange = vi.fn();
    render(<FlowchartEditor source={SOURCE} onCodeChange={onCodeChange} />);

    fireEvent.click(screen.getByRole("button", { name: /^Output/ }));
    expect(screen.getAllByTestId("flow-node")).toHaveLength(5);
    expect(onCodeChange).toHaveBeenLastCalledWith(`${SOURCE}\nOUTPUT "Result"`);

    fireEvent.keyDown(screen.getByRole("button", { name: /^Input/ }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("button", { name: /^Process/ }), { key: " " });
    expect(screen.getAllByTestId("flow-node")).toHaveLength(7);
  });

  it("labels the palette toggle as a button", () => {
    render(<FlowchartEditor source="" />);
    const toggle = screen.getByRole("button", { name: "Hide palette" });

    expect(toggle).toHaveAttribute("type", "button");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Show palette" })).toHaveAttribute("aria-expanded", "false");
  });

  it("clears only the canvas until Generate Code is pressed", () => {
    const onCodeChange = vi.fn();
    const onGenerateCode = vi.fn();
    render(<FlowchartEditor source={SOURCE} onCodeChange={onCodeChange} onGenerateCode={onGenerateCode} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear Canvas" }));
    expect(screen.queryAllByTestId("flow-node")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /^Output/ }));
    expect(onCodeChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Generate Code" }));
    expect(onGenerateCode).toHaveBeenCalledWith('OUTPUT "Result"');
  });
  it("undoes and redoes block additions, then discards redo after a new edit", () => {
    const onCodeChange = vi.fn();
    render(<FlowchartEditor source={SOURCE} onCodeChange={onCodeChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^Output/ }));
    expect(screen.getAllByTestId('flow-node')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Undo flowchart change' }));
    expect(screen.getAllByTestId('flow-node')).toHaveLength(4);
    expect(onCodeChange).toHaveBeenLastCalledWith(SOURCE);
    fireEvent.click(screen.getByRole('button', { name: 'Redo flowchart change' }));
    expect(screen.getAllByTestId('flow-node')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Undo flowchart change' }));
    fireEvent.click(screen.getByRole('button', { name: /^Input/ }));
    expect(screen.getByRole('button', { name: 'Redo flowchart change' })).toBeDisabled();
  });

  it("resets history on an external source change without publishing old code", () => {
    const onCodeChange = vi.fn();
    const { rerender } = render(<FlowchartEditor source={SOURCE} onCodeChange={onCodeChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^Output/ }));
    onCodeChange.mockClear();
    rerender(<FlowchartEditor source={'OUTPUT "new file"'} onCodeChange={onCodeChange} />);
    expect(onCodeChange).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('flow-node')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Undo flowchart change' })).toBeDisabled();
  });

  it("can undo clearing the canvas without changing the source", () => {
    const onCodeChange = vi.fn();
    render(<FlowchartEditor source={SOURCE} onCodeChange={onCodeChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Canvas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo flowchart change' }));
    expect(screen.getAllByTestId('flow-node')).toHaveLength(4);
    expect(onCodeChange).not.toHaveBeenCalled();
  });

});
