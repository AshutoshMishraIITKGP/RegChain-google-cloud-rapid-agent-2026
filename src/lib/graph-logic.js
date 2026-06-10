// Graph Logic — Business logic for RegChain graph operations
import { v4 as uuidv4 } from 'uuid';
import {
  indexDocument, getDocument, updateDocument, deleteDocument,
  searchDocuments, bulkIndex
} from './elastic';
import {
  ENTITY_INDEX, RELATIONSHIP_INDEX, EVENTS_INDEX, SUGGESTIONS_INDEX
} from './constants';

// ===== Entity Operations =====

export async function createEntity(data) {
  const entity = {
    id: data.id || uuidv4(),
    type: data.type,
    name: data.name,
    description: data.description || '',
    status: data.status || 'active',
    owner: data.owner || '',
    confidence: data.confidence ?? 1.0,
    tags: data.tags || [],
    source: data.source || 'manual',
    last_updated: new Date().toISOString(),
    notes: data.notes || '',
    related_documents: data.related_documents || [],
    created_by: data.created_by || 'user',
    x: data.x ?? Math.random() * 800 - 400,
    y: data.y ?? Math.random() * 600 - 300,
  };

  await indexDocument(ENTITY_INDEX, entity.id, entity);
  await recordEvent('node_created', entity.id, entity.type, entity, data.created_by || 'user');
  return entity;
}

export async function updateEntity(id, updates) {
  const existing = await getDocument(ENTITY_INDEX, id);
  if (!existing) throw new Error(`Entity ${id} not found`);

  const updated = { ...existing, ...updates, last_updated: new Date().toISOString() };
  await updateDocument(ENTITY_INDEX, id, updated);
  await recordEvent('node_updated', id, updated.type, { before: existing, after: updated }, 'user');
  return updated;
}

export async function deleteEntity(id) {
  const existing = await getDocument(ENTITY_INDEX, id);
  if (!existing) throw new Error(`Entity ${id} not found`);

  // Also delete connected relationships
  const connectedEdges = await searchDocuments(RELATIONSHIP_INDEX, {
    bool: {
      should: [
        { term: { source: id } },
        { term: { target: id } },
      ],
    },
  });

  for (const edge of connectedEdges) {
    await deleteDocument(RELATIONSHIP_INDEX, edge.id);
    await recordEvent('edge_deleted', edge.id, 'relationship', edge, 'user');
  }

  await deleteDocument(ENTITY_INDEX, id);
  await recordEvent('node_deleted', id, existing.type, existing, 'user');
  return { deleted: true, cascaded_edges: connectedEdges.length };
}

export async function getEntity(id) {
  return getDocument(ENTITY_INDEX, id);
}

export async function listEntities(query) {
  if (query && typeof query === 'string') {
    return searchDocuments(ENTITY_INDEX, {
      bool: {
        should: [
          { match: { name: query } },
          { match: { description: query } },
          { match: { type: query } },
          { term: { tags: query } },
        ],
      },
    });
  }
  return searchDocuments(ENTITY_INDEX, {});
}

// ===== Relationship Operations =====

export async function createRelationship(data) {
  const rel = {
    id: data.id || uuidv4(),
    source: data.source,
    target: data.target,
    relation: data.relation,
    confidence: data.confidence ?? 1.0,
    rationale: data.rationale || '',
    created_by: data.created_by || 'user',
    approved_by: data.approved_by || '',
    timestamp: new Date().toISOString(),
    editable: data.editable ?? true,
  };

  await indexDocument(RELATIONSHIP_INDEX, rel.id, rel);
  await recordEvent('edge_created', rel.id, 'relationship', rel, data.created_by || 'user');
  return rel;
}

export async function updateRelationship(id, updates) {
  const existing = await getDocument(RELATIONSHIP_INDEX, id);
  if (!existing) throw new Error(`Relationship ${id} not found`);

  const updated = { ...existing, ...updates, timestamp: new Date().toISOString() };
  await updateDocument(RELATIONSHIP_INDEX, id, updated);
  await recordEvent('edge_updated', id, 'relationship', { before: existing, after: updated }, 'user');
  return updated;
}

