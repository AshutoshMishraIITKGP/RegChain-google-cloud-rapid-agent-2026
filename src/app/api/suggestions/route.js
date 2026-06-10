// API: /api/suggestions — List and create suggestions
import { NextResponse } from 'next/server';
import { ensureIndices } from '@/lib/elastic';
import { createSuggestion, listSuggestions } from '@/lib/graph-logic';

export async function GET(request) {
  try {
    await ensureIndices();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || null;
    const suggestions = await listSuggestions(status);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error('GET /api/suggestions error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureIndices();
    const body = await request.json();
    const suggestion = await createSuggestion(body);
    return NextResponse.json({ suggestion }, { status: 201 });
  } catch (err) {
    console.error('POST /api/suggestions error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
