// API: /api/graph/neighborhood — Get node neighborhood
import { NextResponse } from 'next/server';
import { ensureIndices } from '@/lib/elastic';
import { getNodeNeighborhood } from '@/lib/graph-logic';

export async function GET(request) {
  try {
    await ensureIndices();
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');
    const depth = parseInt(searchParams.get('depth') || '1', 10);

    if (!nodeId) {
      return NextResponse.json({ error: 'nodeId is required' }, { status: 400 });
    }

    const neighborhood = await getNodeNeighborhood(nodeId, depth);
    return NextResponse.json(neighborhood);
  } catch (err) {
    console.error('GET /api/graph/neighborhood error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
