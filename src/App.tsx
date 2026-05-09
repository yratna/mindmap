import React, { useCallback, useState } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { MapsBrowser } from './components/MapsBrowser';
import { LoginPage } from './components/LoginPage';
import { useAuth } from './contexts/AuthContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { supabase } from './lib/supabase';
import './styles/theme.css';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [guestMode, setGuestMode] = useState(false);
  const [editTrigger, setEditTrigger] = useState<string | null>(null);
  const [showMaps, setShowMaps] = useState(false);

  const startEditing = useCallback((id: string) => {
    setEditTrigger(id);
    setTimeout(() => setEditTrigger(null), 100);
  }, []);

  useKeyboardShortcuts(startEditing);

  // Show login if Supabase is configured and user is not authenticated and not in guest mode
  if (supabase && !user && !guestMode && !loading) {
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

  return (
    <>
      <Toolbar onShowMaps={() => setShowMaps(true)} />
      <Canvas editTriggerId={editTrigger} />
      {showMaps && <MapsBrowser onClose={() => setShowMaps(false)} />}
    </>
  );
};

export default AppContent;
