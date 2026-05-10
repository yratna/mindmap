import React, { useState, useEffect } from 'react';
import { useMindMapStore, getMapsIndex, SavedMapEntry } from '../store/mindMapStore';
import { useAuth } from '../contexts/AuthContext';
import { fetchMaps, createMap, deleteMapApi, renameMapApi, MapEntry } from '../lib/mapsApi';

interface MapsBrowserProps {
  onClose: () => void;
}

interface DisplayMap {
  id: string;
  name: string;
  updatedAt: number;
  source: 'cloud' | 'local';
}

export const MapsBrowser: React.FC<MapsBrowserProps> = ({ onClose }) => {
  const { user } = useAuth();
  const currentMapId = useMindMapStore((s) => s.currentMapId);
  const loadMap = useMindMapStore((s) => s.loadMap);
  const deleteMap = useMindMapStore((s) => s.deleteMap);
  const createNewMap = useMindMapStore((s) => s.createNewMap);
  const renameMap = useMindMapStore((s) => s.renameMap);
  const saveMap = useMindMapStore((s) => s.saveMap);

  const [maps, setMaps] = useState<DisplayMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [newMapName, setNewMapName] = useState('');

  const loadMaps = async () => {
    if (user) {
      setLoading(true);
      try {
        const cloudMaps = await fetchMaps();
        const cloudList: DisplayMap[] = cloudMaps.map((m) => ({
          id: m.id,
          name: m.name,
          updatedAt: new Date(m.updated_at).getTime(),
          source: 'cloud' as const,
        }));
        // Include current unsaved map if it's not in the cloud list
        const curId = useMindMapStore.getState().currentMapId;
        if (curId && !cloudList.find((m) => m.id === curId)) {
          const localIndex = getMapsIndex();
          const localEntry = localIndex.find((e) => e.id === curId);
          if (localEntry) {
            cloudList.unshift({
              id: localEntry.id,
              name: localEntry.name,
              updatedAt: localEntry.updatedAt,
              source: 'local' as const,
            });
          }
        }
        setMaps(cloudList);
      } catch {
        // Fallback to local
        setMaps(getMapsIndex().map((m) => ({
          id: m.id,
          name: m.name,
          updatedAt: m.updatedAt,
          source: 'local' as const,
        })));
      }
      setLoading(false);
    } else {
      setMaps(getMapsIndex().map((m) => ({
        id: m.id,
        name: m.name,
        updatedAt: m.updatedAt,
        source: 'local' as const,
      })));
    }
  };

  useEffect(() => { loadMaps(); }, [user]);

  const handleOpen = async (map: DisplayMap) => {
    saveMap();
    if (map.source === 'cloud') {
      // Load from Supabase
      const { fetchMap } = await import('../lib/mapsApi');
      const cloudMap = await fetchMap(map.id);
      if (cloudMap && cloudMap.data) {
        const store = useMindMapStore.getState();
        useMindMapStore.setState({
          nodes: cloudMap.data.nodes,
          rootId: cloudMap.data.rootId,
          selectedId: cloudMap.data.selectedId || cloudMap.data.rootId,
          currentMapId: cloudMap.id,
          _undoStack: [],
          _redoStack: [],
        } as any);
        // Also cache in localStorage
        const payload = JSON.stringify(cloudMap.data);
        localStorage.setItem('mindmap-map-' + cloudMap.id, payload);
        localStorage.setItem('mindmap-active-map', cloudMap.id);
      }
    } else {
      loadMap(map.id);
    }
    onClose();
  };

  const handleDelete = async (map: DisplayMap, e: React.MouseEvent) => {
    e.stopPropagation();
    if (map.source === 'cloud') {
      await deleteMapApi(map.id);
    }
    deleteMap(map.id);
    await loadMaps();
  };

  const handleRenameStart = (map: DisplayMap, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(map.id);
    setRenameText(map.name);
  };

  const handleRenameSubmit = async (map: DisplayMap) => {
    if (renameText.trim()) {
      if (map.source === 'cloud') {
        await renameMapApi(map.id, renameText.trim());
      }
      renameMap(map.id, renameText.trim());
      await loadMaps();
    }
    setRenamingId(null);
  };

  const handleCreateNew = async () => {
    saveMap();
    if (user) {
      try {
        const { createInitialState } = await import('../store/mindMapStore');
        const newState = createInitialState();
        const name = newMapName.trim() || 'Untitled Map';
        const cloudMap = await createMap(name, newState);
        useMindMapStore.setState({
          ...newState,
          currentMapId: cloudMap.id,
          _undoStack: [],
          _redoStack: [],
        } as any);
        localStorage.setItem('mindmap-active-map', cloudMap.id);
      } catch {
        createNewMap(newMapName.trim() || undefined);
      }
    } else {
      createNewMap(newMapName.trim() || undefined);
    }
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
          {loading && <div className="maps-empty">Loading maps...</div>}
          {!loading && maps.length === 0 && (
            <div className="maps-empty">No saved maps yet. Create one above!</div>
          )}
          {!loading && maps
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((entry) => (
              <div
                key={entry.id}
                className={`maps-item ${entry.id === currentMapId ? 'active' : ''}`}
                onClick={() => handleOpen(entry)}
              >
                <div className="maps-item-info">
                  {renamingId === entry.id ? (
                    <input
                      className="maps-rename-input"
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      onBlur={() => handleRenameSubmit(entry)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSubmit(entry);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span className="maps-item-name">
                      {entry.name}
                      {entry.source === 'cloud' && <span className="maps-cloud-badge">☁️</span>}
                    </span>
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
                    onClick={(e) => handleDelete(entry, e)}
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
