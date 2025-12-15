/**
 * Unified Chat API - intelligent routing between stats and expert content
 * NOW WITH HYBRID SUPPORT! 🔥
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
 * Classify query type using AI - NOW WITH HYBRID! 🎯
 */
async function classifyQuery(message: string): Promise<'stats' | 'expert' | 'hybrid'> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Classify volleyball queries into 3 types:

1. "stats" - Pure numbers/statistics request
   Examples: 
   - "Pokaż statystyki Smarzek"
   - "Ile punktów zdobył Leon"
   - "Top scorers w lidze"

2. "expert" - Pure knowledge/technique/tactics
   Examples:
   - "Co to rotacja 1"
   - "Jak poprawić timing ataku"
   - "Zasady gry w siatkówce"

3. "hybrid" - Requires BOTH stats AND explanation
   Examples:
   - "Dlaczego Smarzek lepsza w playoff"
   - "Porównaj Leon i Kurek jako atakujących"
   - "Który zespół ma najlepszy blok i dlaczego"
   - "Wyjaśnij skuteczność Efimienko w tym sezonie"

Respond ONLY with one word: stats, expert, or hybrid`
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
    
    if (classification === 'hybrid') return 'hybrid';
    if (classification === 'stats') return 'stats';
    return 'expert';
    
  } catch (error) {
    console.error('Classification error:', error);
    return 'expert'; // Safe fallback
  }
}

/**
 * Search stats using Pinecone
 */
async function searchStats(message: string, limit: number = 5) {
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
      topK: limit,
      includeMetadata: true
    });

    console.log(`🔍 Stats search: found ${queryResponse.matches?.length || 0} results`);

    return queryResponse.matches?.map(match => ({
      content: match.metadata?.content || '',
      score: match.score || 0,
      source: 'stats',
      metadata: {
        filename: match.metadata?.filename,
        type: match.metadata?.type,
        originalFile: match.metadata?.originalFile
      }
    })) || [];
  } catch (error) {
    console.error('Stats search error:', error);
    return [];
  }
}

/**
 * Search expert content using vectorStore
 */
async function searchExpertContent(message: string, limit: number = 5) {
  try {
    const results = await searchSimilar(message, limit);
    console.log(`🎓 Expert search: found ${results?.length || 0} results`);
    
    return results.map((doc: any) => ({
      content: doc.content || doc.pageContent || doc.text || '',
      score: doc.score || doc.similarity || 0,
      source: 'expert',
      metadata: doc.metadata || {}
    }));
  } catch (error) {
    console.error('Expert content search error:', error);
    return [];
  }
}

/**
 * Generate response using retrieved context - NOW WITH HYBRID! 🔥
 */
async function generateResponse(
  message: string,
  context: any[],
  queryType: 'stats' | 'expert' | 'hybrid',
  history: any[] = []
) {
  const contextText = context
    .map((doc, i) => {
      const sourceTag = doc.source === 'stats' ? '[STATS]' : '[EXPERT]';
      return `${sourceTag} [${i + 1}] ${doc.content}`;
    })
    .join('\n\n');

  console.log(`📝 Context length: ${contextText.length} chars`);
  console.log(`📝 Query type: ${queryType}`);

  let systemPrompt;

  if (queryType === 'hybrid') {
    // 🔥 HYBRID MODE - Best of both worlds!
    systemPrompt = `Jesteś ekspertem od siatkówki z dostępem do dwóch źródeł:
- STATYSTYK graczy i meczów (oznaczone [STATS])
- WIEDZY EKSPERCKIEJ o taktyce, technice i treningach (oznaczone [EXPERT])

Odpowiadając na pytania wymagające obu źródeł ZAWSZE:
1. Zacznij od KONKRETNYCH LICZB ze statystyk [STATS]
2. Następnie WYJAŚNIJ "dlaczego" używając wiedzy eksperckiej [EXPERT]
3. POŁĄCZ oba źródła w spójną, naturalną odpowiedź
4. NIE oznaczaj źródeł w odpowiedzi (user ich nie widzi)

⚠️ KRYTYCZNE - ZERO HALLUCINATION:
- Używaj TYLKO liczb które widzisz w kontekście [STATS]
- Jeśli NIE MA breakdown (np. playoff vs regular), POWIEDZ TO wprost
- NIE wymyślaj statystyk których nie ma w danych
- Lepiej powiedzieć "nie mam oddzielnych danych" niż zgadywać

Przykład gdy BRAK breakdown:
"Malwina Smarzek ma 36.41% skuteczności ataku w sezonie 2024-2025. 
Nie mam oddzielnych statystyk dla playoff vs sezonu regularnego, ale 
zawodnicy z doświadczeniem międzynarodowym zazwyczaj prezentują lepszą 
formę w kluczowych meczach ze względu na..."

Kontekst (używaj OBA źródła!):
${contextText}

Odpowiadaj po polsku, zwięźle i konkretnie. NIGDY nie wymyślaj liczb.`;

  } else if (queryType === 'stats') {
    systemPrompt = `Jesteś ekspertem od statystyk siatkarskich. Odpowiadaj konkretnie, podając liczby i fakty.
Używaj kontekstu poniżej do odpowiedzi:

${contextText}

Odpowiadaj po polsku, zwięźle i konkretnie. Zawsze podawaj źródło danych jeśli jest dostępne.`;

  } else {
    // expert
    systemPrompt = `Jesteś ekspertem od siatkówki - taktyki, techniki i treningów. 
Używaj kontekstu poniżej do odpowiedzi:

${contextText}

Odpowiadaj po polsku, merytorycznie i praktycznie. Odwoływaj się do kontekstu gdy to możliwe.`;
  }

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

    // Step 1: Classify query (now returns: stats | expert | hybrid)
    const queryType = await classifyQuery(message);
    console.log(`🔍 Query classified as: ${queryType}`);

    // Step 2: Search appropriate source(s)
    let context: any[] = [];

    if (queryType === 'hybrid') {
      // 🔥 HYBRID MODE - Query BOTH sources!
      console.log('🔥 HYBRID MODE - Querying both stats and expert...');
      
      const [statsResults, expertResults] = await Promise.all([
        searchStats(message, 3),           // Top 3 stats
        searchExpertContent(message, 2)    // Top 2 expert
      ]);

      // Combine results
      context = [
        ...statsResults,
        ...expertResults
      ];

      console.log(`✅ Hybrid results: ${statsResults.length} stats + ${expertResults.length} expert = ${context.length} total`);

    } else if (queryType === 'stats') {
      context = await searchStats(message, 5);
      
    } else {
      // expert
      context = await searchExpertContent(message, 5);
    }

    console.log(`📚 Found ${context.length} relevant documents`);

    if (context.length > 0) {
      console.log(`📝 First doc content length: ${context[0]?.content?.length || 0}`);
      console.log(`📝 First doc source: ${context[0]?.source}`);
    }

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