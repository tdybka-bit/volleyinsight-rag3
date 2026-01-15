import { kv } from '@vercel/kv';
import { createClient } from '@vercel/kv';

// Fallback to REDIS_URL if KV env vars not available
const kv = process.env.KV_REDIS_URL 
  ? createClient({ url: process.env.KV_REDIS_URL })
  : (await import('@vercel/kv')).kv;
import { NextResponse } from 'next/server';

// Mock KV for local development
const isLocal = !process.env.KV_REST_API_URL;
const mockKV = {
  set: async (key: string, value: any) => {
    console.log('📝 [LOCAL] Saving to KV:', key, value);
    return value;
  },
  get: async (key: string) => {
    console.log('📖 [LOCAL] Reading from KV:', key);
    return null;
  },
  lpush: async (key: string, value: any) => {
    console.log('📝 [LOCAL] Adding to list:', key, value);
    return 1;
  },
  lrange: async (key: string, start: number, end: number) => {
    console.log('📖 [LOCAL] Reading list:', key);
    return [];
  }
};

const storage = isLocal ? mockKV : kv;

// POST - Submit feedback
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      matchId,
      rallyNumber,
      setNumber,
      commentary,
      rating,
      suggestion,
      timestamp
    } = body;

    // Validate
    if (!matchId || !rallyNumber || !rating) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate unique ID
    const feedbackId = `feedback:${matchId}:${rallyNumber}:${Date.now()}`;

    // Prepare feedback data
    const feedbackData = {
      id: feedbackId,
      matchId,
      rallyNumber,
      setNumber,
      commentary,
      rating,
      suggestion: suggestion || '',
      timestamp: timestamp || new Date().toISOString()
    };

    // Save to KV
    await storage.set(feedbackId, feedbackData);
    
    // Add to list for easy retrieval
    await storage.lpush('feedbacks:all', feedbackId);

    console.log('✅ Feedback saved:', feedbackId);

    return NextResponse.json({
      success: true,
      feedbackId,
      message: 'Feedback saved successfully'
    });

  } catch (error: any) {
    console.error('❌ Error saving feedback:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save feedback' },
      { status: 500 }
    );
  }
}

// GET - Retrieve feedbacks
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const matchId = searchParams.get('matchId');

    // Get all feedback IDs
    const feedbackIds = await storage.lrange('feedbacks:all', 0, limit - 1);
    
    // Fetch all feedbacks
    const feedbacks = await Promise.all(
      feedbackIds.map(async (id) => {
        const feedback = await storage.get(id);
        return feedback;
      })
    );

    // Filter nulls and optionally by matchId
    let filteredFeedbacks = feedbacks.filter(Boolean);
    
    if (matchId) {
      filteredFeedbacks = filteredFeedbacks.filter(
        (fb: any) => fb.matchId === matchId
      );
    }

    return NextResponse.json({
      feedbacks: filteredFeedbacks,
      total: filteredFeedbacks.length
    });

  } catch (error: any) {
    console.error('❌ Error fetching feedbacks:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch feedbacks' },
      { status: 500 }
    );
  }
}