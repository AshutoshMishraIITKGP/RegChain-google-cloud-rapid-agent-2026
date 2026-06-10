'use client';
import { useMemo, useState } from 'react';
import { useGraph } from '@/context/GraphContext';
import { NODE_COLORS, NODE_ICONS } from '@/lib/constants';
import { X, Edit3, Trash2, ExternalLink, GitBranch, Sparkles, Check } from 'lucide-react';

export default function NodeInspector() {
  const { state, dispatch, addToast, resolveSuggestionItem } = useGraph();
  const node = state.selectedNode;
  const [isProcessing, setIsProcessing] = useState(false);

  const { inbound, outbound } = useMemo(() => {
    if (!node) return { inbound: [], outbound: [] };

    const inb = state.relationships
      .filter((r) => r.target === node.id)
      .map((r) => {
        const srcEntity = state.entities.find((e) => e.id === r.source);
        return { ...r, sourceEntity: srcEntity };
      });

    const outb = state.relationships
      .filter((r) => r.source === node.id)
      .map((r) => {
        const tgtEntity = state.entities.find((e) => e.id === r.target);
        return { ...r, targetEntity: tgtEntity };
      });

    return { inbound: inb, outbound: outb };
  }, [node, state.relationships, state.entities]);

  const suggestion = useMemo(() => {
    if (node?.isGhost && node?.suggestionId) {
      return state.pendingSuggestions.find(s => s.id === node.suggestionId);
    }
    return null;
  }, [node, state.pendingSuggestions]);

  if (!node) return null;

  const handleDelete = () => {
    dispatch({
      type: 'SHOW_DELETE_CONFIRM',
      payload: { nodes: [node._entity || node], edges: [] }
    });
  };

  const handleEdit = () => {
    dispatch({ type: 'SHOW_EDIT_NODE', payload: node });
  };

  const handleEdgeClick = (entityId) => {
    const entity = state.entities.find((e) => e.id === entityId);
    if (entity) {
      dispatch({ type: 'SELECT_NODE', payload: entity });
      dispatch({ type: 'FOCUS_NODE', payload: entityId });
    }
  };

  const handleApproveGhost = async () => {
    if (!suggestion) return;
    setIsProcessing(true);
    await resolveSuggestionItem(suggestion, 'node', node.itemIndex, 'approve');
    setIsProcessing(false);
  };

  const handleRejectGhost = async () => {
    if (!suggestion) return;
    setIsProcessing(true);
    await resolveSuggestionItem(suggestion, 'node', node.itemIndex, 'reject');
    setIsProcessing(false);
  };

  // Ghost Node Render View
  if (node.isGhost) {
    return (
      <div className="node-inspector">
        <div className="inspector-header" style={{ borderBottomColor: '#8a2be240' }}>
          <div className="inspector-node-icon" style={{ background: '#8a2be220', color: '#8a2be2' }}>
            <Sparkles size={16} />
          </div>
          <div className="inspector-node-info">
            <div className="inspector-node-name">{node.name}</div>
            <div className="inspector-node-type" style={{ color: '#8a2be2' }}>
              AI Proposal ({node.type})
            </div>
          </div>
          <button className="inspector-close" onClick={() => dispatch({ type: 'CLOSE_INSPECTOR' })}>
            <X size={18} />
          </button>
        </div>

        <div className="inspector-body">
          <div className="inspector-section">
            <div className="inspector-section-title" style={{ color: '#8a2be2' }}>AI Reasoning</div>
            <div className="inspector-field-value">{suggestion?.reasoning || node.description || 'No reasoning provided.'}</div>
          </div>
          {node.source && (
            <div className="inspector-section">
              <div className="inspector-section-title">Source Data</div>
              <div className="inspector-field-value">{node.source}</div>
            </div>
          )}
        </div>

        <div className="inspector-actions" style={{ flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button className="inspector-btn" onClick={handleApproveGhost} disabled={isProcessing} style={{ background: '#2ea043', color: 'white', borderColor: '#2ea043', flex: 1 }}>
              <Check size={14} /> {isProcessing ? 'Processing...' : 'Approve'}
            </button>
            <button className="inspector-btn" onClick={handleRejectGhost} disabled={isProcessing} style={{ background: '#da3633', color: 'white', borderColor: '#da3633', flex: 1 }}>
              <X size={14} /> {isProcessing ? 'Processing...' : 'Reject'}
            </button>
          </div>
          <button className="inspector-btn" onClick={handleEdit} disabled={isProcessing} style={{ width: '100%' }}>
            <Edit3 size={14} /> Modify Manually
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="node-inspector">
      <div className="inspector-header">
        <div
          className="inspector-node-icon"
          style={{ background: `${NODE_COLORS[node.type]}20`, color: NODE_COLORS[node.type] }}
        >
          {NODE_ICONS[node.type] || '●'}
        </div>
        <div className="inspector-node-info">
          <div className="inspector-node-name">{node.name}</div>
          <div className="inspector-node-type" style={{ color: NODE_COLORS[node.type] }}>
            {node.type}
          </div>
        </div>
        <button
          className="inspector-close"
          onClick={() => dispatch({ type: 'CLOSE_INSPECTOR' })}
        >
          <X size={18} />
        </button>
      </div>

      <div className="inspector-body">
        {/* Description */}
        {node.description && (
          <div className="inspector-section">
            <div className="inspector-section-title">Description</div>
            <div className="inspector-field-value">{node.description}</div>
          </div>
        )}

        {/* Metadata */}
        <div className="inspector-section">
          <div className="inspector-section-title">Metadata</div>

          <div className="inspector-field">
            <div className="inspector-field-label">Status</div>
            <div className="inspector-field-value">
              <span className={`badge ${node.type.toLowerCase()}`}>
                {node.status || 'active'}
              </span>
            </div>
          </div>

          {node.owner && (
            <div className="inspector-field">
              <div className="inspector-field-label">Owner</div>
              <div className="inspector-field-value">{node.owner}</div>
            </div>
          )}

          {node.confidence != null && (
            <div className="inspector-field">
              <div className="inspector-field-label">Confidence</div>
              <div className="inspector-field-value">
                {Math.round(node.confidence * 100)}%
              </div>
            </div>
          )}

          {node.source && (
            <div className="inspector-field">
              <div className="inspector-field-label">Source</div>
              <div className="inspector-field-value">{node.source}</div>
            </div>
          )}

          {node.created_by && (
            <div className="inspector-field">
              <div className="inspector-field-label">Created By</div>
              <div className="inspector-field-value">{node.created_by}</div>
            </div>
          )}

          {node.last_updated && (
            <div className="inspector-field">
              <div className="inspector-field-label">Last Updated</div>
              <div className="inspector-field-value">
                {new Date(node.last_updated).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Tags */}
        {node.tags && node.tags.length > 0 && (
          <div className="inspector-section">
            <div className="inspector-section-title">Tags</div>
            <div className="inspector-tags">
              {node.tags.map((tag) => (
                <span key={tag} className="inspector-tag">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {node.notes && (
          <div className="inspector-section">
            <div className="inspector-section-title">Notes</div>
            <div className="inspector-field-value">{node.notes}</div>
          </div>
        )}

        {/* Inbound Edges */}
        <div className="inspector-section">
          <div className="inspector-section-title">
            Inbound Connections ({inbound.length})
          </div>
          <div className="inspector-edge-list">
            {inbound.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                No inbound connections
              </div>
            )}
            {inbound.map((edge) => (
              <div
                key={edge.id}
                className="inspector-edge-item"
                onClick={() => handleEdgeClick(edge.source)}
              >
                <span className="inspector-edge-direction">←</span>
                <span className="inspector-edge-relation">{edge.relation}</span>
                <span className="inspector-edge-node">
                  {edge.sourceEntity?.name || edge.source}
                </span>
                <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Outbound Edges */}
        <div className="inspector-section">
          <div className="inspector-section-title">
            Outbound Connections ({outbound.length})
          </div>
          <div className="inspector-edge-list">
            {outbound.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                No outbound connections
              </div>
            )}
            {outbound.map((edge) => (
              <div
                key={edge.id}
                className="inspector-edge-item"
                onClick={() => handleEdgeClick(edge.target)}
              >
                <span className="inspector-edge-direction">→</span>
                <span className="inspector-edge-relation">{edge.relation}</span>
                <span className="inspector-edge-node">
                  {edge.targetEntity?.name || edge.target}
                </span>
                <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="inspector-actions">
        <button className="inspector-btn" onClick={handleEdit}>
          <Edit3 size={14} /> Edit
        </button>
        <button className="inspector-btn" onClick={() => {
          dispatch({ type: 'TOGGLE_ADD_EDGE_MODAL' });
        }}>
          <GitBranch size={14} /> Connect
        </button>
        <button className="inspector-btn danger" onClick={handleDelete}>
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
}
