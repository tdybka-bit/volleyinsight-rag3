import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasPinecone: !!process.env.PINECONE_API_KEY,
    openaiPrefix: process.env.OPENAI_API_KEY?.substring(0, 7) || 'MISSING',
    timestamp: new Date().toISOString()
  });
}
