// API: /api/suggestions/[id] — Approve, Reject, Modify suggestions
import { NextResponse } from 'next/server';
import { ensureIndices } from '@/lib/elastic';
import {
  approveSuggestion, rejectSuggestion, modifySuggestion
} from '@/lib/graph-logic';
import { getDocument } from '@/lib/elastic';
import { SUGGESTIONS_INDEX } from '@/lib/constants';

export async function GET(request, { params }) {
  try {
    await ensureIndices();
    const { id } = await params;
    const suggestion = await getDocument(SUGGESTIONS_INDEX, id);
    if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ suggestion });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureIndices();
    const { id } = await params;
    const body = await request.json();
    const { action, ...modifications } = body;

    let result;
    switch (action) {
      case 'approve':
        result = await approveSuggestion(id);
        break;
      case 'reject':
        result = await rejectSuggestion(id);
        break;
      case 'modify':
        result = await modifySuggestion(id, modifications);
        break;
      default:
        return NextResponse.json({ error: 'action must be approve, reject, or modify' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('PUT /api/suggestions/[id] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
