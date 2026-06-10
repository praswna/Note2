import { Note, Notebook, Tag } from '../types';
import { isTauriApp } from './tauri';

const KEYS = {
  notes: 'evnote_notes',
  notebooks: 'evnote_notebooks',
  tags: 'evnote_tags',
};

// Fire-and-forget: write JSON to data/{filename} next to the executable
function writeDataFile(filename: string, data: unknown): void {
  if (!isTauriApp()) return;
  import('@tauri-apps/api/core').then(({ invoke }) =>
    invoke('write_data_file', { filename, content: JSON.stringify(data, null, 2) })
  ).catch(console.error);
}

// ─── Load (sync from localStorage, used for initial state) ───────────────────

export function loadNotes(): Note[] {
  try { return JSON.parse(localStorage.getItem(KEYS.notes) || '[]'); }
  catch { return []; }
}

export function loadNotebooks(): Notebook[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KEYS.notebooks) || '[]');
    if (stored.length === 0) {
      const def: Notebook = { id: 'default', name: '내 노트북', color: '#00A82D', createdAt: Date.now() };
      saveNotebooks([def]);
      return [def];
    }
    return stored;
  } catch {
    const def: Notebook = { id: 'default', name: '내 노트북', color: '#00A82D', createdAt: Date.now() };
    saveNotebooks([def]);
    return [def];
  }
}

export function loadTags(): Tag[] {
  try { return JSON.parse(localStorage.getItem(KEYS.tags) || '[]'); }
  catch { return []; }
}

// ─── Save (sync to localStorage + async to file) ─────────────────────────────

export function saveNotes(notes: Note[]): void {
  localStorage.setItem(KEYS.notes, JSON.stringify(notes));
  writeDataFile('notes.json', notes);
}

export function saveNotebooks(notebooks: Notebook[]): void {
  localStorage.setItem(KEYS.notebooks, JSON.stringify(notebooks));
  writeDataFile('notebooks.json', notebooks);
}

export function saveTags(tags: Tag[]): void {
  localStorage.setItem(KEYS.tags, JSON.stringify(tags));
  writeDataFile('tags.json', tags);
}

// ─── Async init from files (Tauri only) ──────────────────────────────────────

export async function loadDataFromFiles(): Promise<{
  notes: Note[];
  notebooks: Notebook[];
  tags: Tag[];
} | null> {
  if (!isTauriApp()) return null;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const [notesStr, notebooksStr, tagsStr] = await Promise.all([
      invoke<string>('read_data_file', { filename: 'notes.json' }),
      invoke<string>('read_data_file', { filename: 'notebooks.json' }),
      invoke<string>('read_data_file', { filename: 'tags.json' }),
    ]);

    // All empty → first launch in Tauri, no files yet
    if (!notesStr && !notebooksStr && !tagsStr) return null;

    return {
      notes:     notesStr     ? JSON.parse(notesStr)     : loadNotes(),
      notebooks: notebooksStr ? JSON.parse(notebooksStr) : loadNotebooks(),
      tags:      tagsStr      ? JSON.parse(tagsStr)      : loadTags(),
    };
  } catch (e) {
    console.error('Failed to load data from files:', e);
    return null;
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
