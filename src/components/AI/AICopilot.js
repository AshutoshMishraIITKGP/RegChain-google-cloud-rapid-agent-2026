'use client';
import { useState, useRef, useEffect } from 'react';
import { useGraph } from '@/context/GraphContext';
import { Send, Bot, User, Sparkles, X, MessageSquare, Plus, Clock, Trash2, Maximize, Minimize, Paperclip } from 'lucide-react';
import SuggestionCard from './SuggestionCard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';

const BUILD_QUICK_PROMPTS = [
  'Suggest missing nodes',
  'Add AI regulation',
  'Suggest AI controls',
];

const ANALYZE_QUICK_PROMPTS = [
  'Explore KYC connections',
  'Impact of removing audits',
  'Find high-risk gaps',
];

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'ai',
  content: 'Hello! I\'m your RegChain AI assistant. I can help you explore and improve your compliance knowledge graph.\n\nTry asking me to:\n- Suggest missing nodes or edges\n- Explore connections around a concept\n- Analyze impact of changes\n- Find conflicts or gaps',
  timestamp: new Date().toISOString(),
};

export default function AICopilot() {
  const [collapsed, setCollapsed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState('build'); // 'build' or 'analyze'
  
  // Chat History State
  const [threads, setThreads] = useState([]);
  const [currentThreadId, setCurrentThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [referencedItems, setReferencedItems] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const { state, dispatch, addToast } = useGraph();

  // Resize State
  const [panelWidth, setPanelWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const minWidth = 350;
  const maxWidth = 800;

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Auto-resize input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, isFullScreen ? 400 : 120)}px`;
    }
  }, [input, isFullScreen]);

  // Load threads on mount
  useEffect(() => {
    setMounted(true);
    fetch('/api/ai/threads')
      .then(res => res.json())
      .then(data => {
        if (!data.error && Array.isArray(data) && data.length > 0) {
          setThreads(data);
          setCurrentThreadId(data[0].id);
          setMessages(data[0].messages || [WELCOME_MESSAGE]);
        } else {
          handleNewChat();
        }
      })
      .catch(err => {
        console.error('Failed to load threads', err);
        handleNewChat();
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewChat = () => {
    const newId = Date.now().toString();
    setCurrentThreadId(newId);
    setMessages([WELCOME_MESSAGE]);
    setShowHistory(false);
  };

  const loadThread = (threadId) => {
    const thread = threads.find(t => t.id === threadId);
    if (thread) {
      setCurrentThreadId(thread.id);
      setMessages(thread.messages || [WELCOME_MESSAGE]);
      setShowHistory(false);
    }
  };

  const deleteThread = (e, threadId) => {
    e.stopPropagation(); // prevent triggering loadThread
    
    // Optimistic UI update
    setThreads(prev => prev.filter(t => t.id !== threadId));
    if (currentThreadId === threadId) {
      handleNewChat();
    }

    // Background delete
    fetch(`/api/ai/threads/${threadId}`, { method: 'DELETE' }).catch(err => {
      console.error('Failed to delete thread', err);
    });
  };

  const saveThread = async (id, msgs) => {
    let title = 'New Chat';
    const firstUserMsg = msgs.find(m => m.role === 'user');
    if (firstUserMsg) {
      title = firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');
    }

    try {
      const isNew = !threads.some(t => t.id === id);
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/ai/threads' : `/api/ai/threads/${id}`;

      // Strip metadata from messages before saving to ES
      const msgsToSave = msgs.map(m => {
        const { metadata, ...rest } = m;
        return rest;
      });

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title, messages: msgsToSave }),
      });
      
      const updatedThread = { id, title, messages: msgs, updated_at: new Date().toISOString() };
      
      setThreads(prev => {
        const exists = prev.some(t => t.id === id);
        if (!exists) return [updatedThread, ...prev];
        return prev.map(t => t.id === id ? updatedThread : t).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      });
    } catch(err) {
      console.error('Failed to save thread:', err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    // Only set dragging to false if we leave the actual container, not children
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(file => {
        if (file.size > 20 * 1024 * 1024) {
          addToast(`File ${file.name} is too large (max 20MB)`, 'error');
          return false;
        }
        return true;
      });
      setSelectedFiles(prev => [...prev, ...newFiles]);
      e.dataTransfer.clearData();
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter(file => {
        if (file.size > 20 * 1024 * 1024) {
          addToast(`File ${file.name} is too large (max 20MB)`, 'error');
          return false;
        }
        return true;
      });
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (indexToRemove) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearFile = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text');
    if (text && text.startsWith('[RegChain_Reference:')) {
      e.preventDefault();
      try {
        const jsonStr = text.replace('[RegChain_Reference: ', '').replace(/]$/, '');
        const data = JSON.parse(jsonStr);
        setReferencedItems(data);
        addToast(`Attached ${data.nodes?.length || 0} nodes and ${data.edges?.length || 0} edges as reference`, 'success');
      } catch (err) {
        addToast('Failed to parse graph reference', 'error');
      }
    }
  };

  const sendMessage = async (text) => {
    if ((!text.trim() && !referencedItems) || loading) return;

    let finalText = text.trim();
    if (referencedItems && (referencedItems.nodes?.length > 0 || referencedItems.edges?.length > 0)) {
      const refStr = `\n\n[Context: The user has explicitly referenced the following items from the graph:]\nNodes:\n${(referencedItems.nodes || []).map(n => `- ID: ${n.id} (Label: "${n.label}", Type: ${n.type})`).join('\n')}\nEdges:\n${(referencedItems.edges || []).map(e => `- ${e.source} -> ${e.relation} -> ${e.target}`).join('\n')}`;
      finalText += refStr;
    }

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: finalText,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    // Wait for the new analysis session to overwrite the old one naturally,
    // to prevent the graph from "flashing" while waiting for the API.

    // Save user message to thread
    saveThread(currentThreadId, updatedMessages);

    try {
      const formData = new FormData();
      formData.append('message', finalText);
      formData.append('history', JSON.stringify(messages));
      formData.append('mode', mode);
      if (selectedFiles && selectedFiles.length > 0) {
        selectedFiles.forEach(f => formData.append('file', f));
      }

      // Clear the file and references selection immediately before awaiting the network request
      clearFile();
      setReferencedItems(null);

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Tag metadata with a unique session ID so we can track it across re-renders
      const sessionMetadata = data.metadata ? { ...data.metadata, _sessionId: (Date.now() + 1).toString() } : null;

      // === DEBUG: Trace the entire analysis path pipeline ===
      console.log('[DEBUG AICopilot] mode:', mode);
      console.log('[DEBUG AICopilot] data.metadata from API:', JSON.stringify(data.metadata));
      console.log('[DEBUG AICopilot] sessionMetadata:', JSON.stringify(sessionMetadata));
      console.log('[DEBUG AICopilot] visited_nodes:', sessionMetadata?.visited_nodes);
      console.log('[DEBUG AICopilot] visited_edges:', sessionMetadata?.visited_edges);
      console.log('[DEBUG AICopilot] condition check: mode===analyze?', mode === 'analyze', 
        '| sessionMetadata?', !!sessionMetadata,
        '| visited_nodes.length>0?', sessionMetadata?.visited_nodes?.length > 0,
        '| visited_edges.length>0?', sessionMetadata?.visited_edges?.length > 0);
      // === END DEBUG ===

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: data.message,
        suggestion: data.suggestion,
        metadata: sessionMetadata,
        isAnalyzeMode: mode === 'analyze',
        timestamp: data.timestamp || new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      saveThread(currentThreadId, finalMessages);

      if (data.suggestion) {
        dispatch({ type: 'ADD_SUGGESTION', payload: data.suggestion });
      }

      // Auto-highlight the analysis path on the graph for analyze mode
      if (mode === 'analyze' && sessionMetadata && (sessionMetadata.visited_nodes?.length > 0 || sessionMetadata.visited_edges?.length > 0)) {
        console.log('[DEBUG AICopilot] ✅ DISPATCHING SET_ANALYSIS_SESSION with:', JSON.stringify(sessionMetadata));
        dispatch({ type: 'SET_ANALYSIS_SESSION', payload: sessionMetadata });
      } else {
        console.log('[DEBUG AICopilot] ❌ NOT dispatching SET_ANALYSIS_SESSION. Reason:', 
          mode !== 'analyze' ? 'mode is not analyze (mode=' + mode + ')' : 
          !sessionMetadata ? 'sessionMetadata is null' : 
          'visited_nodes and visited_edges are both empty');
      }
    } catch (err) {
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `Sorry, I encountered an error: ${err.message}. Please check your API configuration and try again.`,
        timestamp: new Date().toISOString(),
        error: true,
      };
      setMessages(prev => [...prev, errorMsg]);
    }

    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };


  if (collapsed) {
    return (
      <div
        style={{
          width: 48,
          minWidth: 48,
          height: '100vh',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-primary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 16,
        }}
      >
        <button
          className="toolbar-btn"
          onClick={() => setCollapsed(false)}
          title="Open AI Assistant"
          style={{ padding: 8 }}
        >
          <MessageSquare size={18} />
        </button>
      </div>
    );
  }

  const containerStyle = isFullScreen ? {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    zIndex: 1000,
  } : { 
    position: 'relative', 
    width: panelWidth, 
    minWidth: panelWidth 
  };

  return (
    <div 
      className={`right-panel ${isFullScreen ? 'full-screen' : ''}`} 
      style={containerStyle}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(10, 10, 10, 0.6)',
          border: '2px dashed rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          pointerEvents: 'none',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            backgroundColor: 'rgba(30, 30, 30, 0.8)',
            padding: '16px 28px',
            borderRadius: '12px',
            color: '#fff',
            fontWeight: '500',
            fontSize: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            Drop file to ingest
          </div>
        </div>
      )}
      {/* Resizer Handle */}
      {!isFullScreen && (
        <div
          style={{
            position: 'absolute',
            left: -3,
            top: 0,
            bottom: 0,
            width: '6px',
            cursor: 'ew-resize',
            zIndex: 100,
            backgroundColor: isResizing ? 'var(--accent)' : 'transparent',
            transition: 'background-color 0.2s',
          }}
          onMouseDown={() => setIsResizing(true)}
          onMouseEnter={(e) => {
            if (!isResizing) e.target.style.backgroundColor = 'var(--border-secondary)';
          }}
          onMouseLeave={(e) => {
            if (!isResizing) e.target.style.backgroundColor = 'transparent';
          }}
        />
      )}
      <div className="right-panel-header">
        <div className="right-panel-header-icon">
          <Sparkles size={16} color="#0a0a0a" />
        </div>
        <div style={{ flex: 1 }}>
          <div className="right-panel-title">AI Copilot</div>
          <div className="right-panel-subtitle">Compliance Graph Assistant</div>
        </div>
        
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="right-panel-close"
            onClick={handleNewChat}
            title="New Chat"
            style={{ padding: 4 }}
          >
            <Plus size={16} />
          </button>
          <button
            className="right-panel-close"
            onClick={() => setShowHistory(!showHistory)}
            title="Chat History"
            style={{ padding: 4, background: showHistory ? 'var(--bg-tertiary)' : 'transparent' }}
          >
            <Clock size={16} />
          </button>
          <button
            className="right-panel-close"
            onClick={() => setIsFullScreen(!isFullScreen)}
            title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
            style={{ padding: 4 }}
          >
            {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          <button
            className="right-panel-close"
            onClick={() => {
              setCollapsed(true);
              setIsFullScreen(false);
            }}
            title="Close Panel"
            style={{ padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '6px', padding: 2, marginBottom: 8 }}>
          <button
            style={{
              flex: 1, padding: '6px 0', border: 'none', borderRadius: '4px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: mode === 'build' ? 'var(--bg-secondary)' : 'transparent',
              color: mode === 'build' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              boxShadow: mode === 'build' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
            }}
            onClick={() => setMode('build')}
          >
            BUILD MODE
          </button>
          <button
            style={{
              flex: 1, padding: '6px 0', border: 'none', borderRadius: '4px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: mode === 'analyze' ? 'var(--bg-secondary)' : 'transparent',
              color: mode === 'analyze' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              boxShadow: mode === 'analyze' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
            }}
            onClick={() => setMode('analyze')}
          >
            ANALYZE MODE
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          {mode === 'build' ? 'Maintain and grow the compliance memory.' : 'Reason over and investigate the compliance memory.'}
        </div>
      </div>

      {showHistory ? (
        <div className="chat-messages" style={{ display: 'block', padding: 0 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-primary)', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Past Conversations</span>
            <button 
              className="right-panel-close" 
              onClick={() => setShowHistory(false)}
              title="Close History"
              style={{ padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>
          {threads.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center' }}>
              No chat history found.
            </div>
          ) : (
            threads.map(t => (
              <div 
                key={t.id}
                onClick={() => loadThread(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-primary)',
                  cursor: 'pointer',
                  background: t.id === currentThreadId ? 'var(--bg-tertiary)' : 'transparent',
                  transition: 'background 0.2s'
                }}
                  onMouseEnter={e => { if (t.id !== currentThreadId) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={e => { if (t.id !== currentThreadId) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {new Date(t.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => deleteThread(e, t.id)}
                    className="toolbar-btn"
                    style={{ padding: 6, border: 'none', background: 'transparent' }}
                    title="Delete Chat"
                  >
                    <Trash2 size={14} color="var(--text-tertiary)" />
                  </button>
                </div>
              ))
            )}
        </div>
      ) : (
        <>
          <div className="chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.role}`}>
                <div className={`chat-avatar ${msg.role}`}>
                  {msg.role === 'ai' ? <Bot size={14} /> : <User size={14} />}
                </div>
                <div>
                  <div className="chat-bubble">
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>
                        {msg.content.trim()}
                      </ReactMarkdown>
                    </div>
                    {msg.content.trim().length === 0 && !msg.suggestion && (
                      <span style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>No text response</span>
                    )}
                  </div>

                  {msg.suggestion && (() => {
                    const liveSugg = state.pendingSuggestions.find(s => s.id === msg.suggestion.id);
                    const displaySugg = liveSugg || { ...msg.suggestion, status: 'resolved' };
                    return <SuggestionCard suggestion={displaySugg} />;
                  })()}

                  {msg.isAnalyzeMode && (
                    <div style={{ marginTop: 12, padding: '12px 0 0 0', borderTop: '1px solid var(--border-primary)' }}>
                      {!msg.metadata ? (
                        <div>
                          <button className="btn btn-secondary" disabled style={{ width: '100%', justifyContent: 'center' }}>
                            Graph Path Unavailable
                          </button>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'center' }}>
                            The AI agent did not return a valid graph path.
                          </div>
                        </div>
                      ) : state.activeAnalysisSession?._sessionId === msg.metadata?._sessionId ? (
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => dispatch({ type: 'SET_ANALYSIS_SESSION', payload: null })}
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          Hide Analysis Path
                        </button>
                      ) : (
                        <button 
                          className="btn btn-primary" 
                          onClick={() => dispatch({ type: 'SET_ANALYSIS_SESSION', payload: msg.metadata })}
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          Show Analysis Path
                        </button>
                      )}
                    </div>
                  )}

                  <div className="chat-timestamp" suppressHydrationWarning>
                    {mounted ? new Date(msg.timestamp).toLocaleTimeString() : ''}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-message ai">
                <div className="chat-avatar ai">
                  <Bot size={14} />
                </div>
                <div className="chat-bubble">
                  <div className="loading-dots">
                    <div className="loading-dot" />
                    <div className="loading-dot" />
                    <div className="loading-dot" />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    Analyzing graph and generating suggestions...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            {selectedFiles && selectedFiles.length > 0 && (
              <div style={{ margin: '0 16px 8px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedFiles.map((file, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 10px',
                    backgroundColor: 'rgba(0, 242, 254, 0.1)',
                    border: '1px solid #00f2fe',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#00f2fe'
                  }}>
                    <Paperclip size={14} style={{ marginRight: '6px', flexShrink: 0 }} />
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#00f2fe',
                        cursor: 'pointer',
                        padding: '2px',
                        marginLeft: '8px',
                        flexShrink: 0
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {referencedItems && (
              <div style={{
                background: 'var(--bg-tertiary)', padding: '6px 12px', borderRadius: '6px',
                fontSize: 12, color: 'var(--text-secondary)', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px',
                border: '1px solid var(--border-primary)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                  <span>
                    Referencing {referencedItems.nodes?.length || 0} nodes and {referencedItems.edges?.length || 0} edges
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReferencedItems(null)}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    marginLeft: '8px'
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <form className="chat-input-wrapper" onSubmit={handleSubmit}>
              <input 
                type="file" 
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept="application/pdf,image/*,audio/*"
              />
              <button
                type="button"
                className="chat-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="Attach file (PDF, Image, Audio)"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#00f2fe'}
                onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
              >
                <Paperclip size={18} />
              </button>
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder="Ask about your compliance graph..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                rows={1}
                disabled={loading}
                style={{ overflowY: 'auto' }}
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={(!input.trim() && selectedFiles.length === 0) || loading}
              >
                <Send size={16} />
              </button>
            </form>

            <div className="chat-suggestions">
              {(mode === 'build' ? BUILD_QUICK_PROMPTS : ANALYZE_QUICK_PROMPTS).map((prompt) => (
                <button
                  key={prompt}
                  className="chat-suggestion-chip"
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
