import { NextResponse } from 'next/server';
import { getElasticClient } from '@/lib/elastic';
import { ENTITY_INDEX } from '@/lib/constants';

export async function POST(req) {
  try {
    const { nodes } = await req.json();

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json({ error: 'Invalid nodes data' }, { status: 400 });
    }

    const client = getElasticClient();

    // Prepare bulk update operations
    const operations = nodes.flatMap(node => [
      { update: { _index: ENTITY_INDEX, _id: node.id } },
      { doc: { x: node.x, y: node.y } }
    ]);

    if (operations.length === 0) {
      return NextResponse.json({ success: true, message: 'No nodes to update' });
    }

    const result = await client.bulk({ refresh: true, body: operations });

    if (result.errors) {
      const errorDetails = result.items.filter(item => item.update && item.update.error);
      console.error('Bulk update errors:', errorDetails);
      return NextResponse.json({ error: 'Failed to update some nodes' }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: nodes.length });
  } catch (error) {
    console.error('Failed to save layout configuration:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
