import { Note, Notebook, Tag, NoteVersion } from '../types';
import { isTauriApp } from './tauri';

const KEYS = {
  notes: 'evnote_notes',
  notebooks: 'evnote_notebooks',
  tags: 'evnote_tags',
  versions: 'evnote_versions',
};

export type NoteIndexEntry = Omit<Note, 'content'>;

// ─── Shared data files ────────────────────────────────────────────────────────

function writeDataFile(filename: string, data: unknown): void {
  if (!isTauriApp()) return;
  import('@tauri-apps/api/core').then(({ invoke }) =>
    invoke('write_data_file', { filename, content: JSON.stringify(data, null, 2) })
  ).catch(console.error);
}

// ─── Per-note file helpers ────────────────────────────────────────────────────

export function writeNoteFile(note: Note): void {
  if (!isTauriApp()) return;
  import('@tauri-apps/api/core').then(({ invoke }) =>
    invoke('write_note_file', {
      id: note.id,
      notebookId: note.notebookId,
      content: JSON.stringify(note, null, 2),
    })
  ).catch(console.error);
}

export async function readNoteFile(id: string, notebookId: string): Promise<Note | null> {
  if (!isTauriApp()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const s = await invoke<string>('read_note_file', { id, notebookId });
    return s ? JSON.parse(s) as Note : null;
  } catch (e) {
    console.error('readNoteFile failed:', e);
    return null;
  }
}

export function deleteNoteFile(id: string, notebookId: string): void {
  if (!isTauriApp()) return;
  import('@tauri-apps/api/core').then(({ invoke }) =>
    invoke('delete_note_file', { id, notebookId })
  ).catch(console.error);
}

export function moveNoteFile(id: string, fromNotebookId: string, toNotebookId: string): void {
  if (!isTauriApp()) return;
  import('@tauri-apps/api/core').then(({ invoke }) =>
    invoke('move_note_file', { id, fromNotebookId, toNotebookId })
  ).catch(console.error);
}

// ─── Index file helpers ───────────────────────────────────────────────────────

export function writeNoteIndex(notes: Note[]): void {
  if (!isTauriApp()) return;
  const entries: NoteIndexEntry[] = notes.map(({ content: _c, ...rest }) => rest);
  import('@tauri-apps/api/core').then(({ invoke }) =>
    invoke('write_note_index', { content: JSON.stringify(entries, null, 2) })
  ).catch(console.error);
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

export function loadNotes(): Note[] {
  try { return JSON.parse(localStorage.getItem(KEYS.notes) || '[]'); }
  catch { return []; }
}

export function loadNotebooks(): Notebook[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KEYS.notebooks) || '[]');
    if (stored.length === 0) {
      const def: Notebook = { id: 'default', name: '내 노트북', color: '#4C8CE4', createdAt: Date.now() };
      saveNotebooks([def]);
      return [def];
    }
    return stored;
  } catch {
    const def: Notebook = { id: 'default', name: '내 노트북', color: '#4C8CE4', createdAt: Date.now() };
    saveNotebooks([def]);
    return [def];
  }
}

export function loadTags(): Tag[] {
  try { return JSON.parse(localStorage.getItem(KEYS.tags) || '[]'); }
  catch { return []; }
}

export function loadVersions(): NoteVersion[] {
  try { return JSON.parse(localStorage.getItem(KEYS.versions) || '[]'); }
  catch { return []; }
}

export function saveNotes(notes: Note[]): void {
  // Tauri persistence is handled via individual note files + index; localStorage is unused
  if (isTauriApp()) return;
  localStorage.setItem(KEYS.notes, JSON.stringify(notes));
}

export function saveNotebooks(notebooks: Notebook[]): void {
  localStorage.setItem(KEYS.notebooks, JSON.stringify(notebooks));
  writeDataFile('notebooks.json', notebooks);
}

export function saveTags(tags: Tag[]): void {
  localStorage.setItem(KEYS.tags, JSON.stringify(tags));
  writeDataFile('tags.json', tags);
}

export function saveVersions(versions: NoteVersion[]): void {
  localStorage.setItem(KEYS.versions, JSON.stringify(versions));
  writeDataFile('versions.json', versions);
}

// ─── Async init from files (Tauri only) ──────────────────────────────────────

export async function loadDataFromFiles(): Promise<{
  notes: Note[];
  notebooks: Notebook[];
  tags: Tag[];
  versions: NoteVersion[];
} | null> {
  if (!isTauriApp()) return null;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const [indexStr, notebooksStr, tagsStr, versionsStr] = await Promise.all([
      invoke<string>('read_note_index'),
      invoke<string>('read_data_file', { filename: 'notebooks.json' }),
      invoke<string>('read_data_file', { filename: 'tags.json' }),
      invoke<string>('read_data_file', { filename: 'versions.json' }),
    ]);

    if (!indexStr && !notebooksStr && !tagsStr) return null;

    const notesFromIndex: Note[] = indexStr
      ? (JSON.parse(indexStr) as NoteIndexEntry[]).map(e => ({ ...e, content: '' }))
      : loadNotes();

    return {
      notes:     notesFromIndex,
      notebooks: notebooksStr ? JSON.parse(notebooksStr) : loadNotebooks(),
      tags:      tagsStr      ? JSON.parse(tagsStr)      : loadTags(),
      versions:  versionsStr  ? JSON.parse(versionsStr)  : loadVersions(),
    };
  } catch (e) {
    console.error('Failed to load data from files:', e);
    return null;
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