export async function deleteRelationship(id) {
  const existing = await getDocument(RELATIONSHIP_INDEX, id);
  if (!existing) throw new Error(`Relationship ${id} not found`);

  await deleteDocument(RELATIONSHIP_INDEX, id);
  await recordEvent('edge_deleted', id, 'relationship', existing, 'user');
  return { deleted: true };
}

export async function getRelationship(id) {
  return getDocument(RELATIONSHIP_INDEX, id);
}

export async function listRelationships(query) {
  if (query && typeof query === 'string') {
    return searchDocuments(RELATIONSHIP_INDEX, {
      bool: {
        should: [
          { match: { relation: query } },
          { match: { rationale: query } },
        ],
      },
    });
  }
  return searchDocuments(RELATIONSHIP_INDEX, {});
}

// ===== Graph Operations =====

export async function getFullGraph() {
  const entities = await searchDocuments(ENTITY_INDEX, {}, 500);
  const relationships = await searchDocuments(RELATIONSHIP_INDEX, {}, 1000);
  return { entities, relationships };
}

export async function getNodeNeighborhood(nodeId, depth = 1) {
  const visited = new Set();
  const nodeIds = new Set([nodeId]);
  const allEdges = [];

  for (let d = 0; d < depth; d++) {
    const currentIds = [...nodeIds].filter((id) => !visited.has(id));
    if (currentIds.length === 0) break;

    for (const id of currentIds) {
      visited.add(id);
      const edges = await searchDocuments(RELATIONSHIP_INDEX, {
        bool: {
          should: [
            { term: { source: id } },
            { term: { target: id } },
          ],
        },
      });

      for (const edge of edges) {
        allEdges.push(edge);
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
      }
    }
  }

  const entities = [];
  for (const id of nodeIds) {
    const entity = await getDocument(ENTITY_INDEX, id);
    if (entity) entities.push(entity);
  }

  // Deduplicate edges
  const uniqueEdges = [...new Map(allEdges.map((e) => [e.id, e])).values()];

  return { entities, relationships: uniqueEdges, focusId: nodeId };
}

export async function searchGraph(query) {
  const entities = await searchDocuments(ENTITY_INDEX, {
    bool: {
      should: [
        { match: { name: { query, boost: 3 } } },
        { match: { description: query } },
        { match: { type: query } },
        { term: { tags: query } },
        { match: { notes: query } },
      ],
    },
  });

  return entities;
}

// ===== Suggestion Operations =====

export async function createSuggestion(data) {
  const suggestion = {
    id: data.id || uuidv4(),
    status: 'pending',
    summary: data.summary || '',
    reasoning: data.reasoning || '',
    exploration_used: data.exploration_used || [],
    proposed_nodes: data.proposed_nodes || [],
    proposed_edges: data.proposed_edges || [],
    proposed_deletions: data.proposed_deletions || { nodes: [], edges: [] },
    changes: data.changes || [],
    confidence: data.confidence ?? 0.0,
    warnings: data.warnings || [],
    created_at: new Date().toISOString(),
    resolved_at: null,
    resolved_by: null,
  };

  await indexDocument(SUGGESTIONS_INDEX, suggestion.id, suggestion);
  return suggestion;
}

