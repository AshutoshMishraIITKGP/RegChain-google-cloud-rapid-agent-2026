import { NextResponse } from 'next/server';
import { getElasticClient } from '@/lib/elastic';
import { ENTITY_INDEX } from '@/lib/constants';

export async function POST(req) {
  try {
    const client = getElasticClient();
    
    // Use Painless script to remove 'x' and 'y' fields from all entities
    const result = await client.updateByQuery({
      index: ENTITY_INDEX,
      refresh: true,
      body: {
        script: {
          source: "ctx._source.remove('x'); ctx._source.remove('y');",
          lang: "painless"
        },
        query: {
          match_all: {}
        }
      }
    });

    return NextResponse.json({ success: true, updated: result.updated });
  } catch (error) {
    console.error('Failed to reset layout configuration:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

