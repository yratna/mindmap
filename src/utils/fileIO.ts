import { MindMapState } from '../types';

export function exportToJson(state: MindMapState) {
  const data = JSON.stringify(
    { nodes: state.nodes, rootId: state.rootId },
    null,
    2
  );
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mindmap.json';
  a.click();
  URL.revokeObjectURL(url);
}

export async function importFromJson(): Promise<MindMapState | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.nodes && data.rootId) {
          resolve({
            nodes: data.nodes,
            rootId: data.rootId,
            selectedId: data.rootId,
          });
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}
