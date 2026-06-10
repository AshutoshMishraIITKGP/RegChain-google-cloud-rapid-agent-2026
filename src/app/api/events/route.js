// API: /api/events — List graph events
import { NextResponse } from 'next/server';
import { ensureIndices } from '@/lib/elastic';
import { listEvents } from '@/lib/graph-logic';

export async function GET(request) {
  try {
    await ensureIndices();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const events = await listEvents(limit);
    return NextResponse.json({ events });
  } catch (err) {
    console.error('GET /api/events error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
