import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import {
  BookOpen, Tag, Pin, Trash2, ChevronDown, ChevronRight,
  Plus, Edit2, X, Check, FolderPlus,
  ChevronsDownUp, ChevronsUpDown, GripVertical,
} from 'lucide-react';
import { useApp, type Action } from '../context/AppContext';
import { Notebook } from '../types';
import { generateId } from '../utils/storage';

const NOTE_COLORS = [
  '#EAFFD0', '#FFF799', '#FFD150', '#95E1D3',
  '#91D06C', '#FF9760', '#f8961e', '#F38181',
  '#f3722c', '#f94144', '#F26076', '#43aa8b',
  '#4C8CE4', '#458B73', '#577590', '#406093',
];

interface AddFormProps {
  onConfirm: (name: string, color: string) => void;
  onCancel: () => void;
  placeholder?: string;
}

function AddForm({ onConfirm, onCancel, placeholder = '태그 이름...' }: AddFormProps) {
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

function isDescendant(nodeId: string, ancestorId: string, notebooks: Notebook[]): boolean {
  const visited = new Set<string>();
  let cur: string | undefined = nodeId;
  while (cur) {
    if (visited.has(cur)) break;
    visited.add(cur);
    if (cur === ancestorId) return true;
    cur = notebooks.find(nb => nb.id === cur)?.parentId;
  }
  return false;
}

interface NotebookNodeProps {
  notebook: Notebook;
  allNotebooks: Notebook[];
  childrenMap: Map<string | undefined, Notebook[]>;
  notebookCountMap: Map<string, number>;
  activeNotebookId: string | null;
  dispatch: React.Dispatch<Action>;
  depth: number;
  menuOpen: string | null;
  setMenuOpen: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  setEditingName: (name: string) => void;
  editingName: string;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onExpand: (id: string) => void;
  onExpandAll: (fromId: string) => void;
  onCollapseAll: (fromId: string) => void;
  onCreateChild: (parentId: string) => void;
  draggingNbRef: React.MutableRefObject<string | null>;
  dragOverRef: React.MutableRefObject<{ id: string; pos: 'before' | 'after' } | null>;
  dropLineId: string | null;
  setDropLineId: (id: string | null) => void;
  onReorder: (notebookId: string, beforeId: string | null, parentId: string | undefined) => void;
  selectedNbIds: Set<string>;
  setSelectedNbIds: (ids: Set<string>) => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
}

const NotebookNode = memo(function NotebookNode({
  notebook, allNotebooks, childrenMap, notebookCountMap, activeNotebookId, dispatch,
  depth, menuOpen, setMenuOpen, editingId, setEditingId, editingName, setEditingName,
  expandedIds, onToggle, onExpand, onExpandAll, onCollapseAll, onCreateChild,
  draggingNbRef, dragOverRef, dropLineId, setDropLineId, onReorder,
  selectedNbIds, setSelectedNbIds, draggingId, setDraggingId,
}: NotebookNodeProps) {
  const [dragOver, setDragOver] = useState(false);

  const expanded = expandedIds.has(notebook.id);
  const children = childrenMap.get(notebook.id) ?? [];
  const hasChildren = children.length > 0;
  const count = notebookCountMap.get(notebook.id) ?? 0;
  const isActive = activeNotebookId === notebook.id;

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
              onFocus={e => e.target.select()}
              onBlur={confirmEdit}
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
            className={`nav-item ${isActive ? 'active' : ''} ${selectedNbIds.has(notebook.id) ? 'nb-selected' : ''} ${dragOver ? 'drop-target' : ''} ${dropLineId === `${notebook.id}:before` ? 'nb-drop-before' : dropLineId === `${notebook.id}:after` ? 'nb-drop-after' : ''} ${draggingId === notebook.id ? 'nb-dragging' : ''}`}
            style={{ paddingLeft: indent + 10 }}
            role="button"
            tabIndex={0}
            draggable
            onDragStart={e => {
              draggingNbRef.current = notebook.id;
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/notebook-id', notebook.id);
              e.dataTransfer.setData('text/plain', `nb:${notebook.id}`);
              setTimeout(() => { if (draggingNbRef.current === notebook.id) setDraggingId(notebook.id); }, 0);
            }}
            onDragEnd={() => {
              draggingNbRef.current = null;
              dragOverRef.current = null;
              setDropLineId(null);
              setDraggingId(null);
            }}
            onClick={e => {
              if (e.ctrlKey || e.metaKey) {
                const next = new Set(selectedNbIds);
                if (next.has(notebook.id)) next.delete(notebook.id); else next.add(notebook.id);
                setSelectedNbIds(next);
              } else {
                setSelectedNbIds(new Set());
                dispatch({ type: 'SET_VIEW', viewMode: 'notebook', notebookId: notebook.id });
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') dispatch({ type: 'SET_VIEW', viewMode: 'notebook', notebookId: notebook.id });
              if (e.key === 'F2') startEdit();
            }}
            onContextMenu={e => { e.preventDefault(); setMenuOpen(menuOpen === notebook.id ? null : notebook.id); }}
            onDragEnter={e => { e.preventDefault(); }}
            onDragOver={e => {
              e.preventDefault();
              const isNoteDrag = e.dataTransfer.types.includes('text/note-id') ||
                (draggingNbRef.current === null && e.dataTransfer.types.includes('text/plain'));
              if (isNoteDrag) {
                e.dataTransfer.dropEffect = 'move';
                setDragOver(true);
                return;
              }
              const draggingId = draggingNbRef.current;
              if (!draggingId || draggingId === notebook.id) return;
              const draggingNb = allNotebooks.find(nb => nb.id === draggingId);

              if (isDescendant(notebook.id, draggingId, allNotebooks)) return;
              if (!draggingNb?.parentId && notebook.parentId) return;

              e.dataTransfer.dropEffect = 'move';

              if (draggingNb?.parentId && !notebook.parentId) {
                setDragOver(true);
                return;
              }

              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
              const newId = `${notebook.id}:${pos}`;
              if (dragOverRef.current?.id !== notebook.id || dragOverRef.current?.pos !== pos) {
                dragOverRef.current = { id: notebook.id, pos };
                setDropLineId(newId);
              }
            }}
            onDragLeave={e => {
              if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                setDragOver(false);
                if (dragOverRef.current?.id === notebook.id) {
                  dragOverRef.current = null;
                  setDropLineId(null);
                }
              }
            }}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);

              let noteId = e.dataTransfer.getData('text/note-id');
              if (!noteId) {
                const plain = e.dataTransfer.getData('text/plain');
                if (plain && plain.startsWith('nt:')) noteId = plain.slice(3);
              }
              if (noteId) {
                dispatch({ type: 'UPDATE_NOTE', note: { id: noteId, notebookId: notebook.id } });
                dragOverRef.current = null;
                setDropLineId(null);
                return;
              }

              let nbId = draggingNbRef.current;
              if (!nbId) {
                const fromData = e.dataTransfer.getData('text/notebook-id');
                if (fromData) {
                  nbId = fromData;
                } else {
                  const plain = e.dataTransfer.getData('text/plain');
                  if (plain && plain.startsWith('nb:')) nbId = plain.slice(3);
                }
              }

              if (nbId && nbId !== notebook.id) {
                const draggingNb = allNotebooks.find(nb => nb.id === nbId);
                const isCycle = isDescendant(notebook.id, nbId, allNotebooks);
                const isRootOnChild = !draggingNb?.parentId && !!notebook.parentId;

                if (!isCycle && !isRootOnChild) {
                  const isChildOnRoot = !!draggingNb?.parentId && !notebook.parentId;
                  if (isChildOnRoot) {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                    const rootChildren = childrenMap.get(notebook.id) ?? [];
                    const beforeId = pos === 'before' ? (rootChildren[0]?.id ?? null) : null;
                    onReorder(nbId, beforeId, notebook.id);
                  } else {
                    const savedPos = dragOverRef.current?.id === notebook.id ? dragOverRef.current.pos : null;
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const pos = savedPos ?? (e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
                    const siblings = childrenMap.get(notebook.parentId) ?? [];
                    const afterSibling = siblings.find((_, i, arr) => arr[i - 1]?.id === notebook.id)?.id ?? null;
                    onReorder(nbId, pos === 'before' ? notebook.id : afterSibling, notebook.parentId);
                  }
                }
              }
              draggingNbRef.current = null;
              dragOverRef.current = null;
              setDropLineId(null);
            }}
          >
            <span className="drag-handle" draggable={false}>
              <GripVertical size={12} />
            </span>
            {hasChildren ? (
              <button
                className="expand-btn"
                draggable={false}
                onClick={e => { e.stopPropagation(); onToggle(notebook.id); }}
              >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            ) : (
              <span className="expand-placeholder" />
            )}
            <span className="nav-label" style={{ color: notebook.color }}>
              {notebook.name}<span className="nav-count">{count}</span>
            </span>
            <span style={{ flex: 1 }} />
            <button
              className="add-child-btn"
              draggable={false}
              title="하위 노트북 추가"
              onClick={e => {
                e.stopPropagation();
                onCreateChild(notebook.id);
                onExpand(notebook.id);
              }}
            >
              <Plus size={11} />
            </button>
          </div>
        )}

        {menuOpen === notebook.id && (
          <div className="context-menu" style={{ left: indent + 10 }}>
            <button onClick={startEdit}>
              <Edit2 size={12} /> 이름 변경 (F2)
            </button>
            <div className="context-color-picker">
              {NOTE_COLORS.map(c => (
                <button
                  key={c}
                  className={`color-dot ${notebook.color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => {
                    const targets = selectedNbIds.size > 0 ? [...selectedNbIds] : [notebook.id];
                    targets.forEach(id => dispatch({ type: 'CHANGE_NOTEBOOK_COLOR', notebookId: id, color: c }));
                    setMenuOpen(null);
                    setSelectedNbIds(new Set());
                  }}
                />
              ))}
            </div>
            <button onClick={() => { onCreateChild(notebook.id); onExpand(notebook.id); setMenuOpen(null); }}>
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
              childrenMap={childrenMap}
              notebookCountMap={notebookCountMap}
              activeNotebookId={activeNotebookId}
              dispatch={dispatch}
              depth={depth + 1}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
              editingId={editingId}
              setEditingId={setEditingId}
              editingName={editingName}
              setEditingName={setEditingName}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onExpand={onExpand}
              onExpandAll={onExpandAll}
              onCollapseAll={onCollapseAll}
              onCreateChild={onCreateChild}
              draggingNbRef={draggingNbRef}
              dragOverRef={dragOverRef}
              dropLineId={dropLineId}
              setDropLineId={setDropLineId}
              onReorder={onReorder}
              selectedNbIds={selectedNbIds}
              setSelectedNbIds={setSelectedNbIds}
              draggingId={draggingId}
              setDraggingId={setDraggingId}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default function Sidebar() {
  const { state, dispatch } = useApp();
  const [notebooksOpen, setNotebooksOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [addingTag, setAddingTag] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const sidebarRef = useRef<HTMLElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(state.notebooks.map(nb => nb.id))
  );
  const draggingNbRef = useRef<string | null>(null);
  const dragOverRef = useRef<{ id: string; pos: 'before' | 'after' } | null>(null);
  const [dropLineId, setDropLineId] = useState<string | null>(null);
  const [selectedNbIds, setSelectedNbIds] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Index notebooks by parentId — O(1) child lookup per node
  const childrenMap = useMemo(() => {
    const map = new Map<string | undefined, Notebook[]>();
    for (const nb of state.notebooks) {
      if (!map.has(nb.parentId)) map.set(nb.parentId, []);
      map.get(nb.parentId)!.push(nb);
    }
    return map;
  }, [state.notebooks]);

  // Pre-compute subtree note counts for all notebooks in one pass
  const notebookCountMap = useMemo(() => {
    const direct = new Map<string, number>();
    for (const note of state.notes) {
      if (!note.isTrashed) direct.set(note.notebookId, (direct.get(note.notebookId) ?? 0) + 1);
    }
    const result = new Map<string, number>();
    const visited = new Set<string>();
    function sum(id: string): number {
      if (result.has(id)) return result.get(id)!;
      if (visited.has(id)) return 0;
      visited.add(id);
      const total = (direct.get(id) ?? 0) +
        (childrenMap.get(id) ?? []).reduce((acc, c) => acc + sum(c.id), 0);
      result.set(id, total);
      return total;
    }
    for (const nb of state.notebooks) sum(nb.id);
    return result;
  }, [state.notebooks, state.notes, childrenMap]);

  // Pre-compute tag note counts
  const tagCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const note of state.notes) {
      if (!note.isTrashed) {
        for (const tagId of note.tags) map.set(tagId, (map.get(tagId) ?? 0) + 1);
      }
    }
    return map;
  }, [state.notes]);

  const { allCount, pinnedCount, trashCount } = useMemo(() => ({
    allCount: state.notes.filter(n => !n.isTrashed).length,
    pinnedCount: state.notes.filter(n => n.isPinned && !n.isTrashed).length,
    trashCount: state.notes.filter(n => n.isTrashed).length,
  }), [state.notes]);

  useEffect(() => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      let changed = false;
      state.notebooks.forEach(nb => { if (!prev.has(nb.id)) { next.add(nb.id); changed = true; } });
      return changed ? next : prev;
    });
  }, [state.notebooks]);

  useEffect(() => {
    if (!menuOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (!sidebarRef.current?.contains(e.target as Node)) setMenuOpen(null);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [menuOpen]);

  const getSubtreeIds = useCallback((fromId: string): string[] => {
    const visited = new Set<string>();
    const result: string[] = [];
    const collect = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      result.push(id);
      (childrenMap.get(id) ?? []).forEach(c => collect(c.id));
    };
    collect(fromId);
    return result;
  }, [childrenMap]);

  const createNotebook = useCallback((parentId?: string) => {
    const id = generateId();
    const color = parentId
      ? (state.notebooks.find(nb => nb.id === parentId)?.color ?? NOTE_COLORS[state.notebooks.length % NOTE_COLORS.length])
      : NOTE_COLORS[state.notebooks.length % NOTE_COLORS.length];
    dispatch({ type: 'CREATE_NOTEBOOK', id, name: '새 노트북', color, parentId });
    setEditingId(id);
    setEditingName('새 노트북');
  }, [state.notebooks, dispatch]);

  const onToggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const onExpand = useCallback((id: string) => {
    setExpandedIds(prev => prev.has(id) ? prev : new Set([...prev, id]));
  }, []);

  const onExpandAll = useCallback((fromId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      getSubtreeIds(fromId).forEach(id => next.add(id));
      return next;
    });
  }, [getSubtreeIds]);

  const onCollapseAll = useCallback((fromId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      getSubtreeIds(fromId).forEach(id => next.delete(id));
      return next;
    });
  }, [getSubtreeIds]);

  const onReorder = useCallback((nbId: string, beforeId: string | null, parentId: string | undefined) => {
    dispatch({ type: 'REORDER_NOTEBOOK', notebookId: nbId, beforeId, parentId });
  }, [dispatch]);

  const rootNotebooks = childrenMap.get(undefined) ?? [];
  const hasAnyNotebook = state.notebooks.length > 0;
  const activeNotebookId = state.viewMode === 'notebook' ? state.selectedNotebookId : null;

  const isActive = (viewMode: string, id?: string) => {
    if (viewMode === 'notebook') return state.viewMode === 'notebook' && state.selectedNotebookId === id;
    if (viewMode === 'tag') return state.viewMode === 'tag' && state.selectedTagId === id;
    return state.viewMode === viewMode;
  };

  return (
    <aside className="sidebar" ref={sidebarRef}>
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
            onClick={e => { e.stopPropagation(); createNotebook(); }}
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
                childrenMap={childrenMap}
                notebookCountMap={notebookCountMap}
                activeNotebookId={activeNotebookId}
                dispatch={dispatch}
                depth={0}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                editingId={editingId}
                setEditingId={setEditingId}
                editingName={editingName}
                setEditingName={setEditingName}
                expandedIds={expandedIds}
                onToggle={onToggle}
                onExpand={onExpand}
                onExpandAll={onExpandAll}
                onCollapseAll={onCollapseAll}
                onCreateChild={createNotebook}
                draggingNbRef={draggingNbRef}
                dragOverRef={dragOverRef}
                dropLineId={dropLineId}
                setDropLineId={setDropLineId}
                onReorder={onReorder}
                selectedNbIds={selectedNbIds}
                setSelectedNbIds={setSelectedNbIds}
                draggingId={draggingId}
                setDraggingId={setDraggingId}
              />
            ))}
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
              const count = tagCountMap.get(tag.id) ?? 0;
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
