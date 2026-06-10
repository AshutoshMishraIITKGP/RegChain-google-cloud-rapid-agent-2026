// API: /api/entities — List and Create entities
import { NextResponse } from 'next/server';
import { ensureIndices } from '@/lib/elastic';
import { createEntity, listEntities } from '@/lib/graph-logic';

export async function GET(request) {
  try {
    await ensureIndices();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || null;
    const entities = await listEntities(query);
    return NextResponse.json({ entities });
  } catch (err) {
    console.error('GET /api/entities error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureIndices();
    const body = await request.json();
    const entity = await createEntity(body);
    return NextResponse.json({ entity }, { status: 201 });
  } catch (err) {
    console.error('POST /api/entities error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
