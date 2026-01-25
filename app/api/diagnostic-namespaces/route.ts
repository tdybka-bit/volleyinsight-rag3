// app/api/diagnostic-namespaces/route.ts
// Temporary endpoint to check what's in each namespace

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const namespace = searchParams.get('namespace') || '__default__';
    const query = searchParams.get('query') || 'Grozdanov charakterystyka';

    console.log(`🔍 Checking namespace: ${namespace}, query: ${query}`);

    // Generate embedding for query
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      dimensions: 768,
    });

    // Query the namespace
    const results = await index.namespace(namespace).query({
      vector: embedding.data[0].embedding,
      topK: 5,
      includeMetadata: true,
    });

    // Format results
    const formatted = results.matches.map((match, idx) => ({
      rank: idx + 1,
      score: match.score?.toFixed(3),
      id: match.id,
      metadata: match.metadata,
    }));

    console.log(`✅ Found ${results.matches.length} results in ${namespace}`);

    return new Response(JSON.stringify({
      namespace,
      query,
      totalResults: results.matches.length,
      results: formatted,
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    return new Response(JSON.stringify({ 
      error: String(error),
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}