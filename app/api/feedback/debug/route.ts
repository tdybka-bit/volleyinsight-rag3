import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get all feedback IDs
    const allIds = await kv.lrange('feedbacks:all', 0, -1);
    
    // Get all keys starting with feedback:
    const keys = await kv.keys('feedback:*');
    
    // Get first 3 feedbacks as samples
    const samples = await Promise.all(
      allIds.slice(0, 3).map(async (id) => {
        return await kv.get(id);
      })
    );

    return NextResponse.json({
      total_ids_in_list: allIds.length,
      total_keys: keys.length,
      feedback_ids: allIds,
      sample_feedbacks: samples
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}