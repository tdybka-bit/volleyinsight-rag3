// app/api/feedback/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { 
  getAllFeedback, 
  getFeedbackByMatch, 
  getFeedbackByRating,
  getFeedbackStats 
} from '@/lib/redis';

// Simple password protection for admin
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'volleyinsight2026';

export async function GET(request: NextRequest) {
  try {
    // Check admin password in header
    const password = request.headers.get('x-admin-password');
    
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get query params
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');
    const rating = searchParams.get('rating');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const statsOnly = searchParams.get('stats') === 'true';
    
    // Return stats only
    if (statsOnly) {
      const stats = await getFeedbackStats();
      return NextResponse.json({ stats });
    }
    
    // Filter by match
    if (matchId) {
      const feedback = await getFeedbackByMatch(matchId);
      return NextResponse.json({ 
        feedback,
        total: feedback.length 
      });
    }
    
    // Filter by rating
    if (rating) {
      const ratingNum = parseInt(rating) as 1 | 2 | 3 | 4 | 5;
      if (ratingNum < 1 || ratingNum > 5) {
        return NextResponse.json(
          { error: 'Invalid rating' },
          { status: 400 }
        );
      }
      const feedback = await getFeedbackByRating(ratingNum);
      return NextResponse.json({ 
        feedback,
        total: feedback.length 
      });
    }
    
    // Get all feedback with pagination
    const feedback = await getAllFeedback(limit, offset);
    const stats = await getFeedbackStats();
    
    return NextResponse.json({ 
      feedback,
      total: stats.total,
      limit,
      offset,
      stats
    });
    
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}
