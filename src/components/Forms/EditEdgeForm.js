'use client';
import { useState, useEffect } from 'react';
import { useGraph } from '@/context/GraphContext';
import { EDGE_TYPES } from '@/lib/constants';
import { X } from 'lucide-react';

export default function EditEdgeModal() {
  const { state, dispatch, addToast, resolveSuggestionItem, performGraphAction } = useGraph();
  const edge = state.editingEdge;

  const [form, setForm] = useState({
    source: '',
    target: '',
    relation: '',
    rationale: '',
    confidence: 0.9,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (edge) {
      setForm({
        source: edge.source || '',
        target: edge.target || '',
        relation: edge.relation || 'references',
        rationale: edge.rationale || '',
        confidence: edge.confidence ?? 0.9,
      });
    }
  }, [edge]);

  if (!edge) return null;

  const handleRejectGhost = async () => {
    const liveSuggestion = state.pendingSuggestions.find(s => s.id === edge.suggestionId);
    if (liveSuggestion) {
      await resolveSuggestionItem(liveSuggestion, 'edge', edge._relationship || edge, 'reject');
    }
    dispatch({ type: 'HIDE_EDIT_EDGE' });
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    try {
      if (edge.isGhost) {
        const newEdge = { ...form, id: edge.id || crypto.randomUUID(), source: 'manual' };
        const actionConfig = {
          type: `Create Edge "${form.relation}" from Proposal`,
          forward: [
            {
              dispatch: { type: 'ADD_RELATIONSHIP', payload: newEdge },
              api: { url: '/api/relationships', method: 'POST', body: newEdge }
            }
          ],
          reverse: [
            {
              dispatch: { type: 'REMOVE_RELATIONSHIP', payload: newEdge.id },
              api: { url: `/api/relationships/${newEdge.id}`, method: 'DELETE' }
            }
          ]
        };

        performGraphAction(actionConfig);

        dispatch({ 
          type: 'REMOVE_SUGGESTION_ITEM', 
          payload: { suggestionId: edge.suggestionId, itemType: 'edge', item: edge } 
        });

        const liveSuggestion = state.pendingSuggestions.find(s => s.id === edge.suggestionId);
        if (liveSuggestion) {
          let remaining = (liveSuggestion.proposed_nodes?.length || 0) + (liveSuggestion.proposed_edges?.length || 0);
          if (remaining <= 1) {
            fetch(`/api/suggestions/${edge.suggestionId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'reject' }),
            }).catch(console.error);
            dispatch({ type: 'REMOVE_SUGGESTION', payload: edge.suggestionId });
          }
        }

        dispatch({ type: 'HIDE_EDIT_EDGE' });
        addToast(`Manually created relationship`, 'success');
      } else {
        const oldEdge = { ...edge };
        const updatedEdge = { ...edge, ...form };
        
        const actionConfig = {
          type: `Update Edge "${form.relation}"`,
          forward: [
            {
              dispatch: { type: 'UPDATE_RELATIONSHIP', payload: updatedEdge },
              api: { url: `/api/relationships/${edge.id}`, method: 'PUT', body: form }
            }
          ],
          reverse: [
            {
              dispatch: { type: 'UPDATE_RELATIONSHIP', payload: oldEdge },
              api: { url: `/api/relationships/${edge.id}`, method: 'PUT', body: oldEdge }
            }
          ]
        };

        performGraphAction(actionConfig);

        dispatch({ type: 'HIDE_EDIT_EDGE' });
        addToast('Relationship updated', 'success');
      }
    } catch (err) {
      addToast('Failed to update: ' + err.message, 'error');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    dispatch({ 
      type: 'SHOW_DELETE_CONFIRM', 
      payload: { nodes: [], edges: [edge] } 
    });
    dispatch({ type: 'HIDE_EDIT_EDGE' });
  };

  return (
    <div className="modal-overlay" onClick={() => dispatch({ type: 'HIDE_EDIT_EDGE' })}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Relationship</h2>
          <button className="modal-close" onClick={() => dispatch({ type: 'HIDE_EDIT_EDGE' })}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Source Node</label>
              <select
                className="form-select"
                value={form.source}
                onChange={(e) => handleChange('source', e.target.value)}
              >
                {state.entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    [{e.type}] {e.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Relationship Type</label>
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
              <label className="form-label">Target Node</label>
              <select
                className="form-select"
                value={form.target}
                onChange={(e) => handleChange('target', e.target.value)}
              >
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
            {!edge.isGhost && (
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            )}
            <div style={{ flex: 1 }} />
            {edge.isGhost ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleRejectGhost}
              >
                Reject Proposal
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => dispatch({ type: 'HIDE_EDIT_EDGE' })}
              >
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
