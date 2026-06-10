// API: /api/seed/reset — Delete all data and re-seed
import { NextResponse } from 'next/server';
import { getElasticClient, ensureIndices } from '@/lib/elastic';
import { ENTITY_INDEX, RELATIONSHIP_INDEX, EVENTS_INDEX, SUGGESTIONS_INDEX } from '@/lib/constants';

export async function POST() {
  try {
    const es = getElasticClient();

    // Delete all indices
    const indices = [ENTITY_INDEX, RELATIONSHIP_INDEX, EVENTS_INDEX, SUGGESTIONS_INDEX];
    for (const index of indices) {
      try {
        await es.indices.delete({ index });
        console.log(`Deleted index: ${index}`);
      } catch (err) {
        // Index might not exist
      }
    }

    // Re-create indices
    await ensureIndices();

    return NextResponse.json({ message: 'All data cleared. Indices re-created.' });
  } catch (err) {
    console.error('POST /api/seed/reset error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
