// scripts/test-full-hybrid.js
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const { ComputeLayer } = require('./compute-layer');

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX_NAME);

async function hybridQuery(question) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 QUESTION: "${question}"`);
  console.log('='.repeat(60));
  
  // 1. Generate embedding
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question,
    dimensions: 768
  });
  
  const queryEmbedding = embeddingResponse.data[0].embedding;
  
  // 2. RAG - Expert Knowledge
  console.log('\n📚 RAG - Searching expert knowledge...');
  const expertResults = await index.namespace('expert-knowledge').query({
    vector: queryEmbedding,
    topK: 2,
    includeMetadata: true
  });
  
  console.log('\nTop expert chunks:');
  expertResults.matches.forEach((match, i) => {
    console.log(`\n${i + 1}. ${match.id} (score: ${match.score.toFixed(4)})`);
    console.log(`   ${match.metadata.content.substring(0, 200)}...`);
  });
  
  // 3. COMPUTE - Player Stats
  console.log('\n\n💻 COMPUTE - Player statistics...');
  const compute = new ComputeLayer();
  await compute.loadPlayers('plusliga', '2025-2026');
  await compute.loadPlayers('tauronliga', '2025-2026');
  
  const topServers = compute.topServers(5);
  
  console.log('\nTOP 5 Servers:');
  topServers.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} (${p.team}) - ${p.aces} aces, ${p.aces_per_set}/set`);
  });
  
  // 4. LLM - Synthesize answer
  console.log('\n\n🤖 LLM - Generating answer...\n');
  
  const expertContext = expertResults.matches
    .map(m => m.metadata.content)
    .join('\n\n');
  
  const statsContext = topServers
    .map((p, i) => `${i + 1}. ${p.name} (${p.team}): ${p.aces} aces, ${p.aces_per_set} per set`)
    .join('\n');
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a volleyball analytics expert. Answer using BOTH expert knowledge and current player statistics. Cite sources.'
      },
      {
        role: 'user',
        content: `Question: ${question}

EXPERT KNOWLEDGE:
${expertContext}

CURRENT STATS (2025-2026 season):
${statsContext}

Please provide a comprehensive answer combining expert insights with current player performance data.`
      }
    ],
    temperature: 0.7,
    max_tokens: 500
  });
  
  console.log(completion.choices[0].message.content);
  console.log('\n' + '='.repeat(60));
}

// Test queries
async function runTests() {
  // Hybrid query - needs both RAG and compute
  await hybridQuery("Kto ma najlepszą zagrywkę w lidze i jakie są kluczowe aspekty skutecznego serwisu?");
  
  // Pure compute
  // await hybridQuery("TOP 5 servers this season");
  
  // Pure RAG
  // await hybridQuery("Jakie są przepisy dotyczące zagrywki?");
}

runTests().catch(console.error);