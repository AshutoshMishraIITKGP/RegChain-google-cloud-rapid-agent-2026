import { useState, useEffect } from 'react';
import { useGraph } from '@/context/GraphContext';
import { Save, X } from 'lucide-react';

export default function SaveGraphModal() {
  const { state, dispatch, addToast } = useGraph();
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (state.showSaveGraphModal) {
      setSaveName(new Date().toLocaleString());
    }
  }, [state.showSaveGraphModal]);

  const handleSave = async () => {
    if (!saveName.trim()) {
      addToast('Please enter a name for the version', 'error');
      return;
    }

    setIsSaving(true);
    addToast('Saving new graph version...', 'info');
    
    try {
      const res = await fetch('/api/versions', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', name: saveName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      if (data.version && data.version.id) {
        await fetch(`/api/versions/${data.version.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: saveName })
        });
      }
      
      addToast(`Successfully saved ${saveName}`, 'success');
      dispatch({ type: 'TOGGLE_SAVE_GRAPH_MODAL' });
    } catch (err) {
      addToast('Failed to save version: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!state.showSaveGraphModal) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 450 }}>
        <div className="modal-header">
          <h2><Save size={20} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} /> Save Graph State</h2>
          <button className="icon-btn" onClick={() => dispatch({ type: 'TOGGLE_SAVE_GRAPH_MODAL' })}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Version Name</label>
            <input 
              type="text" 
              value={saveName} 
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Before merging risk nodes"
              className="form-input"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={() => dispatch({ type: 'TOGGLE_SAVE_GRAPH_MODAL' })} disabled={isSaving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Version'}
          </button>
        </div>
      </div>
    </div>
  );
}
