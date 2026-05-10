import React, { useState, useEffect } from 'react';
import { useMindMapStore, getMapsIndex, createInitialState } from '../store/mindMapStore';
import { useAuth } from '../contexts/AuthContext';
import { fetchMaps, createMap, deleteMapApi, renameMapApi } from '../lib/mapsApi';

interface DashboardProps {
  onOpenMap: (mapId: string, source: 'cloud' | 'local') => void;
  onNewMap: () => void;
}

interface DisplayMap {
  id: string;
  name: string;
  updatedAt: number;
  source: 'cloud' | 'local';
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenMap, onNewMap }) => {
  const { user, signOut } = useAuth();
  const [maps, setMaps] = useState<DisplayMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const loadMaps = async () => {
    setLoading(true);
    if (user) {
      try {
        const cloudMaps = await fetchMaps();
        const cloudList: DisplayMap[] = cloudMaps.map((m) => ({
          id: m.id,
          name: m.name,
          updatedAt: new Date(m.updated_at).getTime(),
          source: 'cloud' as const,
        }));
        // Include local-only maps not yet synced
        const localMaps = getMapsIndex();
        for (const local of localMaps) {
          if (!cloudList.find((c) => c.id === local.id)) {
            cloudList.push({
              id: local.id,
              name: local.name,
              updatedAt: local.updatedAt,
              source: 'local' as const,
            });
          }
        }
        setMaps(cloudList);
      } catch {
        setMaps(getMapsIndex().map((m) => ({
          id: m.id,
          name: m.name,
          updatedAt: m.updatedAt,
          source: 'local' as const,
        })));
      }
    } else {
      setMaps(getMapsIndex().map((m) => ({
        id: m.id,
        name: m.name,
        updatedAt: m.updatedAt,
        source: 'local' as const,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { loadMaps(); }, [user]);

  const handleDelete = async (map: DisplayMap) => {
    if (!confirm(`Delete "${map.name}"?`)) return;
    if (map.source === 'cloud') {
      await deleteMapApi(map.id);
    }
    useMindMapStore.getState().deleteMap(map.id);
    await loadMaps();
  };

  const handleRenameSubmit = async (map: DisplayMap) => {
    if (renameText.trim() && renameText.trim() !== map.name) {
      if (map.source === 'cloud') {
        await renameMapApi(map.id, renameText.trim());
      }
      useMindMapStore.getState().renameMap(map.id, renameText.trim());
      await loadMaps();
    }
    setRenamingId(null);
  };

  const handleNewMap = async () => {
    if (user) {
      try {
        const newState = createInitialState();
        const cloudMap = await createMap('Untitled Map', newState);
        useMindMapStore.setState({
          ...newState,
          currentMapId: cloudMap.id,
          _undoStack: [],
          _redoStack: [],
        } as any);
        localStorage.setItem('mindmap-active-map', cloudMap.id);
        onNewMap();
      } catch {
        useMindMapStore.getState().createNewMap();
        onNewMap();
      }
    } else {
      useMindMapStore.getState().createNewMap();
      onNewMap();
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">🧠 MindMap</h1>
        {user ? (
          <div className="dashboard-user">
            {user.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url} className="dashboard-avatar" alt="" />
            )}
            <span className="dashboard-user-name">
              {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
            </span>
            <button className="dashboard-signout" onClick={signOut}>Sign out</button>
          </div>
        ) : (
          <span className="dashboard-guest-badge">Guest</span>
        )}
      </div>

      <div className="dashboard-content">
        <div className="dashboard-actions">
          <button className="dashboard-new-btn" onClick={handleNewMap}>
            <span className="dashboard-new-icon">+</span>
            <span>New Map</span>
          </button>
        </div>

        <div className="dashboard-section">
          <h2 className="dashboard-section-title">My Maps</h2>
          {loading ? (
            <div className="dashboard-empty">Loading maps...</div>
          ) : maps.length === 0 ? (
            <div className="dashboard-empty">No maps yet. Create your first one!</div>
          ) : (
            <div className="dashboard-list">
              {maps
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="dashboard-map-row"
                    onClick={() => onOpenMap(entry.id, entry.source)}
                  >
                    <div className="dashboard-map-icon">
                      {entry.source === 'cloud' ? '☁️' : '💾'}
                    </div>
                    <div className="dashboard-map-info">
                      {renamingId === entry.id ? (
                        <input
                          className="dashboard-rename-input"
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
                        <span className="dashboard-map-name">{entry.name}</span>
                      )}
                    </div>
                    <div className="dashboard-map-date">{formatDate(entry.updatedAt)}</div>
                    <div className="dashboard-map-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="dashboard-action-btn"
                        onClick={() => { setRenamingId(entry.id); setRenameText(entry.name); }}
                        title="Rename"
                      >
                        ✏️
                      </button>
                      <button
                        className="dashboard-action-btn dashboard-action-delete"
                        onClick={() => handleDelete(entry)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
