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

export async function POST(request: NextRequest) {
  try {
    const { setNumber, finalScore, recentRallies, language } = await request.json();
    
    // Create embedding for set summary query
    const queryText = `podsumowanie seta ${setNumber} wynik ${finalScore.aluron}:${finalScore.bogdanka} kluczowe momenty`;
    
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText,
    });
    
    const embedding = embeddingResponse.data[0].embedding;
    
    // Query set-summaries namespace
    const results = await index.namespace('set-summaries').query({
      vector: embedding,
      topK: 5,
      includeMetadata: true,
    });
    
    const context = results.matches
      .filter(match => match.score && match.score > 0.7)
      .map(match => match.metadata?.text || '')
      .join('\n\n');
    
    // Generate set summary
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Jesteś ekspertem od analizy meczów siatkarskich. Wygeneruj krótkie podsumowanie seta w języku: ${language}.`
        },
        {
          role: 'user',
          content: `
SET ${setNumber} ZAKOŃCZONY
Wynik końcowy: ${finalScore.aluron}:${finalScore.bogdanka}

${context ? `STRATEGICZNE INSIGHTS:\n${context}\n\n` : ''}

Napisz 2-3 zdaniowe podsumowanie seta:
- Kto wygrał i jakim wynikiem
- Kluczowe momenty/serie punktowe
- Które akcje zadecydowały o wyniku

Bądź konkretny i profesjonalny.`
        }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });
    
    const summary = completion.choices[0].message.content || '';
    
    return new Response(JSON.stringify({ summary }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
    
  } catch (error) {
    console.error('❌ Set summary error:', error);
    return new Response(JSON.stringify({ summary: 'Błąd generowania podsumowania' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
