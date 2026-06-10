import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { executeElasticMCPTool } from './mcp-client.js';

// Global tracker for the current analysis session
global._activeToolSession = {
  visitedNodes: new Set(),
  visitedEdges: new Set()
};

// Rate Limiter: Max 13 calls per 60 seconds
const RATE_LIMIT_MAX_CALLS = 13;
const RATE_LIMIT_WINDOW_MS = 60000;
const callTimestamps = [];

async function throttleToolCall() {
  const now = Date.now();
  // Remove timestamps older than 60 seconds
  while (callTimestamps.length > 0 && callTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    callTimestamps.shift();
  }

  if (callTimestamps.length >= RATE_LIMIT_MAX_CALLS) {
    const oldest = callTimestamps[0];
    const timeToWait = (oldest + RATE_LIMIT_WINDOW_MS) - now;
    console.warn(`[AI Copilot] Throttling tool call. Sleeping for ${timeToWait}ms to respect limits.`);
    await new Promise(r => setTimeout(r, timeToWait + 100)); // +100ms buffer
    // After waiting, clear old timestamps again
    const afterWait = Date.now();
    while (callTimestamps.length > 0 && callTimestamps[0] < afterWait - RATE_LIMIT_WINDOW_MS) {
      callTimestamps.shift();
    }
  }
  
  callTimestamps.push(Date.now());
}

function trackResults(results) {
  try {
    if (!results || !Array.isArray(results.results)) return results;

    results.results.forEach(item => {
      if (item.type === 'esql_results' && item.data && Array.isArray(item.data.columns) && Array.isArray(item.data.values)) {
        const idIdx = item.data.columns.findIndex(c => c.name === 'id');
        const sourceIdx = item.data.columns.findIndex(c => c.name === 'source');
        const targetIdx = item.data.columns.findIndex(c => c.name === 'target');

        item.data.values.forEach(row => {
          if (sourceIdx !== -1 && targetIdx !== -1 && row[sourceIdx] && row[targetIdx]) {
            if (idIdx !== -1 && row[idIdx]) {
              global._activeToolSession.visitedEdges.add(row[idIdx]);
            }
            global._activeToolSession.visitedNodes.add(row[sourceIdx]);
            global._activeToolSession.visitedNodes.add(row[targetIdx]);
          } else if (idIdx !== -1 && row[idIdx]) {
            global._activeToolSession.visitedNodes.add(row[idIdx]);
          }
        });
      } else if (item.type === 'resource_list' && item.data && Array.isArray(item.data.resources)) {
        item.data.resources.forEach(res => {
          if (res.reference && res.reference.id) {
             global._activeToolSession.visitedNodes.add(res.reference.id);
          }
        });
      }
    });
  } catch (e) {
    console.warn("Error tracking tool results:", e);
  }
  return results;
}

export const searchGraphTool = new FunctionTool({
  name: 'search_graph',
  description: 'Retrieve nodes and relationships from the compliance graph.',
  parameters: z.object({
    query: z.string().describe('The search query or entity name.'),
    entity_type: z.string().optional().describe('Filter by node type (e.g., Regulation, Risk, Control).')
  }),
  execute: async ({ query, entity_type }) => {
    await throttleToolCall();
    const q = entity_type ? `${query} type:"${entity_type}"` : query;
    const res = await executeElasticMCPTool('platform_core_search', { index: 'entities', query: q });
    return trackResults(res);
  }
});

export const findNeighborsTool = new FunctionTool({
  name: 'find_neighbors',
  description: 'Traverse connected entities in the graph.',
  parameters: z.object({
    nodeId: z.string().describe('The ID of the source node.')
  }),
  execute: async ({ nodeId }) => {
    await throttleToolCall();
    const esql = `FROM regchain-relationships | WHERE source == "${nodeId}" OR target == "${nodeId}" | LIMIT 50`;
    global._activeToolSession.visitedNodes.add(nodeId);
    const res = await executeElasticMCPTool('platform_core_execute_esql', { query: esql });
    return trackResults(res);
  }
});

