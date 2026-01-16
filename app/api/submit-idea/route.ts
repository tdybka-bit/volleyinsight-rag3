import { NextResponse } from 'next/server';
import Redis from 'ioredis';

const redis = process.env.KV_REDIS_URL 
  ? new Redis(process.env.KV_REDIS_URL)
  : null;

// Mock KV for local
const mockKV = {
  set: async (key: string, value: any) => {
    console.log('📝 [LOCAL] Saving:', key);
    return value;
  },
  get: async (key: string) => {
    console.log('📖 [LOCAL] Reading:', key);
    return null;
  },
  lpush: async (key: string, ...values: any[]) => {
    console.log('📝 [LOCAL] List add:', key);
    return 1;
  },
  lrange: async (key: string, start: number, end: number) => {
    console.log('📖 [LOCAL] List read:', key);
    return [];
  }
};

const storage = redis ? {
  set: async (key: string, value: any) => {
    return await redis.set(key, JSON.stringify(value));
  },
  get: async (key: string) => {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },
  lpush: async (key: string, ...values: any[]) => {
    return await redis.lpush(key, ...values);
  },
  lrange: async (key: string, start: number, end: number) => {
    return await redis.lrange(key, start, end);
  }
} : mockKV;

// Gemini API classification
async function classifyIdeaWithGemini(idea: string, priority: string) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const prompt = `You are a Product Manager for VolleyInsight volleyball analytics platform.

Classify this user idea into ONE of these types:
- commentary_training (better AI commentary - no code needed)
- feature_request (new functionality - requires code)
- bug_fix (something broken - requires fix)
- ui_ux_improvement (visual/UX changes)

User idea: "${idea}"
Priority: ${priority}

Respond ONLY with valid JSON in this format:
{
  "type": "commentary_training | feature_request | bug_fix | ui_ux_improvement",
  "title": "Short descriptive title",
  "description": "Brief explanation",
  "category": "serve | attack | block | stats | ui | other"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from response (remove markdown if present)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error: any) {
    console.error('Gemini classification error:', error);
    // Fallback to simple classification
    return {
      type: 'feature_request',
      title: idea.substring(0, 50) + '...',
      description: idea,
      category: 'other'
    };
  }
}

export async function POST(request: Request) {
  try {
    const { idea, priority } = await request.json();

    if (!idea || !idea.trim()) {
      return NextResponse.json(
        { error: 'Idea is required' },
        { status: 400 }
      );
    }

    // Classify with Gemini
    const classification = await classifyIdeaWithGemini(idea, priority);

    // Generate unique ID
    const timestamp = Date.now();
    const type_prefix = 
      classification.type === 'commentary_training' ? 'CT' :
      classification.type === 'feature_request' ? 'F' :
      classification.type === 'bug_fix' ? 'B' :
      'UI';
    
    const id = `${type_prefix}-${timestamp}`;

    // Prepare data to save
    const ideaData = {
      id,
      idea: idea.trim(),
      priority,
      classification,
      status: 'new',
      created_at: new Date().toISOString(),
      created_by: 'web_form'
    };

    // Save to Vercel KV
    await storage.set(`idea:${id}`, ideaData);
    
    // Also add to a list for easy retrieval
    await storage.lpush('ideas:all', id);

    // If commentary training, could auto-add to RAG here
    // if (classification.type === 'commentary_training') {
    //   await addToCommentaryRAG(ideaData);
    // }

    return NextResponse.json({
      success: true,
      id,
      classification,
      message: 'Idea saved successfully'
    });

  } catch (error: any) {
    console.error('Error submitting idea:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit idea' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve ideas
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type'); // filter by type
    const status = searchParams.get('status'); // filter by status

    // Get all idea IDs
    const ideaIds = await storage.lrange('ideas:all', 0, limit - 1);
    
    // Fetch all ideas
    const ideas = await Promise.all(
      ideaIds.map(async (id) => {
        const idea = await storage.get(`idea:${id}`);
        return idea;
      })
    );

    // Filter if needed
    let filteredIdeas = ideas.filter(Boolean);
    
    if (type) {
      filteredIdeas = filteredIdeas.filter(
        (idea: any) => idea.classification?.type === type
      );
    }
    
    if (status) {
      filteredIdeas = filteredIdeas.filter(
        (idea: any) => idea.status === status
      );
    }

    return NextResponse.json({
      ideas: filteredIdeas,
      total: filteredIdeas.length
    });

  } catch (error: any) {
    console.error('Error fetching ideas:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch ideas' },
      { status: 500 }
    );
  }
}
