// API: /api/entities/[id] — Get, Update, Delete single entity
import { NextResponse } from 'next/server';
import { ensureIndices } from '@/lib/elastic';
import { getEntity, updateEntity, deleteEntity } from '@/lib/graph-logic';

export async function GET(request, { params }) {
  try {
    await ensureIndices();
    const { id } = await params;
    const entity = await getEntity(id);
    if (!entity) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ entity });
  } catch (err) {
    console.error('GET /api/entities/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureIndices();
    const { id } = await params;
    const body = await request.json();
    const entity = await updateEntity(id, body);
    return NextResponse.json({ entity });
  } catch (err) {
    console.error('PUT /api/entities/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await ensureIndices();
    const { id } = await params;
    const result = await deleteEntity(id);
    return NextResponse.json(result);
  } catch (err) {
    console.error('DELETE /api/entities/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
