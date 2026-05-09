import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useMindMapStore, getNodeColor } from '../store/mindMapStore';
import { computeLayout, getNodeDimensions } from '../layout/treeLayout';
import { MindMapNodeComponent } from './MindMapNode';
import { Connectors } from './Connectors';

interface CanvasProps {
  editTriggerId?: string | null;
}

export const Canvas: React.FC<CanvasProps> = ({ editTriggerId }) => {
  const nodes = useMindMapStore((s) => s.nodes);
  const rootId = useMindMapStore((s) => s.rootId);
  const selectedId = useMindMapStore((s) => s.selectedId);
  const setSelected = useMindMapStore((s) => s.setSelected);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [editingId, setEditingId] = useState<string | null>(null);

  // Drag and drop (reparenting via spatial drag)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Spatial drag (move node + subtree)
  const [spatialDragId, setSpatialDragId] = useState<string | null>(null);
  const [spatialDragStart, setSpatialDragStart] = useState({ x: 0, y: 0 });
  const [spatialDragDelta, setSpatialDragDelta] = useState<{ x: number; y: number } | null>(null);

  // Resize drag
  const [resizeId, setResizeId] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [resizeDelta, setResizeDelta] = useState(0);

  const layout = computeLayout(nodes, rootId);
  const { positions: basePositions } = layout;

  // Compute depth for each visible node
  const depths: Record<string, number> = {};
  const computeDepths = (nodeId: string, depth: number) => {
    depths[nodeId] = depth;
    const node = nodes[nodeId];
    if (node && !node.collapsed) {
      node.children.forEach((cid) => computeDepths(cid, depth + 1));
    }
  };
  computeDepths(rootId, 0);

  // Compute accumulated offsets: each node inherits its ancestors' offsets
  const accumulatedOffsets: Record<string, { x: number; y: number }> = {};
  const computeOffsets = (nodeId: string, parentOffX: number, parentOffY: number) => {
    const node = nodes[nodeId];
    if (!node) return;
    const ownOffX = node.offsetX || 0;
    const ownOffY = node.offsetY || 0;
    const totalX = parentOffX + ownOffX;
    const totalY = parentOffY + ownOffY;
    accumulatedOffsets[nodeId] = { x: totalX, y: totalY };
    if (!node.collapsed) {
      node.children.forEach((cid) => computeOffsets(cid, totalX, totalY));
    }
  };
  computeOffsets(rootId, 0, 0);

  // Apply offsets + active drag delta to produce final positions
  const positions: Record<string, { x: number; y: number }> = {};
  for (const id in basePositions) {
    const base = basePositions[id];
    const acc = accumulatedOffsets[id] || { x: 0, y: 0 };
    let dx = acc.x;
    let dy = acc.y;

    // If this node is being dragged or is a descendant of the dragged node, add live drag delta
    if (spatialDragId && spatialDragDelta) {
      const inSubtree = (targetId: string, ancestorId: string): boolean => {
        let cur: string | null = targetId;
        while (cur) {
          if (cur === ancestorId) return true;
          cur = nodes[cur]?.parentId ?? null;
        }
        return false;
      };
      if (inSubtree(id, spatialDragId)) {
        dx += spatialDragDelta.x;
        dy += spatialDragDelta.y;
      }
    }

    positions[id] = { x: base.x + dx, y: base.y + dy };
  }

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === containerRef.current || e.target === contentRef.current) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        setSelected(null);
      }
    },
    [pan, setSelected]
  );

  // Helper: check if targetId is a descendant of (or equal to) ancestorId
  const isInSubtree = useCallback(
    (targetId: string, ancestorId: string): boolean => {
      let cur: string | null = targetId;
      while (cur) {
        if (cur === ancestorId) return true;
        cur = nodes[cur]?.parentId ?? null;
      }
      return false;
    },
    [nodes]
  );

  // During spatial drag, detect if mouse is over another node for reparenting
  const findDropTarget = useCallback(
    (clientX: number, clientY: number): string | null => {
      if (!containerRef.current || !spatialDragId) return null;
      const rect = containerRef.current.getBoundingClientRect();
      // Convert screen coords to canvas coords
      const canvasX = (clientX - rect.left - pan.x) / zoom;
      const canvasY = (clientY - rect.top - pan.y) / zoom;

      for (const id in positions) {
        if (id === spatialDragId) continue;
        // Skip descendants of the dragged node
        if (isInSubtree(id, spatialDragId)) continue;
        const n = nodes[id];
        if (!n) continue;
        const dims = getNodeDimensions(n);
        const pos = positions[id];
        if (
          canvasX >= pos.x &&
          canvasX <= pos.x + dims.width &&
          canvasY >= pos.y &&
          canvasY <= pos.y + dims.height
        ) {
          return id;
        }
      }
      return null;
    },
    [spatialDragId, positions, nodes, pan, zoom, isInSubtree]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      } else if (resizeId) {
        const delta = (e.clientX - resizeStartX) / zoom;
        setResizeDelta(delta);
      } else if (spatialDragId) {
        setSpatialDragDelta({
          x: (e.clientX - spatialDragStart.x) / zoom,
          y: (e.clientY - spatialDragStart.y) / zoom,
        });
        // Detect drop target for reparenting
        const target = findDropTarget(e.clientX, e.clientY);
        setDropTargetId(target);
      }
    },
    [isPanning, panStart, spatialDragId, spatialDragStart, zoom, resizeId, resizeStartX, findDropTarget]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);

    // Commit resize
    if (resizeId && resizeDelta !== 0) {
      const newWidth = Math.max(80, resizeStartWidth + resizeDelta);
      useMindMapStore.getState().setNodeWidth(resizeId, newWidth);
    }
    setResizeId(null);
    setResizeDelta(0);

    // Commit spatial drag or reparent
    if (spatialDragId && spatialDragDelta) {
      const store = useMindMapStore.getState();
      if (dropTargetId && dropTargetId !== spatialDragId) {
        // Reparent: move dragged node under the drop target
        store.moveNode(spatialDragId, dropTargetId);
      } else {
        // Spatial move: apply offset
        const node = store.nodes[spatialDragId];
        if (node) {
          const prevX = node.offsetX || 0;
          const prevY = node.offsetY || 0;
          store.setNodeOffset(
            spatialDragId,
            prevX + spatialDragDelta.x,
            prevY + spatialDragDelta.y
          );
        }
      }
    }
    setSpatialDragId(null);
    setSpatialDragDelta(null);
    setDropTargetId(null);
  }, [spatialDragId, spatialDragDelta, dropTargetId]);

  // Wheel handler: scroll to pan, pinch (ctrlKey) to zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom or Ctrl+scroll → zoom
        const delta = e.deltaY > 0 ? 0.95 : 1.05;
        const newZoom = Math.min(3, Math.max(0.2, zoom * delta));

        const rect = containerRef.current!.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;

        setPan({
          x: cx - (cx - pan.x) * (newZoom / zoom),
          y: cy - (cy - pan.y) * (newZoom / zoom),
        });
        setZoom(newZoom);
      } else {
        // Regular scroll / two-finger drag → pan
        setPan({
          x: pan.x - e.deltaX,
          y: pan.y - e.deltaY,
        });
      }
    },
    [zoom, pan]
  );

  // Fit to view
  const fitView = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 80;

    if (layout.width === 0 || layout.height === 0) return;

    const scaleX = (rect.width - padding * 2) / layout.width;
    const scaleY = (rect.height - padding * 2) / layout.height;
    const newZoom = Math.min(1.5, Math.max(0.2, Math.min(scaleX, scaleY)));

    setPan({
      x: (rect.width - layout.width * newZoom) / 2,
      y: (rect.height - layout.height * newZoom) / 2,
    });
    setZoom(newZoom);
  }, [layout]);

  // Fit on initial load
  useEffect(() => {
    const timer = setTimeout(fitView, 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle edit trigger from keyboard shortcuts
  useEffect(() => {
    if (editTriggerId) {
      setEditingId(editTriggerId);
    }
  }, [editTriggerId]);

  // Render all visible nodes
  const nodeElements: React.ReactNode[] = [];
  const visibleNodeIds = Object.keys(positions);

  for (const nodeId of visibleNodeIds) {
    const node = nodes[nodeId];
    if (!node) continue;
    const pos = positions[nodeId];
    const depth = depths[nodeId] ?? 0;
    const color = getNodeColor(depth, node.color);
    const dims = getNodeDimensions(node);
    let nodeWidth = dims.width;
    let nodeHeight = dims.height;

    // Apply live resize delta
    if (resizeId === nodeId && resizeDelta !== 0) {
      nodeWidth = Math.max(80, resizeStartWidth + resizeDelta);
      // Recompute height for the resized width
      const contentWidth = nodeWidth - 32;
      const charsPerLine = Math.max(1, Math.floor(contentWidth / 8.5));
      const lineCount = Math.ceil(node.text.length / charsPerLine);
      nodeHeight = lineCount <= 1 ? 40 : Math.max(40, lineCount * 22 + 16);
    }

    const isDragging = spatialDragId
      ? isInSubtree(nodeId, spatialDragId)
      : false;

    nodeElements.push(
      <MindMapNodeComponent
        key={nodeId}
        node={node}
        x={pos.x}
        y={pos.y}
        width={nodeWidth}
        height={nodeHeight}
        color={color}
        isSelected={nodeId === selectedId}
        isEditing={nodeId === editingId}
        isDropTarget={nodeId === dropTargetId}
        isDragging={isDragging}
        depth={depth}
        onSelect={() => setSelected(nodeId)}
        onStartEdit={() => setEditingId(nodeId)}
        onEndEdit={(text) => {
          if (text !== node.text) {
            useMindMapStore.getState().updateText(nodeId, text);
          }
          setEditingId(null);
        }}
        onSpatialDragStart={(e) => {
          e.stopPropagation();
          setSpatialDragId(nodeId);
          setSpatialDragStart({ x: e.clientX, y: e.clientY });
          setSpatialDragDelta(null);
          setSelected(nodeId);
        }}
        onToggleCollapse={() => {
          useMindMapStore.getState().toggleCollapse(nodeId);
        }}
        onResizeStart={(e) => {
          setResizeId(nodeId);
          setResizeStartX(e.clientX);
          setResizeStartWidth(nodeWidth);
          setResizeDelta(0);
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{ cursor: isPanning ? 'grabbing' : resizeId ? 'ew-resize' : spatialDragId ? 'move' : 'default' }}
    >
      <div
        ref={contentRef}
        className="canvas-content"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <Connectors nodes={nodes} positions={positions} depths={depths} />
        {nodeElements}
      </div>
      <div className="zoom-controls">
        <button onClick={() => setZoom((z) => Math.min(3, z * 1.2))} title="Zoom In">+</button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.max(0.2, z * 0.8))} title="Zoom Out">−</button>
        <button onClick={fitView} title="Fit View" className="fit-btn">⊡</button>
      </div>
    </div>
  );
};
