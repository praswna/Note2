import { createContext, useContext, useReducer, useEffect, useState, ReactNode } from 'react';
import { AppState, Note, Notebook, Tag, NoteVersion, ViewMode } from '../types';
import {
  loadNotes, saveNotes,
  loadNotebooks, saveNotebooks,
  loadTags, saveTags,
  loadVersions, saveVersions,
  loadDataFromFiles,
  generateId,
  writeNoteFile,
  writeNoteIndex,
  deleteNoteFile,
  moveNoteFile,
} from '../utils/storage';
import { isTauriApp } from '../utils/tauri';

export type Action =
  | { type: 'LOAD_DATA'; notes: Note[]; notebooks: Notebook[]; tags: Tag[]; versions: NoteVersion[] }
  | { type: 'SET_VIEW'; viewMode: ViewMode; notebookId?: string; tagId?: string }
  | { type: 'SELECT_NOTE'; noteId: string | null }
  | { type: 'SET_NOTE_CONTENT'; noteId: string; content: string }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'CREATE_NOTE' }
  | { type: 'UPDATE_NOTE'; note: Partial<Note> & { id: string } }
  | { type: 'DELETE_NOTE'; noteId: string }
  | { type: 'TRASH_NOTE'; noteId: string }
  | { type: 'RESTORE_NOTE'; noteId: string }
  | { type: 'TOGGLE_PIN'; noteId: string }
  | { type: 'CREATE_NOTEBOOK'; name: string; color: string; parentId?: string; id?: string }
  | { type: 'RENAME_NOTEBOOK'; notebookId: string; name: string }
  | { type: 'CHANGE_NOTEBOOK_COLOR'; notebookId: string; color: string }
  | { type: 'DELETE_NOTEBOOK'; notebookId: string }
  | { type: 'MOVE_NOTEBOOK'; notebookId: string; parentId: string | undefined }
  | { type: 'REORDER_NOTEBOOK'; notebookId: string; beforeId: string | null; parentId: string | undefined }
  | { type: 'CREATE_TAG'; name: string; color: string }
  | { type: 'DELETE_TAG'; tagId: string }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SAVE_VERSION'; noteId: string }
  | { type: 'RESTORE_VERSION'; versionId: string }
  | { type: 'DELETE_NOTE_VERSIONS'; noteId: string };

const NOTE_COLORS = [
  '#EAFFD0', '#FFF799', '#FFD150', '#95E1D3',
  '#91D06C', '#FF9760', '#f8961e', '#F38181',
  '#f3722c', '#f94144', '#F26076', '#43aa8b',
  '#4C8CE4', '#458B73', '#577590', '#406093',
];

function getRandomColor(): string {
  return NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
}

