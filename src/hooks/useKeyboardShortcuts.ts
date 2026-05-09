import { useEffect } from 'react';
import { useMindMapStore } from '../store/mindMapStore';

export function useKeyboardShortcuts(
  startEditing: (id: string) => void
) {
  const store = useMindMapStore;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const state = store.getState();
      const { selectedId, rootId, nodes } = state;

      // Don't intercept when editing a node
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        return;
      }

      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          state.redo();
        } else {
          state.undo();
        }
        return;
      }

      if (!selectedId) return;

      switch (e.key) {
        case 'Tab': {
          e.preventDefault();
          const newId = state.addChild(selectedId);
          if (newId) {
            setTimeout(() => startEditing(newId), 50);
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (selectedId === rootId) {
            const newId = state.addChild(selectedId);
            if (newId) setTimeout(() => startEditing(newId), 50);
          } else {
            const newId = state.addSibling(selectedId);
            if (newId) setTimeout(() => startEditing(newId), 50);
          }
          break;
        }
        case 'Delete':
        case 'Backspace': {
          if (selectedId !== rootId) {
            e.preventDefault();
            state.deleteNode(selectedId);
          }
          break;
        }
        case 'F2': {
          e.preventDefault();
          startEditing(selectedId);
          break;
        }
        case ' ': {
          e.preventDefault();
          const node = nodes[selectedId];
          if (node && node.children.length > 0) {
            state.toggleCollapse(selectedId);
          }
          break;
        }
        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault();
          const node = nodes[selectedId];
          if (!node?.parentId) break;
          const parent = nodes[node.parentId];
          if (!parent) break;
          const siblings = parent.children;
          const idx = siblings.indexOf(selectedId);
          if (e.key === 'ArrowUp' && idx > 0) {
            state.setSelected(siblings[idx - 1]);
          } else if (e.key === 'ArrowDown' && idx < siblings.length - 1) {
            state.setSelected(siblings[idx + 1]);
          }
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const node = nodes[selectedId];
          if (node && node.children.length > 0 && !node.collapsed) {
            state.setSelected(node.children[0]);
          } else if (node && node.children.length > 0 && node.collapsed) {
            state.toggleCollapse(selectedId);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const node = nodes[selectedId];
          if (node?.parentId) {
            state.setSelected(node.parentId);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store, startEditing]);
}
