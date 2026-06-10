import { useRef, useState, useCallback, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import NoteList from './components/NoteList';
import Editor from './components/Editor';

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 480;
const LIST_MIN = 180;
const LIST_MAX = 520;

function ResizeHandle({ onDrag }: { onDrag: (dx: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(ev: MouseEvent) {
      if (!dragging.current) return;
      const dx = ev.clientX - lastX.current;
      lastX.current = ev.clientX;
      onDrag(dx);
    }
    function onMouseUp() {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [onDrag]);

  return (
    <div className="resize-handle" onMouseDown={onMouseDown} />
  );
}

function AppLayout() {
  const { state } = useApp();
  const [sidebarW, setSidebarW] = useState(240);
  const [listW, setListW] = useState(280);

  // Sync CSS variables
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${sidebarW}px`);
  }, [sidebarW]);
  useEffect(() => {
    document.documentElement.style.setProperty('--list-w', `${listW}px`);
  }, [listW]);

  const onSidebarDrag = useCallback((dx: number) => {
    setSidebarW(w => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w + dx)));
  }, []);

  const onListDrag = useCallback((dx: number) => {
    setListW(w => Math.min(LIST_MAX, Math.max(LIST_MIN, w + dx)));
  }, []);

  return (
    <div className={`app-layout ${state.sidebarOpen ? '' : 'sidebar-collapsed'}`}>
{state.sidebarOpen && (
        <>
          <Sidebar />
          <ResizeHandle onDrag={onSidebarDrag} />
        </>
      )}

      <NoteList />
      <ResizeHandle onDrag={onListDrag} />

      <Editor />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}
