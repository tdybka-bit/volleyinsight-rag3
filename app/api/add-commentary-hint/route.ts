import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const index = pinecone.index('ed-volley');

interface CommentaryHint {
  category?: string;
  actionType?: string;
  scoreSituation?: string;
  player?: string;
  originalCommentary?: string;
  betterCommentary?: string;
  contextNotes?: string;
  priority?: string;
  status?: string;
  usageCount?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { hints }: { hints: CommentaryHint[] } = await request.json();

    if (!hints || hints.length === 0) {
      return new Response(JSON.stringify({ error: 'No hints provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`📥 Importing ${hints.length} commentary hints...`);

    const results = {
      success: 0,
      failed: 0,
      details: [] as any[],
    };

    for (const hint of hints) {
      try {
        // Skip if no better commentary provided
        if (!hint.betterCommentary || hint.betterCommentary.trim() === '') {
          results.failed++;
          results.details.push({
            category: hint.category || 'unknown',
            status: 'failed',
            reason: 'No better commentary provided',
          });
          continue;
        }

        // Default values for optional fields
        const category = hint.category || 'general';
        const actionType = hint.actionType || 'general';
        const player = hint.player || 'Any';
        const contextNotes = hint.contextNotes || '';
        const priority = hint.priority || 'normal';

        // Build rich context for RAG
        const ragText = `
COMMENTARY HINT:
Category: ${category}
Action Type: ${actionType}
Player: ${player}
Context: ${contextNotes}

BETTER COMMENTARY:
"${hint.betterCommentary}"

GUIDANCE:
${contextNotes}
Priority: ${priority}
`;

        // Generate embedding - text-embedding-3-small with 768 dims
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: ragText,
          dimensions: 768,  // Match Pinecone index!
        });

        // Generate unique ID (safe now with defaults)
        const categorySlug = category.toLowerCase().replace(/\s+/g, '-');
        const id = `commentary-hint-${categorySlug}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Upsert to Pinecone (commentary-hints namespace)
        await index.namespace('commentary-hints').upsert([
          {
            id,
            values: embedding.data[0].embedding,
            metadata: {
              text: ragText,
              category: category,
              actionType: actionType,
              player: player,
              betterCommentary: hint.betterCommentary,
              contextNotes: contextNotes,
              priority: priority,
              addedAt: new Date().toISOString(),
            },
          },
        ]);

        results.success++;
        results.details.push({
          category: category,
          actionType: actionType,
          status: 'success',
          id,
        });

        console.log(`✅ Added hint: ${category} - ${actionType}`);
      } catch (error) {
        console.error(`❌ Failed to add hint:`, error);
        results.failed++;
        results.details.push({
          category: hint.category || 'unknown',
          status: 'failed',
          error: String(error),
        });
      }
    }

    console.log(`📊 Import complete: ${results.success} success, ${results.failed} failed`);

    return new Response(JSON.stringify({
      message: 'Import complete',
      results,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Import API error:', error);
    return new Response(JSON.stringify({
      error: 'Import failed',
      details: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// GET endpoint to check stats
export async function GET(request: NextRequest) {
  try {
    const stats = await index.namespace('commentary-hints').describeIndexStats();

    return new Response(JSON.stringify({
      message: 'Commentary hints stats',
      totalVectors: stats.namespaces?.['commentary-hints']?.vectorCount || 0,
      note: 'Use POST to add new hints',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Stats error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get stats',
      details: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}