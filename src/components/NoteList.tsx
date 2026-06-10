import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Search, Plus, Pin, Tag, Trash2, RotateCcw, X, FolderOpen } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Note, AppState } from '../types';

function formatDate(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);

  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  if (hour < 24) return `${hour}시간 전`;
  if (day < 7) return `${day}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function getPreview(content: string): string {
  return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 100).trim();
}

interface NoteCardProps {
  note: Note;
  state: AppState;
  dispatch: React.Dispatch<import('../context/AppContext').Action>;
  isMultiSelected: boolean;
  onCardClick: (note: Note, e: React.MouseEvent) => void;
}

function NoteCard({ note, state, dispatch, isMultiSelected, onCardClick }: NoteCardProps) {
  const notebook = state.notebooks.find(nb => nb.id === note.notebookId);
  const noteTags = state.tags.filter(t => note.tags.includes(t.id));
  const preview = getPreview(note.content);
  const isSelected = state.selectedNoteId === note.id;

  return (
    <div
      className={`note-card ${isSelected ? 'selected' : ''} ${isMultiSelected ? 'multi-selected' : ''}`}
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/note-id', note.id);
        e.dataTransfer.setData('text/plain', `nt:${note.id}`);
      }}
      onClick={e => onCardClick(note, e)}
    >
      {isMultiSelected && <div className="multi-check" />}
      <div className="note-card-header">
        <h3 className="note-card-title">{note.title || '제목 없음'}</h3>
        {note.isPinned && <Pin size={12} className="pin-icon" />}
      </div>
      {preview && <p className="note-card-preview">{preview}</p>}
      <div className="note-card-meta">
        <span className="note-card-date">{formatDate(note.updatedAt)}</span>
        {notebook && (
          <span className="note-card-notebook">
            <span className="notebook-dot-sm" style={{ background: notebook.color }} />
            {notebook.name}
          </span>
        )}
      </div>
      {noteTags.length > 0 && (
        <div className="note-card-tags">
          {noteTags.slice(0, 3).map(tag => (
            <span key={tag.id} className="tag-chip" style={{ color: tag.color, borderColor: tag.color }}>
              {tag.name}
            </span>
          ))}
        </div>
      )}
      {state.viewMode === 'trash' && (
        <div className="trash-actions" onClick={e => e.stopPropagation()}>
          <button
            className="trash-btn restore"
            onClick={() => dispatch({ type: 'RESTORE_NOTE', noteId: note.id })}
            title="복원"
          >
            <RotateCcw size={13} /> 복원
          </button>
          <button
            className="trash-btn delete"
            onClick={() => dispatch({ type: 'DELETE_NOTE', noteId: note.id })}
            title="영구 삭제"
          >
            <X size={13} /> 영구 삭제
          </button>
        </div>
      )}
    </div>
  );
}

export default function NoteList() {
  const { state, dispatch } = useApp();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const lastClickedRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedIds(new Set());
    setMoveOpen(false);
    lastClickedRef.current = null;
  }, [state.viewMode, state.selectedNotebookId, state.selectedTagId]);

  const filteredNotes = useMemo(() => {
    let notes = state.notes;

    if (state.viewMode === 'trash') {
      notes = notes.filter(n => n.isTrashed);
    } else {
      notes = notes.filter(n => !n.isTrashed);
      if (state.viewMode === 'notebook' && state.selectedNotebookId) {
        const collectIds = (id: string): string[] => {
          const children = state.notebooks.filter(nb => nb.parentId === id).map(nb => nb.id);
          return [id, ...children.flatMap(collectIds)];
        };
        const notebookIds = new Set(collectIds(state.selectedNotebookId));
        notes = notes.filter(n => notebookIds.has(n.notebookId));
      } else if (state.viewMode === 'tag' && state.selectedTagId) {
        notes = notes.filter(n => n.tags.includes(state.selectedTagId!));
      } else if (state.viewMode === 'pinned') {
        notes = notes.filter(n => n.isPinned);
      }
    }

    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      notes = notes.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      );
    }

    return [...notes].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [state.notes, state.notebooks, state.viewMode, state.selectedNotebookId, state.selectedTagId, state.searchQuery]);

  const handleCardClick = useCallback((note: Note, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+클릭: 토글
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(note.id)) next.delete(note.id);
        else next.add(note.id);
        return next;
      });
    } else if (e.shiftKey && lastClickedRef.current) {
      // Shift+클릭: 범위 선택
      const ids = filteredNotes.map(n => n.id);
      const a = ids.indexOf(lastClickedRef.current);
      const b = ids.indexOf(note.id);
      const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
      setSelectedIds(prev => new Set([...prev, ...range]));
    } else {
      // 일반 클릭: 단일 선택, 다중선택 해제
      setSelectedIds(new Set());
      dispatch({ type: 'SELECT_NOTE', noteId: note.id });
      lastClickedRef.current = note.id;
    }
  }, [filteredNotes, dispatch, lastClickedRef]);

  const clearSelection = () => { setSelectedIds(new Set()); setMoveOpen(false); };

  const bulkTrash = () => {
    selectedIds.forEach(id => dispatch({ type: 'TRASH_NOTE', noteId: id }));
    clearSelection();
  };

  const bulkRestore = () => {
    selectedIds.forEach(id => dispatch({ type: 'RESTORE_NOTE', noteId: id }));
    clearSelection();
  };

  const bulkMove = (notebookId: string) => {
    selectedIds.forEach(id => dispatch({ type: 'UPDATE_NOTE', note: { id, notebookId } }));
    clearSelection();
  };

  const viewTitle = useMemo(() => {
    if (state.viewMode === 'all') return '모든 노트';
    if (state.viewMode === 'pinned') return '고정된 노트';
    if (state.viewMode === 'trash') return '휴지통';
    if (state.viewMode === 'notebook') {
      return state.notebooks.find(nb => nb.id === state.selectedNotebookId)?.name ?? '노트북';
    }
    if (state.viewMode === 'tag') {
      return state.tags.find(t => t.id === state.selectedTagId)?.name ?? '태그';
    }
    return '노트';
  }, [state.viewMode, state.selectedNotebookId, state.selectedTagId, state.notebooks, state.tags]);

  const multiCount = selectedIds.size;

  return (
    <div className="note-list">
      <div className="note-list-header">
        {multiCount > 0 ? (
          <div className="multi-action-bar">
            <span className="multi-count">{multiCount}개 선택됨</span>
            {state.viewMode === 'trash' ? (
              <button className="multi-btn" onClick={bulkRestore}><RotateCcw size={13} /> 복원</button>
            ) : (
              <>
                <div className="multi-move-wrapper">
                  <button className="multi-btn" onClick={() => setMoveOpen(o => !o)}>
                    <FolderOpen size={13} /> 이동
                  </button>
                  {moveOpen && (
                    <div className="multi-move-dropdown">
                      {state.notebooks.map(nb => (
                        <button key={nb.id} onClick={() => bulkMove(nb.id)}>
                          <span className="notebook-dot-sm" style={{ background: nb.color }} />
                          {nb.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="multi-btn danger" onClick={bulkTrash}><Trash2 size={13} /> 삭제</button>
              </>
            )}
            <button className="multi-btn-close" onClick={clearSelection}><X size={14} /></button>
          </div>
        ) : (
          <>
            <div className="note-list-title-row">
              <h2>{viewTitle}</h2>
              <span className="note-list-count">{filteredNotes.length}</span>
            </div>
            <div className="search-bar">
              <Search size={15} />
              <input
                type="text"
                placeholder="노트 검색..."
                value={state.searchQuery}
                onChange={e => dispatch({ type: 'SET_SEARCH', query: e.target.value })}
              />
              {state.searchQuery && (
                <button onClick={() => dispatch({ type: 'SET_SEARCH', query: '' })}>
                  <X size={14} />
                </button>
              )}
            </div>
            {state.viewMode !== 'trash' && (
              <button
                className="new-note-btn"
                onClick={() => dispatch({ type: 'CREATE_NOTE' })}
              >
                <Plus size={16} /> 새 노트
              </button>
            )}
          </>
        )}
      </div>

      <div className="note-list-body">
        {filteredNotes.length === 0 ? (
          <div className="empty-state">
            {state.viewMode === 'trash' ? (
              <>
                <Trash2 size={40} />
                <p>휴지통이 비어 있습니다</p>
              </>
            ) : (
              <>
                <Tag size={40} />
                <p>노트가 없습니다</p>
                <button
                  className="new-note-btn"
                  onClick={() => dispatch({ type: 'CREATE_NOTE' })}
                >
                  <Plus size={14} /> 첫 노트 작성
                </button>
              </>
            )}
          </div>
        ) : (
          filteredNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              state={state}
              dispatch={dispatch}
              isMultiSelected={selectedIds.has(note.id)}
              onCardClick={handleCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
