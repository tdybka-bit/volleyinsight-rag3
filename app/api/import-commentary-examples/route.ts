// Force rebuild - ada-002 fix 2026-01-16
import { NextRequest } from 'next/server';

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

interface CommentaryExample {
  category: string;
  actionType: string;
  scoreSituation: string;
  player: string;
  originalCommentary: string;
  betterCommentary: string;
  contextNotes: string;
  priority: string;
  status: string;
  usageCount: number;
}

export async function POST(request: NextRequest) {
  try {
    const { examples }: { examples: CommentaryExample[] } = await request.json();

    if (!examples || examples.length === 0) {
      return new Response(JSON.stringify({ error: 'No examples provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`📥 Importing ${examples.length} commentary examples...`);

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[],
    };

    for (const example of examples) {
      try {
        // Skip if no better commentary provided
        if (!example.betterCommentary || example.betterCommentary.trim() === '') {
          results.skipped++;
          results.details.push({
            category: example.category,
            status: 'skipped',
            reason: 'No better commentary provided',
          });
          continue;
        }

        // Skip if already added (status = ADDED or IN_RAG)
        if (example.status === 'ADDED' || example.status === 'IN_RAG') {
          results.skipped++;
          results.details.push({
            category: example.category,
            status: 'skipped',
            reason: 'Already in RAG',
          });
          continue;
        }

        // Build rich context for RAG
        const ragText = `
COMMENTARY EXAMPLE:
Category: ${example.category}
Action Type: ${example.actionType}
Score Situation: ${example.scoreSituation}
Player: ${example.player || 'Any'}
Context: ${example.contextNotes}
Priority: ${example.priority}

BETTER COMMENTARY:
"${example.betterCommentary}"

WHY THIS IS BETTER:
${example.contextNotes}

USAGE GUIDANCE:
- Use this style for similar ${example.actionType} situations
- Score context: ${example.scoreSituation}
- Avoid patterns from: "${example.originalCommentary || 'generic commentary'}"
- Usage count: ${example.usageCount || 0} (prefer unused examples for variety)
`;

        // Generate embedding
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-ada-002',  // ← 768 dims
          input: ragText,
        });

        // Generate unique ID
        const id = `commentary-example-${example.category.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Upsert to Pinecone (commentary-examples namespace)
        await index.namespace('commentary-examples').upsert([
          {
            id,
            values: embedding.data[0].embedding,
            metadata: {
              text: ragText,
              category: example.category,
              actionType: example.actionType,
              scoreSituation: example.scoreSituation,
              player: example.player || '',
              betterCommentary: example.betterCommentary,
              contextNotes: example.contextNotes,
              priority: example.priority,
              usageCount: example.usageCount || 0,
              addedAt: new Date().toISOString(),
            },
          },
        ]);

        results.success++;
        results.details.push({
          category: example.category,
          actionType: example.actionType,
          status: 'success',
          id,
        });

        console.log(`✅ Added: ${example.category} - ${example.actionType}`);
      } catch (error) {
        console.error(`❌ Failed to add example:`, error);
        results.failed++;
        results.details.push({
          category: example.category,
          status: 'failed',
          error: String(error),
        });
      }
    }

    console.log(`📊 Import complete: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`);

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

// GET endpoint to check current examples
export async function GET(request: NextRequest) {
  try {
    // Query all examples from commentary-examples namespace
    const stats = await index.namespace('commentary-examples').describeIndexStats();

    return new Response(JSON.stringify({
      message: 'Commentary examples stats',
      totalVectors: stats.namespaces?.['commentary-examples']?.vectorCount || 0,
      note: 'Use POST to add new examples',
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
