// app/api/chat/route.ts - EXTENDED VERSION
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

// Import existing vector store
import { searchSimilar } from '@/lib/vectorStore';

// Initialize clients
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

// NEW: Initialize Pinecone for tactics namespace
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});
const index = pc.index('ed-volley');

// NEW: Query Classification
async function classifyQuery(message: string, openai: OpenAI) {
  const systemPrompt = `Classify volleyball query into type:
- TACTICS: Pure tactics/technique (e.g. "Co to commit block?")
- PLAYER_STATS: Player statistics (e.g. "Ile punktów Grozdanov?")
- HYBRID: Tactics + player (e.g. "Dlaczego Grozdanov dobry w bloku?")
- GENERAL: Other questions

Respond JSON only: {"type": "TACTICS|PLAYER_STATS|HYBRID|GENERAL", "player_name": "name or null", "tactic_focus": "tactic or null"}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    return JSON.parse(response.choices[0].message.content || '{"type":"GENERAL"}');
  } catch (error) {
    console.error('Classification error:', error);
    return { type: 'GENERAL' };
  }
}

// NEW: Query tactics namespace with re-ranking
async function queryTacticsEnhanced(message: string, openai: OpenAI) {
  // Generate embedding
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: message,
    dimensions: 768,
  });
  const embedding = embeddingResponse.data[0].embedding;

  // NEW (v6 correct):
  const results = await index.query({
    queryRequest: {
      vector: embedding,
      topK: 10,
      includeMetadata: true,
      namespace: 'tactics',
    }
  });

  // Re-rank results
  const reRanked = (results.matches || []).map((result) => {
    const metadata = result.metadata || {};
    const tags = (metadata.tags as string || '').split(',');
    const section = metadata.section as string || '';

    let boost = 0;

    // Definition boost
    if (tags.includes('definicja') || section.includes('Definicja')) {
      boost += 0.2;
    }

    // Core concept boost
    if (section.includes('Główne koncepty') || section.includes('Techniki')) {
      boost += 0.1;
    }

    const boostedScore = Math.min((result.score || 0) + boost, 1.0);

    return {
      ...result,
      boostedScore,
    };
  }).sort((a, b) => b.boostedScore - a.boostedScore);

  return reRanked.slice(0, 3);
}

// NEW: Hybrid query (tactics + stats)
async function queryHybrid(
  message: string,
  playerName: string,
  tacticFocus: string,
  openai: OpenAI
) {
  // Query tactics
  const tacticsResults = await queryTacticsEnhanced(tacticFocus || message, openai);

  // Query player stats (use existing searchSimilar)
  const statsResults = await searchSimilar(`${playerName} statistics`, 3);

  return {
    tactics: tacticsResults,
    stats: statsResults,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Brak wiadomości' },
        { status: 400 }
      );
    }

    const openai = getOpenAI();

    // NEW: Classify query to determine routing
    const classification = await classifyQuery(message, openai);
    const queryType = classification.type;

    console.log(`Query type: ${queryType}`, classification);

    // Prepare RAG context based on query type
    let ragContext = '';
    let useGPT4o = false;

    if (queryType === 'TACTICS') {
      // Pure tactics - use tactics namespace
      try {
        const tacticsResults = await queryTacticsEnhanced(message, openai);
        if (tacticsResults && tacticsResults.length > 0) {
          ragContext = tacticsResults
            .map((doc: any) => {
              const meta = doc.metadata || {};
              return `[TACTICS - ${meta.topic}/${meta.section}]\n${meta.text || ''}`;
            })
            .join('\n\n');
        }
      } catch (error) {
        console.error('Tactics query error:', error);
      }
    } else if (queryType === 'HYBRID') {
      // Hybrid - use both tactics and stats
      useGPT4o = true; // Use better model for synthesis
      const playerName = classification.player_name || '';
      const tacticFocus = classification.tactic_focus || '';

      try {
        const hybridResults = await queryHybrid(message, playerName, tacticFocus, openai);

        // Tactics context
        const tacticsContext = hybridResults.tactics
          .map((doc: any) => {
            const meta = doc.metadata || {};
            return `[TACTICS - ${meta.topic}/${meta.section}]\n${meta.text || ''}`;
          })
          .join('\n\n');

        // Stats context
        const statsContext = hybridResults.stats
          .map((doc: any) => `[STATS] ${doc.content}`)
          .join('\n\n');

        ragContext = `=== TACTICAL KNOWLEDGE ===\n${tacticsContext}\n\n=== PLAYER STATISTICS ===\n${statsContext}`;
      } catch (error) {
        console.error('Hybrid query error:', error);
      }
    } else {
      // GENERAL or PLAYER_STATS - use existing searchSimilar
      try {
        const similarDocs = await searchSimilar(message, 3);
        if (similarDocs && similarDocs.length > 0) {
          ragContext = similarDocs
            .map((doc: any) => `[${doc.metadata.type}] ${doc.content}`)
            .join('\n\n');
        }
      } catch (ragError) {
        console.error('RAG search error:', ragError);
      }
    }

    // System prompt based on context
    let systemPrompt = `Jesteś ekspertem od siatkówki i pomocnym asystentem AI dla aplikacji VolleyLive AI.`;

    if (context === 'live-match') {
      systemPrompt += `\n\nOdpowiadasz na pytania użytkownika który ogląda mecz NA ŻYWO.
Twoje odpowiedzi powinny być:
- KRÓTKIE i zwięzłe (2-4 zdania max)
- Napisane prostym językiem
- Z emoji dla lepszej czytelności 🏐
- Skoncentrowane na konkretnej akcji z meczu
- Praktyczne i przydatne podczas oglądania`;
    } else {
      systemPrompt += `\n\nTwoje odpowiedzi powinny być rzeczowe, pomocne i oparte na faktach.`;
    }

    // Add RAG context
    if (ragContext) {
      systemPrompt += `\n\nMasz dostęp do następującej wiedzy:\n${ragContext}`;

      // Special instructions for HYBRID queries
      if (queryType === 'HYBRID') {
        systemPrompt += `\n\n🎯 HYBRID QUERY - Połącz teorię taktyczną ze statystykami gracza:
1. Wyjaśnij technikę/taktykę (czym jest, jak działa)
2. Podaj konkretne statystyki gracza
3. Połącz: dlaczego ten gracz jest (nie)skuteczny w tej taktyce
4. Używaj TYLKO danych ze źródeł powyżej`;
      }

      systemPrompt += `\n\n🎯 KRYTYCZNE ZASADY:
1. Używaj TYLKO liczb ze źródeł - ZERO halucynacji!
2. Jeśli brak danych - powiedz "nie mam tych danych"
3. ZAWSZE podawaj ligę i sezon przy statystykach`;
    }

    // Choose model based on query complexity
    const model = useGPT4o ? 'gpt-4o' : 'gpt-4o-mini';
    const maxTokens = context === 'live-match' ? 200 : (useGPT4o ? 800 : 500);

    console.log(`Using model: ${model}, maxTokens: ${maxTokens}`);

    // Call OpenAI with STREAMING
    const stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      stream: true
    });

    // Create streaming response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              const data = JSON.stringify({
                content,
                ragUsed: !!ragContext,
                queryType,
                model,
                context: context || 'general'
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: 'Błąd podczas przetwarzania zapytania',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}