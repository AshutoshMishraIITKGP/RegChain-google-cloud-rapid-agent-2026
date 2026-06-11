// RegChain Constants — Node types, Edge types, Colors, and Configuration

export const NODE_TYPES = [
  'Regulation',
  'Obligation',
  'Control',
  'Process',
  'Policy',
  'Team',
  'Risk',
  'Evidence',
  'Task',
  'System',
  'Gap',
  'Organization',
];

export const EDGE_TYPES = [
  'mandates',
  'affects',
  'implemented_by',
  'governs',
  'owned_by',
  'conflicts_with',
  'creates_risk',
  'supported_by',
  'requires_fix',
  'references',
  'supersedes',
  'amends',
  'applies_to',
  'uses',
  'depends_on',
  'mitigates',
  'monitored_by',
  'requires',
  'supports',
];

export const NODE_COLORS = {
  Regulation:   '#E8B931',
  Obligation:   '#E07B39',
  Control:      '#4ECDC4',
  Process:      '#3498DB',
  Policy:       '#9B59B6',
  Team:         '#2ECC71',
  Risk:         '#E74C3C',
  Evidence:     '#F1C40F',
  Task:         '#E67E22',
  System:       '#34495E',
  Gap:          '#E91E63',
  Organization: '#95A5A6',
  Finding:      '#C2185B',
  Recommendation: '#8BC34A',
};

export const NODE_ICONS = {
  Regulation:   '§',             // Section
  Obligation:   '\u2696\uFE0E',  // Scales
  Control:      '\u26E8\uFE0E',  // Shield cross
  Process:      '\u2699\uFE0E',  // Gear
  Policy:       '\u2630',        // Trigram / Document
  Team:         '\u25C8',        // Diamond with dot / Cluster
  Risk:         '\u26A0\uFE0E',  // Warning
  Evidence:     '\u2315',        // Magnifying glass
  Task:         '\u2611\uFE0E',  // Checkbox
  System:       '\u26C1',        // Database cylinder
  Gap:          '\u2205',        // Empty set
  Organization: '\u2302',        // House / Institution
};

export const STATUS_OPTIONS = [
  'active',
  'draft',
  'deprecated',
  'archived',
  'pending_review',
  'non_compliant',
  'compliant',
];

export const ENTITY_INDEX = 'regchain-entities';
export const RELATIONSHIP_INDEX = 'regchain-relationships';
export const EVENTS_INDEX = 'regchain-graph-events';
export const SUGGESTIONS_INDEX = 'regchain-suggestions';
export const CHAT_THREAD_INDEX = 'regchain-chat-threads';
export const VERSIONS_INDEX = 'regchain-versions';

export const INDICES = {
  entities: ENTITY_INDEX,
  relationships: RELATIONSHIP_INDEX,
  events: EVENTS_INDEX,
  suggestions: SUGGESTIONS_INDEX,
  chatThreads: CHAT_THREAD_INDEX,
  versions: VERSIONS_INDEX,
};
