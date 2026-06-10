'use client';
import { useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { GraphProvider, useGraph } from '@/context/GraphContext';
import LeftSidebar from '@/components/Layout/LeftSidebar';
import GraphCanvas from '@/components/Graph/GraphCanvas';
import AICopilot from '@/components/AI/AICopilot';
import DeleteConfirmModal from '@/components/Forms/DeleteConfirmModal';
import AddNodeModal from '@/components/Forms/AddNodeForm';
import AddEdgeModal from '@/components/Forms/AddEdgeForm';
import EditNodeModal from '@/components/Forms/EditNodeForm';
import EditEdgeModal from '@/components/Forms/EditEdgeForm';
import VersionHistoryModal from '@/components/Forms/VersionHistoryModal';
import SaveGraphModal from '@/components/Forms/SaveGraphModal';
import ThemeToggle from '@/components/Common/ThemeToggle';
import HelpModal from '@/components/Modals/HelpModal';

function AppContent() {
  const { state, dispatch, loadGraph } = useGraph();

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // Globally prevent context menu to avoid interference with right-click interactions
  useEffect(() => {
    const handleContextMenu = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      if (!e.shiftKey) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  return (
    <>
      <div className="app-layout">
        <LeftSidebar />
        <GraphCanvas />
        <AICopilot />
      </div>

      {/* Action Bar */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '320px', // next to inspector
        zIndex: 10,
        display: 'flex',
        gap: '12px',
        pointerEvents: 'auto'
      }}>
      </div>

      {/* Modals */}
      {state.showAddNodeModal && <AddNodeModal />}
      {state.showAddEdgeModal && <AddEdgeModal />}
      {state.showEditNodeModal && <EditNodeModal />}
      {state.showEditEdgeModal && <EditEdgeModal />}
      <VersionHistoryModal />
      <SaveGraphModal />
      <DeleteConfirmModal />
      <HelpModal />

      {/* Toast Notifications */}
      <div className="toast-container">
        {state.toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === 'success' && '✅'}
            {toast.type === 'error' && '❌'}
            {toast.type === 'warning' && '⚠️'}
            {toast.type === 'info' && 'ℹ️'}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Home() {
  return (
    <ThemeProvider>
      <GraphProvider>
        <AppContent />
      </GraphProvider>
    </ThemeProvider>
  );
}
