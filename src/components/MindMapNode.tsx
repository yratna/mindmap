import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MindMapNode } from '../types';

interface Props {
  node: MindMapNode;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  isSelected: boolean;
  isEditing: boolean;
  isDropTarget: boolean;
  isDragging: boolean;
  depth: number;
  onSelect: () => void;
  onStartEdit: () => void;
  onEndEdit: (text: string) => void;
  onSpatialDragStart: (e: React.MouseEvent) => void;
  onToggleCollapse: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
}

export const MindMapNodeComponent: React.FC<Props> = ({
  node,
  x,
  y,
  width,
  height,
  color,
  isSelected,
  isEditing,
  isDropTarget,
  isDragging,
  depth,
  onSelect,
  onStartEdit,
  onEndEdit,
  onSpatialDragStart,
  onToggleCollapse,
  onResizeStart,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [editText, setEditText] = useState(node.text);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      setEditText(node.text);
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, node.text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onEndEdit(editText);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onEndEdit(node.text); // revert
      }
      e.stopPropagation();
    },
    [editText, node.text, onEndEdit]
  );

  const hasChildren = node.children.length > 0;
  const isRoot = depth === 0;
  const isWrapped = height > 40;

  return (
    <div
      className={`mind-map-node ${isSelected ? 'selected' : ''} ${isDropTarget ? 'drop-target' : ''} ${isRoot ? 'root-node' : ''} ${isDragging ? 'dragging' : ''} ${isWrapped ? 'wrapped' : ''}`}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        backgroundColor: color,
        transition: isDragging ? 'none' : 'left 0.3s ease, top 0.3s ease',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEdit();
      }}
      onMouseDown={(e) => {
        if (e.button === 0 && !isEditing) {
          onSpatialDragStart(e);
        }
      }}
    >
      {isEditing ? (
        <textarea
          ref={inputRef}
          className="node-input"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => onEndEdit(editText)}
          rows={Math.max(1, Math.ceil(editText.length / 25))}
        />
      ) : (
        <span className="node-text">{node.text}</span>
      )}

      {hasChildren && (
        <button
          className={`collapse-btn ${node.collapsed ? 'collapsed' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          title={node.collapsed ? 'Expand' : 'Collapse'}
        >
          {node.collapsed ? `+${node.children.length}` : '−'}
        </button>
      )}

      {isSelected && (
        <div
          className="resize-handle"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStart(e);
          }}
        />
      )}
    </div>
  );
};
