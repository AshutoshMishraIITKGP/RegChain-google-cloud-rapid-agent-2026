// API: /api/relationships/[id] — Get, Update, Delete single relationship
import { NextResponse } from 'next/server';
import { ensureIndices } from '@/lib/elastic';
import { getRelationship, updateRelationship, deleteRelationship } from '@/lib/graph-logic';

export async function GET(request, { params }) {
  try {
    await ensureIndices();
    const { id } = await params;
    const relationship = await getRelationship(id);
    if (!relationship) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ relationship });
  } catch (err) {
    console.error('GET /api/relationships/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureIndices();
    const { id } = await params;
    const body = await request.json();
    const relationship = await updateRelationship(id, body);
    return NextResponse.json({ relationship });
  } catch (err) {
    console.error('PUT /api/relationships/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await ensureIndices();
    const { id } = await params;
    const result = await deleteRelationship(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error('DELETE /api/relationships/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
