// API: /api/graph/search — Search the graph
import { NextResponse } from 'next/server';
import { ensureIndices } from '@/lib/elastic';
import { searchGraph } from '@/lib/graph-logic';

export async function GET(request) {
  try {
    await ensureIndices();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
      return NextResponse.json({ error: 'q (query) is required' }, { status: 400 });
    }

    const results = await searchGraph(q);
    return NextResponse.json({ results });
  } catch (err) {
    console.error('GET /api/graph/search error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