export async function approveSuggestion(id) {
  const suggestion = await getDocument(SUGGESTIONS_INDEX, id);
  if (!suggestion) throw new Error(`Suggestion ${id} not found`);
  if (suggestion.status !== 'pending') throw new Error(`Suggestion ${id} is not pending`);

  // Get all entities to resolve names to IDs
  const allEntities = await searchDocuments(ENTITY_INDEX, {}, 500);
  const entityByName = {};
  for (const e of allEntities) {
    entityByName[e.name.toLowerCase()] = e;
  }

  // Apply proposed nodes
  const createdNodes = [];
  for (const node of (suggestion.proposed_nodes || [])) {
    const entity = await createEntity({
      ...node,
      created_by: 'ai',
      source: `suggestion:${id}`,
    });
    createdNodes.push(entity);
    entityByName[entity.name.toLowerCase()] = entity;
  }

  // Apply proposed edges
  const createdEdges = [];
  for (const edge of (suggestion.proposed_edges || [])) {
    // Resolve source and target names to IDs
    let sourceId = edge.source;
    let targetId = edge.target;

    if (edge.source_name) {
      const src = entityByName[edge.source_name.toLowerCase()];
      if (src) sourceId = src.id;
    }
    if (edge.target_name) {
      const tgt = entityByName[edge.target_name.toLowerCase()];
      if (tgt) targetId = tgt.id;
    }

    if (sourceId && targetId) {
      const rel = await createRelationship({
        source: sourceId,
        target: targetId,
        relation: edge.relation,
        rationale: edge.rationale || '',
        confidence: edge.confidence ?? 0.9,
        created_by: 'ai',
        approved_by: 'user',
      });
      createdEdges.push(rel);
    }
  }

  // Apply proposed deletions
  const deletedNodes = [];
  const deletedEdges = [];
  if (suggestion.proposed_deletions) {
    if (suggestion.proposed_deletions.nodes) {
      for (const id of suggestion.proposed_deletions.nodes) {
        try {
          await deleteEntity(id);
          deletedNodes.push(id);
        } catch (e) {
          console.error("Failed to delete node:", id, e);
        }
      }
    }
    if (suggestion.proposed_deletions.edges) {
      for (const id of suggestion.proposed_deletions.edges) {
        try {
          await deleteDocument(RELATIONSHIP_INDEX, id);
          await recordEvent('edge_deleted', id, 'relationship', { id }, 'user');
          deletedEdges.push(id);
        } catch (e) {
          console.error("Failed to delete edge:", id, e);
        }
      }
    }
  }

  // Update suggestion status
  await updateDocument(SUGGESTIONS_INDEX, id, {
    status: 'approved',
    resolved_at: new Date().toISOString(),
    resolved_by: 'user',
  });

  await recordEvent('suggestion_approved', id, 'suggestion', {
    suggestion_id: id,
    created_nodes: createdNodes.length,
    created_edges: createdEdges.length,
  }, 'user');

  return { approved: true, createdNodes, createdEdges };
}

export async function rejectSuggestion(id) {
  const suggestion = await getDocument(SUGGESTIONS_INDEX, id);
  if (!suggestion) throw new Error(`Suggestion ${id} not found`);

  await updateDocument(SUGGESTIONS_INDEX, id, {
    status: 'rejected',
    resolved_at: new Date().toISOString(),
    resolved_by: 'user',
  });

  await recordEvent('suggestion_rejected', id, 'suggestion', { suggestion_id: id }, 'user');

  return { rejected: true };
}

export async function modifySuggestion(id, modifications) {
  const suggestion = await getDocument(SUGGESTIONS_INDEX, id);
  if (!suggestion) throw new Error(`Suggestion ${id} not found`);

  const updated = {
    ...suggestion,
    ...modifications,
    status: 'pending', // Reset to pending for re-approval
  };

  await updateDocument(SUGGESTIONS_INDEX, id, updated);
  await recordEvent('suggestion_modified', id, 'suggestion', { modifications }, 'user');

  return updated;
}

export async function listSuggestions(status) {
  if (status) {
    return searchDocuments(SUGGESTIONS_INDEX, { term: { status } });
  }
  return searchDocuments(SUGGESTIONS_INDEX, {});
}

// ===== Event Recording =====

export async function recordEvent(eventType, entityId, entityType, payload, actor = 'system') {
  const event = {
    id: uuidv4(),
    event_type: eventType,
    entity_id: entityId,
    entity_type: entityType,
    payload,
    actor,
    timestamp: new Date().toISOString(),
    notes: '',
  };

  try {
    await indexDocument(EVENTS_INDEX, event.id, event);
  } catch (err) {
    console.error('Failed to record event:', err.message);
  }
  return event;
}

export async function listEvents(limit = 50) {
  const es = (await import('./elastic')).getElasticClient();
  try {
    const result = await es.search({
      index: EVENTS_INDEX,
      body: {
        query: { match_all: {} },
        sort: [{ timestamp: { order: 'desc' } }],
        size: limit,
      },
    });
    return result.hits.hits.map((hit) => ({ id: hit._id, ...hit._source }));
  } catch (err) {
    if (err?.meta?.statusCode === 404) return [];
    throw err;
  }
}
