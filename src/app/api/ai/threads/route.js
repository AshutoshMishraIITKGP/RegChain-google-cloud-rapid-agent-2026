import { NextResponse } from 'next/server';
import { ensureIndices, searchDocuments, indexDocument } from '@/lib/elastic';
import { CHAT_THREAD_INDEX } from '@/lib/constants';

export async function GET() {
  try {
    await ensureIndices();
    const threads = await searchDocuments(CHAT_THREAD_INDEX, {}, 100);
    // Sort by updated_at descending
    threads.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    return NextResponse.json(threads);
  } catch (err) {
    console.error('GET /api/ai/threads error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureIndices();
    const body = await request.json();
    const id = body.id || Date.now().toString();
    
    const newThread = {
      id,
      title: body.title || 'New Chat',
      messages: body.messages || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await indexDocument(CHAT_THREAD_INDEX, id, newThread);
    return NextResponse.json(newThread, { status: 201 });
  } catch (err) {
    console.error('POST /api/ai/threads error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
