'use client';
import { useState } from 'react';
import { useGraph } from '@/context/GraphContext';
import {
  LayoutDashboard, Network, PlusCircle, Link2, Lightbulb, FileText,
  Cog, Shield, AlertTriangle, CheckSquare, FileCheck, ChevronLeft,
  ChevronRight, Users, Building2, Monitor, Target, History as HistoryIcon,
  HelpCircle
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    title: 'Main',
    items: [
      { id: 'graph', label: 'Graph Explorer', icon: Network },
      { id: 'add-node', label: 'Add Node', icon: PlusCircle, action: 'addNode' },
      { id: 'add-edge', label: 'Add Relationship', icon: Link2, action: 'addEdge' },
      { id: 'versions', label: 'Version History', icon: HistoryIcon, action: 'showVersions' },
    ],
  },
  {
    title: 'Entities',
    items: [
      { id: 'regulations', label: 'Regulations', icon: FileText, filter: 'Regulation' },
      { id: 'processes', label: 'Processes', icon: Cog, filter: 'Process' },
      { id: 'controls', label: 'Controls', icon: Shield, filter: 'Control' },
      { id: 'policies', label: 'Policies', icon: FileCheck, filter: 'Policy' },
      { id: 'risks', label: 'Risks', icon: AlertTriangle, filter: 'Risk' },
      { id: 'tasks', label: 'Tasks', icon: CheckSquare, filter: 'Task' },
      { id: 'evidence', label: 'Evidence', icon: FileCheck, filter: 'Evidence' },
      { id: 'teams', label: 'Teams', icon: Users, filter: 'Team' },
      { id: 'systems', label: 'Systems', icon: Monitor, filter: 'System' },
      { id: 'organizations', label: 'Organizations', icon: Building2, filter: 'Organization' },
      { id: 'gaps', label: 'Gaps', icon: Target, filter: 'Gap' },
    ],
  },
];

export default function LeftSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState('graph');
  const { state, dispatch } = useGraph();

  const handleItemClick = (item) => {
    setActiveItem(item.id);

    if (item.action === 'addNode') {
      dispatch({ type: 'TOGGLE_ADD_NODE_MODAL' });
    } else if (item.action === 'addEdge') {
      dispatch({ type: 'TOGGLE_ADD_EDGE_MODAL' });
    } else if (item.action === 'showVersions') {
      dispatch({ type: 'TOGGLE_VERSION_HISTORY' });
    } else if (item.filter) {
      // Filter graph to show only this type
      dispatch({ type: 'SET_CATEGORY_FILTER', payload: item.filter });
    } else {
      dispatch({ type: 'SET_CATEGORY_FILTER', payload: null });
      dispatch({ type: 'SET_SEARCH', payload: '' });
    }
  };

  const entityCounts = {};
  state.entities.forEach((e) => {
    entityCounts[e.type] = (entityCounts[e.type] || 0) + 1;
  });

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header" style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '16px 0' : '16px' }}>
        {!collapsed && <div className="sidebar-logo">R</div>}
        {!collapsed && (
          <div className="sidebar-title">
            Reg<span>Chain</span>
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={collapsed ? { margin: 0 } : {}}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="sidebar-section">
            {!collapsed && (
              <div className="sidebar-section-title">{section.title}</div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const count = item.filter ? entityCounts[item.filter] : null;
              return (
                <button
                  key={item.id}
                  className={`sidebar-item ${activeItem === item.id ? 'active' : ''}`}
                  onClick={() => handleItemClick(item)}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="sidebar-item-icon">
                    <Icon size={18} />
                  </span>
                  {!collapsed && (
                    <>
                      <span className="sidebar-item-label">{item.label}</span>
                      {count != null && count > 0 && (
                        <span className="sidebar-item-badge">{count}</span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
            {!collapsed && section.title === 'Main' && <div className="sidebar-divider" />}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="sidebar-item"
          onClick={() => dispatch({ type: 'TOGGLE_HELP_MODAL', payload: true })}
          title={collapsed ? 'Help Guide' : undefined}
        >
          <span className="sidebar-item-icon">
            <HelpCircle size={18} />
          </span>
          {!collapsed && <span className="sidebar-item-label">Help Guide</span>}
        </button>
      </div>
    </aside>
  );
}
