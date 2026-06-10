'use client';
import { useState } from 'react';
import { useGraph } from '@/context/GraphContext';
import { EDGE_TYPES } from '@/lib/constants';
import { X } from 'lucide-react';

export default function AddEdgeModal() {
  const { state, dispatch, addToast, performGraphAction } = useGraph();
  const [form, setForm] = useState({
    source: state.edgeDraft?.source || state.selectedNode?.id || '',
    target: state.edgeDraft?.target || '',
    relation: 'connects',
    rationale: '',
    confidence: 0.9,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.source || !form.target) {
      addToast('Source and target are required', 'warning');
      return;
    }
    if (form.source === form.target) {
      addToast('Source and target must be different', 'warning');
      return;
    }

    setLoading(true);
    try {
      const newRel = { ...form, id: crypto.randomUUID() };
      
      const actionConfig = {
        type: `Add Edge "${form.relation}"`,
        forward: [
          {
            dispatch: { type: 'ADD_RELATIONSHIP', payload: newRel },
            api: { url: '/api/relationships', method: 'POST', body: newRel }
          }
        ],
        reverse: [
          {
            dispatch: { type: 'REMOVE_RELATIONSHIP', payload: newRel.id },
            api: { url: `/api/relationships/${newRel.id}`, method: 'DELETE' }
          }
        ]
      };

      performGraphAction(actionConfig);

      dispatch({ type: 'TOGGLE_ADD_EDGE_MODAL' });
      addToast(`Created relationship: ${form.relation}`, 'success');
    } catch (err) {
      addToast('Failed to create edge: ' + err.message, 'error');
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={() => dispatch({ type: 'TOGGLE_ADD_EDGE_MODAL' })}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add Relationship</h2>
          <button className="modal-close" onClick={() => dispatch({ type: 'TOGGLE_ADD_EDGE_MODAL' })}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Source Node *</label>
              <select
                className="form-select"
                value={form.source}
                onChange={(e) => handleChange('source', e.target.value)}
              >
                <option value="">Select source...</option>
                {state.entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    [{e.type}] {e.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Relationship Type *</label>
              <select
                className="form-select"
                value={form.relation}
                onChange={(e) => handleChange('relation', e.target.value)}
              >
                {EDGE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Target Node *</label>
              <select
                className="form-select"
                value={form.target}
                onChange={(e) => handleChange('target', e.target.value)}
              >
                <option value="">Select target...</option>
                {state.entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    [{e.type}] {e.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Rationale</label>
              <textarea
                className="form-textarea"
                value={form.rationale}
                onChange={(e) => handleChange('rationale', e.target.value)}
                placeholder="Why does this relationship exist?"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confidence ({Math.round(form.confidence * 100)}%)</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={form.confidence}
                onChange={(e) => handleChange('confidence', parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dispatch({ type: 'TOGGLE_ADD_EDGE_MODAL' })}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Relationship'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
