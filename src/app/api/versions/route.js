import { NextResponse } from 'next/server';
import { getElasticClient, ensureIndices, searchDocuments } from '@/lib/elastic';
import { INDICES } from '@/lib/constants';

export async function GET() {
  try {
    await ensureIndices();
    const client = getElasticClient();
    
    const response = await client.search({
      index: INDICES.versions,
      size: 50,
      sort: [{ timestamp: { order: 'desc' } }],
      _source: ['id', 'name', 'timestamp'] // Only fetch metadata to save bandwidth
    });
    
    const versions = response.hits.hits.map(h => ({
      id: h._id,
      ...h._source
    }));
    
    return NextResponse.json(versions);
  } catch (err) {
    console.error('GET /api/versions error:', err);
    // If index doesn't exist yet, just return empty array
    if (err.meta?.statusCode === 404) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureIndices();
    const client = getElasticClient();
    
    // Check total versions limit
    const countRes = await client.count({ index: INDICES.versions });
    if (countRes.count >= 20) {
      // Find the oldest version to delete
      const oldestRes = await client.search({
        index: INDICES.versions,
        size: 1,
        sort: [{ timestamp: { order: 'asc' } }],
        _source: ['id']
      });
      
      if (oldestRes.hits.hits.length > 0) {
        const oldestId = oldestRes.hits.hits[0]._id;
        await client.delete({ index: INDICES.versions, id: oldestId, refresh: true });
        console.log(`[VersionHistory] Deleted oldest version ${oldestId} to stay within limit.`);
      }
    }

    // Grab current graph state
    const entities = await searchDocuments(INDICES.entities, {}, 5000);
    const relationships = await searchDocuments(INDICES.relationships, {}, 5000);
    
    const now = new Date().toISOString();
    const newVersion = {
      id: `v_${Date.now()}`,
      name: `Version ${new Date().toLocaleString()}`,
      timestamp: now,
      entities,
      relationships
    };
    
    await client.index({
      index: INDICES.versions,
      id: newVersion.id,
      body: newVersion,
      refresh: true
    });
    
    return NextResponse.json({
      message: 'Version saved successfully',
      version: { id: newVersion.id, name: newVersion.name, timestamp: newVersion.timestamp }
    });
  } catch (err) {
    console.error('POST /api/versions error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
