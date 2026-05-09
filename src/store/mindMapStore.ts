import { create } from 'zustand';
import { MindMapNode, MindMapState } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 10);

const DEPTH_COLORS = [
  '#f0c040', // root - gold
  '#e8588c', // depth 1 - pink/magenta
  '#5b8def', // depth 2 - blue
  '#45b884', // depth 3 - green
  '#9b6bdf', // depth 4 - purple
  '#e07c4a', // depth 5 - orange
];

const DEFAULT_NODE_COLOR = '#8899aa'; // gray for deep nodes

export function getNodeColor(depth: number, override?: string): string {
  if (override) return override;
  return depth < DEPTH_COLORS.length ? DEPTH_COLORS[depth] : DEFAULT_NODE_COLOR;
}

function createInitialState(): MindMapState {
  const rootId = generateId();
  return {
    rootId,
    selectedId: rootId,
    nodes: {
      [rootId]: {
        id: rootId,
        text: 'Central Idea',
        children: [],
        parentId: null,
        collapsed: false,
      },
    },
  };
}

function getDepth(nodes: Record<string, MindMapNode>, nodeId: string): number {
  let depth = 0;
  let current = nodes[nodeId];
  while (current?.parentId) {
    depth++;
    current = nodes[current.parentId];
  }
  return depth;
}

interface UndoEntry {
  nodes: Record<string, MindMapNode>;
  rootId: string;
  selectedId: string | null;
}

interface MindMapActions {
  addChild: (parentId?: string) => string | null;
  addSibling: (nodeId?: string) => string | null;
  deleteNode: (nodeId?: string) => void;
  updateText: (nodeId: string, text: string) => void;
  toggleCollapse: (nodeId: string) => void;
  setSelected: (nodeId: string | null) => void;
  moveNode: (nodeId: string, newParentId: string) => void;
  setNodeOffset: (nodeId: string, offsetX: number, offsetY: number) => void;
  setNodeWidth: (nodeId: string, width: number | undefined) => void;
  getDepth: (nodeId: string) => number;
  undo: () => void;
  redo: () => void;
  loadState: (state: MindMapState) => void;
  // Map management
  currentMapId: string | null;
  saveMap: (name?: string) => void;
  loadMap: (mapId: string) => void;
  createNewMap: (name?: string) => void;
  deleteMap: (mapId: string) => void;
  renameMap: (mapId: string, name: string) => void;
  // history
  _undoStack: UndoEntry[];
  _redoStack: UndoEntry[];
  _pushUndo: () => void;
}

const STORAGE_KEY = 'mindmap-data';
const MAPS_INDEX_KEY = 'mindmap-maps-index';
const MAP_PREFIX = 'mindmap-map-';

export interface SavedMapEntry {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export function getMapsIndex(): SavedMapEntry[] {
  try {
    const data = localStorage.getItem(MAPS_INDEX_KEY);
    if (data) return JSON.parse(data);
  } catch {}
  return [];
}

function saveMapsIndex(index: SavedMapEntry[]) {
  localStorage.setItem(MAPS_INDEX_KEY, JSON.stringify(index));
}

function loadFromStorage(): { state: MindMapState; mapId: string | null } | null {
  try {
    // Try loading the last active map
    const activeId = localStorage.getItem('mindmap-active-map');
    if (activeId) {
      const data = localStorage.getItem(MAP_PREFIX + activeId);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.nodes && parsed.rootId) return { state: parsed, mapId: activeId };
      }
    }
    // Fallback: legacy single-map storage
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.nodes && parsed.rootId) return { state: parsed, mapId: null };
    }
  } catch {}
  return null;
}

function saveToStorage(state: MindMapState, mapId: string | null) {
  try {
    const payload = JSON.stringify({ nodes: state.nodes, rootId: state.rootId, selectedId: state.selectedId });
    if (mapId) {
      localStorage.setItem(MAP_PREFIX + mapId, payload);
      localStorage.setItem('mindmap-active-map', mapId);
      // Update timestamp in index
      const index = getMapsIndex();
      const entry = index.find((e) => e.id === mapId);
      if (entry) {
        entry.updatedAt = Date.now();
        saveMapsIndex(index);
      }
    } else {
      localStorage.setItem(STORAGE_KEY, payload);
    }
  } catch {}
}

