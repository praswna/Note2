import { Note, Notebook } from '../types';
import { isTauriApp, saveImageFile } from './imageStorage';

function getNotebookPath(notebookId: string, notebooks: Notebook[]): string[] {
  const path: string[] = [];
  let current = notebooks.find(nb => nb.id === notebookId);
  while (current) {
    path.unshift(current.name);
    const parentId = current.parentId;
    current = parentId ? notebooks.find(nb => nb.id === parentId) : undefined;
  }
  return path;
}

/**
 * Scans all notes for inline base64 images, saves each as a file,
 * and replaces the src with an asset:// URL.
 * Only runs in Tauri desktop mode.
 */
export async function migrateBase64Images(
  notes: Note[],
  notebooks: Notebook[],
  onUpdate: (noteId: string, content: string) => void,
): Promise<void> {
  if (!isTauriApp()) return;

  for (const note of notes) {
    if (!note.content.includes('data:image/')) continue;

    const doc = new DOMParser().parseFromString(note.content, 'text/html');
    const images = Array.from(doc.querySelectorAll('img[src^="data:image/"]'));
    if (images.length === 0) continue;

    const notebookPath = getNotebookPath(note.notebookId, notebooks);
    let changed = false;

    for (const img of images) {
      const dataUrl = img.getAttribute('src');
      if (!dataUrl) continue;
      try {
        const assetUrl = await saveImageFile(dataUrl, notebookPath);
        img.setAttribute('src', assetUrl);
        changed = true;
      } catch (e) {
        console.error('Image migration failed for note', note.id, e);
      }
    }

    if (changed) {
      onUpdate(note.id, doc.body.innerHTML);
    }
  }
}
