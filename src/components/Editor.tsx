import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Pin, Trash2, Tag, ChevronDown, X, Check,
  Maximize2, Minimize2, Type, Strikethrough,
  Highlighter, History, Code,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { saveImageFile } from '../utils/imageStorage';
import { readNoteFile } from '../utils/storage';
import { NoteVersion } from '../types';

type FormatCommand = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'insertUnorderedList' | 'insertOrderedList' | 'justifyLeft' | 'justifyCenter' | 'justifyRight';

export default function Editor() {
  const { state, dispatch } = useApp();
  const note = state.notes.find(n => n.id === state.selectedNoteId);

  const [title, setTitle] = useState('');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [notebookDropdownOpen, setNotebookDropdownOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState('16');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null);
  const [overlayRect, setOverlayRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const selectedImgRef = useRef<HTMLImageElement | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedId = useRef<string | null>(null);
  const currentNoteIdRef = useRef<string | null>(null);
  // Tracks the notebook tree path (root → leaf names) for the current note
  const notebookPathRef = useRef<string[]>([]);

  // Lazy-load content when a note is selected but not yet fetched
  useEffect(() => {
    if (!note) return;
    if (!state.loadedNoteIds.has(note.id)) {
      // Reset guard so innerHTML will be written once content arrives
      lastSavedId.current = null;
      readNoteFile(note.id, note.notebookId).then(full => {
        // Always dispatch — marks as loaded even if file missing
        dispatch({ type: 'SET_NOTE_CONTENT', noteId: note.id, content: full?.content ?? '' });
      });
    }
  }, [note?.id]);

  useEffect(() => {
    if (!note) return;
    if (!state.loadedNoteIds.has(note.id)) return;
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    currentNoteIdRef.current = note.id;
    setTitle(note.title === '제목 없음' ? '' : note.title);
    if (editorRef.current && lastSavedId.current !== note.id) {
      editorRef.current.innerHTML = note.content;
      lastSavedId.current = note.id;
    }
    setHistoryOpen(false);
    setSelectedVersion(null);
    selectedImgRef.current = null;
    setOverlayRect(null);
  }, [note?.id, state.loadedNoteIds.has(note?.id ?? '')]);

  // Keep notebookPathRef in sync whenever the note's notebook changes
  useEffect(() => {
    if (!note) return;
    const path: string[] = [];
    let current = state.notebooks.find(nb => nb.id === note.notebookId);
    while (current) {
      path.unshift(current.name);
      const parentId = current.parentId;
      current = parentId ? state.notebooks.find(nb => nb.id === parentId) : undefined;
    }
    notebookPathRef.current = path;
  }, [note?.notebookId, state.notebooks]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.notebook-selector')) setNotebookDropdownOpen(false);
      if (!target.closest('.tag-add-wrapper')) setTagDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveContent = useCallback(() => {
    if (!currentNoteIdRef.current || !editorRef.current) return;
    const content = editorRef.current.innerHTML;
    dispatch({
      type: 'UPDATE_NOTE',
      note: { id: currentNoteIdRef.current, content },
    });
  }, [dispatch]);

  // Ctrl+S → save version
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 's' && (e.ctrlKey || e.metaKey) && currentNoteIdRef.current) {
        e.preventDefault();
        saveContent();
        dispatch({ type: 'SAVE_VERSION', noteId: currentNoteIdRef.current });
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, saveContent]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!note) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      dispatch({
        type: 'UPDATE_NOTE',
        note: { id: note.id, title: value || '제목 없음' },
      });
    }, 500);
  };

  const handleEditorInput = useCallback(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(saveContent, 800);
  }, [saveContent]);

  function format(cmd: FormatCommand) {
    document.execCommand(cmd, false);
    editorRef.current?.focus();
    handleEditorInput();
  }

  function formatFontSize(size: string) {
    // Mark pre-existing font[size="7"] so we only restyle newly inserted ones
    const existing = editorRef.current?.querySelectorAll('font[size="7"]');
    existing?.forEach(el => el.setAttribute('data-pre', '1'));
    document.execCommand('fontSize', false, '7');
    const newElements = editorRef.current?.querySelectorAll('font[size="7"]:not([data-pre])');
    newElements?.forEach(el => {
      (el as HTMLElement).removeAttribute('size');
      (el as HTMLElement).style.fontSize = `${size}px`;
    });
    existing?.forEach(el => el.removeAttribute('data-pre'));
    setFontSize(size);
    editorRef.current?.focus();
    handleEditorInput();
  }

  function highlight() {
    document.execCommand('hiliteColor', false, '#FFFF99');
    editorRef.current?.focus();
    handleEditorInput();
  }

  function insertCodeBlock() {
    const sel = window.getSelection();
    const selectedText = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).toString() : '';
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = selectedText || '';
    pre.appendChild(code);

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(pre);
      // place cursor inside code
      const newRange = document.createRange();
      newRange.selectNodeContents(code);
      newRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } else if (editorRef.current) {
      editorRef.current.appendChild(pre);
    }

    editorRef.current?.focus();
    handleEditorInput();
  }

  // ── Image resize ──────────────────────────────────────────────
  function syncOverlay(img: HTMLImageElement | null) {
    if (!img) { setOverlayRect(null); return; }
    const r = img.getBoundingClientRect();
    setOverlayRect({ left: r.left, top: r.top, width: r.width, height: r.height });
  }

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    function onScroll() { syncOverlay(selectedImgRef.current); }
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Element;
      if (!target.closest?.('[data-img-overlay]') && !target.closest?.('.note-body')) {
        selectedImgRef.current = null;
        setOverlayRect(null);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && target.classList.contains('note-image')) {
      selectedImgRef.current = target as HTMLImageElement;
      syncOverlay(target as HTMLImageElement);
    } else {
      selectedImgRef.current = null;
      setOverlayRect(null);
    }
  }

  function onHandleMouseDown(e: React.MouseEvent, handle: string) {
    e.preventDefault();
    e.stopPropagation();
    const img = selectedImgRef.current;
    if (!img) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = img.getBoundingClientRect().width;
    const startH = img.getBoundingClientRect().height;
    const aspect = startW / startH;

    function onMouseMove(ev: MouseEvent) {
      const img = selectedImgRef.current;
      if (!img) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let newW = startW;
      let newH = startH;

      // Determine primary dimension by handle direction, then derive the other
      if (handle === 'e' || handle === 'ne' || handle === 'se') {
        newW = Math.max(50, startW + dx);
        newH = newW / aspect;
      } else if (handle === 'w' || handle === 'nw' || handle === 'sw') {
        newW = Math.max(50, startW - dx);
        newH = newW / aspect;
      } else if (handle === 's') {
        newH = Math.max(50, startH + dy);
        newW = newH * aspect;
      } else if (handle === 'n') {
        newH = Math.max(50, startH - dy);
        newW = newH * aspect;
      }

      img.style.width = `${Math.round(newW)}px`;
      img.style.height = `${Math.round(newH)}px`;
      syncOverlay(img);
    }

    function onMouseUp() {
      handleEditorInput();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  const HANDLES = [
    { h: 'nw', style: { left: -5, top: -5,               cursor: 'nwse-resize' } },
    { h: 'n',  style: { left: '50%' as const, top: -5,   transform: 'translateX(-50%)', cursor: 'ns-resize' } },
    { h: 'ne', style: { right: -5, top: -5,               cursor: 'nesw-resize' } },
    { h: 'e',  style: { right: -5, top: '50%' as const,  transform: 'translateY(-50%)', cursor: 'ew-resize' } },
    { h: 'se', style: { right: -5, bottom: -5,            cursor: 'nwse-resize' } },
    { h: 's',  style: { left: '50%' as const, bottom: -5, transform: 'translateX(-50%)', cursor: 'ns-resize' } },
    { h: 'sw', style: { left: -5, bottom: -5,             cursor: 'nesw-resize' } },
    { h: 'w',  style: { left: -5, top: '50%' as const,   transform: 'translateY(-50%)', cursor: 'ew-resize' } },
  ];
  // ──────────────────────────────────────────────────────────────

  const insertImageDataUrl = useCallback(async (dataUrl: string) => {
    editorRef.current?.focus();
    const src = await saveImageFile(dataUrl, notebookPathRef.current);
    document.execCommand('insertHTML', false, `<img src="${src}" class="note-image" />`);
    handleEditorInput();
  }, [handleEditorInput]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const imageItem = Array.from(e.clipboardData.items).find(item => item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => insertImageDataUrl(reader.result as string).catch(console.error);
    reader.readAsDataURL(file);
  }, [insertImageDataUrl]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!editorRef.current?.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => insertImageDataUrl(reader.result as string).catch(console.error);
      reader.readAsDataURL(file);
    });
  }, [insertImageDataUrl]);

  if (!note) {
    return (
      <div className="editor-empty">
        <div className="editor-empty-inner">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <rect width="80" height="80" rx="16" fill="#2a2a2a" />
            <path d="M20 24h40M20 36h32M20 48h36M20 60h24" stroke="#00A82D" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <h3>노트를 선택하세요</h3>
          <p>왼쪽에서 노트를 선택하거나 새 노트를 만드세요</p>
          <button
            className="new-note-btn"
            onClick={() => dispatch({ type: 'CREATE_NOTE' })}
          >
            새 노트 만들기
          </button>
        </div>
      </div>
    );
  }

  const notebook = state.notebooks.find(nb => nb.id === note.notebookId);
  const noteTags = state.tags.filter(t => note.tags.includes(t.id));
  const availableTags = state.tags.filter(t => !note.tags.includes(t.id));
  const isTrash = note.isTrashed;

  return (
    <div className={`editor ${fullscreen ? 'fullscreen' : ''}`}>
      <div className="editor-toolbar-top">
        <div className="editor-meta">
          <div className="notebook-selector">
            <button
              className="notebook-select-btn"
              onClick={() => !isTrash && setNotebookDropdownOpen(o => !o)}
              disabled={isTrash}
            >
              <span className="notebook-dot" style={{ background: notebook?.color ?? '#ccc' }} />
              <span>{notebook?.name ?? '노트북 없음'}</span>
              {!isTrash && <ChevronDown size={13} />}
            </button>
            {notebookDropdownOpen && (
              <div className="dropdown">
                {state.notebooks.map(nb => (
                  <button
                    key={nb.id}
                    className={nb.id === note.notebookId ? 'active' : ''}
                    onClick={() => {
                      dispatch({ type: 'UPDATE_NOTE', note: { id: note.id, notebookId: nb.id } });
                      setNotebookDropdownOpen(false);
                    }}
                  >
                    <span className="notebook-dot" style={{ background: nb.color }} />
                    {nb.name}
                    {nb.id === note.notebookId && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="tag-selector">
            {noteTags.map(tag => (
              <span key={tag.id} className="tag-chip" style={{ color: tag.color, borderColor: tag.color }}>
                {tag.name}
                {!isTrash && (
                  <button
                    onClick={() => dispatch({
                      type: 'UPDATE_NOTE',
                      note: { id: note.id, tags: note.tags.filter(t => t !== tag.id) },
                    })}
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}
            {!isTrash && (
              <div className="tag-add-wrapper">
                <button
                  className="tag-add-btn"
                  onClick={() => setTagDropdownOpen(o => !o)}
                >
                  <Tag size={13} /> 태그 추가
                </button>
                {tagDropdownOpen && (
                  <div className="dropdown">
                    {availableTags.length === 0 ? (
                      <div className="dropdown-empty">태그가 없습니다<br/>사이드바에서 태그를 만드세요</div>
                    ) : (
                      availableTags.map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => {
                            dispatch({
                              type: 'UPDATE_NOTE',
                              note: { id: note.id, tags: [...note.tags, tag.id] },
                            });
                            setTagDropdownOpen(false);
                          }}
                        >
                          <Tag size={12} style={{ color: tag.color }} />
                          {tag.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="editor-actions">
          {!isTrash && (
            <>
              <button
                className={`action-btn ${note.isPinned ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'TOGGLE_PIN', noteId: note.id })}
                title={note.isPinned ? '고정 해제' : '고정'}
              >
                <Pin size={16} />
              </button>
              <button
                className={`action-btn ${historyOpen ? 'active' : ''}`}
                onClick={() => setHistoryOpen(o => !o)}
                title="버전 기록"
              >
                <History size={16} />
              </button>
            </>
          )}
          {isTrash ? (
            <button
              className="action-btn danger"
              onClick={() => dispatch({ type: 'DELETE_NOTE', noteId: note.id })}
              title="영구 삭제"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <button
              className="action-btn"
              onClick={() => dispatch({ type: 'TRASH_NOTE', noteId: note.id })}
              title="삭제"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            className="action-btn"
            onClick={() => setFullscreen(f => !f)}
            title={fullscreen ? '창 모드' : '전체 화면'}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {!isTrash && (
        <div className="formatting-toolbar">
          <div className="toolbar-group">
            <Type size={14} />
            <select
              value={fontSize}
              onChange={e => formatFontSize(e.target.value)}
              title="글자 크기"
            >
              <option value="12">12</option>
              <option value="14">14</option>
              <option value="16">16</option>
              <option value="18">18</option>
              <option value="20">20</option>
              <option value="24">24</option>
              <option value="28">28</option>
              <option value="36">36</option>
            </select>
          </div>
          <div className="toolbar-divider" />
          <div className="toolbar-group">
            <button onClick={() => format('bold')} title="굵게"><Bold size={15} /></button>
            <button onClick={() => format('italic')} title="기울기"><Italic size={15} /></button>
            <button onClick={() => format('underline')} title="밑줄"><Underline size={15} /></button>
            <button onClick={() => format('strikethrough')} title="취소선"><Strikethrough size={15} /></button>
            <button onClick={highlight} title="형광펜"><Highlighter size={15} /></button>
          </div>
          <div className="toolbar-divider" />
          <div className="toolbar-group">
            <button onClick={() => format('insertUnorderedList')} title="목록"><List size={15} /></button>
            <button onClick={() => format('insertOrderedList')} title="번호 목록"><ListOrdered size={15} /></button>
            <button onClick={insertCodeBlock} title="코드 블럭"><Code size={15} /></button>
          </div>
          <div className="toolbar-divider" />
          <div className="toolbar-group">
            <button onClick={() => format('justifyLeft')} title="왼쪽 정렬"><AlignLeft size={15} /></button>
            <button onClick={() => format('justifyCenter')} title="가운데 정렬"><AlignCenter size={15} /></button>
            <button onClick={() => format('justifyRight')} title="오른쪽 정렬"><AlignRight size={15} /></button>
          </div>
        </div>
      )}

      {historyOpen ? (
        (() => {
          const noteVersions = state.versions
            .filter(v => v.noteId === note.id)
            .sort((a, b) => b.savedAt - a.savedAt);

          function formatVersionDate(ts: number): string {
            const d = new Date(ts);
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const yesterdayStart = todayStart - 86400000;
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            if (ts >= todayStart) return `오늘 ${hh}:${mm}`;
            if (ts >= yesterdayStart) return `어제 ${hh}:${mm}`;
            return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}:${mm}`;
          }

          return (
            <div className="history-panel">
              <div className="history-list">
                <div className="history-list-header">
                  <span>버전 기록</span>
                  <button
                    className="action-btn"
                    onClick={() => { setHistoryOpen(false); setSelectedVersion(null); }}
                    title="닫기"
                  >
                    <X size={14} />
                  </button>
                </div>
                {noteVersions.length === 0 ? (
                  <div className="history-empty">
                    저장된 버전 없음<br/><small>Ctrl+S로 저장</small>
                  </div>
                ) : (
                  noteVersions.map(v => (
                    <div
                      key={v.id}
                      className={`history-item ${selectedVersion?.id === v.id ? 'active' : ''}`}
                      onClick={() => setSelectedVersion(v)}
                    >
                      {formatVersionDate(v.savedAt)}
                    </div>
                  ))
                )}
              </div>
              <div className="history-preview">
                {selectedVersion ? (
                  <>
                    <div className="history-preview-header">
                      <div className="history-preview-title">{selectedVersion.title}</div>
                      <button
                        className="history-restore-btn"
                        onClick={() => {
                          dispatch({ type: 'RESTORE_VERSION', versionId: selectedVersion.id });
                          setHistoryOpen(false);
                          setSelectedVersion(null);
                        }}
                      >
                        복원
                      </button>
                    </div>
                    <div
                      className="note-body readonly"
                      dangerouslySetInnerHTML={{ __html: selectedVersion.content }}
                    />
                  </>
                ) : (
                  <div className="history-empty">버전을 선택하세요</div>
                )}
              </div>
            </div>
          );
        })()
      ) : (
        <div className="editor-content">
          <input
            className="note-title-input"
            placeholder="제목..."
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            disabled={isTrash}
          />
          <div className="note-body-wrapper">
            <div
              ref={editorRef}
              className={`note-body ${isTrash ? 'readonly' : ''}`}
              contentEditable={!isTrash}
              suppressContentEditableWarning
              onInput={handleEditorInput}
              onBlur={saveContent}
              onClick={handleEditorClick}
              onPaste={isTrash ? undefined : handlePaste}
              onDragOver={isTrash ? undefined : handleDragOver}
              onDragLeave={isTrash ? undefined : handleDragLeave}
              onDrop={isTrash ? undefined : handleDrop}
              data-placeholder="여기에 노트를 작성하세요..."
            />
            {isDraggingOver && (
              <div className="drag-overlay">
                <div className="drag-overlay-inner">이미지를 여기에 놓으세요</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="editor-footer">
        <span>
          최종 수정: {new Date(note.updatedAt).toLocaleString('ko-KR', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </span>
        {isTrash && <span className="trash-badge">휴지통</span>}
      </div>

      {overlayRect && (
        <div
          data-img-overlay
          style={{
            position: 'fixed',
            left: overlayRect.left,
            top: overlayRect.top,
            width: overlayRect.width,
            height: overlayRect.height,
            border: '1.5px solid #0066CC',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          {HANDLES.map(({ h, style }) => (
            <div
              key={h}
              style={{
                position: 'absolute',
                width: 10,
                height: 10,
                background: 'white',
                border: '1.5px solid #0066CC',
                borderRadius: 2,
                pointerEvents: 'all',
                ...style,
              }}
              onMouseDown={e => onHandleMouseDown(e, h)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