function isDescendantOf(notebookId: string, ancestorId: string, notebooks: Notebook[]): boolean {
  const visited = new Set<string>();
  let cur: string | undefined = notebookId;
  while (cur) {
    if (visited.has(cur)) break;
    visited.add(cur);
    if (cur === ancestorId) return true;
    cur = notebooks.find(nb => nb.id === cur)?.parentId;
  }
  return false;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD_DATA':
      return {
        ...state,
        notes: action.notes,
        notebooks: action.notebooks,
        tags: action.tags,
        versions: action.versions,
        loadedNoteIds: new Set<string>(),
      };
    case 'SET_VIEW': {
      let selectedNoteId: string | null = null;
      if (action.viewMode === 'notebook' && action.notebookId) {
        const collectIds = (id: string, visited = new Set<string>()): string[] => {
          if (visited.has(id)) return [];
          visited.add(id);
          const children = state.notebooks.filter(nb => nb.parentId === id).map(nb => nb.id);
          return [id, ...children.flatMap(c => collectIds(c, visited))];
        };
        const nbIds = new Set(collectIds(action.notebookId));
        const latest = [...state.notes]
          .filter(n => !n.isTrashed && nbIds.has(n.notebookId))
          .sort((a, b) => b.updatedAt - a.updatedAt)[0];
        selectedNoteId = latest?.id ?? null;
      }
      return {
        ...state,
        viewMode: action.viewMode,
        selectedNotebookId: action.notebookId ?? null,
        selectedTagId: action.tagId ?? null,
        selectedNoteId,
      };
    }
    case 'SELECT_NOTE':
      return { ...state, selectedNoteId: action.noteId };
    case 'SET_NOTE_CONTENT': {
      const notes = state.notes.map(n =>
        n.id === action.noteId ? { ...n, content: action.content } : n
      );
      const loadedNoteIds = new Set(state.loadedNoteIds);
      loadedNoteIds.add(action.noteId);
      return { ...state, notes, loadedNoteIds };
    }
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };
    case 'CREATE_NOTE': {
      const notebookId = state.selectedNotebookId ?? state.notebooks[0]?.id ?? 'default';
      const newNote: Note = {
        id: generateId(),
        title: '제목 없음',
        content: '',
        notebookId,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false,
        isTrashed: false,
      };
      const notes = [newNote, ...state.notes];
      saveNotes(notes);
      writeNoteFile(newNote);
      writeNoteIndex(notes);
      const loadedNoteIds = new Set(state.loadedNoteIds);
      loadedNoteIds.add(newNote.id);
      return { ...state, notes, selectedNoteId: newNote.id, loadedNoteIds };
    }
    case 'UPDATE_NOTE': {
      const oldNote = state.notes.find(n => n.id === action.note.id);
      const notes = state.notes.map(n =>
        n.id === action.note.id
          ? { ...n, ...action.note, updatedAt: Date.now() }
          : n
      );
      saveNotes(notes);
      const updated = notes.find(n => n.id === action.note.id);
      if (updated) {
        if (oldNote && action.note.notebookId && oldNote.notebookId !== action.note.notebookId) {
          moveNoteFile(updated.id, oldNote.notebookId, updated.notebookId);
        }
        writeNoteFile(updated);
        writeNoteIndex(notes);
      }
      return { ...state, notes };
    }
    case 'TRASH_NOTE': {
      const notes = state.notes.map(n =>
        n.id === action.noteId ? { ...n, isTrashed: true, updatedAt: Date.now() } : n
      );
      saveNotes(notes);
      const trashed = notes.find(n => n.id === action.noteId);
      if (trashed) { writeNoteFile(trashed); writeNoteIndex(notes); }
      const selectedNoteId = state.selectedNoteId === action.noteId ? null : state.selectedNoteId;
      return { ...state, notes, selectedNoteId };
    }
    case 'RESTORE_NOTE': {
      const notes = state.notes.map(n =>
        n.id === action.noteId ? { ...n, isTrashed: false, updatedAt: Date.now() } : n
      );
      saveNotes(notes);
      const restored = notes.find(n => n.id === action.noteId);
      if (restored) { writeNoteFile(restored); writeNoteIndex(notes); }
      return { ...state, notes };
    }
    case 'DELETE_NOTE': {
      const toDelete = state.notes.find(n => n.id === action.noteId);
      const notes = state.notes.filter(n => n.id !== action.noteId);
      saveNotes(notes);
      if (toDelete) deleteNoteFile(toDelete.id, toDelete.notebookId);
      writeNoteIndex(notes);
      const loadedNoteIds = new Set(state.loadedNoteIds);
      loadedNoteIds.delete(action.noteId);
      const selectedNoteId = state.selectedNoteId === action.noteId ? null : state.selectedNoteId;
      const versionsAfterDelete = state.versions.filter(v => v.noteId !== action.noteId);
      saveVersions(versionsAfterDelete);
      return { ...state, notes, selectedNoteId, versions: versionsAfterDelete, loadedNoteIds };
    }
    case 'TOGGLE_PIN': {
      const notes = state.notes.map(n =>
        n.id === action.noteId ? { ...n, isPinned: !n.isPinned, updatedAt: Date.now() } : n
      );
      saveNotes(notes);
      const pinned = notes.find(n => n.id === action.noteId);
      if (pinned) { writeNoteFile(pinned); writeNoteIndex(notes); }
      return { ...state, notes };
    }
    case 'CREATE_NOTEBOOK': {
      const notebook: Notebook = {
        id: action.id ?? generateId(),
        name: action.name,
        color: action.color || getRandomColor(),
        createdAt: Date.now(),
        parentId: action.parentId,
      };
      const notebooks = [...state.notebooks, notebook];
      saveNotebooks(notebooks);
      return { ...state, notebooks };
    }
    case 'RENAME_NOTEBOOK': {
      const notebooks = state.notebooks.map(nb =>
        nb.id === action.notebookId ? { ...nb, name: action.name } : nb
      );
      saveNotebooks(notebooks);
      return { ...state, notebooks };
    }
    case 'CHANGE_NOTEBOOK_COLOR': {
      const notebooks = state.notebooks.map(nb =>
        nb.id === action.notebookId ? { ...nb, color: action.color } : nb
      );
      saveNotebooks(notebooks);
      return { ...state, notebooks };
    }
    case 'DELETE_NOTEBOOK': {
      // Collect IDs of the deleted notebook and all its descendants
      const toDelete = new Set<string>();
      const collect = (id: string) => {
        if (toDelete.has(id)) return;
        toDelete.add(id);
        state.notebooks.filter(nb => nb.parentId === id).forEach(c => collect(c.id));
      };
      collect(action.notebookId);

      let notebooks = state.notebooks.filter(nb => !toDelete.has(nb.id));
      // Ensure at least one notebook always exists
      if (notebooks.length === 0) {
        const def: Notebook = { id: 'default', name: '내 노트북', color: '#4C8CE4', createdAt: Date.now() };
        notebooks = [def];
      }
      const fallbackId = notebooks[0].id;
      const notes = state.notes.map(n =>
        toDelete.has(n.notebookId) ? { ...n, notebookId: fallbackId } : n
      );
      saveNotebooks(notebooks);
      saveNotes(notes);
      const reassigned = notes.filter(n => toDelete.has(state.notes.find(o => o.id === n.id)?.notebookId ?? ''));
      reassigned.forEach(n => {
        const oldNotebookId = state.notes.find(o => o.id === n.id)!.notebookId;
        moveNoteFile(n.id, oldNotebookId, n.notebookId);
        writeNoteFile(n);
      });
      if (reassigned.length) writeNoteIndex(notes);
      return { ...state, notebooks, notes };
    }
    case 'MOVE_NOTEBOOK': {
      if (action.parentId && isDescendantOf(action.parentId, action.notebookId, state.notebooks)) return state;
      const notebooks = state.notebooks.map(nb =>
        nb.id === action.notebookId ? { ...nb, parentId: action.parentId } : nb
      );
      saveNotebooks(notebooks);
      return { ...state, notebooks };
    }
    case 'REORDER_NOTEBOOK': {
      const moving = state.notebooks.find(nb => nb.id === action.notebookId);
      if (!moving) return state;
      if (action.beforeId === action.notebookId) return state;
      if (action.parentId && isDescendantOf(action.parentId, action.notebookId, state.notebooks)) return state;
      const rest = state.notebooks.filter(nb => nb.id !== action.notebookId);
      let idx = action.beforeId ? rest.findIndex(nb => nb.id === action.beforeId) : -1;
      if (idx === -1) idx = rest.length;
      const notebooks = [...rest.slice(0, idx), { ...moving, parentId: action.parentId }, ...rest.slice(idx)];
      saveNotebooks(notebooks);
      return { ...state, notebooks };
    }
    case 'CREATE_TAG': {
      const tag: Tag = {
        id: generateId(),
        name: action.name,
        color: action.color || getRandomColor(),
      };
      const tags = [...state.tags, tag];
      saveTags(tags);
      return { ...state, tags };
    }
    case 'DELETE_TAG': {
      const tags = state.tags.filter(t => t.id !== action.tagId);
      const notes = state.notes.map(n => ({
        ...n,
        tags: n.tags.filter(tid => tid !== action.tagId),
      }));
      saveTags(tags);
      saveNotes(notes);
      const tagChanged = notes.filter(n => state.notes.find(o => o.id === n.id)?.tags.includes(action.tagId));
      tagChanged.forEach(writeNoteFile);
      if (tagChanged.length) writeNoteIndex(notes);
      return { ...state, tags, notes };
    }
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'SAVE_VERSION': {
      const noteToSnapshot = state.notes.find(n => n.id === action.noteId);
      if (!noteToSnapshot || !noteToSnapshot.content) return state;
      const noteVersions = state.versions.filter(v => v.noteId === action.noteId);
      const mostRecent = noteVersions.sort((a, b) => b.savedAt - a.savedAt)[0];
      if (mostRecent && mostRecent.content === noteToSnapshot.content) return state;
      const newVersion: NoteVersion = {
        id: generateId(),
        noteId: action.noteId,
        title: noteToSnapshot.title,
        content: noteToSnapshot.content,
        savedAt: Date.now(),
      };
      const allVersionsForNote = [newVersion, ...noteVersions].slice(0, 20);
      const otherVersions = state.versions.filter(v => v.noteId !== action.noteId);
      const versions = [...otherVersions, ...allVersionsForNote];
      saveVersions(versions);
      return { ...state, versions };
    }
    case 'RESTORE_VERSION': {
      const version = state.versions.find(v => v.id === action.versionId);
      if (!version) return state;
      const notes = state.notes.map(n =>
        n.id === version.noteId
          ? { ...n, title: version.title, content: version.content, updatedAt: Date.now() }
          : n
      );
      saveNotes(notes);
      const reverted = notes.find(n => n.id === version.noteId);
      if (reverted) { writeNoteFile(reverted); writeNoteIndex(notes); }
      return { ...state, notes };
    }
    case 'DELETE_NOTE_VERSIONS': {
      const versions = state.versions.filter(v => v.noteId !== action.noteId);
      saveVersions(versions);
      return { ...state, versions };
    }
    default:
      return state;
  }
}

