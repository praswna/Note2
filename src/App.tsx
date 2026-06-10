import { Menu, X } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import NoteList from './components/NoteList';
import Editor from './components/Editor';

function AppLayout() {
  const { state, dispatch } = useApp();

  return (
    <div className={`app-layout ${state.sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <button
        className="sidebar-toggle"
        onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        title={state.sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
      >
        {state.sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {state.sidebarOpen && <Sidebar />}

      <NoteList />

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
