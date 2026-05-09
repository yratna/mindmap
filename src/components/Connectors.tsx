import React from 'react';
import { MindMapNode, Position } from '../types';
import { getNodeDimensions } from '../layout/treeLayout';
import { getNodeColor } from '../store/mindMapStore';

interface Props {
  nodes: Record<string, MindMapNode>;
  positions: Record<string, Position>;
  depths: Record<string, number>;
}

export const Connectors: React.FC<Props> = ({ nodes, positions, depths }) => {
  const lines: React.ReactNode[] = [];

  for (const nodeId in positions) {
    const node = nodes[nodeId];
    if (!node || node.collapsed) continue;

    const parentPos = positions[nodeId];
    if (!parentPos) continue;
    const parentDims = getNodeDimensions(node);

    for (const childId of node.children) {
      const childNode = nodes[childId];
      const childPos = positions[childId];
      if (!childPos || !childNode) continue;

      const childDims = getNodeDimensions(childNode);

      const x1 = parentPos.x + parentDims.width;
      const y1 = parentPos.y + parentDims.height / 2;
      const x2 = childPos.x;
      const y2 = childPos.y + childDims.height / 2;

      const cpOffset = (x2 - x1) * 0.5;
      const cp1x = x1 + cpOffset;
      const cp1y = y1;
      const cp2x = x2 - cpOffset;
      const cp2y = y2;

      const parentDepth = depths[nodeId] ?? 0;
      const color = getNodeColor(parentDepth, node.color);

      lines.push(
        <path
          key={`${nodeId}-${childId}`}
          d={`M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`}
          stroke={color}
          strokeWidth={2.5}
          strokeOpacity={0.6}
          fill="none"
        />
      );
    }
  }

  // Compute SVG size from positions
  let maxX = 0;
  let maxY = 0;
  for (const id in positions) {
    const n = nodes[id];
    if (!n) continue;
    const dims = getNodeDimensions(n);
    maxX = Math.max(maxX, positions[id].x + dims.width + 100);
    maxY = Math.max(maxY, positions[id].y + dims.height + 100);
  }

  return (
    <svg
      className="connectors-svg"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: maxX,
        height: maxY,
        pointerEvents: 'none',
      }}
    >
      {lines}
    </svg>
  );
};
