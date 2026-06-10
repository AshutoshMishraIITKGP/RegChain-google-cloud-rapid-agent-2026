'use client';
import { useState, useEffect } from 'react';
import { Check, X, AlertTriangle, Edit3, Link2, Circle } from 'lucide-react';
import { useGraph } from '@/context/GraphContext';
import { NODE_COLORS } from '@/lib/constants';

export default function SuggestionCard({ suggestion }) {
  const [optimisticStatus, setOptimisticStatus] = useState(null);
  const { state, resolveSuggestionItem, resolveSuggestion, dispatch } = useGraph();

  const handlePartialAction = (itemType, item, action) => {
    resolveSuggestionItem(suggestion, itemType, item, action);
  };

  const handlePartialModify = (itemType, item) => {
    if (itemType === 'node') {
      const nodeId = item.id || item.name.toLowerCase().replace(/\s+/g, '_');
      dispatch({ 
        type: 'SHOW_EDIT_NODE', 
        payload: { ...item, id: nodeId, isGhost: true, suggestionId: suggestion.id }
      });
    }
  };

  if (!suggestion) return null;

  useEffect(() => {
    fetch(`/api/suggestions/${suggestion.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.suggestion && data.suggestion.status) {
          setOptimisticStatus(data.suggestion.status);
        }
      })
      .catch(err => console.error('Failed to fetch suggestion status', err));
  }, [suggestion.id]);

  const currentStatus = optimisticStatus || suggestion.status;
  const isResolved = currentStatus === 'approved' || currentStatus === 'rejected' || currentStatus === 'resolved';

  const nodes = suggestion.proposed_nodes || [];
  const edges = suggestion.proposed_edges || [];
  const deletedNodes = suggestion.proposed_deletions?.nodes || [];
  const deletedEdges = suggestion.proposed_deletions?.edges || [];
  const totalFindings = nodes.length + edges.length + deletedNodes.length + deletedEdges.length;
  
  const hasRisks = nodes.some(n => n.type === 'Risk' || n.type === 'Gap');
  const hasObligations = nodes.some(n => n.type === 'Obligation' || n.type === 'Task' || n.type === 'Regulation');
  const riskLevel = hasRisks ? 'High' : (hasObligations ? 'Medium' : 'Low');
  const riskColor = hasRisks ? 'var(--danger)' : (hasObligations ? 'var(--warning)' : 'var(--success)');

  // Group nodes by type
  const groupedNodes = {};
  nodes.forEach((n, i) => {
    if (!groupedNodes[n.type]) groupedNodes[n.type] = [];
    groupedNodes[n.type].push({ node: n, index: i });
  });
  
  const getNodeName = (id) => {
    const node = state.entities.find(e => e.id === id);
    return node ? node.name : id;
  };

  return (
    <div className="suggestion-card" style={{ padding: '16px', fontFamily: 'var(--font-sans)', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-elevated)', marginTop: '12px' }}>
      {/* HEADER */}
      <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px', marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>
          Graph Review Complete
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Findings:</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {[
                nodes.length > 0 ? `${nodes.length} Nodes` : '',
                edges.length > 0 ? `${edges.length} Edges` : '',
                deletedNodes.length > 0 ? `${deletedNodes.length} Deletions` : '',
                deletedEdges.length > 0 ? `${deletedEdges.length} Edge Deletions` : ''
              ].filter(Boolean).join(', ') || 'No Changes'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Risk Level:</div>
            <div style={{ fontWeight: 700, color: riskColor }}>{riskLevel}</div>
          </div>
        </div>
      </div>

      {/* EXECUTIVE SUMMARY */}
      {suggestion.summary && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '6px' }}>Executive Summary</div>
          <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {suggestion.summary}
          </div>
          {suggestion.reasoning && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.4 }}>
              {suggestion.reasoning}
            </div>
          )}
        </div>
      )}

      {/* RECOMMENDED CHANGES */}
      {totalFindings > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '12px' }}>Recommended Changes</div>
          
          {Object.entries(groupedNodes).map(([type, items]) => (
            <div key={type} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                <Circle size={10} fill={NODE_COLORS[type] || 'var(--text-secondary)'} color={NODE_COLORS[type] || 'var(--text-secondary)'} />
                {type}s
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.map(({ node, index }) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{node.name}</div>
                      {node.description && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{node.description}</div>}
                    </div>
                    {!isResolved && (
                      <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                        <button onClick={() => handlePartialAction('node', node, 'approve')} className="toolbar-btn" style={{ padding: '4px' }} title="Approve">
                          <Check size={14} color="var(--success)" />
                        </button>
                        <button onClick={() => handlePartialAction('node', node, 'reject')} className="toolbar-btn" style={{ padding: '4px' }} title="Reject">
                          <X size={14} color="var(--danger)" />
                        </button>
                        <button onClick={() => handlePartialModify('node', node)} className="toolbar-btn" style={{ padding: '4px' }} title="Modify">
                          <Edit3 size={14} color="var(--text-secondary)" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {deletedNodes.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--danger)', marginBottom: '8px' }}>
                <AlertTriangle size={12} />
                Node Deletions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {deletedNodes.map((nodeId, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', background: 'var(--danger-dim)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--danger)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--danger)' }}>{getNodeName(nodeId)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {edges.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                <Link2 size={12} />
                Relationships
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {edges.map((edge, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                    <div style={{ flex: 1, fontSize: '11px', color: 'var(--text-primary)' }}>
                      <span style={{ fontWeight: 500 }}>{edge.source_name || edge.source}</span>
                      <span style={{ color: 'var(--text-tertiary)', margin: '0 4px' }}>→ [{edge.relation}] →</span>
                      <span style={{ fontWeight: 500 }}>{edge.target_name || edge.target}</span>
                      {edge.rationale && <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{edge.rationale}</div>}
                    </div>
                    {!isResolved && (
                      <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                        <button onClick={() => handlePartialAction('edge', edge, 'approve')} className="toolbar-btn" style={{ padding: '4px' }} title="Approve">
                          <Check size={14} color="var(--success)" />
                        </button>
                        <button onClick={() => handlePartialAction('edge', edge, 'reject')} className="toolbar-btn" style={{ padding: '4px' }} title="Reject">
                          <X size={14} color="var(--danger)" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {deletedEdges.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--danger)', marginBottom: '8px' }}>
                <Link2 size={12} />
                Edge Deletions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {deletedEdges.map((edgeId, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', background: 'var(--danger-dim)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--danger)' }}>
                    <div style={{ flex: 1, fontSize: '11px', color: 'var(--danger)' }}>
                      <span style={{ fontWeight: 500 }}>ID: {edgeId}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* IMPACT & CONFIDENCE */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '6px' }}>Impact</div>
          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {nodes.length > 0 && <li>Add {nodes.length} node{nodes.length > 1 ? 's' : ''}</li>}
            {edges.length > 0 && <li>Add {edges.length} relationship{edges.length > 1 ? 's' : ''}</li>}
            <li>Enhance compliance mapping</li>
          </ul>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '6px' }}>Confidence</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {nodes.map((n, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>{n.name}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round((n.confidence || 0.85) * 100)}%</span>
              </div>
            ))}
            {edges.map((e, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>{e.relation}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round((e.confidence || 0.85) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WARNINGS */}
      {suggestion.warnings && suggestion.warnings.length > 0 && (
        <div style={{ marginBottom: '20px', background: 'var(--warning-dim)', border: '1px solid var(--warning)', borderRadius: '6px', padding: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--warning)', marginBottom: '4px' }}>
            <AlertTriangle size={14} /> Warnings
          </div>
          {suggestion.warnings.map((warning, i) => (
            <div key={i} style={{ fontSize: '11px', color: 'var(--warning)', paddingLeft: '20px', lineHeight: 1.4, marginBottom: '4px' }}>
              • {warning}
            </div>
          ))}
        </div>
      )}

      {/* ACTIONS */}
      {!isResolved && (
        <div style={{ display: 'flex', gap: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-primary)' }}>
          <button 
            className="toolbar-btn primary" 
            style={{ flex: 1, padding: '8px', fontWeight: 600 }} 
            onClick={() => {
              setOptimisticStatus('approved');
              resolveSuggestion(suggestion, 'approve');
            }}
          >
            <Check size={16} /> Approve All
          </button>
          <button 
            className="toolbar-btn" 
            style={{ flex: 1, padding: '8px', color: 'var(--danger)', fontWeight: 600 }} 
            onClick={() => {
              setOptimisticStatus('rejected');
              resolveSuggestion(suggestion, 'reject');
            }}
          >
            <X size={16} /> Reject All
          </button>
        </div>
      )}

      {isResolved && (
        <div style={{
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 600,
          color: currentStatus === 'approved' ? 'var(--success)' : 'var(--text-tertiary)',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          {currentStatus === 'approved' ? (
            <><Check size={14} /> Changes Applied Successfully</>
          ) : (
            <><X size={14} /> Suggestion Rejected</>
          )}
        </div>
      )}
    </div>
  );
}
