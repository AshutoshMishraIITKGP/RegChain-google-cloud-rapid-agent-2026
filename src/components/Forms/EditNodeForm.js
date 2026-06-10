'use client';
import { useState, useEffect } from 'react';
import { useGraph } from '@/context/GraphContext';
import { NODE_TYPES, STATUS_OPTIONS } from '@/lib/constants';
import { X } from 'lucide-react';

export default function EditNodeModal() {
  const { state, dispatch, addToast, loadGraph, resolveSuggestionItem, performGraphAction } = useGraph();
  const node = state.editingNode;

  const [form, setForm] = useState({
    type: '',
    name: '',
    description: '',
    status: 'active',
    owner: '',
    tags: [],
    notes: '',
  });
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (node) {
      setForm({
        type: node.type || 'Regulation',
        name: node.name || '',
        description: node.description || '',
        status: node.status || 'active',
        owner: node.owner || '',
        tags: node.tags || [],
        notes: node.notes || '',
      });
    }
  }, [node]);

  if (!node) return null;

  const handleRejectGhost = async () => {
    const liveSuggestion = state.pendingSuggestions.find(s => s.id === node.suggestionId);
    if (liveSuggestion) {
      await resolveSuggestionItem(liveSuggestion, 'node', node._entity || node, 'reject');
    }
    dispatch({ type: 'HIDE_EDIT_NODE' });
  };

  const handleDelete = () => {
    dispatch({ 
      type: 'SHOW_DELETE_CONFIRM', 
      payload: { nodes: [node], edges: [] } 
    });
    dispatch({ type: 'HIDE_EDIT_NODE' });
    dispatch({ type: 'CLOSE_INSPECTOR' });
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!form.tags.includes(tagInput.trim())) {
        setForm((prev) => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast('Name is required', 'warning');
      return;
    }

    setLoading(true);
    try {
      if (node.isGhost) {
        // Creating a new node manually from a ghost suggestion
        const newNode = { ...form, source: 'manual', id: node.id || crypto.randomUUID() };
        
        const actionConfig = {
          type: `Create Node "${form.name}" from Proposal`,
          forward: [
            {
              dispatch: { type: 'ADD_ENTITY', payload: newNode },
              api: { url: '/api/entities', method: 'POST', body: newNode }
            }
          ],
          reverse: [
            {
              dispatch: { type: 'REMOVE_ENTITY', payload: newNode.id },
              api: { url: `/api/entities/${newNode.id}`, method: 'DELETE' }
            }
          ]
        };

        performGraphAction(actionConfig);

        dispatch({ 
          type: 'REMOVE_SUGGESTION_ITEM', 
          payload: { suggestionId: node.suggestionId, itemType: 'node', item: node } 
        });

        const liveSuggestion = state.pendingSuggestions.find(s => s.id === node.suggestionId);
        if (liveSuggestion) {
          let remaining = (liveSuggestion.proposed_nodes?.length || 0) + (liveSuggestion.proposed_edges?.length || 0);
          if (remaining <= 1) {
            fetch(`/api/suggestions/${node.suggestionId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'reject' }),
            }).catch(console.error);
            dispatch({ type: 'REMOVE_SUGGESTION', payload: node.suggestionId });
          }
        }

        dispatch({ type: 'HIDE_EDIT_NODE' });
        dispatch({ type: 'CLOSE_INSPECTOR' });
        
        addToast(`Manually created "${form.name}"`, 'success');
      } else {
        // Normal update
        // We need to keep track of the old node state for the reverse action
        const oldNode = { ...node };
        const updatedNode = { ...node, ...form };
        
        const actionConfig = {
          type: `Update Node "${form.name}"`,
          forward: [
            {
              dispatch: { type: 'UPDATE_ENTITY', payload: updatedNode },
              api: { url: `/api/entities/${node.id}`, method: 'PUT', body: form }
            }
          ],
          reverse: [
            {
              dispatch: { type: 'UPDATE_ENTITY', payload: oldNode },
              api: { url: `/api/entities/${node.id}`, method: 'PUT', body: oldNode }
            }
          ]
        };

        performGraphAction(actionConfig);

        dispatch({ type: 'HIDE_EDIT_NODE' });

        // Update selected node if it's the same
        if (state.selectedNode?.id === node.id) {
          dispatch({ type: 'SELECT_NODE', payload: updatedNode });
        }

        addToast(`Updated "${form.name}"`, 'success');
      }
    } catch (err) {
      addToast('Failed to save: ' + err.message, 'error');
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={() => dispatch({ type: 'HIDE_EDIT_NODE' })}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{node.isGhost ? 'Modify AI Proposal' : 'Edit Node'}</h2>
          <button className="modal-close" onClick={() => dispatch({ type: 'HIDE_EDIT_NODE' })}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select
                className="form-select"
                value={form.type}
                onChange={(e) => handleChange('type', e.target.value)}
              >
                {NODE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                className="form-input"
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Owner</label>
              <input
                className="form-input"
                type="text"
                value={form.owner}
                onChange={(e) => handleChange('owner', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tags</label>
              <div className="form-tags-input">
                {form.tags.map((tag) => (
                  <span key={tag} className="form-tag">
                    {tag}
                    <button
                      type="button"
                      className="form-tag-remove"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  className="form-tag-input"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Type and press Enter..."
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="modal-footer">
            {!node.isGhost && (
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            )}
            <div style={{ flex: 1 }} />
            {node.isGhost ? (
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
                onClick={() => dispatch({ type: 'HIDE_EDIT_NODE' })}
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
