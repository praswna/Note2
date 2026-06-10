import { useState, useEffect } from 'react';
import {
  BookOpen, Tag, Pin, Trash2, ChevronDown, ChevronRight,
  Plus, MoreHorizontal, Edit2, X, Check, FolderPlus,
  ChevronsDownUp, ChevronsUpDown, Palette,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Notebook } from '../types';

const NOTE_COLORS = [
  '#00A82D', '#0066CC', '#CC3300', '#FF6600',
  '#9933CC', '#00AAAA', '#CC6600', '#006633',
];

interface AddFormProps {
  onConfirm: (name: string, color: string) => void;
  onCancel: () => void;
  placeholder?: string;
}

function AddForm({ onConfirm, onCancel, placeholder = '노트북 이름...' }: AddFormProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(NOTE_COLORS[0]);
  return (
    <div className="add-form">
      <div className="color-picker">
        {NOTE_COLORS.map(c => (
          <button
            key={c}
            className={`color-dot ${color === c ? 'selected' : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <input
        autoFocus
        placeholder={placeholder}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { if (name.trim()) onConfirm(name.trim(), color); }
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="add-form-actions">
        <button className="btn-confirm" onClick={() => { if (name.trim()) onConfirm(name.trim(), color); }}>추가</button>
        <button className="btn-cancel" onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}

interface NotebookNodeProps {
  notebook: Notebook;
  allNotebooks: Notebook[];
  depth: number;
  menuOpen: string | null;
  setMenuOpen: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  addingChildOf: string | null;
  setAddingChildOf: (id: string | null) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onExpand: (id: string) => void;
  onExpandAll: (fromId: string) => void;
  onCollapseAll: (fromId: string) => void;
  colorPickerId: string | null;
  setColorPickerId: (id: string | null) => void;
}

function NotebookNode({
  notebook, allNotebooks, depth,
  menuOpen, setMenuOpen,
  editingId, setEditingId,
  addingChildOf, setAddingChildOf,
  expandedIds, onToggle, onExpand, onExpandAll, onCollapseAll,
  colorPickerId, setColorPickerId,
}: NotebookNodeProps) {
  const { state, dispatch } = useApp();
  const [editingName, setEditingName] = useState('');

  const expanded = expandedIds.has(notebook.id);
  const children = allNotebooks.filter(nb => nb.parentId === notebook.id);
  const hasChildren = children.length > 0;

  const collectIds = (id: string): string[] => {
    const kids = allNotebooks.filter(nb => nb.parentId === id).map(nb => nb.id);
    return [id, ...kids.flatMap(collectIds)];
  };
  const allIds = collectIds(notebook.id);
  const count = state.notes.filter(n => allIds.includes(n.notebookId) && !n.isTrashed).length;

  const isActive = state.viewMode === 'notebook' && state.selectedNotebookId === notebook.id;

  function startEdit() {
    setEditingName(notebook.name);
    setEditingId(notebook.id);
    setMenuOpen(null);
  }

  function confirmEdit() {
    if (editingName.trim()) {
      dispatch({ type: 'RENAME_NOTEBOOK', notebookId: notebook.id, name: editingName.trim() });
    }
    setEditingId(null);
  }

  const indent = depth * 14;

  return (
    <div>
      <div className="section-item-wrapper">
        {editingId === notebook.id ? (
          <div className="inline-edit" style={{ paddingLeft: indent + 10 }}>
            <input
              autoFocus
              value={editingName}
              onChange={e => setEditingName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmEdit();
                if (e.key === 'Escape') setEditingId(null);
              }}
            />
            <button onClick={confirmEdit}><Check size={12} /></button>
            <button onClick={() => setEditingId(null)}><X size={12} /></button>
          </div>
        ) : (
          <div
            className={`nav-item ${isActive ? 'active' : ''}`}
            style={{ paddingLeft: indent + 10 }}
            role="button"
            tabIndex={0}
            onClick={() => dispatch({ type: 'SET_VIEW', viewMode: 'notebook', notebookId: notebook.id })}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') dispatch({ type: 'SET_VIEW', viewMode: 'notebook', notebookId: notebook.id }); }}
          >
            {hasChildren || addingChildOf === notebook.id ? (
              <button
                className="expand-btn"
                onClick={e => { e.stopPropagation(); onToggle(notebook.id); }}
              >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            ) : (
              <span className="expand-placeholder" />
            )}
            <span className="notebook-dot" style={{ background: notebook.color }} />
            <span className="nav-label">{notebook.name}</span>
            <span className="nav-count">{count}</span>
            <button
              className="item-menu-btn"
              onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === notebook.id ? null : notebook.id); }}
            >
              <MoreHorizontal size={12} />
            </button>
          </div>
        )}

        {menuOpen === notebook.id && (
          <div className="context-menu" style={{ left: indent + 10 }}>
            <button onClick={startEdit}>
              <Edit2 size={12} /> 이름 변경
            </button>
            <button onClick={() => setColorPickerId(colorPickerId === notebook.id ? null : notebook.id)}>
              <Palette size={12} /> 색 변경
            </button>
            {colorPickerId === notebook.id && (
              <div className="context-color-picker">
                {NOTE_COLORS.map(c => (
                  <button
                    key={c}
                    className={`color-dot ${notebook.color === c ? 'selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => {
                      dispatch({ type: 'CHANGE_NOTEBOOK_COLOR', notebookId: notebook.id, color: c });
                      setColorPickerId(null);
                      setMenuOpen(null);
                    }}
                  />
                ))}
              </div>
            )}
            <button onClick={() => { setAddingChildOf(notebook.id); onExpand(notebook.id); setMenuOpen(null); }}>
              <FolderPlus size={12} /> 하위 노트북 추가
            </button>
            {hasChildren && (
              <>
                <button onClick={() => { onExpandAll(notebook.id); setMenuOpen(null); }}>
                  <ChevronsUpDown size={12} /> 모두 열기
                </button>
                <button onClick={() => { onCollapseAll(notebook.id); setMenuOpen(null); }}>
                  <ChevronsDownUp size={12} /> 모두 닫기
                </button>
              </>
            )}
            <button
              className="danger"
              onClick={() => { dispatch({ type: 'DELETE_NOTEBOOK', notebookId: notebook.id }); setMenuOpen(null); }}
            >
              <Trash2 size={12} /> 삭제
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div>
          {children.map(child => (
            <NotebookNode
              key={child.id}
              notebook={child}
              allNotebooks={allNotebooks}
              depth={depth + 1}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
              editingId={editingId}
              setEditingId={setEditingId}
              addingChildOf={addingChildOf}
              setAddingChildOf={setAddingChildOf}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onExpand={onExpand}
              onExpandAll={onExpandAll}
              onCollapseAll={onCollapseAll}
              colorPickerId={colorPickerId}
              setColorPickerId={setColorPickerId}
            />
          ))}
          {addingChildOf === notebook.id && (
            <div style={{ paddingLeft: (depth + 1) * 14 + 8 }}>
              <AddForm
                onConfirm={(name, color) => {
                  dispatch({ type: 'CREATE_NOTEBOOK', name, color, parentId: notebook.id });
                  setAddingChildOf(null);
                }}
                onCancel={() => setAddingChildOf(null)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { state, dispatch } = useApp();
  const [notebooksOpen, setNotebooksOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [addingRootNotebook, setAddingRootNotebook] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingChildOf, setAddingChildOf] = useState<string | null>(null);
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(state.notebooks.map(nb => nb.id))
  );

  // Auto-expand newly added notebooks
  useEffect(() => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      let changed = false;
      state.notebooks.forEach(nb => { if (!prev.has(nb.id)) { next.add(nb.id); changed = true; } });
      return changed ? next : prev;
    });
  }, [state.notebooks]);

  function getSubtreeIds(fromId: string): string[] {
    const result: string[] = [];
    const collect = (id: string) => {
      result.push(id);
      state.notebooks.filter(nb => nb.parentId === id).forEach(c => collect(c.id));
    };
    collect(fromId);
    return result;
  }

  function onToggle(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function onExpand(id: string) {
    setExpandedIds(prev => prev.has(id) ? prev : new Set([...prev, id]));
  }

  function onExpandAll(fromId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      getSubtreeIds(fromId).forEach(id => next.add(id));
      return next;
    });
  }

  function onCollapseAll(fromId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      getSubtreeIds(fromId).forEach(id => next.delete(id));
      return next;
    });
  }

  const rootNotebooks = state.notebooks.filter(nb => !nb.parentId);
  const allCount = state.notes.filter(n => !n.isTrashed).length;
  const pinnedCount = state.notes.filter(n => n.isPinned && !n.isTrashed).length;
  const trashCount = state.notes.filter(n => n.isTrashed).length;
  const hasAnyNotebook = state.notebooks.length > 0;

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
        <button className="section-header" onClick={() => setNotebooksOpen(o => !o)}>
          {notebooksOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>노트북</span>
          {notebooksOpen && hasAnyNotebook && (
            <>
              <button
                className="add-btn"
                title="모두 열기"
                onClick={e => { e.stopPropagation(); rootNotebooks.forEach(nb => onExpandAll(nb.id)); }}
              >
                <ChevronsUpDown size={13} />
              </button>
              <button
                className="add-btn"
                title="모두 닫기"
                onClick={e => { e.stopPropagation(); rootNotebooks.forEach(nb => onCollapseAll(nb.id)); }}
              >
                <ChevronsDownUp size={13} />
              </button>
            </>
          )}
          <button
            className="add-btn"
            onClick={e => { e.stopPropagation(); setAddingRootNotebook(true); }}
            title="노트북 추가"
          >
            <Plus size={14} />
          </button>
        </button>

        {notebooksOpen && (
          <div className="section-items">
            {rootNotebooks.map(nb => (
              <NotebookNode
                key={nb.id}
                notebook={nb}
                allNotebooks={state.notebooks}
                depth={0}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                editingId={editingId}
                setEditingId={setEditingId}
                addingChildOf={addingChildOf}
                setAddingChildOf={setAddingChildOf}
                expandedIds={expandedIds}
                onToggle={onToggle}
                onExpand={onExpand}
                onExpandAll={onExpandAll}
                onCollapseAll={onCollapseAll}
                colorPickerId={colorPickerId}
                setColorPickerId={setColorPickerId}
              />
            ))}
            {addingRootNotebook && (
              <AddForm
                onConfirm={(name, color) => {
                  dispatch({ type: 'CREATE_NOTEBOOK', name, color });
                  setAddingRootNotebook(false);
                }}
                onCancel={() => setAddingRootNotebook(false)}
              />
            )}
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <button className="section-header" onClick={() => setTagsOpen(o => !o)}>
          {tagsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>태그</span>
          <button
            className="add-btn"
            onClick={e => { e.stopPropagation(); setAddingTag(true); }}
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
                    <span className="expand-placeholder" />
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
              <AddForm
                placeholder="태그 이름..."
                onConfirm={(name, color) => {
                  dispatch({ type: 'CREATE_TAG', name, color });
                  setAddingTag(false);
                }}
                onCancel={() => setAddingTag(false)}
              />
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
