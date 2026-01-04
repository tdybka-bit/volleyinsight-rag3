/**
 * ENHANCED Unified Chat API - PROFESSIONAL hierarchy with tactics priority
 * Fallback chain: Tactics → Expert → Stats → Web → Not Found
 * NOW WITH RE-RANKING! 🔥
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX_NAME || 'ed-volley';

// Vector store for expert content (fallback)
const { searchSimilar } = require('../../../lib/vectorStore');

// Unknown queries logger (for Tomek)
const unknownQueries: string[] = [];

/**
 * Classify query type - ENHANCED with TACTICS detection
 */
async function classifyQuery(message: string): Promise<'tactics' | 'stats' | 'hybrid' | 'general'> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Classify volleyball queries into 4 types:

1. "tactics" - Volleyball technique/tactics/strategy questions
   Examples:
   - "Co to commit block"
   - "Jak wykonać float serve"
   - "Zasady rotacji"
   - "Complex II w siatkówce"

2. "stats" - Pure numbers/statistics
   Examples:
   - "Ile punktów Smarzek"
   - "Top scorers"

3. "hybrid" - Player performance + tactics explanation
   Examples:
   - "Dlaczego Grozdanov skuteczny w bloku"
   - "Porównaj Leon i Kurek jako atakujących"

4. "general" - Other questions
   Examples:
   - "Zasady gry"
   - "Historia siatkówki"

Respond ONLY with one word: tactics, stats, hybrid, or general`
        },
        { role: 'user', content: message }
      ],
      temperature: 0.1,
      max_tokens: 10
    });

    const classification = response.choices[0].message.content?.trim().toLowerCase();
    
    if (classification === 'tactics') return 'tactics';
    if (classification === 'hybrid') return 'hybrid';
    if (classification === 'stats') return 'stats';
    return 'general';

  } catch (error) {
    console.error('Classification error:', error);
    return 'general';
  }
}

/**
 * Search TACTICS namespace with RE-RANKING (PRIORITY #1!)
 */
async function searchTactics(message: string, limit: number = 5) {
  try {
    console.log('🎯 Searching tactics namespace (PRIORITY!)...');
    
    // Create embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
      dimensions: 768
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Query Pinecone tactics namespace (v6 API - correct way!)
    const index = pinecone.index(indexName);
    
    // In v6, namespace is passed differently
    const queryResponse = await index.namespace('tactics').query({
      vector: queryEmbedding,
      topK: limit * 2,
      includeMetadata: true,
    });

    const matches = queryResponse.matches || [];
    console.log(`📚 Tactics search: found ${matches.length} raw results`);

    // RE-RANKING SYSTEM 🔥
    const reRanked = matches.map(match => {
      const metadata = match.metadata || {};
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
      
      // Tag relevance boost
      const tacticsTags = ['blok', 'atak', 'zagrywka', 'obrona', 'ustawienie'];
      const hasRelevantTag = tacticsTags.some(tag => 
        message.toLowerCase().includes(tag) && tags.includes(tag)
      );
      if (hasRelevantTag) {
        boost += 0.1;
      }
      
      const boostedScore = Math.min((match.score || 0) + boost, 1.0);
      
      return {
        content: metadata.text as string || '',
        score: boostedScore,
        originalScore: match.score || 0,
        boost,
        source: 'tactics',
        metadata: {
          topic: metadata.topic,
          section: metadata.section,
          tags: metadata.tags,
        }
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

    console.log(`✅ Tactics re-ranked: top score ${reRanked[0]?.score.toFixed(3) || 0}`);
    
    return reRanked;

  } catch (error) {
    console.error('Tactics search error:', error);
    return [];
  }
}

/**
 * Search stats using Pinecone (unchanged)
 */
async function searchStats(message: string, limit: number = 5) {
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
      dimensions: 768
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    const index = pinecone.index(indexName);
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: limit,
      includeMetadata: true
    });

    console.log(`📊 Stats search: found ${queryResponse.matches?.length || 0} results`);

    return queryResponse.matches?.map(match => ({
      content: match.metadata?.content || '',
      score: match.score || 0,
      source: 'stats',
      metadata: match.metadata
    })) || [];
  } catch (error) {
    console.error('Stats search error:', error);
    return [];
  }
}

/**
 * Search expert content (FALLBACK for tactics)
 */
async function searchExpertContent(message: string, limit: number = 5) {
  try {
    console.log('📖 Searching expert-knowledge (fallback)...');
    const results = await searchSimilar(message, limit);
    console.log(`📚 Expert search: found ${results?.length || 0} results`);

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
 * PROFESSIONAL HIERARCHY - Smart fallback chain
 */
async function smartSearch(message: string, queryType: string) {
  console.log(`🔍 Smart search for type: ${queryType}`);
  
  let allResults: any[] = [];
  
  if (queryType === 'tactics') {
    // 1. Try TACTICS first (PRIORITY!)
    const tacticsResults = await searchTactics(message, 5);
    
    if (tacticsResults.length > 0 && tacticsResults[0].score > 0.7) {
      console.log('✅ HIGH QUALITY tactics results - using them!');
      return { results: tacticsResults, source: 'tactics' };
    }
    
    // 2. Fallback to expert knowledge
    console.log('⚠️ Tactics score low, trying expert-knowledge...');
    const expertResults = await searchExpertContent(message, 3);
    allResults = [...tacticsResults, ...expertResults];
    
  } else if (queryType === 'hybrid') {
    // Parallel: tactics + stats
    console.log('🔥 HYBRID MODE - querying tactics + stats...');
    const [tacticsResults, statsResults] = await Promise.all([
      searchTactics(message, 3),
      searchStats(message, 3)
    ]);
    allResults = [...tacticsResults, ...statsResults];
    
  } else if (queryType === 'stats') {
    // Pure stats
    allResults = await searchStats(message, 5);
    
  } else {
    // General - try all sources
    console.log('🔍 General query - trying all sources...');
    const [tacticsResults, expertResults] = await Promise.all([
      searchTactics(message, 2),
      searchExpertContent(message, 3)
    ]);
    allResults = [...tacticsResults, ...expertResults];
  }
  
  // Sort by score
  allResults.sort((a, b) => b.score - a.score);
  
  return { 
    results: allResults.slice(0, 5),
    source: 'mixed'
  };
}

/**
 * Log unknown queries for Tomek
 */
function logUnknownQuery(message: string, context: any[]) {
  const bestScore = context[0]?.score || 0;
  
  if (bestScore < 0.5) {
    console.log(`⚠️ LOW QUALITY MATCH (${bestScore.toFixed(2)}) - logging for Tomek!`);
    unknownQueries.push(`[${new Date().toISOString()}] ${message} (score: ${bestScore.toFixed(2)})`);
    
    // TODO: Send to database/Slack/Email
    // For now, just console log
    console.log(`📝 Unknown queries logged: ${unknownQueries.length} total`);
  }
}

/**
 * Generate STREAMING response
 */
async function generateResponse(
  message: string,
  context: any[],
  queryType: string,
  history: any[] = []
) {
  const contextText = context
    .map((doc, i) => {
      const sourceTag = doc.source === 'tactics' ? '[TACTICS]' : 
                        doc.source === 'stats' ? '[STATS]' : '[EXPERT]';
      const scoreInfo = doc.boost ? ` (score: ${doc.score.toFixed(2)}, boost: +${doc.boost.toFixed(2)})` : '';
      return `${sourceTag}${scoreInfo}\n${doc.content}`;
    })
    .join('\n\n---\n\n');

  console.log(`📝 Context length: ${contextText.length} chars`);

  let systemPrompt = `Jesteś profesjonalnym ekspertem od siatkówki.

