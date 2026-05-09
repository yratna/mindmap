import React, { useCallback, useState } from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { MapsBrowser } from './components/MapsBrowser';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import './styles/theme.css';

const App: React.FC = () => {
  const [editTrigger, setEditTrigger] = useState<string | null>(null);
  const [showMaps, setShowMaps] = useState(false);

  const startEditing = useCallback((id: string) => {
    setEditTrigger(id);
    setTimeout(() => setEditTrigger(null), 100);
  }, []);

  useKeyboardShortcuts(startEditing);

  return (
    <>
      <Toolbar onShowMaps={() => setShowMaps(true)} />
      <Canvas editTriggerId={editTrigger} />
      {showMaps && <MapsBrowser onClose={() => setShowMaps(false)} />}
    </>
  );
};

export default App;
