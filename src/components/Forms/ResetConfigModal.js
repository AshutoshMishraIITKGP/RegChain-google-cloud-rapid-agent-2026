'use client';
import { useState } from 'react';
import { useGraph } from '@/context/GraphContext';
import { RotateCcw, X } from 'lucide-react';

export default function ResetConfigModal({ isOpen, onClose, onReset }) {
  const { loadGraph, addToast } = useGraph();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/graph/layout/reset', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to reset layout');
      
      addToast(`Configuration reset successfully. Releasing all pinned nodes.`, 'success');
      
      // Clear pins and reheat simulation
      if (onReset) onReset();
      
      // Reload graph to fetch new un-pinned nodes
      await loadGraph();
      onClose();
    } catch (err) {
      console.error(err);
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <RotateCcw size={18} />
            Reset Graph Configuration
          </div>
          <button className="icon-btn" onClick={onClose} disabled={loading}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
          <p>Are you sure you want to reset the graph layout configuration to its default physics state?</p>
          <p style={{ marginTop: '12px' }}>This will unpin all manually positioned nodes and cause the graph to automatically recalculate node distances and clusters.</p>
        </div>

        <div className="modal-footer" style={{ marginTop: '24px' }}>
          <button className="btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button 
            className="btn primary" 
            onClick={handleConfirm}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {loading ? 'Resetting...' : 'Reset Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
