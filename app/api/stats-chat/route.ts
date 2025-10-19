/**
 * API Route: /api/stats-chat
 * RAG Chatbot dla statystyk siatkarskich
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX_NAME || 'ed-volley';

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Stwórz embedding dla pytania użytkownika
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
      dimensions: 768
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 2. Wyszukaj relevantne dane w Pinecone
    const index = pinecone.index(indexName);
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 10,
      includeMetadata: true
    });

    // 3. Przygotuj kontekst z wyników
    const context = queryResponse.matches
      .map(match => {
        const meta = match.metadata as any;
        return `${meta.name} (${meta.league} ${meta.season}, ${meta.team}): ${meta.text}`;
      })
      .join('\n\n---\n\n');

    // 4. Stwórz system prompt
    const systemPrompt = `Jesteś ekspertem od statystyk siatkówki w Polsce. 
Odpowiadasz na pytania na podstawie danych z PlusLigi (mężczyźni) i Tauron Ligi (kobiety) z sezonów 2022-2025.

Dane które masz dostępne:
${context}

Zasady odpowiedzi:
- Odpowiadaj TYLKO na podstawie dostarczonych danych
- Jeśli nie masz informacji, powiedz to wprost
- Podawaj konkretne liczby i statystyki
- Możesz porównywać graczy/sezony
- Odpowiadaj po polsku
- Bądź zwięzły ale konkretny
- Jeśli dane są z różnych sezonów, wyraźnie to zaznacz`;

    // 5. Wywołaj GPT z historią i kontekstem
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []),
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.3,
      max_tokens: 1000
    });

    const assistantMessage = completion.choices[0].message.content;

    // 6. Zwróć odpowiedź + źródła
    const sources = queryResponse.matches.slice(0, 3).map(match => {
      const meta = match.metadata as any;
      return {
        name: meta.name,
        league: meta.league,
        season: meta.season,
        team: meta.team,
        score: match.score
      };
    });

    return NextResponse.json({
      message: assistantMessage,
      sources: sources
    });

  } catch (error: any) {
    console.error('Stats chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat', details: error.message },
      { status: 500 }
    );
  }
}