export const impactAnalysisTool = new FunctionTool({
  name: 'impact_analysis',
  description: 'Find downstream effects of modifications to a node.',
  parameters: z.object({
    nodeId: z.string().describe('The ID of the modified or removed node.')
  }),
  execute: async ({ nodeId }) => {
    await throttleToolCall();
    // For a simple impact analysis, just fetch downstream relationships
    const esql = `FROM regchain-relationships | WHERE source == "${nodeId}" | LIMIT 50`;
    global._activeToolSession.visitedNodes.add(nodeId);
    const res = await executeElasticMCPTool('platform_core_execute_esql', { query: esql });
    return trackResults(res);
  }
});

export const suggestChangesTool = new FunctionTool({
  name: 'suggest_changes',
  description: 'Generate graph proposals for adding/removing nodes and edges.',
  parameters: z.object({
    userPrompt: z.string().describe('The request or context for generating changes.')
  }),
  execute: async ({ userPrompt }) => {
    await throttleToolCall();
    // Use platform_core_search to find related nodes to suggest changes
    const res = await executeElasticMCPTool('platform_core_search', { index: 'regchain-entities', query: userPrompt });
    return trackResults(res);
  }
});

export const generateReportTool = new FunctionTool({
  name: 'generate_report',
  description: 'Create audit/compliance reports based on graph evidence.',
  parameters: z.object({
    scope: z.string().describe('The scope of the report (e.g., Audit Summary, Gap Assessment).')
  }),
  execute: async ({ scope }) => {
    await throttleToolCall();
    const res = await executeElasticMCPTool('platform_core_search', { index: 'regchain-entities', query: scope });
    return trackResults(res);
  }
});

export const prioritizeTasksTool = new FunctionTool({
  name: 'prioritize_tasks',
  description: 'Generate ranked remediation plans for compliance gaps.',
  parameters: z.object({
    scope: z.string().describe('The scope of tasks to prioritize.')
  }),
  execute: async ({ scope }) => {
    await throttleToolCall();
    const res = await executeElasticMCPTool('platform_core_search', { index: 'regchain-entities', query: `priority:high ${scope}` });
    return trackResults(res);
  }
});

export const findConflictsTool = new FunctionTool({
  name: 'find_conflicts',
  description: 'Detect policy or regulation conflicts for a node.',
  parameters: z.object({
    nodeId: z.string().describe('The ID of the node to check for conflicts.')
  }),
  execute: async ({ nodeId }) => {
    await throttleToolCall();
    const esql = `FROM regchain-relationships | WHERE source == "${nodeId}" AND type == "conflicts_with" | LIMIT 50`;
    const res = await executeElasticMCPTool('platform_core_execute_esql', { query: esql });
    return trackResults(res);
  }
});

export const findGapsTool = new FunctionTool({
  name: 'find_gaps',
  description: 'Detect missing controls, evidence, ownership, or compliance coverage.',
  parameters: z.object({}),
  execute: async () => {
    await throttleToolCall();
    const esql = `FROM entities | WHERE status == "Missing" OR status == "Draft" | LIMIT 50`;
    const res = await executeElasticMCPTool('platform_core_execute_esql', { query: esql });
    return trackResults(res);
  }
});

export const graphPathTool = new FunctionTool({
  name: 'graph_path',
  description: 'Find graph reasoning chains between two entities.',
  parameters: z.object({
    source: z.string().describe('The ID of the source node.'),
    target: z.string().describe('The ID of the target node.')
  }),
  execute: async ({ source, target }) => {
    await throttleToolCall();
    const esql = `FROM regchain-relationships | WHERE source == "${source}" OR target == "${target}" | LIMIT 100`;
    const res = await executeElasticMCPTool('platform_core_execute_esql', { query: esql });
    return trackResults(res);
  }
});

export const regchainTools = [
  searchGraphTool,
  findNeighborsTool,
  impactAnalysisTool,
  suggestChangesTool,
  generateReportTool,
  prioritizeTasksTool,
  findConflictsTool,
  findGapsTool,
  graphPathTool
];