Masz dostęp do trzech źródeł wiedzy (w kolejności priorytetu):
1. [TACTICS] - Profesjonalna wiedza taktyczna i techniczna (NAJWYŻSZY PRIORYTET!)
2. [EXPERT] - Dodatkowa wiedza ekspercka
3. [STATS] - Statystyki graczy i meczów

ZAWSZE priorytetyzuj informacje z [TACTICS] gdy są dostępne!

Kontekst:
${contextText}

ZASADY:
- Odpowiadaj po polsku, zwięźle i konkretnie
- Używaj TYLKO informacji z kontekstu
- NIE wymyślaj liczb ani faktów
- Jeśli pytanie wykracza poza kontekst - powiedz wprost
- Zawsze bądź profesjonalny i merytoryczny`;

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message }
  ];

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    max_tokens: 1000,
    stream: true
  });

  return stream;
}

export async function POST(request: NextRequest) {
  try {
    const { message, history = [] } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    console.log('📨 ENHANCED Unified Chat:', message.substring(0, 50));

    // Step 1: Classify
    const queryType = await classifyQuery(message);
    console.log(`🎯 Query type: ${queryType}`);

    // Step 2: Smart search with hierarchy
    const { results: context, source } = await smartSearch(message, queryType);
    
    console.log(`📚 Found ${context.length} results from ${source}`);
    
    if (context.length > 0) {
      console.log(`   Top result: score ${context[0].score.toFixed(3)} from ${context[0].source}`);
    }

    // Step 3: Check if quality is good enough
    if (context.length === 0 || context[0].score < 0.4) {
      logUnknownQuery(message, context);
      
      return NextResponse.json({
        response: 'Przepraszam, nie znalazłem odpowiedzi na to pytanie w mojej bazie wiedzy. Zespół został powiadomiony o tej luce.',
        queryType,
        sources: [],
        lowQuality: true
      });
    }

    // Step 4: Log if quality is medium (for improvement)
    logUnknownQuery(message, context);

    // Step 5: Generate streaming response
    const stream = await generateResponse(message, context, queryType, history);

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send metadata first
          const metadata = {
            queryType,
            sources: context.slice(0, 3).map((doc, i) => ({
              id: i + 1,
              content: doc.content.substring(0, 150) + '...',
              score: doc.score,
              source: doc.source,
              boost: doc.boost
            }))
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ metadata })}\n\n`));

          // Stream response
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
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
    console.error('❌ Enhanced chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Export unknown queries for monitoring
export function getUnknownQueries() {
  return unknownQueries;
}