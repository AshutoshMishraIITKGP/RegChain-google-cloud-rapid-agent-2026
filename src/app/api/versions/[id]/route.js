import { NextResponse } from 'next/server';
import { getElasticClient, ensureIndices } from '@/lib/elastic';
import { INDICES } from '@/lib/constants';

export async function PUT(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    await ensureIndices();
    const client = getElasticClient();
    const { name } = await request.json();
    
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    await client.update({
      index: INDICES.versions,
      id,
      body: {
        doc: { name }
      },
      refresh: true
    });

    return NextResponse.json({ message: 'Version renamed successfully' });
  } catch (err) {
    console.error('PUT /api/versions/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    await ensureIndices();
    const client = getElasticClient();
    
    await client.delete({
      index: INDICES.versions,
      id,
      refresh: true
    });

    return NextResponse.json({ message: 'Version deleted successfully' });
  } catch (err) {
    console.error('DELETE /api/versions/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  // This POST route acts as the "RESTORE" endpoint if action=restore is passed
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    await ensureIndices();
    const client = getElasticClient();
    
    const { action } = await request.json();
    
    if (action !== 'restore') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // 1. Fetch the version
    const versionRes = await client.get({
      index: INDICES.versions,
      id
    });
    
    const version = versionRes._source;
    if (!version.entities || !version.relationships) {
      return NextResponse.json({ error: 'Invalid version data' }, { status: 500 });
    }

    // 2. Wipe current graph
    // delete_by_query using match_all
    await client.deleteByQuery({
      index: INDICES.entities,
      body: { query: { match_all: {} } },
      refresh: true,
      conflicts: 'proceed'
    }).catch(e => console.warn('Wiping entities failed or index empty:', e.message));

    await client.deleteByQuery({
      index: INDICES.relationships,
      body: { query: { match_all: {} } },
      refresh: true,
      conflicts: 'proceed'
    }).catch(e => console.warn('Wiping relationships failed or index empty:', e.message));

    // 3. Insert all entities and relationships from the version
    const bulkOps = [];
    
    version.entities.forEach(entity => {
      bulkOps.push({ index: { _index: INDICES.entities, _id: entity.id } });
      const { id, ...source } = entity;
      bulkOps.push(source);
    });
    
    version.relationships.forEach(rel => {
      bulkOps.push({ index: { _index: INDICES.relationships, _id: rel.id } });
      const { id, ...source } = rel;
      bulkOps.push(source);
    });

    if (bulkOps.length > 0) {
      await client.bulk({ refresh: true, body: bulkOps });
    }

    return NextResponse.json({ message: 'Version restored successfully' });
  } catch (err) {
    console.error('POST /api/versions/[id]/restore error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
