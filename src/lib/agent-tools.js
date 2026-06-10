import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { executeElasticMCPTool } from './mcp-client.js';

// Global tracker for the current analysis session
global._activeToolSession = {
  visitedNodes: new Set(),
  visitedEdges: new Set()
};

function trackResults(results) {
  try {
    if (Array.isArray(results)) {
      results.forEach(item => {
        if (item._id) {
          // If it's a relationship, it has source/target
          if (item._source && item._source.source && item._source.target) {
            global._activeToolSession.visitedEdges.add(item._id);
            global._activeToolSession.visitedNodes.add(item._source.source);
            global._activeToolSession.visitedNodes.add(item._source.target);
          } else {
            global._activeToolSession.visitedNodes.add(item._id);
          }
        }
      });
    } else if (results && results.hits && Array.isArray(results.hits.hits)) {
      trackResults(results.hits.hits);
    }
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
    const esql = `FROM relationships | WHERE source == "${nodeId}" OR target == "${nodeId}" | LIMIT 50`;
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
    // For a simple impact analysis, just fetch downstream relationships
    const esql = `FROM relationships | WHERE source == "${nodeId}" | LIMIT 50`;
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
    // Use platform_core_search to find related nodes to suggest changes
    return await executeElasticMCPTool('platform_core_search', { index: 'entities', query: userPrompt });
  }
});

export const generateReportTool = new FunctionTool({
  name: 'generate_report',
  description: 'Create audit/compliance reports based on graph evidence.',
  parameters: z.object({
    scope: z.string().describe('The scope of the report (e.g., Audit Summary, Gap Assessment).')
  }),
  execute: async ({ scope }) => {
    return await executeElasticMCPTool('platform_core_search', { index: 'entities', query: scope });
  }
});

export const prioritizeTasksTool = new FunctionTool({
  name: 'prioritize_tasks',
  description: 'Generate ranked remediation plans for compliance gaps.',
  parameters: z.object({
    scope: z.string().describe('The scope of tasks to prioritize.')
  }),
  execute: async ({ scope }) => {
    return await executeElasticMCPTool('platform_core_search', { index: 'entities', query: `priority:high ${scope}` });
  }
});

export const findConflictsTool = new FunctionTool({
  name: 'find_conflicts',
  description: 'Detect policy or regulation conflicts for a node.',
  parameters: z.object({
    nodeId: z.string().describe('The ID of the node to check for conflicts.')
  }),
  execute: async ({ nodeId }) => {
    const esql = `FROM relationships | WHERE source == "${nodeId}" AND type == "conflicts_with" | LIMIT 50`;
    return await executeElasticMCPTool('platform_core_execute_esql', { query: esql });
  }
});

export const findGapsTool = new FunctionTool({
  name: 'find_gaps',
  description: 'Detect missing controls, evidence, ownership, or compliance coverage.',
  parameters: z.object({}),
  execute: async () => {
    const esql = `FROM entities | WHERE status == "Missing" OR status == "Draft" | LIMIT 50`;
    return await executeElasticMCPTool('platform_core_execute_esql', { query: esql });
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
    const esql = `FROM relationships | WHERE source == "${source}" OR target == "${target}" | LIMIT 100`;
    return await executeElasticMCPTool('platform_core_execute_esql', { query: esql });
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
