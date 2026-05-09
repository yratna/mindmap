import { toPng } from 'html-to-image';

export async function exportToPng() {
  const content = document.querySelector('.canvas-content') as HTMLElement;
  if (!content) return;

  try {
    const dataUrl = await toPng(content, {
      backgroundColor: '#1a1a2e',
      pixelRatio: 2,
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'mindmap.png';
    a.click();
  } catch (err) {
    console.error('Failed to export PNG:', err);
  }
}
