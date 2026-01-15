// app/api/feedback/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { saveFeedback, Feedback } from '@/lib/redis';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const { 
      matchId, 
      rallyNumber, 
      setNumber,
      rating, 
      userNickname, 
      originalCommentary,
      userSuggestion,
      userComment 
    } = body;
    
    // Validation
    if (!matchId || !rallyNumber || !setNumber || !rating || !userNickname || !originalCommentary) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }
    
    // For ratings 1-3, userSuggestion should be present
    if (rating <= 3 && !userSuggestion) {
      return NextResponse.json(
        { error: 'Suggestion is required for ratings 1-3' },
        { status: 400 }
      );
    }
    
    // Create feedback object
    const feedback: Feedback = {
      id: nanoid(),
      matchId,
      rallyNumber,
      setNumber,
      rating,
      userNickname: userNickname.trim(),
      originalCommentary,
      userSuggestion: userSuggestion?.trim() || undefined,
      userComment: userComment?.trim() || undefined,
      timestamp: new Date().toISOString(),
    };
    
    // Save to Redis
    await saveFeedback(feedback);
    
    return NextResponse.json(
      { 
        success: true, 
        feedbackId: feedback.id,
        message: 'Feedback saved successfully' 
      },
      { status: 201 }
    );
    
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}
