// app/api/chat-hybrid/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

interface QueryClassification {
  type: 'rag' | 'compute' | 'hybrid';
  confidence: number;
  reasoning: string;
}

// Query Classifier
async function classifyQuery(question: string): Promise<QueryClassification> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a query classifier for a volleyball analytics system.

Classify queries into 3 types:
1. "rag" - Questions about rules, techniques, expert knowledge, theory
2. "compute" - Questions about statistics, rankings, player performance data  
3. "hybrid" - Questions combining theory with current stats

Respond with JSON only: {"type": "rag"|"compute"|"hybrid", "confidence": 0.0-1.0, "reasoning": "brief"}`
      },
      { role: 'user', content: question }
    ],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  
  return JSON.parse(completion.choices[0].message.content!);
}

// RAG Search
async function searchExpertKnowledge(question: string, topK = 3) {
  const index = pc.index(process.env.PINECONE_INDEX_NAME!);
  
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question,
    dimensions: 768
  });
  
  const results = await index.namespace('expert-knowledge').query({
    vector: embeddingResponse.data[0].embedding,
    topK,
    includeMetadata: true
  });
  
  return results.matches.map(m => ({
    content: m.metadata?.content as string,
    topic: m.metadata?.topic as string,
    score: m.score
  }));
}

// Compute Layer (simplified - load from JSON)
async function computePlayerStats() {
  // For now, return mock data
  // TODO: Integrate with actual compute-layer.js
  return {
    topServers: [
      { name: "Karol Butryn", team: "Asseco Resovia", aces: 476, acesPerSet: "0.4555" },
      { name: "Mateusz Bieniek", team: "Aluron CMC", aces: 444, acesPerSet: "0.3685" },
      { name: "Bartosz Kwolek", team: "Aluron CMC", aces: 417, acesPerSet: "0.408" }
    ]
  };
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 });
    }
    
    // 1. Classify query
    console.log('🎯 Classifying query...');
    const classification = await classifyQuery(message);
    console.log(`   Type: ${classification.type} (${(classification.confidence * 100).toFixed(0)}%)`);
    
    let expertContext = '';
    let statsContext = '';
    
    // 2. RAG (if needed)
    if (classification.type === 'rag' || classification.type === 'hybrid') {
      console.log('📚 Searching expert knowledge...');
      const expertResults = await searchExpertKnowledge(message);
      expertContext = expertResults
        .map(r => r.content)
        .join('\n\n');
      console.log(`   Found ${expertResults.length} chunks`);
    }
    
    // 3. Compute (if needed)
    if (classification.type === 'compute' || classification.type === 'hybrid') {
      console.log('💻 Computing stats...');
      const stats = await computePlayerStats();
      statsContext = stats.topServers
        .map((p, i) => `${i + 1}. ${p.name} (${p.team}): ${p.aces} aces, ${p.acesPerSet}/set`)
        .join('\n');
      console.log(`   Loaded stats`);
    }
    
    // 4. LLM Synthesis
    console.log('🤖 Generating answer...');
    
    const systemPrompt = classification.type === 'rag' 
      ? 'Jesteś ekspertem siatkówki. Odpowiadaj używając wiedzy eksperckiej i zasad.'
      : classification.type === 'compute'
      ? 'Jesteś analitykiem statystyk siatkówki. Odpowiadaj używając aktualnych danych graczy.'
      : 'Jesteś analitykiem siatkówki. Łącz wiedzę ekspercką z aktualnymi statystykami.';
    
    let userPrompt = `Pytanie: ${message}\n\n`;
    
    if (expertContext) {
      userPrompt += `WIEDZA EKSPERCKA:\n${expertContext}\n\n`;
    }
    
    if (statsContext) {
      userPrompt += `AKTUALNE STATYSTYKI (2025-2026):\n${statsContext}\n\n`;
    }
    
    userPrompt += 'Udziel wyczerpującej odpowiedzi po polsku.';
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    const response = completion.choices[0].message.content;
    
    return NextResponse.json({
      response,
      classification: {
        type: classification.type,
        confidence: classification.confidence
      },
      sources: {
        expertChunks: classification.type !== 'compute' ? expertContext.length > 0 : undefined,
        playerStats: classification.type !== 'rag'
      }
    });
    
  } catch (error) {
    console.error('Chat-hybrid API error:', error);
    return NextResponse.json(
      { 
        error: 'Błąd podczas przetwarzania',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}