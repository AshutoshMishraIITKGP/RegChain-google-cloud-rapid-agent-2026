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

      {/* Theme toggle floating */}
      <div style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 50,
      }}>
        <ThemeToggle />
      </div>

      {/* Modals */}
      {state.showAddNodeModal && <AddNodeModal />}
      {state.showAddEdgeModal && <AddEdgeModal />}
      {state.showEditNodeModal && <EditNodeModal />}
      {state.showEditEdgeModal && <EditEdgeModal />}
      <VersionHistoryModal />
      <SaveGraphModal />
      <DeleteConfirmModal />

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
