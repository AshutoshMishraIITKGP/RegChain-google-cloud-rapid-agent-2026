// API: /api/relationships — List and Create relationships
import { NextResponse } from 'next/server';
import { ensureIndices } from '@/lib/elastic';
import { createRelationship, listRelationships } from '@/lib/graph-logic';

export async function GET(request) {
  try {
    await ensureIndices();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || null;
    const relationships = await listRelationships(query);
    return NextResponse.json({ relationships });
  } catch (err) {
    console.error('GET /api/relationships error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureIndices();
    const body = await request.json();
    if (!body.source || !body.target || !body.relation) {
      return NextResponse.json({ error: 'source, target, and relation are required' }, { status: 400 });
    }
    const relationship = await createRelationship(body);
    return NextResponse.json({ relationship }, { status: 201 });
  } catch (err) {
    console.error('POST /api/relationships error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
