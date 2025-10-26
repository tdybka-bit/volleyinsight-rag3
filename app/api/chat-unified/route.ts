/**
 * Unified Chat API - intelligent routing between stats and expert content
 * Usage: POST /api/chat-unified with { message, history }
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX_NAME || 'ed-volley';

// Vector store for expert content
const { searchSimilar } = require('../../../lib/vectorStore');

/**
 * Classify query type using AI
 */
async function classifyQuery(message: string): Promise<'stats' | 'expert'> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Klasyfikuj pytania użytkownika jako:
- "stats" - pytania o statystyki, liczby, wyniki meczów, punkty graczy, porównania liczbowe
- "expert" - pytania o taktykę, technikę, treningi, analizy eksperckie, porady

Odpowiedz TYLKO słowem: stats lub expert`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.1,
      max_tokens: 10
    });

    const classification = response.choices[0].message.content?.trim().toLowerCase();
    return classification === 'stats' ? 'stats' : 'expert';
  } catch (error) {
    console.error('Classification error:', error);
    // Default to stats if classification fails
    return 'stats';
  }
}

/**
 * Search stats using Pinecone
 */
async function searchStats(message: string) {
  try {
    // Create embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
      dimensions: 768
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search Pinecone
    const index = pinecone.index(indexName);
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true
    });

    return queryResponse.matches?.map(match => ({
      content: match.metadata?.text || '',
      score: match.score || 0,
      source: 'stats'
    })) || [];
  } catch (error) {
    console.error('Stats search error:', error);
    return [];
  }
}

/**
 * Search expert content using vectorStore
 */
async function searchExpertContent(message: string) {
  try {
    const results = await searchSimilar(message, 5);
    return results.map((doc: any) => ({
      content: doc.pageContent || doc.text || '',
      score: doc.score || 0,
      source: 'expert'
    }));
  } catch (error) {
    console.error('Expert content search error:', error);
    return [];
  }
}

/**
 * Generate response using retrieved context
 */
async function generateResponse(
  message: string,
  context: any[],
  queryType: 'stats' | 'expert',
  history: any[] = []
) {
  const contextText = context
    .map((doc, i) => `[${i + 1}] ${doc.content}`)
    .join('\n\n');

  const systemPrompt = queryType === 'stats'
    ? `Jesteś ekspertem od statystyk siatkarskich. Odpowiadaj konkretnie, podając liczby i fakty.
Używaj kontekstu poniżej do odpowiedzi:

${contextText}

Odpowiadaj po polsku, zwięźle i konkretnie. Zawsze podawaj źródło danych jeśli jest dostępne.`
    : `Jesteś ekspertem od siatkówki - taktyki, techniki i treningów. 
Używaj kontekstu poniżej do odpowiedzi:

${contextText}

Odpowiadaj po polsku, merytorycznie i praktycznie. Odwoływuj się do kontekstu gdy to możliwe.`;

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message }
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    max_tokens: 1000
  });

  return response.choices[0].message.content;
}

export async function POST(request: NextRequest) {
  try {
    const { message, history = [] } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    console.log('📨 Unified Chat - New message:', message.substring(0, 50));

    // Step 1: Classify query
    const queryType = await classifyQuery(message);
    console.log(`🔍 Query classified as: ${queryType}`);

    // Step 2: Search appropriate source
    const context = queryType === 'stats'
      ? await searchStats(message)
      : await searchExpertContent(message);

    console.log(`📚 Found ${context.length} relevant documents`);

    if (context.length === 0) {
      return NextResponse.json({
        response: 'Przepraszam, nie znalazłem odpowiednich informacji w bazie danych.',
        queryType,
        sources: []
      });
    }

    // Step 3: Generate response
    const answer = await generateResponse(message, context, queryType, history);

    return NextResponse.json({
      response: answer,
      queryType,
      sources: context.slice(0, 3).map((doc, i) => ({
        id: i + 1,
        content: doc.content.substring(0, 200) + '...',
        score: doc.score,
        source: doc.source
      }))
    });

  } catch (error) {
    console.error('❌ Unified chat error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}