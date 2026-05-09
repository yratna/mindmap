import { MindMapNode, Position, NodeLayout } from '../types';

const NODE_MIN_HEIGHT = 40;
const NODE_V_GAP = 12;
const NODE_H_GAP = 60;
const NODE_MIN_WIDTH = 120;
const NODE_MAX_SINGLE_LINE_WIDTH = 300;
const AUTO_WRAP_WIDTH = 200;
const CHAR_WIDTH = 8.5;
const LINE_HEIGHT = 22;
const NODE_PADDING_V = 16; // vertical padding inside node
const NODE_PADDING_H = 32; // horizontal padding inside node

function estimateNodeWidth(text: string, customWidth?: number): number {
  if (customWidth) return customWidth;
  const textWidth = text.length * CHAR_WIDTH + NODE_PADDING_H;
  // Auto-wrap: if text is long, cap the width
  if (textWidth > NODE_MAX_SINGLE_LINE_WIDTH) {
    return AUTO_WRAP_WIDTH;
  }
  return Math.max(NODE_MIN_WIDTH, textWidth);
}

function estimateNodeHeight(text: string, nodeWidth: number): number {
  const contentWidth = nodeWidth - NODE_PADDING_H;
  if (contentWidth <= 0) return NODE_MIN_HEIGHT;
  const charsPerLine = Math.floor(contentWidth / CHAR_WIDTH);
  if (charsPerLine <= 0) return NODE_MIN_HEIGHT;
  const lineCount = Math.ceil(text.length / charsPerLine);
  if (lineCount <= 1) return NODE_MIN_HEIGHT;
  return Math.max(NODE_MIN_HEIGHT, lineCount * LINE_HEIGHT + NODE_PADDING_V);
}

/** Returns the width and height a node will use in layout */
export function getNodeDimensions(node: MindMapNode): { width: number; height: number } {
  const width = estimateNodeWidth(node.text, node.customWidth);
  const height = estimateNodeHeight(node.text, width);
  return { width, height };
}

interface LayoutNode {
  id: string;
  width: number;
  height: number;
  children: LayoutNode[];
  // Computed
  subtreeHeight: number;
  x: number;
  y: number;
}

function buildLayoutTree(
  nodes: Record<string, MindMapNode>,
  nodeId: string
): LayoutNode | null {
  const node = nodes[nodeId];
  if (!node) return null;

  const children: LayoutNode[] = [];
  if (!node.collapsed) {
    for (const childId of node.children) {
      const childLayout = buildLayoutTree(nodes, childId);
      if (childLayout) children.push(childLayout);
    }
  }

  const { width, height } = getNodeDimensions(node);

  return {
    id: nodeId,
    width,
    height,
    children,
    subtreeHeight: 0,
    x: 0,
    y: 0,
  };
}

function computeSubtreeHeight(node: LayoutNode): number {
  if (node.children.length === 0) {
    node.subtreeHeight = node.height;
    return node.subtreeHeight;
  }

  let totalHeight = 0;
  for (let i = 0; i < node.children.length; i++) {
    totalHeight += computeSubtreeHeight(node.children[i]);
    if (i < node.children.length - 1) {
      totalHeight += NODE_V_GAP;
    }
  }

  node.subtreeHeight = Math.max(node.height, totalHeight);
  return node.subtreeHeight;
}

function assignPositions(
  node: LayoutNode,
  x: number,
  yStart: number,
  positions: Record<string, Position>
) {
  if (node.children.length === 0) {
    node.x = x;
    node.y = yStart + node.subtreeHeight / 2 - node.height / 2;
    positions[node.id] = { x: node.x, y: node.y };
    return;
  }

  // Position children vertically centered in their subtree
  let childY = yStart;
  for (const child of node.children) {
    assignPositions(child, x + node.width + NODE_H_GAP, childY, positions);
    childY += child.subtreeHeight + NODE_V_GAP;
  }

  // Center parent vertically relative to its children
  const firstChild = node.children[0];
  const lastChild = node.children[node.children.length - 1];
  const firstChildCenter = positions[firstChild.id].y + firstChild.height / 2;
  const lastChildCenter = positions[lastChild.id].y + lastChild.height / 2;

  node.x = x;
  node.y = (firstChildCenter + lastChildCenter) / 2 - node.height / 2;
  positions[node.id] = { x: node.x, y: node.y };
}

export function computeLayout(
  nodes: Record<string, MindMapNode>,
  rootId: string
): NodeLayout {
  const tree = buildLayoutTree(nodes, rootId);
  if (!tree) {
    return { positions: {}, width: 0, height: 0 };
  }

  computeSubtreeHeight(tree);

  const positions: Record<string, Position> = {};
  assignPositions(tree, 60, 60, positions);

  // Compute bounding box
  let maxX = 0;
  let maxY = 0;
  for (const id in positions) {
    const dims = getNodeDimensions(nodes[id]);
    maxX = Math.max(maxX, positions[id].x + dims.width);
    maxY = Math.max(maxY, positions[id].y + dims.height);
  }

  return { positions, width: maxX + 60, height: maxY + 60 };
}

export { NODE_MIN_HEIGHT, estimateNodeWidth };
