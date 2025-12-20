// scripts/smart-query.js
require('dotenv').config();
const { QueryClassifier } = require('./query-classifier');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const { ComputeLayer } = require('./compute-layer');

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX_NAME);

async function smartQuery(question) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`❓ QUESTION: "${question}"`);
  console.log('='.repeat(70));
  
  // 1. CLASSIFY
  const classifier = new QueryClassifier();
  const classification = await classifier.classify(question);
  
  console.log(`\n🎯 Classification: ${classification.type.toUpperCase()}`);
  console.log(`   Confidence: ${(classification.confidence * 100).toFixed(0)}%`);
  console.log(`   Reasoning: ${classification.reasoning}`);
  
  let expertContext = '';
  let statsContext = '';
  
  // 2. RAG (if needed)
  if (classification.type === 'rag' || classification.type === 'hybrid') {
    console.log('\n📚 Searching expert knowledge...');
    
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
      dimensions: 768
    });
    
    const expertResults = await index.namespace('expert-knowledge').query({
      vector: embeddingResponse.data[0].embedding,
      topK: 3,
      includeMetadata: true
    });
    
    console.log(`   Found ${expertResults.matches.length} relevant chunks`);
    expertResults.matches.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.id} (score: ${m.score.toFixed(3)})`);
    });
    
    expertContext = expertResults.matches
      .map(m => m.metadata.content)
      .join('\n\n');
  }
  
  // 3. COMPUTE (if needed)
  if (classification.type === 'compute' || classification.type === 'hybrid') {
    console.log('\n💻 Computing player statistics...');
    
    const compute = new ComputeLayer();
    await compute.loadPlayers('plusliga', '2025-2026');
    await compute.loadPlayers('tauronliga', '2025-2026');
    
    // Smart extraction of what stats to compute
    // For now, default to TOP servers
    const topPlayers = compute.topServers(10);
    
    console.log(`   Analyzed ${compute.players.length} players`);
    console.log(`   Top server: ${topPlayers[0].name} (${topPlayers[0].aces} aces)`);
    
    statsContext = topPlayers
      .map((p, i) => `${i + 1}. ${p.name} (${p.team}): ${p.aces} aces, ${p.aces_per_set}/set`)
      .join('\n');
  }
  
  // 4. LLM SYNTHESIS
  console.log('\n🤖 Generating answer...\n');
  
  const systemPrompt = classification.type === 'rag' 
    ? 'You are a volleyball expert. Answer using expert knowledge and rules.'
    : classification.type === 'compute'
    ? 'You are a volleyball statistician. Answer using current player statistics and data.'
    : 'You are a volleyball analytics expert. Combine expert knowledge with current statistics.';
  
  let userPrompt = `Question: ${question}\n\n`;
  
  if (expertContext) {
    userPrompt += `EXPERT KNOWLEDGE:\n${expertContext}\n\n`;
  }
  
  if (statsContext) {
    userPrompt += `CURRENT STATISTICS (2025-2026):\n${statsContext}\n\n`;
  }
  
  userPrompt += 'Provide a comprehensive answer.';
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 500
  });
  
  console.log(completion.choices[0].message.content);
  console.log('\n' + '='.repeat(70));
}

// Test different query types
async function runTests() {
  await smartQuery("Jakie są przepisy dotyczące zagrywki?");
  await smartQuery("TOP 5 servers this season");
  await smartQuery("Kto ma najlepszy serwis i dlaczego?");
}

runTests().catch(console.error);