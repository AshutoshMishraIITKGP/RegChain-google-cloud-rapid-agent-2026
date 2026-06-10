import { useState, useEffect } from 'react';
import { useGraph } from '@/context/GraphContext';
import { X, Clock, Edit2, Trash2, RotateCcw, AlertTriangle, Save, History as HistoryIcon } from 'lucide-react';

export default function VersionHistoryModal() {
  const { state, dispatch, addToast, loadGraph } = useGraph();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (state.showVersionHistoryModal) {
      fetchVersions();
    }
  }, [state.showVersionHistoryModal]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/versions');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVersions(data);
    } catch (err) {
      addToast('Failed to load versions: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (id, newName) => {
    try {
      const res = await fetch(`/api/versions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addToast('Version renamed successfully', 'success');
      setEditingId(null);
      fetchVersions();
    } catch (err) {
      addToast('Failed to rename version: ' + err.message, 'error');
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState(null);

  const handleDelete = async (id) => {
    // Optimistic delete
    const previousVersions = [...versions];
    setVersions(versions.filter(v => v.id !== id));
    setConfirmDeleteId(null);
    
    try {
      const res = await fetch(`/api/versions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      addToast('Version deleted successfully', 'success');
    } catch (err) {
      setVersions(previousVersions);
      addToast('Failed to delete version: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  const handleRestore = async (id) => {
    try {
      setConfirmRestoreId(null);
      addToast('Restoring graph state...', 'info');
      const res = await fetch(`/api/versions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      
      addToast('Graph restored successfully!', 'success');
      dispatch({ type: 'TOGGLE_VERSION_HISTORY' });
      
      setTimeout(() => loadGraph(), 500);
    } catch (err) {
      addToast('Failed to restore version: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saveName, setSaveName] = useState('');

  const handleManualSave = async () => {
    if (!saveName.trim()) {
      addToast('Please enter a name for the version', 'error');
      return;
    }
    
    addToast('Saving new graph version...', 'info');
    setShowSaveConfirm(false);
    try {
      const res = await fetch('/api/versions', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', name: saveName }) // Assuming API accepts name during save or we default it
      });
      // Note: The API currently doesn't take a name in POST /api/versions, we should fix that or it auto-names.
      // Wait, we can rename it right after saving.
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // If we need to rename it
      if (data.version && data.version.id) {
        await fetch(`/api/versions/${data.version.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: saveName })
        });
      }
      
      addToast(`Successfully saved ${saveName}`, 'success');
      fetchVersions();
      setSaveName('');
    } catch (err) {
      addToast('Failed to save version: ' + err.message, 'error');
    }
  };

  if (!state.showVersionHistoryModal) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 600 }}>
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2><HistoryIcon size={20} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} /> Version History</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => { setSaveName(new Date().toLocaleString()); setShowSaveConfirm(true); }}>
              <Save size={16} style={{ marginRight: 8 }} /> Save Current State
            </button>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }} onClick={() => dispatch({ type: 'TOGGLE_VERSION_HISTORY' })}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '16px' }}>
          
          {showSaveConfirm && (
            <div style={{ marginBottom: 16, padding: 16, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
              <h3 style={{ marginBottom: 12, fontSize: 14 }}>Save Current State</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  type="text" 
                  value={saveName} 
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Enter version name..."
                  style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: '#fff', padding: '8px 12px', borderRadius: 4 }}
                  autoFocus
                />
                <button className="btn btn-primary" onClick={handleManualSave}>Save</button>
                <button className="btn" onClick={() => setShowSaveConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              {versions.length} / 20 versions saved. Oldest versions are overwritten when limit is reached.
            </p>
          </div>

          {loading && <p>Loading versions...</p>}
          {!loading && versions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
              <Clock size={40} style={{ marginBottom: 16, opacity: 0.5 }} />
              <p>No saved versions yet. Press Ctrl+S to save your current graph state.</p>
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {versions.map(v => (
              <div key={v.id} style={{ 
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 8, 
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ flex: 1 }}>
                  {editingId === v.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input 
                        type="text" 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: '#fff', padding: '4px 8px', borderRadius: 4 }}
                      />
                      <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => handleRename(v.id, editName)}>Save</button>
                      <button className="btn" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {v.name}
                        <button className="icon-btn" style={{ padding: 4 }} onClick={() => { setEditingId(v.id); setEditName(v.name); }}>
                          <Edit2 size={12} />
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        {new Date(v.timestamp).toLocaleString()}
                      </div>
                    </>
                  )}
                </div>

                {confirmDeleteId === v.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'rgba(244, 67, 54, 0.1)', borderRadius: 4, border: '1px solid rgba(244, 67, 54, 0.3)' }}>
                    <AlertTriangle size={14} color="#F44336" />
                    <span style={{ fontSize: 13, color: '#F44336' }}>Delete?</span>
                    <button className="btn btn-primary" style={{ padding: '2px 8px', fontSize: 12, background: '#F44336', color: 'white' }} onClick={() => handleDelete(v.id)}>Yes</button>
                    <button className="btn" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setConfirmDeleteId(null)}>No</button>
                  </div>
                ) : confirmRestoreId === v.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'rgba(76, 175, 80, 0.1)', borderRadius: 4, border: '1px solid rgba(76, 175, 80, 0.3)' }}>
                    <AlertTriangle size={14} color="#4CAF50" />
                    <span style={{ fontSize: 13, color: '#4CAF50' }}>Overwrite graph?</span>
                    <button className="btn btn-primary" style={{ padding: '2px 8px', fontSize: 12, background: '#4CAF50', color: 'white' }} onClick={() => handleRestore(v.id)}>Yes</button>
                    <button className="btn" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setConfirmRestoreId(null)}>No</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => setConfirmRestoreId(v.id)}
                      style={{ background: 'rgba(76, 175, 80, 0.1)', color: '#4CAF50', border: '1px solid #4CAF50' }}
                    >
                      <RotateCcw size={14} style={{ marginRight: 6 }} /> Restore
                    </button>
                    <button 
                      className="icon-btn" 
                      onClick={() => setConfirmDeleteId(v.id)}
                      style={{ color: '#F44336' }}
                      title="Delete Version"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
