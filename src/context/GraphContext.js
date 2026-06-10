'use client';
import { createContext, useContext, useReducer, useCallback } from 'react';

const GraphContext = createContext();

const initialState = {
  entities: [],
  relationships: [],
  selectedNode: null,
  selectedNodes: [],
  selectedEdges: [],
  focusNodeId: null,
  loading: false,
  showVersionHistory: false,
  showHelpModal: false,
  error: null,
  searchQuery: '',
  categoryFilter: null,
  showInspector: false,
  showAddNodeModal: false,
  showAddEdgeModal: false,
  showEditNodeModal: false,
  editingNode: null,
  showEditEdgeModal: false,
  editingEdge: null,
  toasts: [],
  pendingSuggestions: [],
  edgeDraft: null,
  showDeleteConfirm: false,
  showVersionHistoryModal: false,
  showSaveGraphModal: false,
  deleteItems: { nodes: [], edges: [] },
  past: [],
  future: [],
  activeAnalysisSession: null,
};

function graphReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };
    case 'SET_CATEGORY_FILTER':
      return { ...state, categoryFilter: action.payload };
    case 'SET_ANALYSIS_SESSION':
      return { ...state, activeAnalysisSession: action.payload };
    case 'SET_GRAPH':
      return {
        ...state,
        entities: action.payload.entities || [],
        relationships: action.payload.relationships || [],
        loading: false,
      };
    case 'ADD_ENTITY':
      return { ...state, entities: [...state.entities, action.payload] };
    case 'UPDATE_ENTITY':
      return {
        ...state,
        entities: state.entities.map((e) =>
          e.id === action.payload.id ? { ...e, ...action.payload } : e
        ),
      };
    case 'REMOVE_ENTITY':
      return {
        ...state,
        entities: state.entities.filter((e) => e.id !== action.payload),
        relationships: state.relationships.filter(
          (r) => r.source !== action.payload && r.target !== action.payload
        ),
        selectedNodes: state.selectedNodes.filter(n => n.id !== action.payload),
        selectedNode: state.selectedNode?.id === action.payload ? null : state.selectedNode,
        showInspector: state.selectedNode?.id === action.payload ? false : state.showInspector,
      };
    case 'ADD_RELATIONSHIP':
      return { ...state, relationships: [...state.relationships, action.payload] };
    case 'UPDATE_RELATIONSHIP':
      return {
        ...state,
        relationships: state.relationships.map((r) =>
          r.id === action.payload.id ? { ...r, ...action.payload } : r
        ),
      };
    case 'REMOVE_RELATIONSHIP':
      return {
        ...state,
        relationships: state.relationships.filter((r) => r.id !== action.payload),
        selectedEdges: state.selectedEdges.filter(e => e.id !== action.payload),
      };
    case 'ADD_SUGGESTION':
      return { ...state, pendingSuggestions: [...state.pendingSuggestions, action.payload] };
    case 'REMOVE_SUGGESTION':
      const isSelectedGhost = state.selectedNode?.isGhost && state.selectedNode?.suggestionId === action.payload;
      return { 
        ...state, 
        pendingSuggestions: state.pendingSuggestions.filter(s => s.id !== action.payload),
        showInspector: isSelectedGhost ? false : state.showInspector,
        selectedNode: isSelectedGhost ? null : state.selectedNode
      };
    case 'REMOVE_SUGGESTION_ITEM': {
      const { suggestionId, itemType, item } = action.payload;
      return {
        ...state,
        pendingSuggestions: state.pendingSuggestions.map(sugg => {
          if (sugg.id === suggestionId) {
            const updated = { ...sugg };
            if (itemType === 'node') {
              updated.proposed_nodes = updated.proposed_nodes.filter(n => n !== item && n.name !== item.name);
            } else if (itemType === 'edge') {
              updated.proposed_edges = updated.proposed_edges.filter(e => 
                e !== item && 
                (e.relation !== item.relation || 
                 (e.source_name || e.source) !== (item.source_name || item.source) || 
                 (e.target_name || e.target) !== (item.target_name || item.target))
              );
            }
            return updated;
          }
          return sugg;
        }).filter(sugg => 
          (sugg.proposed_nodes?.length > 0) || (sugg.proposed_edges?.length > 0) || (sugg.changes?.length > 0)
        )
      };
    }
    case 'SELECT_NODE':
      return { ...state, selectedNode: action.payload, selectedNodes: action.payload ? [action.payload] : [], showInspector: !!action.payload, selectedEdges: [] };
    case 'TOGGLE_SELECT_NODE': {
      const { node, multi } = action.payload;
      if (!node) return { ...state, selectedNodes: [], selectedNode: null, showInspector: false };
      
      let newSelectedNodes = [];
      if (multi) {
        const exists = state.selectedNodes.some(n => n.id === node.id);
        if (exists) {
          newSelectedNodes = state.selectedNodes.filter(n => n.id !== node.id);
        } else {
          newSelectedNodes = [...state.selectedNodes, node];
        }
      } else {
        newSelectedNodes = [node];
      }
      
      const selectedNode = (newSelectedNodes.length === 1 && !multi) ? newSelectedNodes[0] : null;
      return { 
        ...state, 
        selectedNodes: newSelectedNodes, 
        selectedNode, 
        showInspector: !!selectedNode, 
        selectedEdges: multi ? state.selectedEdges : [] 
      };
    }
    case 'SELECT_NODES_BULK':
      return { 
        ...state, 
        selectedNodes: action.payload, 
        selectedNode: null, 
        showInspector: false, 
        selectedEdges: [] 
      };
    case 'TOGGLE_SELECT_EDGE': {
      const { edge, multi } = action.payload;
      if (!edge) return { ...state, selectedEdges: [], selectedNode: null, showInspector: false };
      
      let newSelectedEdges = [];
      if (multi) {
        const exists = state.selectedEdges.some(e => e.id === edge.id);
        if (exists) {
          newSelectedEdges = state.selectedEdges.filter(e => e.id !== edge.id);
        } else {
          newSelectedEdges = [...state.selectedEdges, edge];
        }
      } else {
        newSelectedEdges = [edge];
      }
      return { ...state, selectedEdges: newSelectedEdges, selectedNodes: multi ? state.selectedNodes : [], selectedNode: null, showInspector: false };
    }
    case 'FOCUS_NODE':
      return { ...state, focusNodeId: action.payload };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };
    case 'TOGGLE_ADD_NODE_MODAL':
      return { 
        ...state, 
        showAddNodeModal: !state.showAddNodeModal,
        nodeDraftCoords: action.payload || null
      };
    case 'TOGGLE_ADD_EDGE_MODAL':
      return { 
        ...state, 
        showAddEdgeModal: !state.showAddEdgeModal,
        edgeDraft: action.payload || null
      };
    case 'TOGGLE_VERSION_HISTORY':
      return { ...state, showVersionHistoryModal: !state.showVersionHistoryModal };
    case 'TOGGLE_SAVE_GRAPH_MODAL':
      return { ...state, showSaveGraphModal: !state.showSaveGraphModal };
    case 'SHOW_EDIT_NODE':
      return { ...state, showEditNodeModal: true, editingNode: action.payload };
    case 'HIDE_EDIT_NODE':
      return { ...state, showEditNodeModal: false, editingNode: null };
    case 'SHOW_EDIT_EDGE':
      return { ...state, showEditEdgeModal: true, editingEdge: action.payload };
    case 'HIDE_EDIT_EDGE':
      return { ...state, showEditEdgeModal: false, editingEdge: null };
    case 'CLOSE_INSPECTOR':
      return { ...state, showInspector: false, selectedNode: null, selectedNodes: [] };
    case 'TOGGLE_HELP_MODAL':
      return { ...state, showHelpModal: action.payload !== undefined ? action.payload : !state.showHelpModal };
    case 'SHOW_DELETE_CONFIRM':
      return { ...state, showDeleteConfirm: true, deleteItems: action.payload };
    case 'HIDE_DELETE_CONFIRM':
      return { ...state, showDeleteConfirm: false, deleteItems: { nodes: [], edges: [] } };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };
    case 'PUSH_ACTION': {
      const newPast = [...state.past, action.payload];
      if (newPast.length > 20) newPast.shift(); // keep last 20
      return { ...state, past: newPast, future: [] };
    }
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const lastAction = state.past[state.past.length - 1];
      return {
        ...state,
        past: state.past.slice(0, -1),
        future: [lastAction, ...state.future]
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const nextAction = state.future[0];
      return {
        ...state,
        past: [...state.past, nextAction],
        future: state.future.slice(1)
      };
    }
    case 'SET_ANALYSIS_SESSION':
      return { ...state, activeAnalysisSession: action.payload };
    default:
      return state;
  }
}

