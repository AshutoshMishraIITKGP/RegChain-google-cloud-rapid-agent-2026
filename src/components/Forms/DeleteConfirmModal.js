'use client';
import { useState } from 'react';
import { useGraph } from '@/context/GraphContext';
import { AlertTriangle, X } from 'lucide-react';

export default function DeleteConfirmModal() {
  const { state, dispatch, addToast, loadGraph, performGraphAction } = useGraph();
  const [loading, setLoading] = useState(false);

  if (!state.showDeleteConfirm) return null;

  const { nodes = [], edges = [] } = state.deleteItems || {};

  const handleClose = () => {
    dispatch({ type: 'HIDE_DELETE_CONFIRM' });
  };

  const handleConfirm = () => {
    try {
      let deletedNodesCount = 0;
      let deletedEdgesCount = 0;

      const actionConfig = {
        type: `Delete ${nodes.length} nodes and ${edges.length} edges`,
        forward: [],
        reverse: []
      };

      const nodeIds = new Set(nodes.map(n => n.id));
      const connectedEdges = state.relationships.filter(r => nodeIds.has(r.source) || nodeIds.has(r.target));
      
      const allEdgesToDelete = [...edges];
      const edgeIdsToDelete = new Set(allEdgesToDelete.map(e => e.id));
      
      connectedEdges.forEach(e => {
        if (!edgeIdsToDelete.has(e.id)) {
          allEdgesToDelete.push(e);
          edgeIdsToDelete.add(e.id);
        }
      });

      // Edges
      allEdgesToDelete.forEach(edge => {
        if (!edge.isGhost) {
          actionConfig.forward.push({
            dispatch: { type: 'REMOVE_RELATIONSHIP', payload: edge.id },
            api: { url: `/api/relationships/${edge.id}`, method: 'DELETE' }
          });
          actionConfig.reverse.push({
            dispatch: { type: 'ADD_RELATIONSHIP', payload: edge },
            api: { url: '/api/relationships', method: 'POST', body: edge }
          });
          deletedEdgesCount++;
        }
      });

      // Nodes
      nodes.forEach(node => {
        if (!node.isGhost) {
          actionConfig.forward.push({
            dispatch: { type: 'REMOVE_ENTITY', payload: node.id },
            api: { url: `/api/entities/${node.id}`, method: 'DELETE' }
          });
          actionConfig.reverse.push({
            dispatch: { type: 'ADD_ENTITY', payload: node },
            api: { url: '/api/entities', method: 'POST', body: node }
          });
          deletedNodesCount++;
        }
      });

      // We reverse the reverse array so nodes are recreated before edges
      actionConfig.reverse.reverse();

      performGraphAction(actionConfig);

      dispatch({ type: 'CLOSE_INSPECTOR' });
      dispatch({ type: 'HIDE_DELETE_CONFIRM' });

      if (deletedNodesCount > 0 || deletedEdgesCount > 0) {
        let msg = [];
        if (deletedNodesCount > 0) msg.push(`${deletedNodesCount} node(s)`);
        if (deletedEdgesCount > 0) msg.push(`${deletedEdgesCount} edge(s)`);
        addToast(`Deleted ${msg.join(' and ')}`, 'success');
      }
    } catch (err) {
      addToast('Failed to delete items: ' + err.message, 'error');
      loadGraph();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div 
        className="modal" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          background: '#1A1A1A', 
          border: '2px solid #E8B931', 
          boxShadow: '0 8px 32px rgba(232, 185, 49, 0.15)' 
        }}
      >
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(232, 185, 49, 0.2)' }}>
          <h2 className="modal-title" style={{ color: '#E8B931', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} color="#E8B931" />
            Confirm Deletion
          </h2>
          <button className="modal-close" onClick={handleClose} style={{ color: '#E8B931' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ color: '#fff' }}>
          <p style={{ marginBottom: '16px', fontSize: '14px' }}>
            Are you sure you want to permanently delete the following items?
          </p>

          <div style={{ background: '#000', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
            {nodes.length > 0 && (
              <div style={{ marginBottom: edges.length > 0 ? '12px' : '0' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#E8B931', marginBottom: '4px', textTransform: 'uppercase' }}>Nodes ({nodes.length})</div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                  {nodes.map(n => <li key={n.id}>{n.name}</li>)}
                </ul>
              </div>
            )}

            {edges.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#E8B931', marginBottom: '4px', textTransform: 'uppercase' }}>Relationships ({edges.length})</div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                  {edges.map(e => <li key={e.id}>{e.source_name || e.source} → [{e.relation}] → {e.target_name || e.target}</li>)}
                </ul>
              </div>
            )}
          </div>
          
          <p style={{ marginTop: '16px', fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
            Warning: Deleting a node will also automatically delete all relationships connected to it. This action cannot be undone.
          </p>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid rgba(232, 185, 49, 0.2)' }}>
          <button
            type="button"
            className="btn"
            style={{ background: '#333', color: '#fff', border: 'none' }}
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <div style={{ flex: 1 }} />
          <button 
            type="button" 
            className="btn" 
            style={{ background: '#E8B931', color: '#000', border: 'none', fontWeight: 'bold' }} 
            onClick={handleConfirm} 
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Yes, Delete Items'}
          </button>
        </div>
      </div>
    </div>
  );
}
