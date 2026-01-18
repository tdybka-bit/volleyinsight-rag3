import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { Redis } from '@upstash/redis';

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const index = pinecone.index('ed-volley');

const redis = Redis.fromEnv();

interface IdeaSubmission {
  idea: string;
  type: 'commentary' | 'feature';
  priority: 'high' | 'medium' | 'low';
}

export async function POST(request: NextRequest) {
  try {
    const { idea, type, priority }: IdeaSubmission = await request.json();

    if (!idea || !idea.trim()) {
      return new Response(JSON.stringify({ error: 'Idea is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (type !== 'commentary' && type !== 'feature') {
      return new Response(JSON.stringify({ error: 'Type must be commentary or feature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`📥 New ${type} submission:`, idea.substring(0, 100));

    // ========================================================================
    // COMMENTARY → Pinecone (RAG learns)
    // ========================================================================
    if (type === 'commentary') {
      try {
        // Generate embedding
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: idea,
          dimensions: 768,
        });

        // Generate unique ID
        const id = `commentary-hint-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Save to Pinecone
        await index.namespace('commentary-hints').upsert([
          {
            id,
            values: embedding.data[0].embedding,
            metadata: {
              text: idea,
              betterCommentary: idea, // This is what RAG reads
              category: 'user-submitted',
              priority: priority,
              source: 'idea-submit',
              addedAt: new Date().toISOString(),
            },
          },
        ]);

        console.log(`✅ Commentary hint added to Pinecone: ${id}`);

        return new Response(JSON.stringify({
          success: true,
          type: 'commentary',
          id,
          message: 'RAG learned! ✅ Hint added to Pinecone',
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('❌ Failed to add commentary hint:', error);
        return new Response(JSON.stringify({
          error: 'Failed to save commentary hint',
          details: String(error),
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // ========================================================================
    // FEATURE → Redis (VoC for manual review)
    // ========================================================================
    if (type === 'feature') {
      try {
        const ideaId = `idea-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const ideaData = {
          id: ideaId,
          idea: idea,
          type: 'feature',
          priority: priority,
          status: 'new',
          createdAt: new Date().toISOString(),
          page: '/idea-submit',
        };

        // Save to Redis
        await redis.set(`idea:${ideaId}`, JSON.stringify(ideaData));
        
        // Add to ideas list
        await redis.lpush('ideas:all', ideaId);

        console.log(`✅ Feature idea saved to Redis: ${ideaId}`);

        return new Response(JSON.stringify({
          success: true,
          type: 'feature',
          id: ideaId,
          message: 'Saved for manual review 📝',
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('❌ Failed to save feature idea:', error);
        return new Response(JSON.stringify({
          error: 'Failed to save feature idea',
          details: String(error),
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Should never reach here
    return new Response(JSON.stringify({ error: 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Submit idea API error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process idea',
      details: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}