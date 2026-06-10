export interface Note {
  id: string;
  title: string;
  content: string;
  notebookId: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
  isTrashed: boolean;
}

export interface Notebook {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export type ViewMode = 'all' | 'notebook' | 'tag' | 'pinned' | 'trash';

export interface AppState {
  notes: Note[];
  notebooks: Notebook[];
  tags: Tag[];
  selectedNoteId: string | null;
  selectedNotebookId: string | null;
  selectedTagId: string | null;
  viewMode: ViewMode;
  searchQuery: string;
  sidebarOpen: boolean;
}
