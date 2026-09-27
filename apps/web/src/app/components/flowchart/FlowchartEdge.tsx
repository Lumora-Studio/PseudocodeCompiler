'use client';

import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

/** Join forward branches just above their destination, below the other branch blocks. */
export function FlowchartEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    ...(props.targetY > props.sourceY + 72 ? { centerY: props.targetY - 36 } : {}),
    borderRadius: 12,
  });
  return (
    <BaseEdge
      id={props.id}
      path={path}
      style={props.style}
      markerStart={props.markerStart}
      markerEnd={props.markerEnd}
      interactionWidth={props.interactionWidth}
      label={props.label}
      labelX={labelX}
      labelY={labelY}
      labelStyle={props.labelStyle}
      labelShowBg={props.labelShowBg}
      labelBgStyle={props.labelBgStyle}
      labelBgPadding={props.labelBgPadding}
      labelBgBorderRadius={props.labelBgBorderRadius}
    />
  );
}

export const edgeTypes = { smoothstep: FlowchartEdge };
