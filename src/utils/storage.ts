import { Note, Notebook, Tag } from '../types';

const KEYS = {
  notes: 'evnote_notes',
  notebooks: 'evnote_notebooks',
  tags: 'evnote_tags',
};

export function loadNotes(): Note[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.notes) || '[]');
  } catch {
    return [];
  }
}

export function saveNotes(notes: Note[]): void {
  localStorage.setItem(KEYS.notes, JSON.stringify(notes));
}

export function loadNotebooks(): Notebook[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KEYS.notebooks) || '[]');
    if (stored.length === 0) {
      const defaultNotebook: Notebook = {
        id: 'default',
        name: '내 노트북',
        color: '#00A82D',
        createdAt: Date.now(),
      };
      saveNotebooks([defaultNotebook]);
      return [defaultNotebook];
    }
    return stored;
  } catch {
    return [];
  }
}

export function saveNotebooks(notebooks: Notebook[]): void {
  localStorage.setItem(KEYS.notebooks, JSON.stringify(notebooks));
}

export function loadTags(): Tag[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.tags) || '[]');
  } catch {
    return [];
  }
}

export function saveTags(tags: Tag[]): void {
  localStorage.setItem(KEYS.tags, JSON.stringify(tags));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
