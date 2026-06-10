'use client';
import { useState } from 'react';
import { useGraph } from '@/context/GraphContext';
import { NODE_TYPES, STATUS_OPTIONS } from '@/lib/constants';
import { X } from 'lucide-react';

export default function AddNodeModal() {
  const { state, dispatch, addToast, performGraphAction } = useGraph();
  const [form, setForm] = useState({
    type: 'Regulation',
    name: '',
    description: '',
    status: 'active',
    owner: '',
    tags: [],
    notes: '',
  });
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);

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
      const newEntity = { 
        ...form, 
        id: crypto.randomUUID(),
        x: state.nodeDraftCoords?.x,
        y: state.nodeDraftCoords?.y,
        fx: state.nodeDraftCoords?.x,
        fy: state.nodeDraftCoords?.y
      };

      if (state.nodeDraftCoords?.x !== undefined) {
        try {
          const pinned = JSON.parse(localStorage.getItem('regchain_node_positions') || '{}');
          pinned[newEntity.id] = { x: state.nodeDraftCoords.x, y: state.nodeDraftCoords.y };
          localStorage.setItem('regchain_node_positions', JSON.stringify(pinned));
        } catch (e) {
          console.error('Failed to pin new node:', e);
        }
      }

      const actionConfig = {
        type: `Add Node "${form.name}"`,
        forward: [
          { 
            dispatch: { type: 'ADD_ENTITY', payload: newEntity },
            api: { url: '/api/entities', method: 'POST', body: newEntity }
          }
        ],
        reverse: [
          {
            dispatch: { type: 'REMOVE_ENTITY', payload: newEntity.id },
            api: { url: `/api/entities/${newEntity.id}`, method: 'DELETE' }
          }
        ]
      };

      performGraphAction(actionConfig);

      dispatch({ type: 'TOGGLE_ADD_NODE_MODAL' });
      addToast(`Created ${form.type}: "${form.name}"`, 'success');
    } catch (err) {
      addToast('Failed to create node: ' + err.message, 'error');
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={() => dispatch({ type: 'TOGGLE_ADD_NODE_MODAL' })}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add Node</h2>
          <button className="modal-close" onClick={() => dispatch({ type: 'TOGGLE_ADD_NODE_MODAL' })}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Type *</label>
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
                placeholder="Enter node name..."
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe this entity..."
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
                placeholder="Responsible person or team..."
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
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dispatch({ type: 'TOGGLE_ADD_NODE_MODAL' })}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Node'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
