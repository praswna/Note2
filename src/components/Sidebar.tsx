import { useState } from 'react';
import {
  BookOpen, Tag, Pin, Trash2, ChevronDown, ChevronRight,
  Plus, MoreHorizontal, Edit2, X, Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const NOTE_COLORS = [
  '#00A82D', '#0066CC', '#CC3300', '#FF6600',
  '#9933CC', '#00AAAA', '#CC6600', '#006633',
];

export default function Sidebar() {
  const { state, dispatch } = useApp();
  const [notebooksOpen, setNotebooksOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [addingNotebook, setAddingNotebook] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(NOTE_COLORS[0]);
  const [editingNotebookId, setEditingNotebookId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const activeNotebooks = state.notebooks;
  const allCount = state.notes.filter(n => !n.isTrashed).length;
  const pinnedCount = state.notes.filter(n => n.isPinned && !n.isTrashed).length;
  const trashCount = state.notes.filter(n => n.isTrashed).length;

  function createNotebook() {
    if (!newName.trim()) return;
    dispatch({ type: 'CREATE_NOTEBOOK', name: newName.trim(), color: newColor });
    setNewName('');
    setAddingNotebook(false);
  }

  function createTag() {
    if (!newName.trim()) return;
    dispatch({ type: 'CREATE_TAG', name: newName.trim(), color: newColor });
    setNewName('');
    setAddingTag(false);
  }

  function startEditNotebook(id: string, name: string) {
    setEditingNotebookId(id);
    setEditingName(name);
    setMenuOpen(null);
  }

  function confirmEditNotebook() {
    if (editingNotebookId && editingName.trim()) {
      dispatch({ type: 'RENAME_NOTEBOOK', notebookId: editingNotebookId, name: editingName.trim() });
    }
    setEditingNotebookId(null);
  }

  const isActive = (viewMode: string, id?: string) => {
    if (viewMode === 'notebook') return state.viewMode === 'notebook' && state.selectedNotebookId === id;
    if (viewMode === 'tag') return state.viewMode === 'tag' && state.selectedTagId === id;
    return state.viewMode === viewMode;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="app-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#00A82D" />
            <path d="M7 8h14M7 14h10M7 20h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="app-name">Note2</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${isActive('all') ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_VIEW', viewMode: 'all' })}
        >
          <BookOpen size={16} />
          <span>모든 노트</span>
          <span className="nav-count">{allCount}</span>
        </button>

        <button
          className={`nav-item ${isActive('pinned') ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_VIEW', viewMode: 'pinned' })}
        >
          <Pin size={16} />
          <span>고정된 노트</span>
          {pinnedCount > 0 && <span className="nav-count">{pinnedCount}</span>}
        </button>
      </nav>

      <div className="sidebar-section">
        <button
          className="section-header"
          onClick={() => setNotebooksOpen(o => !o)}
        >
          {notebooksOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>노트북</span>
          <button
            className="add-btn"
            onClick={e => { e.stopPropagation(); setNewName(''); setAddingNotebook(true); setNewColor(NOTE_COLORS[0]); }}
            title="노트북 추가"
          >
            <Plus size={14} />
          </button>
        </button>

        {notebooksOpen && (
          <div className="section-items">
            {activeNotebooks.map(nb => {
              const count = state.notes.filter(n => n.notebookId === nb.id && !n.isTrashed).length;
              return (
                <div key={nb.id} className="section-item-wrapper">
                  {editingNotebookId === nb.id ? (
                    <div className="inline-edit">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') confirmEditNotebook();
                          if (e.key === 'Escape') setEditingNotebookId(null);
                        }}
                      />
                      <button onClick={confirmEditNotebook}><Check size={12} /></button>
                      <button onClick={() => setEditingNotebookId(null)}><X size={12} /></button>
                    </div>
                  ) : (
                    <button
                      className={`nav-item ${isActive('notebook', nb.id) ? 'active' : ''}`}
                      onClick={() => dispatch({ type: 'SET_VIEW', viewMode: 'notebook', notebookId: nb.id })}
                    >
                      <span className="notebook-dot" style={{ background: nb.color }} />
                      <span className="nav-label">{nb.name}</span>
                      <span className="nav-count">{count}</span>
                      <button
                        className="item-menu-btn"
                        onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === nb.id ? null : nb.id); }}
                      >
                        <MoreHorizontal size={12} />
                      </button>
                    </button>
                  )}
                  {menuOpen === nb.id && (
                    <div className="context-menu">
                      <button onClick={() => startEditNotebook(nb.id, nb.name)}>
                        <Edit2 size={12} /> 이름 변경
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          dispatch({ type: 'DELETE_NOTEBOOK', notebookId: nb.id });
                          setMenuOpen(null);
                        }}
                      >
                        <Trash2 size={12} /> 삭제
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {addingNotebook && (
              <div className="add-form">
                <div className="color-picker">
                  {NOTE_COLORS.map(c => (
                    <button
                      key={c}
                      className={`color-dot ${newColor === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setNewColor(c)}
                    />
                  ))}
                </div>
                <input
                  autoFocus
                  placeholder="노트북 이름..."
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') createNotebook();
                    if (e.key === 'Escape') setAddingNotebook(false);
                  }}
                />
                <div className="add-form-actions">
                  <button className="btn-confirm" onClick={createNotebook}>추가</button>
                  <button className="btn-cancel" onClick={() => setAddingNotebook(false)}>취소</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <button
          className="section-header"
          onClick={() => setTagsOpen(o => !o)}
        >
          {tagsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>태그</span>
          <button
            className="add-btn"
            onClick={e => { e.stopPropagation(); setNewName(''); setAddingTag(true); setNewColor(NOTE_COLORS[2]); }}
            title="태그 추가"
          >
            <Plus size={14} />
          </button>
        </button>

        {tagsOpen && (
          <div className="section-items">
            {state.tags.map(tag => {
              const count = state.notes.filter(n => n.tags.includes(tag.id) && !n.isTrashed).length;
              return (
                <div key={tag.id} className="section-item-wrapper">
                  <button
                    className={`nav-item ${isActive('tag', tag.id) ? 'active' : ''}`}
                    onClick={() => dispatch({ type: 'SET_VIEW', viewMode: 'tag', tagId: tag.id })}
                  >
                    <Tag size={14} style={{ color: tag.color }} />
                    <span className="nav-label">{tag.name}</span>
                    <span className="nav-count">{count}</span>
                    <button
                      className="item-menu-btn"
                      onClick={e => { e.stopPropagation(); dispatch({ type: 'DELETE_TAG', tagId: tag.id }); }}
                      title="태그 삭제"
                    >
                      <X size={12} />
                    </button>
                  </button>
                </div>
              );
            })}
            {addingTag && (
              <div className="add-form">
                <div className="color-picker">
                  {NOTE_COLORS.map(c => (
                    <button
                      key={c}
                      className={`color-dot ${newColor === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setNewColor(c)}
                    />
                  ))}
                </div>
                <input
                  autoFocus
                  placeholder="태그 이름..."
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') createTag();
                    if (e.key === 'Escape') setAddingTag(false);
                  }}
                />
                <div className="add-form-actions">
                  <button className="btn-confirm" onClick={createTag}>추가</button>
                  <button className="btn-cancel" onClick={() => setAddingTag(false)}>취소</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sidebar-bottom">
        <button
          className={`nav-item ${isActive('trash') ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_VIEW', viewMode: 'trash' })}
        >
          <Trash2 size={16} />
          <span>휴지통</span>
          {trashCount > 0 && <span className="nav-count">{trashCount}</span>}
        </button>
      </div>
    </aside>
  );
}
