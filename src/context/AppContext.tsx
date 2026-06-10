import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, Note, Notebook, Tag, ViewMode } from '../types';
import {
  loadNotes, saveNotes,
  loadNotebooks, saveNotebooks,
  loadTags, saveTags,
  generateId,
} from '../utils/storage';

export type Action =
  | { type: 'SET_VIEW'; viewMode: ViewMode; notebookId?: string; tagId?: string }
  | { type: 'SELECT_NOTE'; noteId: string | null }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'CREATE_NOTE' }
  | { type: 'UPDATE_NOTE'; note: Partial<Note> & { id: string } }
  | { type: 'DELETE_NOTE'; noteId: string }
  | { type: 'TRASH_NOTE'; noteId: string }
  | { type: 'RESTORE_NOTE'; noteId: string }
  | { type: 'TOGGLE_PIN'; noteId: string }
  | { type: 'CREATE_NOTEBOOK'; name: string; color: string; parentId?: string }
  | { type: 'RENAME_NOTEBOOK'; notebookId: string; name: string }
  | { type: 'CHANGE_NOTEBOOK_COLOR'; notebookId: string; color: string }
  | { type: 'DELETE_NOTEBOOK'; notebookId: string }
  | { type: 'MOVE_NOTEBOOK'; notebookId: string; parentId: string | undefined }
  | { type: 'CREATE_TAG'; name: string; color: string }
  | { type: 'DELETE_TAG'; tagId: string }
  | { type: 'TOGGLE_SIDEBAR' };

const NOTE_COLORS = [
  '#00A82D', '#0066CC', '#CC3300', '#FF6600',
  '#9933CC', '#00AAAA', '#CC6600', '#006633',
];

function getRandomColor(): string {
  return NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return {
        ...state,
        viewMode: action.viewMode,
        selectedNotebookId: action.notebookId ?? null,
        selectedTagId: action.tagId ?? null,
        selectedNoteId: null,
      };
    case 'SELECT_NOTE':
      return { ...state, selectedNoteId: action.noteId };
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
      return { ...state, notes, selectedNoteId: newNote.id };
    }
    case 'UPDATE_NOTE': {
      const notes = state.notes.map(n =>
        n.id === action.note.id
          ? { ...n, ...action.note, updatedAt: Date.now() }
          : n
      );
      saveNotes(notes);
      return { ...state, notes };
    }
    case 'TRASH_NOTE': {
      const notes = state.notes.map(n =>
        n.id === action.noteId ? { ...n, isTrashed: true, updatedAt: Date.now() } : n
      );
      saveNotes(notes);
      const selectedNoteId = state.selectedNoteId === action.noteId ? null : state.selectedNoteId;
      return { ...state, notes, selectedNoteId };
    }
    case 'RESTORE_NOTE': {
      const notes = state.notes.map(n =>
        n.id === action.noteId ? { ...n, isTrashed: false, updatedAt: Date.now() } : n
      );
      saveNotes(notes);
      return { ...state, notes };
    }
    case 'DELETE_NOTE': {
      const notes = state.notes.filter(n => n.id !== action.noteId);
      saveNotes(notes);
      const selectedNoteId = state.selectedNoteId === action.noteId ? null : state.selectedNoteId;
      return { ...state, notes, selectedNoteId };
    }
    case 'TOGGLE_PIN': {
      const notes = state.notes.map(n =>
        n.id === action.noteId ? { ...n, isPinned: !n.isPinned, updatedAt: Date.now() } : n
      );
      saveNotes(notes);
      return { ...state, notes };
    }
    case 'CREATE_NOTEBOOK': {
      const notebook: Notebook = {
        id: generateId(),
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
        toDelete.add(id);
        state.notebooks.filter(nb => nb.parentId === id).forEach(c => collect(c.id));
      };
      collect(action.notebookId);

      const notebooks = state.notebooks.filter(nb => !toDelete.has(nb.id));
      const fallbackId = notebooks[0]?.id ?? 'default';
      const notes = state.notes.map(n =>
        toDelete.has(n.notebookId) ? { ...n, notebookId: fallbackId } : n
      );
      saveNotebooks(notebooks);
      saveNotes(notes);
      return { ...state, notebooks, notes };
    }
    case 'MOVE_NOTEBOOK': {
      const notebooks = state.notebooks.map(nb =>
        nb.id === action.notebookId ? { ...nb, parentId: action.parentId } : nb
      );
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
      return { ...state, tags, notes };
    }
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    default:
      return state;
  }
}

const initialState: AppState = {
  notes: loadNotes(),
  notebooks: loadNotebooks(),
  tags: loadTags(),
  selectedNoteId: null,
  selectedNotebookId: null,
  selectedTagId: null,
  viewMode: 'all',
  searchQuery: '',
  sidebarOpen: true,
};

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (state.notes.length > 0 && !state.selectedNoteId) {
      const firstActive = state.notes.find(n => !n.isTrashed);
      if (firstActive) dispatch({ type: 'SELECT_NOTE', noteId: firstActive.id });
    }
  }, []);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
