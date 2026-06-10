// API: /api/graph/full — Get full graph
import { NextResponse } from 'next/server';
import { ensureIndices } from '@/lib/elastic';
import { getFullGraph } from '@/lib/graph-logic';

export async function GET() {
  try {
    await ensureIndices();
    const graph = await getFullGraph();
    return NextResponse.json(graph);
  } catch (err) {
    console.error('GET /api/graph/full error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
