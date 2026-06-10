import { NextResponse } from 'next/server';
import { ensureIndices, getDocument, updateDocument, deleteDocument } from '@/lib/elastic';
import { CHAT_THREAD_INDEX } from '@/lib/constants';

export async function GET(request, { params }) {
  try {
    await ensureIndices();
    const { id } = await params;
    const thread = await getDocument(CHAT_THREAD_INDEX, id);
    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    return NextResponse.json(thread);
  } catch (err) {
    console.error('GET /api/ai/threads/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureIndices();
    const { id } = await params;
    const body = await request.json();
    
    const thread = await getDocument(CHAT_THREAD_INDEX, id);
    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const updatedThread = {
      ...thread,
      ...body,
      updated_at: new Date().toISOString(),
    };

    await updateDocument(CHAT_THREAD_INDEX, id, updatedThread);
    return NextResponse.json(updatedThread);
  } catch (err) {
    console.error('PUT /api/ai/threads/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await ensureIndices();
    const { id } = await params;
    const success = await deleteDocument(CHAT_THREAD_INDEX, id);
    if (!success) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/ai/threads/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
