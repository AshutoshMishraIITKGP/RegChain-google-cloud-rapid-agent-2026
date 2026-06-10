// API: /api/ai/chat — AI assistant endpoint
import { NextResponse } from 'next/server';
import { ensureIndices } from '@/lib/elastic';
import { processAIChat } from '@/lib/ai-agent';
import { createSuggestion } from '@/lib/graph-logic';

export async function POST(request) {
  try {
    await ensureIndices();
    const formData = await request.formData();
    const message = formData.get('message');
    const history = JSON.parse(formData.get('history') || '[]');
    const mode = formData.get('mode') || 'build';
    const file = formData.get('file');

    if (!message && !file) {
      return NextResponse.json({ error: 'message or file is required' }, { status: 400 });
    }

    let fileData = null;
    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      fileData = {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: file.type
        }
      };
    }

    const result = await processAIChat(message, history, mode, fileData);
    console.log('AI Response:', JSON.stringify({ hasMessage: !!result.message, hasSuggestion: !!result.suggestion, metadata: result.metadata }));

    // If the AI returned a structured suggestion, store it
    let storedSuggestion = null;
    if (result.suggestion) {
      storedSuggestion = await createSuggestion(result.suggestion);
    }

    return NextResponse.json({
      message: result.message,
      suggestion: storedSuggestion,
      metadata: result.metadata,
      timestamp: result.timestamp,
    });
  } catch (err) {
    console.error('POST /api/ai/chat error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