const initialNotes = loadNotes();

const initialState: AppState = {
  notes: initialNotes,
  notebooks: loadNotebooks(),
  tags: loadTags(),
  versions: loadVersions(),
  selectedNoteId: null,
  selectedNotebookId: null,
  selectedTagId: null,
  viewMode: 'all',
  searchQuery: '',
  sidebarOpen: true,
  // In browser mode all notes are already loaded; Tauri uses lazy loading
  loadedNoteIds: new Set(initialNotes.map(n => n.id)),
};

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(!isTauriApp());

  useEffect(() => {
    loadDataFromFiles().then(data => {
      if (data) {
        // Files exist — use them as the authoritative source
        dispatch({ type: 'LOAD_DATA', notes: data.notes, notebooks: data.notebooks, tags: data.tags, versions: data.versions });
      } else if (isTauriApp()) {
        // First Tauri launch — migrate localStorage data to files
        initialState.notes.forEach(writeNoteFile);
        writeNoteIndex(initialState.notes);
        saveNotebooks(initialState.notebooks);
        saveTags(initialState.tags);
        saveVersions(initialState.versions);
      }

      // Purge any legacy base64 images and auto-select first note
      const notes = data?.notes ?? initialState.notes;
      notes.forEach(note => {
        if (!note.content.includes('data:image/')) return;
        const doc = new DOMParser().parseFromString(note.content, 'text/html');
        doc.querySelectorAll('img[src^="data:image/"]').forEach(img => img.remove());
        dispatch({ type: 'UPDATE_NOTE', note: { id: note.id, content: doc.body.innerHTML } });
      });

      const firstActive = notes.find(n => !n.isTrashed);
      if (firstActive) dispatch({ type: 'SELECT_NOTE', noteId: firstActive.id });

      setReady(true);
    });
  }, []);

  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999', fontSize: 14 }}>
      불러오는 중...
    </div>
  );

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
