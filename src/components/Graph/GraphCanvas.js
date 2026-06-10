'use client';
import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useGraph } from '@/context/GraphContext';
import { NODE_COLORS, NODE_ICONS } from '@/lib/constants';
import {
  ZoomIn, ZoomOut, Maximize2, Minimize2, PlusCircle, Link2, Search, RotateCcw, Type, X, Save
} from 'lucide-react';
import NodeInspector from '../Inspector/NodeInspector';
import ResetConfigModal from '../Forms/ResetConfigModal';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const getEdgeColor = (relation) => {
  const rel = (relation || '').toLowerCase();
  if (['mitigates', 'supports', 'supported_by', 'implemented_by'].includes(rel)) return '#4CAF50';
  if (['affects', 'creates_risk', 'conflicts_with'].includes(rel)) return '#F44336';
  if (['mandates', 'requires', 'governs'].includes(rel)) return '#2196F3';
  if (['requires_fix'].includes(rel)) return '#FF9800';
  return 'rgba(255, 255, 255, 0.6)';
};

export default function GraphCanvas() {
  const graphRef = useRef();
  const containerRef = useRef();
  const { state, dispatch, addToast, loadGraph, undo, redo } = useGraph();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [searchInput, setSearchInput] = useState('');
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoveredLink, setHoveredLink] = useState(null);
  const [isGraphFullScreen, setIsGraphFullScreen] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [aiHighlightNodes, setAiHighlightNodes] = useState(new Set());
  const [aiHighlightLinks, setAiHighlightLinks] = useState(new Set());
  const [edgeDrag, setEdgeDrag] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const selectionBoxRef = useRef(null);
  
  const isCtrlPressed = useRef(false);
  const isShiftPressed = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Control' || e.key === 'Meta') isCtrlPressed.current = true;
      if (e.key === 'Shift') isShiftPressed.current = true;
    };
    const handleKeyUp = (e) => {
      if (e.key === 'Control' || e.key === 'Meta') isCtrlPressed.current = false;
      if (e.key === 'Shift') isShiftPressed.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const pinnedNodesRef = useRef(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('regchain_node_positions');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });
  
  // Temporary session pins so layout doesn't scramble on refresh
  const sessionPinnedRef = useRef({});
  const isInitialLoad = useRef(true);

  // Need to initialize the ref value properly since useRef doesn't accept an init function like useState
  if (typeof pinnedNodesRef.current === 'function') {
    pinnedNodesRef.current = pinnedNodesRef.current();
  }

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Sync search input with global state if it gets cleared externally
  useEffect(() => {
    if (!state.searchQuery) setSearchInput('');
  }, [state.searchQuery]);

  // Build graph data
  const graphData = useMemo(() => {
    const searchQ = state.searchQuery?.toLowerCase() || '';
    const categoryF = state.categoryFilter;
    
    const pendingDeletedNodes = new Set();
    const pendingDeletedEdges = new Set();
    state.pendingSuggestions?.forEach(s => {
      if (s.proposed_deletions) {
        s.proposed_deletions.nodes?.forEach(id => pendingDeletedNodes.add(id));
        s.proposed_deletions.edges?.forEach(id => pendingDeletedEdges.add(id));
      }
    });
    let primaryMatchIds = new Set(state.entities.map(e => e.id));
    let entityIds = new Set(state.entities.map(e => e.id));
    let isSearchActive = Boolean(searchQ || categoryF);

    if (isSearchActive) {
      let filteredEntities = state.entities;
      if (categoryF) {
        filteredEntities = filteredEntities.filter((e) => e.type === categoryF);
      }
      if (searchQ) {
        filteredEntities = filteredEntities.filter((e) =>
          e.name.toLowerCase().includes(searchQ) ||
          e.type.toLowerCase().includes(searchQ) ||
          (e.description || '').toLowerCase().includes(searchQ) ||
          (e.tags || []).some((t) => t.toLowerCase().includes(searchQ))
        );
      }

      primaryMatchIds = new Set(filteredEntities.map((e) => e.id));
      entityIds = new Set(primaryMatchIds);

      // Include directly connected nodes
      if (filteredEntities.length > 0) {
        state.relationships.forEach((r) => {
          if (entityIds.has(r.source) || entityIds.has(r.target)) {
            entityIds.add(r.source);
            entityIds.add(r.target);
          }
        });
      }
    }

    const nodes = state.entities.map((e) => {
      const pinned = pinnedNodesRef.current[e.id] || sessionPinnedRef.current[e.id];
      let isPrimaryMatch = false;
      let isFaded = false;
      
      if (isSearchActive) {
        isFaded = !entityIds.has(e.id);
        isPrimaryMatch = primaryMatchIds.has(e.id);
      }
      
      const isPendingDelete = pendingDeletedNodes.has(e.id);
      
      return {
        id: e.id,
        name: e.name,
        type: e.type,
        status: e.status,
        description: e.description,
        color: NODE_COLORS[e.type] || '#888',
        val: e.type === 'Regulation' ? 6 : e.type === 'Risk' ? 5 : 4,
        x: e.x,
        y: e.y,
        fx: pinned ? pinned.x : e.fx,
        fy: pinned ? pinned.y : e.fy,
        _entity: e,
        isPrimaryMatch,
        isFaded,
        isPendingDelete,
      };
    });

    state.pendingSuggestions?.forEach(suggestion => {
      if (suggestion.proposed_nodes) {
        suggestion.proposed_nodes.forEach((pn, i) => {
          // Some suggestions might only have a name, try to generate a safe ID if missing
          const nodeId = pn.id || pn.name.toLowerCase().replace(/\s+/g, '_');
          nodes.push({
            id: nodeId,
            name: pn.name,
            type: pn.type || 'Unknown',
            status: 'proposed',
            description: pn.description || '',
            color: '#8a2be2',
            val: pn.type === 'Regulation' ? 6 : pn.type === 'Risk' ? 5 : 4,
            isGhost: true,
            suggestionId: suggestion.id,
            itemIndex: i,
            _entity: { ...pn, id: nodeId, isGhost: true, suggestionId: suggestion.id, itemIndex: i }
          });
        });
      }
    });

    const nodeIdSet = new Set(nodes.map((n) => n.id));
    const links = state.relationships
      .filter((r) => nodeIdSet.has(r.source) && nodeIdSet.has(r.target))
      .map((r) => {
        let isFaded = false;
        if (isSearchActive) {
          isFaded = !entityIds.has(r.source) || !entityIds.has(r.target);
        }
        const isPendingDelete = pendingDeletedEdges.has(r.id);
        return {
          source: r.source,
          target: r.target,
          relation: r.relation,
          id: r.id,
          color: getEdgeColor(r.relation),
          isFaded,
          isPendingDelete,
          _relationship: r,
        };
      });

    state.pendingSuggestions?.forEach(suggestion => {
      if (suggestion.proposed_edges) {
        suggestion.proposed_edges.forEach((pe, i) => {
          const sId = pe.source || nodes.find(n => n.name === pe.source_name)?.id;
          const tId = pe.target || nodes.find(n => n.name === pe.target_name)?.id;

          if (sId && tId && nodeIdSet.has(sId) && nodeIdSet.has(tId)) {
            links.push({
              source: sId,
              target: tId,
              relation: pe.relation || 'connects',
              id: `ghost_${suggestion.id}_edge_${i}`,
              color: '#8a2be2',
              isGhost: true,
              suggestionId: suggestion.id,
              itemIndex: i,
              _relationship: { ...pe, isGhost: true, suggestionId: suggestion.id, itemIndex: i }
            });
          }
        });
      }
    });

    // Calculate intelligent coordinates for ghost nodes to keep them close to their neighbors and avoid overlaps
    nodes.filter(n => n.isGhost && n.fx === undefined && n.fy === undefined).forEach(ghostNode => {
      const connectedEdges = links.filter(l => l.source === ghostNode.id || l.target === ghostNode.id);
      let cx = 0, cy = 0;
      let hasNeighbors = false;

      if (connectedEdges.length > 0) {
        let sumX = 0, sumY = 0, count = 0;
        connectedEdges.forEach(e => {
          const neighborId = e.source === ghostNode.id ? e.target : e.source;
          const neighbor = nodes.find(n => n.id === neighborId);
          if (neighbor) {
            const nx = neighbor.fx !== undefined ? neighbor.fx : (neighbor.x || 0);
            const ny = neighbor.fy !== undefined ? neighbor.fy : (neighbor.y || 0);
            sumX += nx;
            sumY += ny;
            count++;
          }
        });
        if (count > 0) {
          cx = sumX / count;
          cy = sumY / count;
          hasNeighbors = true;
        }
      }

      if (!hasNeighbors) {
        // Place completely disconnected nodes outside the current graph
        let maxX = 0, maxY = 0;
        nodes.forEach(n => {
          if (!n.isGhost) {
            if (n.x !== undefined && Math.abs(n.x) > maxX) maxX = Math.abs(n.x);
            if (n.y !== undefined && Math.abs(n.y) > maxY) maxY = Math.abs(n.y);
          }
        });
        cx = maxX + 100 + (Math.random() * 50);
        cy = maxY + 100 + (Math.random() * 50);
      }

      // Spiral Collision Avoidance
      let placed = false;
      let radius = hasNeighbors ? 45 : 20; // Start distance
      let angle = Math.random() * Math.PI * 2;
      
      let finalX = cx;
      let finalY = cy;
      
      if (hasNeighbors) {
          finalX = cx + Math.cos(angle) * radius;
          finalY = cy + Math.sin(angle) * radius;
      }

      let attempts = 0;
      const MIN_DIST = 50; // Minimum distance between nodes
      
      while (!placed && attempts < 100) {
        let overlap = false;
        for (const other of nodes) {
          if (other.id === ghostNode.id) continue;
          
          let ox = undefined, oy = undefined;
          if (other.fx !== undefined && other.fy !== undefined) {
             ox = other.fx; oy = other.fy;
          } else if (other.x !== undefined && other.y !== undefined) {
             ox = other.x; oy = other.y;
          }
          
          if (ox !== undefined && oy !== undefined) {
             const dist = Math.hypot(finalX - ox, finalY - oy);
             if (dist < MIN_DIST) {
                 overlap = true;
                 break;
             }
          }
        }
        
        if (overlap) {
            angle += 0.8; // Rotate
            radius += 4;  // Spiral outward slightly with each attempt
            finalX = cx + Math.cos(angle) * radius;
            finalY = cy + Math.sin(angle) * radius;
            attempts++;
        } else {
            placed = true;
        }
      }

      ghostNode.fx = finalX;
      ghostNode.fy = finalY;
      ghostNode.x = finalX;
      ghostNode.y = finalY;
    });

    return { nodes, links };
  }, [state.entities, state.relationships, state.searchQuery, state.categoryFilter, state.pendingSuggestions]);

  // Highlight selected node's neighborhood
  useEffect(() => {
    if (!state.selectedNode) {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      return;
    }

    const nodeSet = new Set([state.selectedNode.id]);
    const linkSet = new Set();

    state.relationships.forEach((r) => {
      if (r.source === state.selectedNode.id || r.target === state.selectedNode.id) {
        nodeSet.add(r.source);
        nodeSet.add(r.target);
        linkSet.add(r.id);
      }
    });

    setHighlightNodes(nodeSet);
    setHighlightLinks(linkSet);
  }, [state.selectedNode, state.relationships]);

  // Focus node animation
  useEffect(() => {
    if (state.focusNodeId && graphRef.current) {
      const node = graphData.nodes.find((n) => n.id === state.focusNodeId);
      if (node) {
        graphRef.current.centerAt(node.x, node.y, 800);
        graphRef.current.zoom(3, 800);
        setTimeout(() => {
          dispatch({ type: 'SELECT_NODE', payload: node._entity });
          dispatch({ type: 'FOCUS_NODE', payload: null });
        }, 900);
      }
    }
  }, [state.focusNodeId, graphData.nodes, dispatch]);

  // Zoom to fit on search/filter
  useEffect(() => {
    if ((state.searchQuery || state.categoryFilter) && graphRef.current && graphData.nodes.length > 0) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(800, 80, (node) => !node.isFaded && !node.isGhost);
      }, 300);
    }
  }, [state.searchQuery, state.categoryFilter, graphData.nodes.length]);

  // AI Analysis Session Zoom + Path Highlighting
  useEffect(() => {
    if (state.activeAnalysisSession) {
      const vNodes = Array.isArray(state.activeAnalysisSession.visited_nodes) ? state.activeAnalysisSession.visited_nodes : [];
      const vEdges = Array.isArray(state.activeAnalysisSession.visited_edges) ? state.activeAnalysisSession.visited_edges : [];
      
      const nodeSet = new Set();
      const edgeSet = new Set();

      // We must cross-reference node names to IDs because relationships only use IDs
      vNodes.forEach(n => {
        const str = String(n).toLowerCase().trim();
        nodeSet.add(str);
        
        // Find matching node in graph to get its true ID
        const matchedNode = state.entities.find(e => 
          String(e.id).toLowerCase().trim() === str || 
          String(e.name).toLowerCase().trim() === str
        );
        if (matchedNode) {
          nodeSet.add(String(matchedNode.id).toLowerCase().trim());
        }
      });
      
      vEdges.forEach(e => edgeSet.add(String(e).toLowerCase().trim()));

      // Automatically highlight any edges where both source and target are visited nodes
      state.relationships.forEach(r => {
        if (nodeSet.has(String(r.source).toLowerCase().trim()) && nodeSet.has(String(r.target).toLowerCase().trim())) {
          edgeSet.add(String(r.id).toLowerCase().trim());
        }
      });

      setAiHighlightNodes(nodeSet);
      setAiHighlightLinks(edgeSet);

      if (nodeSet.size > 0 && graphRef.current) {
        // Trigger a tiny layout reheat to wake up the canvas renderer
        graphRef.current.d3ReheatSimulation();
        // Zoom to fit the visited nodes
        setTimeout(() => {
          graphRef.current?.zoomToFit(800, 60, (node) => nodeSet.has(String(node.id).toLowerCase().trim()));
        }, 100);
      }
    } else {
      setAiHighlightNodes(new Set());
      setAiHighlightLinks(new Set());
    }
  }, [state.activeAnalysisSession, state.relationships]);

  // Auto-fit or restore viewport when graph data loads
  useEffect(() => {
    if (graphData.nodes.length > 0 && graphRef.current) {
      graphRef.current.d3Force('link')
        .distance((link) => {
          const textLen = link.relation ? link.relation.length : 0;
          return 160 + (textLen * 2);
        })
        .strength(1); // Force strict edge length instead of being loose
      
      // Extremely high repulsion to spread everything out
      graphRef.current.d3Force('charge').strength(-1500).distanceMax(800);
      graphRef.current.d3ReheatSimulation();
      
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        setTimeout(() => {
          if (!graphRef.current) return;
          try {
            const savedViewport = localStorage.getItem('regchain_viewport');
            if (savedViewport) {
              const { x, y, k } = JSON.parse(savedViewport);
              graphRef.current.centerAt(x, y, 0);
              graphRef.current.zoom(k, 0);
            } else {
              graphRef.current.zoomToFit(600, 80);
            }
          } catch (e) {
            graphRef.current.zoomToFit(600, 80);
          }
        }, 1000);
      }
    }
  }, [graphData]);

  const handleNodeClick = useCallback((node, event) => {
    const isMulti = isCtrlPressed.current || event?.ctrlKey || event?.metaKey;
    dispatch({ 
      type: 'TOGGLE_SELECT_NODE', 
      payload: { node: node._entity, multi: isMulti } 
    });
    
    // If search/filter is active, clear it so the graph returns to its original opacity state
    if (state.searchQuery) dispatch({ type: 'SET_SEARCH', payload: '' });
    if (state.categoryFilter) dispatch({ type: 'SET_CATEGORY_FILTER', payload: null });

    if (graphRef.current && !isMulti) {
      graphRef.current.centerAt(node.x, node.y, 600);
      graphRef.current.zoom(2.5, 600);
    }
  }, [dispatch, state.searchQuery, state.categoryFilter]);

  const handleLinkClick = useCallback((link, event) => {
    const isMulti = isCtrlPressed.current || event?.ctrlKey || event?.metaKey;
    dispatch({ 
      type: 'TOGGLE_SELECT_EDGE', 
      payload: { edge: link._relationship, multi: isMulti } 
    });
  }, [dispatch]);

  const handleBackgroundClick = useCallback(() => {
    dispatch({ type: 'CLOSE_INSPECTOR' });
    dispatch({ type: 'TOGGLE_SELECT_EDGE', payload: { edge: null } });
    
    // Clear search filter so background click restores graph visibility 
    // while keeping the exact same zoom and pan coordinates
    if (state.searchQuery) dispatch({ type: 'SET_SEARCH', payload: '' });
    if (state.categoryFilter) dispatch({ type: 'SET_CATEGORY_FILTER', payload: null });
  }, [dispatch, state.searchQuery, state.categoryFilter]);

  const lastDragPos = useRef(null);

  const handleNodeDrag = useCallback((node) => {
    if (state.selectedNodes?.length > 1) {
      const isSelected = state.selectedNodes.some(n => n.id === node.id);
      if (isSelected) {
        if (lastDragPos.current && lastDragPos.current.id === node.id) {
          const dx = node.x - lastDragPos.current.x;
          const dy = node.y - lastDragPos.current.y;
          
          state.selectedNodes.forEach(n => {
            if (n.id !== node.id) {
              const graphNode = graphData.nodes.find(gn => gn.id === n.id);
              if (graphNode) {
                graphNode.x += dx;
                graphNode.y += dy;
                graphNode.fx = graphNode.x;
                graphNode.fy = graphNode.y;
              }
            }
          });
        }
        lastDragPos.current = { id: node.id, x: node.x, y: node.y };
      }
    } else {
      lastDragPos.current = null;
    }
  }, [state.selectedNodes, graphData.nodes]);

  const handleNodeDragEnd = useCallback((node) => {
    node.fx = node.x;
    node.fy = node.y;
    lastDragPos.current = null;
    let newPinned = {
      ...pinnedNodesRef.current,
      [node.id]: { x: node.x, y: node.y }
    };

    if (state.selectedNodes?.length > 1) {
      const isSelected = state.selectedNodes.some(n => n.id === node.id);
      if (isSelected) {
        state.selectedNodes.forEach(n => {
          if (n.id !== node.id) {
            const graphNode = graphData.nodes.find(gn => gn.id === n.id);
            if (graphNode) {
               newPinned[n.id] = { x: graphNode.x, y: graphNode.y };
            }
          }
        });
      }
    }

    pinnedNodesRef.current = newPinned;
    try {
      localStorage.setItem('regchain_node_positions', JSON.stringify(newPinned));
    } catch (e) {}
  }, [state.selectedNodes, graphData.nodes]);

  const handleNodeRightClick = useCallback((node) => {
    // If we were dragging, ignore this
    if (edgeDrag && edgeDrag.isDragging) return;
    dispatch({ type: 'SHOW_EDIT_NODE', payload: node._entity });
  }, [dispatch, edgeDrag]);

  const handleContextMenu = useCallback((e) => {
    if (!e.shiftKey) {
      e.preventDefault();
    }
  }, []);

  const handlePointerDown = useCallback((e) => {
    if (isCtrlPressed.current && e.button === 0) {
      e.stopPropagation();
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const box = {
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        endX: e.clientX - rect.left,
        endY: e.clientY - rect.top
      };
      selectionBoxRef.current = box;
      setSelectionBox(box);
      return;
    }

    if (e.button !== 2) return;
    if (!graphRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const coords = graphRef.current.screen2GraphCoords(e.clientX - rect.left, e.clientY - rect.top);
    
    const clickedNode = graphData.nodes.find(n => Math.hypot(n.x - coords.x, n.y - coords.y) <= (n.val || 8) + 4);
    if (clickedNode && !clickedNode.isGhost) {
      setEdgeDrag({ 
        sourceNode: clickedNode, 
        currentScreenX: e.clientX - rect.left, 
        currentScreenY: e.clientY - rect.top, 
        isDragging: false 
      });
    }
  }, [graphData.nodes]);

  const handlePointerMove = useCallback((e) => {
    if (selectionBoxRef.current) {
      e.stopPropagation();
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const box = {
        ...selectionBoxRef.current,
        endX: e.clientX - rect.left,
        endY: e.clientY - rect.top
      };
      selectionBoxRef.current = box;
      setSelectionBox(box);
      return;
    }

    if (edgeDrag && edgeDrag.sourceNode && graphRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const currentScreenX = e.clientX - rect.left;
      const currentScreenY = e.clientY - rect.top;
      
      if (!edgeDrag.isDragging) {
        const startPos = graphRef.current.graph2ScreenCoords(edgeDrag.sourceNode.x, edgeDrag.sourceNode.y);
        if (Math.hypot(currentScreenX - startPos.x, currentScreenY - startPos.y) > 10) {
          setEdgeDrag(prev => ({ ...prev, currentScreenX, currentScreenY, isDragging: true }));
        }
      } else {
        setEdgeDrag(prev => ({ ...prev, currentScreenX, currentScreenY }));
      }
    }
  }, [edgeDrag]);

  const handlePointerUp = useCallback((e) => {
    if (selectionBoxRef.current) {
      e.stopPropagation();
      e.preventDefault();
      const box = selectionBoxRef.current;
      selectionBoxRef.current = null;
      setSelectionBox(null);
      
      const minX = Math.min(box.startX, box.endX);
      const maxX = Math.max(box.startX, box.endX);
      const minY = Math.min(box.startY, box.endY);
      const maxY = Math.max(box.startY, box.endY);
      
      // Calculate nodes within box
      if (graphRef.current && maxX - minX > 5 && maxY - minY > 5) {
        const selectedEntities = [];
        graphData.nodes.forEach(node => {
          const coords = graphRef.current.graph2ScreenCoords(node.x, node.y);
          if (coords.x >= minX && coords.x <= maxX && coords.y >= minY && coords.y <= maxY) {
            selectedEntities.push(node._entity);
          }
        });
        if (selectedEntities.length > 0) {
          dispatch({ type: 'SELECT_NODES_BULK', payload: selectedEntities });
        } else {
          dispatch({ type: 'SELECT_NODE', payload: null });
        }
      }
      return;
    }

    if (!edgeDrag) return;
    if (edgeDrag && edgeDrag.isDragging && graphRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const coords = graphRef.current.screen2GraphCoords(e.clientX - rect.left, e.clientY - rect.top);
      const targetNode = graphData.nodes.find(n => Math.hypot(n.x - coords.x, n.y - coords.y) <= (n.val || 8) + 4);
      
      if (targetNode && !targetNode.isGhost && targetNode.id !== edgeDrag.sourceNode.id) {
        dispatch({ 
          type: 'TOGGLE_ADD_EDGE_MODAL', 
          payload: { source: edgeDrag.sourceNode.id, target: targetNode.id } 
        });
      }
    }
    // Give react-force-graph a moment to fire its native click events before wiping drag state
    setTimeout(() => setEdgeDrag(null), 50);
  }, [edgeDrag, graphData.nodes, dispatch]);

  const handleEngineStop = useCallback(() => {
    // Freeze the physics simulation completely so nodes don't bounce around
    if (graphData.nodes) {
      graphData.nodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
          node.fx = node.x;
          node.fy = node.y;
          // Save to session memory so if we reload data, they stay here
          sessionPinnedRef.current[node.id] = { x: node.x, y: node.y };
        }
      });
    }
  }, [graphData.nodes]);

  const handleZoomEnd = useCallback(() => {
    if (graphRef.current) {
      const center = graphRef.current.centerAt();
      const zoom = graphRef.current.zoom();
      if (center && zoom !== undefined) {
        try {
          localStorage.setItem('regchain_viewport', JSON.stringify({ ...center, k: zoom }));
        } catch (e) {}
      }
    }
  }, []);

  const handleZoomIn = () => graphRef.current?.zoom(graphRef.current.zoom() * 1.5, 300);
  const handleZoomOut = () => graphRef.current?.zoom(graphRef.current.zoom() / 1.5, 300);
  const handleFitView = () => graphRef.current?.zoomToFit(400, 60);
  const handleResetView = () => {
    dispatch({ type: 'SET_SEARCH', payload: '' });
    dispatch({ type: 'CLOSE_INSPECTOR' });
    graphRef.current?.zoomToFit(400, 60);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    dispatch({ type: 'SET_SEARCH', payload: searchInput });
  };

  // Keyboard listener for Delete, Undo, Redo
  useEffect(() => {
    const handleKeyDown = async (e) => {
      const activeElem = document.activeElement;
      if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA')) {
        return; // Ignore if typing
      }

      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Save Version: Ctrl+S or Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        addToast('Saving new graph version...', 'info');
        fetch('/api/versions', { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            if (data.error) throw new Error(data.error);
            addToast(`Successfully saved ${data.version.name}`, 'success');
          })
          .catch(err => addToast('Failed to save version: ' + err.message, 'error'));
        return;
      }

      // Redo: Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y
      if (((e.ctrlKey || e.metaKey) && e.key === 'Z' && e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedEdges.length > 0 || (state.selectedNodes && state.selectedNodes.length > 0)) {
          const edgesToDelete = state.selectedEdges.filter(e => !e.isGhost);
          const nodesToDelete = state.selectedNodes.filter(n => !n.isGhost);

          if (edgesToDelete.length > 0 || nodesToDelete.length > 0) {
            dispatch({
              type: 'SHOW_DELETE_CONFIRM',
              payload: { nodes: nodesToDelete, edges: edgesToDelete }
            });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedEdges, state.selectedNode, dispatch, addToast, undo, redo]);

  // Custom node painting
  const paintNode = useCallback((node, ctx, globalScale) => {
    const isSelected = state.selectedNode?.id === node.id || state.selectedNodes?.some(n => n.id === node.id);
    const isAiHighlightActive = aiHighlightNodes.size > 0 || aiHighlightLinks.size > 0;
    
    // The LLM might return the node ID OR the node name, so check both!
    const isAiHighlighted = aiHighlightNodes.has(String(node.id).toLowerCase().trim()) || 
                            (node.name && aiHighlightNodes.has(String(node.name).toLowerCase().trim()));
    
    const isHighlighted = isAiHighlightActive 
      ? isAiHighlighted 
      : (highlightNodes.size === 0 || highlightNodes.has(node.id));
      
    const radius = node.val;
    const isGhost = node.isGhost;
    
    let alpha = isHighlighted ? 1 : 0.2;
    if (isAiHighlightActive && !isAiHighlighted) alpha = 0.1; // heavily dim unrelated nodes
    if (node.isFaded) alpha = 0.15;
    if (isGhost) alpha *= 0.4; // More translucent

    ctx.globalAlpha = alpha;

    // Glow for selected node or primary matches
    if ((isSelected || node.isPrimaryMatch) && !isGhost) {
      ctx.shadowColor = node.color;
      ctx.shadowBlur = 20;
    }

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();

    if (node.isPendingDelete) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (isGhost) {
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (isAiHighlighted) {
      // Glow effect for AI highlighted nodes
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (isSelected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (node.isPrimaryMatch) {
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Label
    if (globalScale > 0.5 || isSelected) {
      const fontSize = 4; // Constant canvas size so it scales naturally with zoom
      ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isHighlighted ? '#fff' : 'rgba(255,255,255,0.3)';
      
      const label = node.name.length > 20 ? node.name.slice(0, 18) + '…' : node.name;
      ctx.fillText(label, node.x, node.y + radius + 3);
    }

    // Type icon for zoomed-in view
    if (globalScale > 1.2) {
      const icon = isGhost ? '✨' : (NODE_ICONS[node.type] || '●');
      const iconSize = node.val * 1.3; // Scale perfectly with node radius
      ctx.font = `${iconSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isGhost ? '#fff' : '#000';
      ctx.fillText(icon, node.x, node.y + 1); // +1 visual centering tweak
    }

    ctx.globalAlpha = 1;
  }, [state.selectedNode, state.selectedNodes, highlightNodes, aiHighlightNodes, aiHighlightLinks]);

  // Custom link painting
  const paintLink = useCallback((link, ctx, globalScale) => {
    const isSelected = state.selectedEdges?.some(e => e.id === link.id);
    const isAiHighlightActive = aiHighlightNodes.size > 0 || aiHighlightLinks.size > 0;
    const isAiHighlighted = aiHighlightLinks.has(String(link.id).toLowerCase().trim());

    const isHighlighted = isAiHighlightActive 
      ? isAiHighlighted 
      : highlightLinks.has(link.id);
      
    const isGhost = link.isGhost;
    
    let alpha = highlightLinks.size === 0 ? 0.6 : isHighlighted ? 0.9 : 0.15;
    if (isAiHighlightActive) {
      alpha = isAiHighlighted ? 1 : 0.05; // heavily dim unrelated edges
    }
    if (link.isFaded) alpha = 0.05;
    if (isGhost) alpha *= 0.5;

    const source = typeof link.source === 'object' ? link.source : null;
    const target = typeof link.target === 'object' ? link.target : null;
    if (!source || !target) return;

    const isSelectedEdge = state.selectedEdges.some(e => e.id === link._relationship?.id) && !isGhost;
    if (isSelectedEdge) alpha = 1;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = isSelectedEdge ? '#00f2fe' : (isAiHighlighted ? '#00f2fe' : (link.isPendingDelete ? '#ffffff' : (isHighlighted ? '#E8B931' : link.color)));
    ctx.lineWidth = isSelectedEdge || isAiHighlighted || link.isPendingDelete ? 4 : (isHighlighted ? 2.5 : 2);
    
    if (isGhost || link.isPendingDelete) ctx.setLineDash([4, 4]);
    
    if (link.isPendingDelete) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 12;
      alpha = 1; // Override alpha to fully highlight
    } else if (isGhost) {
      ctx.shadowColor = '#8a2be2';
      ctx.shadowBlur = 12;
      alpha = 1; // Override alpha to fully highlight
    }
    
    ctx.globalAlpha = alpha;
    ctx.stroke();
    
    ctx.shadowBlur = 0; // Reset glow
    
    if (isGhost || link.isPendingDelete) ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Edge label along the line
    const isHovered = hoveredLink === link.id;
    if ((showAnnotations || isHovered || isHighlighted) && link.relation) {
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      
      const fontSize = 3.5; // Constant canvas size so it scales naturally with zoom
      ctx.save();
      ctx.translate(midX, midY);
      
      let textAngle = angle;
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
        textAngle += Math.PI;
      }
      ctx.rotate(textAngle);
      
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let label = link.relation;
      let textWidth = ctx.measureText(label).width;
      const dist = Math.hypot(target.x - source.x, target.y - source.y);
      const availableSpace = Math.max(0, dist - (source.val || 8) - (target.val || 8) - 10);
      
      if (textWidth > availableSpace && availableSpace > 15) {
        const avgCharWidth = textWidth / label.length;
        const maxChars = Math.floor(availableSpace / avgCharWidth) - 3;
        if (maxChars > 0) {
          label = label.substring(0, maxChars) + '...';
          textWidth = ctx.measureText(label).width;
        } else {
          label = '';
        }
      } else if (availableSpace <= 15) {
        label = ''; // Edge is too short to show any label cleanly
      }

      if (label) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(15, 15, 15, 0.85)';
        ctx.fillRect(-textWidth/2 - 4, -fontSize/2 - 3, textWidth + 8, fontSize + 6);
        
        ctx.fillStyle = isAiHighlighted ? '#00f2fe' : (isHighlighted ? '#E8B931' : link.color);
        ctx.fillText(label, 0, 0);
        ctx.globalAlpha = 1;
      }
      
      ctx.restore();
    }

    // Arrow
    if (source && target) {
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      const arrowLen = isHighlighted ? 6 : 4;
      const targetRadius = (target.val || 8);
      const endX = target.x - Math.cos(angle) * targetRadius;
      const endY = target.y - Math.sin(angle) * targetRadius;

      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - arrowLen * Math.cos(angle - Math.PI / 6),
        endY - arrowLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - arrowLen * Math.cos(angle + Math.PI / 6),
        endY - arrowLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = isSelectedEdge ? '#00f2fe' : (isAiHighlighted ? '#00f2fe' : (link.isPendingDelete ? '#ffffff' : (isHighlighted ? '#E8B931' : link.color)));
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }, [highlightLinks, showAnnotations, hoveredLink, state.selectedEdges, state.activeAnalysisSession, aiHighlightNodes, aiHighlightLinks]);

  return (
    <div className="main-content" style={isGraphFullScreen ? {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 2000,
      background: 'var(--bg-primary)'
    } : {}}>
      {/* Toolbar */}
      <div className="graph-toolbar">
        <div className="graph-toolbar-group">
          <button className="toolbar-btn" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn size={14} />
          </button>
          <button className="toolbar-btn" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut size={14} />
          </button>
          <button 
            className="toolbar-btn" 
            onClick={() => {
              setIsGraphFullScreen(!isGraphFullScreen);
              // Trigger a resize manually so ForceGraph recalculates immediately
              setTimeout(() => {
                if (containerRef.current) {
                  const rect = containerRef.current.getBoundingClientRect();
                  setDimensions({ width: rect.width, height: rect.height });
                }
              }, 50);
            }} 
            title={isGraphFullScreen ? "Exit Full Screen" : "Full Screen"}
          >
            {isGraphFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button className="toolbar-btn" onClick={handleResetView} title="Reset">
            <RotateCcw size={14} />
          </button>
          <button 
            className={`toolbar-btn ${showAnnotations ? 'active' : ''}`} 
            onClick={() => setShowAnnotations(!showAnnotations)} 
            title="Toggle Edge Labels"
            style={{ color: showAnnotations ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
          >
            <Type size={14} />
          </button>
          
          <div className="toolbar-divider" style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />

          <button 
            className="toolbar-btn" 
            style={{ backgroundColor: '#111', color: '#fff', borderColor: '#333' }}
            onClick={async () => {
              // Save layout first
              try {
                const nodes = graphData.nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
                await fetch('/api/graph/layout/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ nodes })
                });
              } catch (e) {
                console.error("Failed to sync layout", e);
              }
              // Then open Save Version modal
              dispatch({ type: 'TOGGLE_SAVE_GRAPH_MODAL' });
            }} 
            title="Save Version & Layout"
          >
            <Save size={14} />
          </button>
        </div>

        <div className="graph-toolbar-divider" />

        <div className="graph-toolbar-group">
          <button
            className="toolbar-btn primary"
            onClick={() => dispatch({ type: 'TOGGLE_ADD_NODE_MODAL' })}
          >
            <PlusCircle size={14} /> Add Node
          </button>
          <button
            className="toolbar-btn"
            onClick={() => dispatch({ type: 'TOGGLE_ADD_EDGE_MODAL' })}
          >
            <Link2 size={14} /> Add Edge
          </button>
        </div>

        <div className="graph-toolbar-divider" />

        <form className="toolbar-search" onSubmit={handleSearch}>
          <Search size={14} className="toolbar-search-icon" />
          <input
            type="text"
            placeholder="Search graph..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>

        <div style={{ flex: 1 }} />

        <div className="graph-toolbar-group">
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {graphData.nodes.length} nodes · {graphData.links.length} edges
          </span>
          {isGraphFullScreen && (
            <button
              className="toolbar-btn"
              onClick={() => {
                setIsGraphFullScreen(false);
                setTimeout(() => {
                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setDimensions({ width: rect.width, height: rect.height });
                  }
                }, 50);
              }}
              title="Exit Full Screen"
              style={{ marginLeft: 8 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Graph Canvas */}
      <div 
        className="graph-canvas-container" 
        ref={containerRef}
        onContextMenuCapture={handleContextMenu}
        onPointerDownCapture={handlePointerDown}
        onPointerMoveCapture={handlePointerMove}
        onPointerUpCapture={handlePointerUp}
      >
        {graphData.nodes.length > 0 ? (
          <ForceGraph2D
            key={resetKey}
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="transparent"
            nodeCanvasObject={paintNode}
            linkCanvasObject={paintLink}
            onNodeClick={handleNodeClick}
            onLinkClick={handleLinkClick}
            onNodeDrag={handleNodeDrag}
            onNodeDragEnd={handleNodeDragEnd}
            onNodeRightClick={handleNodeRightClick}
            onLinkRightClick={(link) => dispatch({ type: 'SHOW_EDIT_EDGE', payload: link._relationship })}
            onBackgroundRightClick={(e) => {
              if (edgeDrag && edgeDrag.isDragging) return;
              if (graphRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const coords = graphRef.current.screen2GraphCoords(e.clientX - rect.left, e.clientY - rect.top);
                dispatch({ type: 'TOGGLE_ADD_NODE_MODAL', payload: { x: coords.x, y: coords.y } });
              }
            }}
            onBackgroundClick={handleBackgroundClick}
            onEngineStop={handleEngineStop}
            onZoomEnd={handleZoomEnd}
            nodePointerAreaPaint={(node, color, ctx) => {
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val + 2, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            onLinkHover={(link) => setHoveredLink(link ? link.id : null)}
            linkHoverPrecision={10}
            cooldownTicks={50}
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.8}
            linkDirectionalArrowLength={0}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            minZoom={0.1}
            maxZoom={10}
          />
        ) : (
          <div className="graph-empty-state">
            <h3>No graph data</h3>
            <p>Seed the database or add nodes to get started</p>
            <button
              className="btn btn-primary"
              onClick={async () => {
                try {
                  addToast('Loading seed data...', 'info');
                  const res = await fetch('/api/seed', { method: 'POST' });
                  const data = await res.json();
                  addToast(data.message || 'Seed data loaded!', 'success');
                  // Wait a moment for Elastic to index, then reload graph
                  setTimeout(() => loadGraph(), 1500);
                } catch (err) {
                  addToast('Failed to seed data: ' + err.message, 'error');
                }
              }}
            >
              Load Seed Data
            </button>
          </div>
        )}

        {/* Temporary Edge Drag Line Overlay */}
        {edgeDrag && edgeDrag.isDragging && edgeDrag.sourceNode && graphRef.current && (
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
            <line 
              x1={graphRef.current.graph2ScreenCoords(edgeDrag.sourceNode.x, edgeDrag.sourceNode.y).x}
              y1={graphRef.current.graph2ScreenCoords(edgeDrag.sourceNode.x, edgeDrag.sourceNode.y).y}
              x2={edgeDrag.currentScreenX}
              y2={edgeDrag.currentScreenY}
              stroke="#00f2fe"
              strokeWidth="3"
              strokeDasharray="6,6"
            />
            <circle 
              cx={edgeDrag.currentScreenX} 
              cy={edgeDrag.currentScreenY} 
              r="5" 
              fill="#00f2fe" 
            />
          </svg>
        )}

        {/* Selection Box Overlay */}
        {selectionBox && (
          <div style={{
            position: 'absolute',
            left: Math.min(selectionBox.startX, selectionBox.endX),
            top: Math.min(selectionBox.startY, selectionBox.endY),
            width: Math.abs(selectionBox.endX - selectionBox.startX),
            height: Math.abs(selectionBox.endY - selectionBox.startY),
            backgroundColor: 'rgba(0, 242, 254, 0.15)',
            border: '1px solid #00f2fe',
            pointerEvents: 'none',
            zIndex: 20
          }} />
        )}

        {/* Node Inspector */}
        {state.showInspector && state.selectedNode && (
          <NodeInspector />
        )}
      </div>

      {/* Status Bar */}
      <div className="graph-status-bar">
        <div className="graph-status-item">
          <span className="graph-status-dot" />
          <span>Connected to Elastic</span>
        </div>
        <div className="graph-status-item">
          <span>{state.entities.length} entities</span>
        </div>
        <div className="graph-status-item">
          <span>{state.relationships.length} relationships</span>
        </div>
        {state.selectedNode && (
          <div className="graph-status-item">
            <span>Selected: {state.selectedNode.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

