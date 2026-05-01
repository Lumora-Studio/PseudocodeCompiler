import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DecisionNode } from "@/app/components/flowchart/FlowchartNodes";

vi.mock("@xyflow/react", () => ({
  MarkerType: {
    ArrowClosed: "arrowclosed",
  },
  Handle: ({
    className,
    id,
    position,
    style,
    type,
  }: {
    className?: string;
    id?: string;
    position: string;
    style?: React.CSSProperties;
    type: string;
  }) => (
    <div
      className={className}
      data-handle-id={id ?? ""}
      data-position={position}
      data-type={type}
      style={style}
    />
  ),
  Position: {
    Top: "top",
    Right: "right",
    Bottom: "bottom",
  },
}));

describe("DecisionNode", () => {
  it("keeps connector handles above decorative labels", () => {
    const props: React.ComponentProps<typeof DecisionNode> = {
      id: "decision-1",
      type: "decision",
      selected: false,
      dragging: false,
      zIndex: 1,
      isConnectable: true,
      data: {
        type: "decision",
        label: "Decision",
        content: "Score >= 50",
        trueLabel: "Yes",
        falseLabel: "No",
      },
      xPos: 0,
      yPos: 0,
    };

    const { container } = render(
      <DecisionNode {...props} />,
    );

    expect(screen.getByText("Yes").className).toContain("pointer-events-none");
    expect(screen.getByText("No").className).toContain("pointer-events-none");

    expect(screen.getByText("Yes")).toHaveClass("pointer-events-none");
    expect(screen.getByText("No")).toHaveClass("pointer-events-none");

    expect(container.querySelector('[data-handle-id="true"]')).toHaveClass("!z-20");
    expect(container.querySelector('[data-handle-id="false"]')).toHaveClass("!z-20");
  });
});
