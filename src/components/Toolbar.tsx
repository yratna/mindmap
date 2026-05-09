import React from 'react';
import { useMindMapStore } from '../store/mindMapStore';
import { exportToJson, importFromJson } from '../utils/fileIO';
import { exportToPng } from '../utils/exportPng';
import { useAuth } from '../contexts/AuthContext';

interface ToolbarProps {
  onShowMaps: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onShowMaps }) => {
  const { user, signOut } = useAuth();
  const selectedId = useMindMapStore((s) => s.selectedId);
  const rootId = useMindMapStore((s) => s.rootId);
  const nodes = useMindMapStore((s) => s.nodes);
  const addChild = useMindMapStore((s) => s.addChild);
  const addSibling = useMindMapStore((s) => s.addSibling);
  const deleteNode = useMindMapStore((s) => s.deleteNode);
  const undo = useMindMapStore((s) => s.undo);
  const redo = useMindMapStore((s) => s.redo);
  const loadState = useMindMapStore((s) => s.loadState);
  const saveMap = useMindMapStore((s) => s.saveMap);
  const createNewMap = useMindMapStore((s) => s.createNewMap);

  const canDelete = selectedId && selectedId !== rootId;

  const handleImport = async () => {
    const state = await importFromJson();
    if (state) {
      loadState(state);
    }
  };

  const handleExport = () => {
    exportToJson({ nodes, rootId, selectedId });
  };

  const handleExportPng = () => {
    exportToPng();
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <span className="toolbar-title">MindMap</span>
      </div>
      <div className="toolbar-group">
        <button onClick={() => { saveMap(); createNewMap(); }} title="New Map">
          <span className="btn-icon">📄</span> New
        </button>
        <button onClick={() => saveMap()} title="Save Map">
          <span className="btn-icon">💾</span> Save
        </button>
        <button onClick={onShowMaps} title="My Maps">
          <span className="btn-icon">📋</span> My Maps
        </button>
      </div>
      <div className="toolbar-group">
        <button
          onClick={() => addChild()}
          disabled={!selectedId}
          title="Add Child (Tab)"
        >
          <span className="btn-icon">+</span> Add Child
        </button>
        <button
          onClick={() => addSibling()}
          disabled={!selectedId || selectedId === rootId}
          title="Add Sibling (Enter)"
        >
          <span className="btn-icon">↵</span> Add Sibling
        </button>
        <button
          onClick={() => deleteNode()}
          disabled={!canDelete}
          title="Delete (Del)"
          className="btn-danger"
        >
          <span className="btn-icon">✕</span> Delete
        </button>
      </div>
      <div className="toolbar-group">
        <button onClick={undo} title="Undo (Ctrl+Z)">
          <span className="btn-icon">↩</span> Undo
        </button>
        <button onClick={redo} title="Redo (Ctrl+Shift+Z)">
          <span className="btn-icon">↪</span> Redo
        </button>
      </div>
      <div className="toolbar-group">
        <button onClick={handleExport} title="Export JSON">
          <span className="btn-icon">�</span> Export
        </button>
        <button onClick={handleImport} title="Import JSON">
          <span className="btn-icon">📂</span> Import
        </button>
        <button onClick={handleExportPng} title="Export PNG">
          <span className="btn-icon">🖼</span> PNG
        </button>
      </div>
      <div className="toolbar-spacer" />
      {user ? (
        <div className="toolbar-group toolbar-user">
          <span className="toolbar-user-name" title={user.email || ''}>
            {user.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url} className="toolbar-avatar" alt="" />
            )}
            {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
          </span>
          <button onClick={signOut} title="Sign out">
            Sign out
          </button>
        </div>
      ) : (
        <div className="toolbar-group toolbar-user">
          <span className="toolbar-guest-badge">Guest</span>
        </div>
      )}
    </div>
  );
};
