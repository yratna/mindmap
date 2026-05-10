import React, { useCallback, useState, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { Dashboard } from './components/Dashboard';
import { LoginPage } from './components/LoginPage';
import { useAuth } from './contexts/AuthContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useMindMapStore } from './store/mindMapStore';
import { fetchMap } from './lib/mapsApi';
import { supabase } from './lib/supabase';
import './styles/theme.css';

type View = 'dashboard' | 'editor';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [guestMode, setGuestMode] = useState(false);
  const [editTrigger, setEditTrigger] = useState<string | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [wasAuthenticated, setWasAuthenticated] = useState(false);

  // Track if user has ever been authenticated in this session
  useEffect(() => {
    if (user) setWasAuthenticated(true);
  }, [user]);

  const startEditing = useCallback((id: string) => {
    setEditTrigger(id);
    setTimeout(() => setEditTrigger(null), 100);
  }, []);

  useKeyboardShortcuts(startEditing);

  const handleOpenMap = async (mapId: string, source: 'cloud' | 'local') => {
    if (source === 'cloud') {
      try {
        const cloudMap = await fetchMap(mapId);
        if (cloudMap?.data) {
          useMindMapStore.setState({
            nodes: cloudMap.data.nodes,
            rootId: cloudMap.data.rootId,
            selectedId: cloudMap.data.selectedId || cloudMap.data.rootId,
            currentMapId: cloudMap.id,
            _undoStack: [],
            _redoStack: [],
          } as any);
          const payload = JSON.stringify(cloudMap.data);
          localStorage.setItem('mindmap-map-' + cloudMap.id, payload);
          localStorage.setItem('mindmap-active-map', cloudMap.id);
        }
      } catch {
        useMindMapStore.getState().loadMap(mapId);
      }
    } else {
      useMindMapStore.getState().loadMap(mapId);
    }
    setView('editor');
  };

  // Sync current map from Supabase when entering editor with auth
  useEffect(() => {
    if (!user || view !== 'editor') return;
    const mapId = useMindMapStore.getState().currentMapId;
    if (!mapId) return;
    fetchMap(mapId).then((cloudMap) => {
      if (cloudMap?.data) {
        useMindMapStore.setState({
          nodes: cloudMap.data.nodes,
          rootId: cloudMap.data.rootId,
          selectedId: cloudMap.data.selectedId || cloudMap.data.rootId,
        } as any);
      }
    }).catch(() => {});
  }, [user, view]);

  // Show login only if never authenticated, not guest, and not loading
  if (supabase && !user && !wasAuthenticated && !guestMode && !loading) {
    return <LoginPage onSkip={() => setGuestMode(true)} />;
  }

  // Show loading spinner while checking auth
  if (supabase && loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1 className="login-title">MindMap</h1>
          <p className="login-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  if (view === 'dashboard') {
    return <Dashboard onOpenMap={handleOpenMap} onNewMap={() => setView('editor')} />;
  }

  return (
    <>
      <Toolbar onBack={() => setView('dashboard')} />
      <Canvas editTriggerId={editTrigger} />
    </>
  );
};

export default AppContent;
