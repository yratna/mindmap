export interface MindMapNode {
  id: string;
  text: string;
  children: string[];
  parentId: string | null;
  collapsed: boolean;
  color?: string;
  offsetX?: number;
  offsetY?: number;
  customWidth?: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface MindMapState {
  nodes: Record<string, MindMapNode>;
  rootId: string;
  selectedId: string | null;
}

export interface NodeLayout {
  positions: Record<string, Position>;
  width: number;
  height: number;
}
