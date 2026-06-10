import React from 'react';
import { useGraph } from '@/context/GraphContext';
import { X, Network, MousePointer2, Move, LayoutGrid, Trash2, Edit3, Keyboard, HardDrive, History, MessageSquare, Paperclip, CheckSquare, XCircle, Search, Filter, Wrench, BarChart2, Type, Maximize2 } from 'lucide-react';

export default function HelpModal() {
  const { state, dispatch } = useGraph();

  if (!state.showHelpModal) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--accent)' }}>
              RegChain Command Center
            </span>
          </h2>
          <button 
            className="icon-btn" 
            onClick={() => dispatch({ type: 'TOGGLE_HELP_MODAL', payload: false })}
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body" style={{ overflowY: 'auto', padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Navigation & Selection */}
          <section>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px' }}>
              Navigation & Selection
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="help-card">
                <div className="help-icon"><MousePointer2 size={16} /></div>
                <div>
                  <strong>Zoom & Pan</strong>
                  <p>Use your scroll wheel to zoom in/out. Click and drag anywhere on the empty background to pan the camera.</p>
                </div>
              </div>
              <div className="help-card">
                <div className="help-icon"><LayoutGrid size={16} /></div>
                <div>
                  <strong>Reset View</strong>
                  <p>Click the Grid icon on the top left of the graph to automatically fit the entire knowledge graph perfectly into frame.</p>
                </div>
              </div>
              <div className="help-card">
                <div className="help-icon"><Type size={16} /></div>
                <div>
                  <strong>Toggle Edge Labels</strong>
                  <p>Click the "T" icon on the top left toolbar to toggle the visibility of relationship labels on all edges.</p>
                </div>
              </div>
              <div className="help-card">
                <div className="help-icon"><Maximize2 size={16} /></div>
                <div>
                  <strong>Full Screen</strong>
                  <p>Click the expand arrows on the top left toolbar to maximize the graph canvas to fill your entire screen.</p>
                </div>
              </div>
              <div className="help-card">
                <div className="help-icon"><Keyboard size={16} /></div>
                <div>
                  <strong>Multi-Selection</strong>
                  <p>Hold <code>Ctrl</code> (or <code>Cmd</code>) and Left-Click on individual nodes or edges to select multiple items simultaneously. You can mix nodes and edges!</p>
                </div>
              </div>
              <div className="help-card">
                <div className="help-icon"><Move size={16} /></div>
                <div>
                  <strong>Bulk Selection & Dragging</strong>
                  <p>Hold <code>Shift</code> and drag on the background to draw a selection box. Select multiple nodes and drag one of them to move the entire group synchronously.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Graph Editing */}
          <section>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px' }}>
              Graph Editing & Mutation
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="help-card">
                <div className="help-icon"><Network size={16} /></div>
                <div>
                  <strong>Creating Elements</strong>
                  <p>Right-Click on empty space to spawn a new Node. Right-Click and drag from one node to another to connect them with an Edge.</p>
                </div>
              </div>
              <div className="help-card">
                <div className="help-icon"><Trash2 size={16} /></div>
                <div>
                  <strong>Deleting Elements</strong>
                  <p>Select any combination of nodes and edges, then hit the <code>Delete</code> or <code>Backspace</code> key to bring up the bulk deletion menu.</p>
                </div>
              </div>
              <div className="help-card">
                <div className="help-icon"><Edit3 size={16} /></div>
                <div>
                  <strong>Editing Properties</strong>
                  <p>Double-Click or Right-Click on any existing node or edge to edit its title, type, and detailed properties.</p>
                </div>
              </div>
            </div>
          </section>

          {/* State & Version Control */}
          <section>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px' }}>
              State & Version Control
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="help-card">
                <div className="help-icon"><HardDrive size={16} /></div>
                <div>
                  <strong>Saving State</strong>
                  <p>Press <code>Ctrl + S</code> to save a named snapshot of your entire graph. This persists all node coordinates and relationship mapping.</p>
                </div>
              </div>
              <div className="help-card">
                <div className="help-icon"><History size={16} /></div>
                <div>
                  <strong>Time Travel</strong>
                  <p>Click "Version History" in the left sidebar to view past saves. You can instantly rollback the graph state to any point in time.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Search & Filter */}
          <section>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px' }}>
              Search & Filtering
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="help-card">
                <div className="help-icon"><Search size={16} /></div>
                <div>
                  <strong>Semantic Search</strong>
                  <p>Use the search bar at the top to find specific entities. The graph will automatically fade out non-matching elements and highlight results.</p>
                </div>
              </div>
              <div className="help-card">
                <div className="help-icon"><Filter size={16} /></div>
                <div>
                  <strong>Category Filters</strong>
                  <p>Click on any category (e.g., "Regulations" or "Risks") in the left sidebar to instantly isolate and view only those specific entity types.</p>
                </div>
              </div>
            </div>
          </section>

          {/* AI Copilot: Build Mode */}
          <section>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px' }}>
              AI Copilot: Build Mode
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="help-card">
                <div className="help-icon"><Wrench size={16} /></div>
                <div>
                  <strong>Graph Construction</strong>
                  <p>In Build Mode, the AI can actively construct and modify the graph. Ask it to generate controls, map out risks, or map regulatory obligations.</p>
                </div>
              </div>
              <div className="help-card">
                <div className="help-icon"><CheckSquare size={16} /></div>
                <div>
                  <strong>Applying Suggestions</strong>
                  <p>When the AI proposes changes, they appear as purple "ghost" nodes on the canvas. Click the <CheckSquare size={12} style={{display:'inline'}}/> to instantly apply them to the real graph, or <XCircle size={12} style={{display:'inline'}}/> to reject them.</p>
                </div>
              </div>
            </div>
          </section>

          {/* AI Copilot: Analyze Mode */}
          <section>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px' }}>
              AI Copilot: Analyze Mode
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="help-card">
                <div className="help-icon"><BarChart2 size={16} /></div>
                <div>
                  <strong>Contextual Analysis</strong>
                  <p>In Analyze Mode, the AI acts as a read-only auditor. Ask it to find compliance gaps, trace risks downstream, or evaluate a specific control.</p>
                </div>
              </div>
              <div className="help-card">
                <div className="help-icon"><Search size={16} /></div>
                <div>
                  <strong>Decision Highlighting</strong>
                  <p>When the AI provides an analysis, it will automatically highlight the specific nodes and edges on the graph that it used to form its conclusion, giving you full transparency.</p>
                </div>
              </div>
            </div>
          </section>

          {/* AI Copilot: General Features */}
          <section>
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px' }}>
              AI Copilot: Features
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="help-card">
                <div className="help-icon"><MessageSquare size={16} /></div>
                <div>
                  <strong>Chat Management</strong>
                  <p>Use the chat history dropdown to switch between past conversations. Click the Trash Can icon to permanently delete the current chat, or the '+' icon to start a new thread.</p>
                </div>
              </div>
              <div className="help-card">
                <div className="help-icon"><Paperclip size={16} /></div>
                <div>
                  <strong>Multi-Modal Ingestion</strong>
                  <p>Click the Paperclip icon to upload <strong>PDF Documents</strong> or <strong>Images</strong>. The AI will read them and can autonomously map their contents directly onto the graph!</p>
                </div>
              </div>
            </div>
          </section>

        </div>
        
        <style dangerouslySetInnerHTML={{__html: `
          .help-card {
            display: flex;
            gap: 12px;
            padding: 16px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-primary);
            border-radius: var(--radius-md);
            transition: all 0.2s;
          }
          .help-card:hover {
            border-color: var(--border-secondary);
            background: var(--bg-hover);
          }
          .help-icon {
            color: var(--accent);
            padding-top: 2px;
          }
          .help-card strong {
            display: block;
            margin-bottom: 4px;
            color: var(--text-primary);
            font-size: 14px;
          }
          .help-card p {
            color: var(--text-secondary);
            font-size: 12px;
            line-height: 1.5;
            margin: 0;
          }
          .help-card code {
            background: var(--bg-primary);
            padding: 2px 4px;
            border-radius: 4px;
            font-family: monospace;
            color: var(--text-primary);
            border: 1px solid var(--border-primary);
          }
        `}} />
      </div>
    </div>
  );
}
