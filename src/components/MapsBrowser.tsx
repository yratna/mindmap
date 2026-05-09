import React, { useState } from 'react';
import { useMindMapStore, getMapsIndex, SavedMapEntry } from '../store/mindMapStore';

interface MapsBrowserProps {
  onClose: () => void;
}

export const MapsBrowser: React.FC<MapsBrowserProps> = ({ onClose }) => {
  const currentMapId = useMindMapStore((s) => s.currentMapId);
  const loadMap = useMindMapStore((s) => s.loadMap);
  const deleteMap = useMindMapStore((s) => s.deleteMap);
  const createNewMap = useMindMapStore((s) => s.createNewMap);
  const renameMap = useMindMapStore((s) => s.renameMap);
  const saveMap = useMindMapStore((s) => s.saveMap);

  const [maps, setMaps] = useState<SavedMapEntry[]>(getMapsIndex);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [newMapName, setNewMapName] = useState('');

  const refresh = () => setMaps(getMapsIndex());

  const handleOpen = (mapId: string) => {
    // Save current map before switching
    saveMap();
    loadMap(mapId);
    onClose();
  };

  const handleDelete = (mapId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (maps.length <= 1 && mapId === currentMapId) {
      // Last map — just create a new one
      deleteMap(mapId);
      refresh();
      return;
    }
    deleteMap(mapId);
    refresh();
  };

  const handleRenameStart = (entry: SavedMapEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(entry.id);
    setRenameText(entry.name);
  };

  const handleRenameSubmit = (mapId: string) => {
    if (renameText.trim()) {
      renameMap(mapId, renameText.trim());
      refresh();
    }
    setRenamingId(null);
  };

  const handleCreateNew = () => {
    saveMap();
    createNewMap(newMapName.trim() || undefined);
    setNewMapName('');
    onClose();
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="maps-overlay" onClick={onClose}>
      <div className="maps-panel" onClick={(e) => e.stopPropagation()}>
        <div className="maps-header">
          <h2>My Mind Maps</h2>
          <button className="maps-close" onClick={onClose}>✕</button>
        </div>

        <div className="maps-create">
          <input
            type="text"
            placeholder="New map name…"
            value={newMapName}
            onChange={(e) => setNewMapName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateNew()}
          />
          <button onClick={handleCreateNew}>+ New Map</button>
        </div>

        <div className="maps-list">
          {maps.length === 0 && (
            <div className="maps-empty">No saved maps yet. Create one above!</div>
          )}
          {maps
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((entry) => (
              <div
                key={entry.id}
                className={`maps-item ${entry.id === currentMapId ? 'active' : ''}`}
                onClick={() => handleOpen(entry.id)}
              >
                <div className="maps-item-info">
                  {renamingId === entry.id ? (
                    <input
                      className="maps-rename-input"
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      onBlur={() => handleRenameSubmit(entry.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSubmit(entry.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span className="maps-item-name">{entry.name}</span>
                  )}
                  <span className="maps-item-date">
                    {formatDate(entry.updatedAt)}
                  </span>
                </div>
                <div className="maps-item-actions">
                  <button
                    className="maps-btn-rename"
                    onClick={(e) => handleRenameStart(entry, e)}
                    title="Rename"
                  >
                    ✏️
                  </button>
                  <button
                    className="maps-btn-delete"
                    onClick={(e) => handleDelete(entry.id, e)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