export const useMindMapStore = create<MindMapState & MindMapActions>((set, get) => {
  const loaded = loadFromStorage();
  const initial = loaded ? loaded.state : createInitialState();
  const initialMapId = loaded ? loaded.mapId : null;

  return {
    ...initial,
    currentMapId: initialMapId,
    _undoStack: [],
    _redoStack: [],

    _pushUndo: () => {
      const { nodes, rootId, selectedId, _undoStack } = get();
      const entry: UndoEntry = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        rootId,
        selectedId,
      };
      set({
        _undoStack: [..._undoStack.slice(-49), entry],
        _redoStack: [],
      });
    },

    addChild: (parentId?: string) => {
      const state = get();
      const pid = parentId || state.selectedId;
      if (!pid || !state.nodes[pid]) return null;

      state._pushUndo();
      const newId = generateId();
      const depth = getDepth(state.nodes, pid) + 1;
      const newNode: MindMapNode = {
        id: newId,
        text: 'New Topic',
        children: [],
        parentId: pid,
        collapsed: false,
      };

      const updatedParent = {
        ...state.nodes[pid],
        children: [...state.nodes[pid].children, newId],
        collapsed: false,
      };

      const newNodes = {
        ...state.nodes,
        [newId]: newNode,
        [pid]: updatedParent,
      };

      set({ nodes: newNodes, selectedId: newId });
      saveToStorage({ ...get(), nodes: newNodes }, get().currentMapId);
      return newId;
    },

    addSibling: (nodeId?: string) => {
      const state = get();
      const nid = nodeId || state.selectedId;
      if (!nid || !state.nodes[nid]) return null;
      const node = state.nodes[nid];
      if (!node.parentId) return null; // can't add sibling to root

      state._pushUndo();
      const newId = generateId();
      const newNode: MindMapNode = {
        id: newId,
        text: 'New Topic',
        children: [],
        parentId: node.parentId,
        collapsed: false,
      };

      const parent = state.nodes[node.parentId];
      const idx = parent.children.indexOf(nid);
      const newChildren = [...parent.children];
      newChildren.splice(idx + 1, 0, newId);

      const updatedParent = { ...parent, children: newChildren };
      const newNodes = {
        ...state.nodes,
        [newId]: newNode,
        [node.parentId]: updatedParent,
      };

      set({ nodes: newNodes, selectedId: newId });
      saveToStorage({ ...get(), nodes: newNodes }, get().currentMapId);
      return newId;
    },

    deleteNode: (nodeId?: string) => {
      const state = get();
      const nid = nodeId || state.selectedId;
      if (!nid || !state.nodes[nid]) return;
      const node = state.nodes[nid];
      if (!node.parentId) return; // can't delete root

      state._pushUndo();

      // Collect all descendants
      const toRemove = new Set<string>();
      const queue = [nid];
      while (queue.length) {
        const current = queue.shift()!;
        toRemove.add(current);
        const n = state.nodes[current];
        if (n) queue.push(...n.children);
      }

      const parent = state.nodes[node.parentId];
      const updatedParent = {
        ...parent,
        children: parent.children.filter((id) => id !== nid),
      };

      const newNodes = { ...state.nodes, [node.parentId]: updatedParent };
      for (const id of toRemove) {
        delete newNodes[id];
      }

      // Select parent after deletion
      set({ nodes: newNodes, selectedId: node.parentId });
      saveToStorage({ ...get(), nodes: newNodes }, get().currentMapId);
    },

    updateText: (nodeId: string, text: string) => {
      const state = get();
      if (!state.nodes[nodeId]) return;
      state._pushUndo();
      const newNodes = {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], text },
      };
      set({ nodes: newNodes });
      saveToStorage({ ...get(), nodes: newNodes }, get().currentMapId);
    },

    toggleCollapse: (nodeId: string) => {
      const state = get();
      const node = state.nodes[nodeId];
      if (!node || node.children.length === 0) return;
      const newNodes = {
        ...state.nodes,
        [nodeId]: { ...node, collapsed: !node.collapsed },
      };
      set({ nodes: newNodes });
      saveToStorage({ ...get(), nodes: newNodes }, get().currentMapId);
    },

    setSelected: (nodeId: string | null) => {
      set({ selectedId: nodeId });
    },

    moveNode: (nodeId: string, newParentId: string) => {
      const state = get();
      if (!state.nodes[nodeId] || !state.nodes[newParentId]) return;
      if (nodeId === state.rootId) return; // can't move root
      if (nodeId === newParentId) return;

      // Prevent moving into own descendants
      let check: string | null = newParentId;
      while (check) {
        if (check === nodeId) return;
        check = state.nodes[check]?.parentId ?? null;
      }

      state._pushUndo();
      const node = state.nodes[nodeId];
      const oldParent = state.nodes[node.parentId!];
      const updatedOldParent = {
        ...oldParent,
        children: oldParent.children.filter((id) => id !== nodeId),
      };
      const newParent = state.nodes[newParentId];
      const updatedNewParent = {
        ...newParent,
        children: [...newParent.children, nodeId],
        collapsed: false,
      };
      const updatedNode = { ...node, parentId: newParentId };

      const newNodes = {
        ...state.nodes,
        [node.parentId!]: updatedOldParent,
        [newParentId]: updatedNewParent,
        [nodeId]: updatedNode,
      };
      set({ nodes: newNodes });
      saveToStorage({ ...get(), nodes: newNodes }, get().currentMapId);
    },

    setNodeOffset: (nodeId: string, offsetX: number, offsetY: number) => {
      const state = get();
      if (!state.nodes[nodeId]) return;
      state._pushUndo();
      const newNodes = {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], offsetX, offsetY },
      };
      set({ nodes: newNodes });
      saveToStorage({ ...get(), nodes: newNodes }, get().currentMapId);
    },

    setNodeWidth: (nodeId: string, width: number | undefined) => {
      const state = get();
      if (!state.nodes[nodeId]) return;
      state._pushUndo();
      const newNodes = {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], customWidth: width },
      };
      set({ nodes: newNodes });
      saveToStorage({ ...get(), nodes: newNodes }, get().currentMapId);
    },

    getDepth: (nodeId: string) => {
      return getDepth(get().nodes, nodeId);
    },

    undo: () => {
      const { _undoStack, nodes, rootId, selectedId } = get();
      if (_undoStack.length === 0) return;
      const prev = _undoStack[_undoStack.length - 1];
      const currentEntry: UndoEntry = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        rootId,
        selectedId,
      };
      set({
        nodes: prev.nodes,
        rootId: prev.rootId,
        selectedId: prev.selectedId,
        _undoStack: _undoStack.slice(0, -1),
        _redoStack: [...get()._redoStack, currentEntry],
      });
      saveToStorage({ nodes: prev.nodes, rootId: prev.rootId, selectedId: prev.selectedId }, get().currentMapId);
    },

    redo: () => {
      const { _redoStack, nodes, rootId, selectedId } = get();
      if (_redoStack.length === 0) return;
      const next = _redoStack[_redoStack.length - 1];
      const currentEntry: UndoEntry = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        rootId,
        selectedId,
      };
      set({
        nodes: next.nodes,
        rootId: next.rootId,
        selectedId: next.selectedId,
        _redoStack: _redoStack.slice(0, -1),
        _undoStack: [...get()._undoStack, currentEntry],
      });
      saveToStorage({ nodes: next.nodes, rootId: next.rootId, selectedId: next.selectedId }, get().currentMapId);
    },

    loadState: (state: MindMapState) => {
      set({ nodes: state.nodes, rootId: state.rootId, selectedId: state.selectedId });
      saveToStorage(state, get().currentMapId);
    },

    saveMap: (name?: string) => {
      const state = get();
      let mapId = state.currentMapId;
      const index = getMapsIndex();

      if (mapId) {
        // Update existing map
        const entry = index.find((e) => e.id === mapId);
        if (entry) {
          if (name) entry.name = name;
          entry.updatedAt = Date.now();
        }
      } else {
        // Save as new map
        mapId = generateId();
        const rootNode = state.nodes[state.rootId];
        index.push({
          id: mapId,
          name: name || rootNode?.text || 'Untitled Map',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        set({ currentMapId: mapId } as any);
      }

      saveMapsIndex(index);
      saveToStorage(state, mapId);
    },

    loadMap: (mapId: string) => {
      const data = localStorage.getItem(MAP_PREFIX + mapId);
      if (!data) return;
      try {
        const parsed = JSON.parse(data);
        if (parsed.nodes && parsed.rootId) {
          set({
            nodes: parsed.nodes,
            rootId: parsed.rootId,
            selectedId: parsed.selectedId || parsed.rootId,
            currentMapId: mapId,
            _undoStack: [],
            _redoStack: [],
          } as any);
          localStorage.setItem('mindmap-active-map', mapId);
        }
      } catch {}
    },

    createNewMap: (name?: string) => {
      const newState = createInitialState();
      const mapId = generateId();
      const index = getMapsIndex();
      index.push({
        id: mapId,
        name: name || 'Untitled Map',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      saveMapsIndex(index);

      set({
        ...newState,
        currentMapId: mapId,
        _undoStack: [],
        _redoStack: [],
      } as any);
      saveToStorage(newState, mapId);
    },

    deleteMap: (mapId: string) => {
      const index = getMapsIndex().filter((e) => e.id !== mapId);
      saveMapsIndex(index);
      localStorage.removeItem(MAP_PREFIX + mapId);

      // If deleting the current map, switch to another or create new
      if (get().currentMapId === mapId) {
        if (index.length > 0) {
          get().loadMap(index[0].id);
        } else {
          const newState = createInitialState();
          const newId = generateId();
          const newIndex: SavedMapEntry[] = [{
            id: newId,
            name: 'Untitled Map',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }];
          saveMapsIndex(newIndex);
          set({
            ...newState,
            currentMapId: newId,
            _undoStack: [],
            _redoStack: [],
          } as any);
          saveToStorage(newState, newId);
        }
      }
    },

    renameMap: (mapId: string, name: string) => {
      const index = getMapsIndex();
      const entry = index.find((e) => e.id === mapId);
      if (entry) {
        entry.name = name;
        saveMapsIndex(index);
      }
    },
  };
});