export function GraphProvider({ children }) {
  const [state, dispatch] = useReducer(graphReducer, initialState);

  const loadGraph = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const res = await fetch('/api/graph/full');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      dispatch({ type: 'SET_GRAPH', payload: data });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
    }
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    dispatch({ type: 'ADD_TOAST', payload: { id, message, type } });
    setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', payload: id });
    }, 4000);
  }, []);

  const performGraphAction = useCallback((actionConfig) => {
    // actionConfig: { type: string, forward: [{dispatch?, api?}] reverse: [{dispatch?, api?}] }
    
    // Execute forward local dispatches instantly
    actionConfig.forward.forEach(f => {
      if (f.dispatch) dispatch(f.dispatch);
    });

    // Record action for undo/redo
    dispatch({ type: 'PUSH_ACTION', payload: actionConfig });

    // Execute forward API calls asynchronously
    actionConfig.forward.forEach(f => {
      if (f.api) {
        fetch(f.api.url, { 
          method: f.api.method, 
          headers: { 'Content-Type': 'application/json' }, 
          body: f.api.body ? JSON.stringify(f.api.body) : undefined 
        }).catch(err => {
          console.error('Action failed:', err);
          addToast('Failed to sync action: ' + err.message, 'error');
        });
      }
    });
  }, [addToast]);

  const undo = useCallback(() => {
    if (state.past.length === 0) return;
    const lastAction = state.past[state.past.length - 1];

    // Execute reverse local dispatches
    lastAction.reverse.forEach(r => {
      if (r.dispatch) dispatch(r.dispatch);
    });

    // Execute reverse API calls
    lastAction.reverse.forEach(r => {
      if (r.api) {
        fetch(r.api.url, { 
          method: r.api.method, 
          headers: { 'Content-Type': 'application/json' }, 
          body: r.api.body ? JSON.stringify(r.api.body) : undefined 
        }).catch(console.error);
      }
    });

    dispatch({ type: 'UNDO' });
    addToast('Undo: ' + lastAction.type, 'info');
  }, [state.past, addToast]);

  const redo = useCallback(() => {
    if (state.future.length === 0) return;
    const nextAction = state.future[0];

    // Execute forward local dispatches
    nextAction.forward.forEach(f => {
      if (f.dispatch) dispatch(f.dispatch);
    });

    // Execute forward API calls
    nextAction.forward.forEach(f => {
      if (f.api) {
        fetch(f.api.url, { 
          method: f.api.method, 
          headers: { 'Content-Type': 'application/json' }, 
          body: f.api.body ? JSON.stringify(f.api.body) : undefined 
        }).catch(console.error);
      }
    });

    dispatch({ type: 'REDO' });
    addToast('Redo: ' + nextAction.type, 'info');
  }, [state.future, addToast]);

  const resolveSuggestion = useCallback(async (suggestion, action) => {
    try {
      if (action === 'approve') {
        const actionConfig = {
          type: 'Approve AI Suggestion',
          forward: [],
          reverse: []
        };

        const newNodes = suggestion.proposed_nodes || [];
        newNodes.forEach(node => {
           const tempId = node.id || node.name.toLowerCase().replace(/\s+/g, '_');
           const fullNode = { ...node, id: tempId, source: 'ai', created_by: 'ai' };
           actionConfig.forward.push({
             dispatch: { type: 'ADD_ENTITY', payload: fullNode }
           });
           actionConfig.reverse.push({
             dispatch: { type: 'REMOVE_ENTITY', payload: tempId },
             api: { url: `/api/entities/${tempId}`, method: 'DELETE' }
           });
        });
        
        const newEdges = suggestion.proposed_edges || [];
        newEdges.forEach(edge => {
           let sourceId = edge.source;
           let targetId = edge.target;
           if (!sourceId && edge.source_name) {
             const src = state.entities.find(e => e.name.toLowerCase() === edge.source_name.toLowerCase()) || newNodes.find(n => n.name.toLowerCase() === edge.source_name.toLowerCase());
             if (src) sourceId = src.id || src.name.toLowerCase().replace(/\s+/g, '_');
           }
           if (!targetId && edge.target_name) {
             const tgt = state.entities.find(e => e.name.toLowerCase() === edge.target_name.toLowerCase()) || newNodes.find(n => n.name.toLowerCase() === edge.target_name.toLowerCase());
             if (tgt) targetId = tgt.id || tgt.name.toLowerCase().replace(/\s+/g, '_');
           }
           if (sourceId && targetId) {
             const edgeId = crypto.randomUUID();
             const fullEdge = { ...edge, id: edgeId, source: sourceId, target: targetId, created_by: 'ai' };
             actionConfig.forward.push({
               dispatch: { type: 'ADD_RELATIONSHIP', payload: fullEdge }
             });
             actionConfig.reverse.push({
               dispatch: { type: 'REMOVE_RELATIONSHIP', payload: edgeId },
               api: { url: `/api/relationships/${edgeId}`, method: 'DELETE' }
             });
           }
        });

        // Optimistic deletions
        const delNodes = suggestion.proposed_deletions?.nodes || [];
        const delEdges = suggestion.proposed_deletions?.edges || [];
        
        delEdges.forEach(id => {
          actionConfig.forward.push({
            dispatch: { type: 'REMOVE_RELATIONSHIP', payload: id }
          });
          const originalEdge = state.relationships.find(e => e.id === id);
          if (originalEdge) {
            actionConfig.reverse.push({
              dispatch: { type: 'ADD_RELATIONSHIP', payload: originalEdge },
              api: { url: '/api/relationships', method: 'POST', body: originalEdge }
            });
          }
        });

        delNodes.forEach(id => {
          actionConfig.forward.push({
            dispatch: { type: 'REMOVE_ENTITY', payload: id }
          });
          const originalNode = state.entities.find(e => e.id === id);
          if (originalNode) {
            actionConfig.reverse.push({
              dispatch: { type: 'ADD_ENTITY', payload: originalNode },
              api: { url: '/api/entities', method: 'POST', body: originalNode }
            });
          }
        });

        actionConfig.forward.push({
          dispatch: { type: 'REMOVE_SUGGESTION', payload: suggestion.id },
          api: { url: `/api/suggestions/${suggestion.id}`, method: 'PUT', body: { action: 'approve' } }
        });

        // Reverse the reverse array to process dependencies properly (e.g. nodes before edges)
        actionConfig.reverse.reverse();

        performGraphAction(actionConfig);
        addToast('Suggestion approved! Graph updated.', 'success');
        return true;
      } else {
        dispatch({ type: 'REMOVE_SUGGESTION', payload: suggestion.id });

        const res = await fetch(`/api/suggestions/${suggestion.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        addToast('Suggestion rejected.', 'info');
        return true;
      }
    } catch (err) {
      addToast(`Failed to ${action}: ${err.message}`, 'error');
      loadGraph();
      return false;
    }
  }, [state.entities, state.relationships, loadGraph, addToast, performGraphAction]);

  const resolveSuggestionItem = useCallback(async (suggestion, itemType, item, action) => {
    try {
      dispatch({ 
        type: 'REMOVE_SUGGESTION_ITEM', 
        payload: { suggestionId: suggestion.id, itemType, item } 
      });

      if (state.selectedNode?.isGhost && state.selectedNode?.suggestionId === suggestion.id && state.selectedNode?.name === item.name) {
        dispatch({ type: 'CLOSE_INSPECTOR' });
      }

      if (action === 'approve') {
        if (itemType === 'node') {
          const tempId = item.id || item.name.toLowerCase().replace(/\s+/g, '_');
          dispatch({ type: 'ADD_ENTITY', payload: { ...item, id: tempId, source: 'ai', created_by: 'ai' } });

          const res = await fetch('/api/entities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...item, id: tempId, source: 'ai', created_by: 'ai' })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
        } else if (itemType === 'edge') {
          let sourceId = item.source;
          let targetId = item.target;
          
          if (!sourceId && item.source_name) {
            const src = state.entities.find(e => e.name.toLowerCase() === item.source_name.toLowerCase());
            if (src) sourceId = src.id;
          }
          if (!targetId && item.target_name) {
            const tgt = state.entities.find(e => e.name.toLowerCase() === item.target_name.toLowerCase());
            if (tgt) targetId = tgt.id;
          }

          if (!sourceId || !targetId) {
            throw new Error(`Missing target node for edge. Ensure both source and target nodes exist before approving this edge.`);
          }

          dispatch({ type: 'ADD_RELATIONSHIP', payload: { ...item, id: crypto.randomUUID(), source: sourceId, target: targetId, created_by: 'ai' } });

          const res = await fetch('/api/relationships', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: sourceId,
              target: targetId,
              relation: item.relation,
              rationale: item.rationale || '',
              created_by: 'ai'
            })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
        }
      }

      const newNodes = itemType === 'node' ? (suggestion.proposed_nodes || []).filter(n => n !== item) : (suggestion.proposed_nodes || []);
      const newEdges = itemType === 'edge' ? (suggestion.proposed_edges || []).filter(e => e !== item) : (suggestion.proposed_edges || []);

      let remaining = newNodes.length + newEdges.length;
      if (remaining <= 0) {
        fetch(`/api/suggestions/${suggestion.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reject' }),
        }).catch(console.error);
        dispatch({ type: 'REMOVE_SUGGESTION', payload: suggestion.id });
      } else {
        fetch(`/api/suggestions/${suggestion.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'modify', proposed_nodes: newNodes, proposed_edges: newEdges }),
        }).catch(console.error);
      }

      if (action === 'approve') {
        addToast(`${itemType === 'node' ? 'Node' : 'Edge'} approved!`, 'success');
        setTimeout(() => loadGraph(), 2000);
      } else if (action === 'reject') {
        addToast(`${itemType === 'node' ? 'Node' : 'Edge'} rejected.`, 'info');
      }

      return true;
    } catch (err) {
      addToast(`Failed to ${action} ${itemType}: ${err.message}`, 'error');
      loadGraph();
      return false;
    }
  }, [state.entities, loadGraph, addToast, state.selectedNode]);

  return (
    <GraphContext.Provider value={{ state, dispatch, loadGraph, addToast, resolveSuggestion, resolveSuggestionItem, performGraphAction, undo, redo }}>
      {children}
    </GraphContext.Provider>
  );
}

export function useGraph() {
  const context = useContext(GraphContext);
  if (!context) throw new Error('useGraph must be used within GraphProvider');
  return context;
}
