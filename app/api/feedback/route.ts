import { NextResponse } from 'next/server';
import Redis from 'ioredis';

// Initialize Redis client
const redis = process.env.KV_REDIS_URL 
  ? new Redis(process.env.KV_REDIS_URL)
  : null;

// Mock KV for local development (when no Redis URL)
const mockKV = {
  set: async (key: string, value: any) => {
    console.log('📝 [LOCAL] Saving to KV:', key, value);
    return value;
  },
  get: async (key: string) => {
    console.log('📖 [LOCAL] Reading from KV:', key);
    return null;
  },
  lpush: async (key: string, ...values: any[]) => {
    console.log('📝 [LOCAL] Adding to list:', key, values);
    return 1;
  },
  lrange: async (key: string, start: number, end: number) => {
    console.log('📖 [LOCAL] Reading list:', key);
    return [];
  }
};

// Storage adapter
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
      status: 'new',
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

// PATCH - Update feedback status
export async function PATCH(request: Request) {
  try {
    const { feedbackId, status } = await request.json();

    if (!feedbackId || !status) {
      return NextResponse.json(
        { error: 'Missing feedbackId or status' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['new', 'reviewed', 'implemented'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: new, reviewed, or implemented' },
        { status: 400 }
      );
    }

    // Get existing feedback
    const existingFeedback = await storage.get(feedbackId);
    
    if (!existingFeedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      );
    }

    // Update status
    const updatedFeedback = {
      ...existingFeedback,
      status,
      updatedAt: new Date().toISOString()
    };

    // Save back
    await storage.set(feedbackId, updatedFeedback);

    console.log(`✅ Feedback status updated: ${feedbackId} → ${status}`);

    return NextResponse.json({
      success: true,
      feedbackId,
      status,
      message: 'Status updated successfully'
    });

  } catch (error: any) {
    console.error('❌ Error updating feedback status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update status' },
      { status: 500 }
    );
  }
}