// scripts/test-hybrid-query.js
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX_NAME);

async function hybridQuery(question) {
  console.log(`\n🔍 Question: "${question}"\n`);
  
  // 1. Generate query embedding
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question,
    dimensions: 768
  });
  
  const queryEmbedding = embeddingResponse.data[0].embedding;
  
  // 2. Search expert knowledge
  console.log('📚 Searching expert knowledge...');
  const expertResults = await index.namespace('expert-knowledge').query({
    vector: queryEmbedding,
    topK: 3,
    includeMetadata: true
  });
  
  console.log('\nTop 3 expert chunks:');
  expertResults.matches.forEach((match, i) => {
    console.log(`\n${i + 1}. ${match.id} (score: ${match.score.toFixed(4)})`);
    console.log(`   Topic: ${match.metadata.topic}`);
    console.log(`   Preview: ${match.metadata.content.substring(0, 150)}...`);
  });
  
  // 3. TODO: Compute layer (player stats aggregation)
  console.log('\n\n💻 Compute layer: TODO (next step)');
  console.log('   - TOP 10 servers');
  console.log('   - Filter by phase');
  console.log('   - Aggregate stats');
  
  return expertResults;
}

// Test queries
async function runTests() {
  // Pure expert query
  await hybridQuery("Jakie są przepisy dotyczące zagrywki?");
  
  // Hybrid query (would need compute)
  // await hybridQuery("Kto ma najlepszy serwis i jakie są zasady zagrywki?");
}

runTests().catch(console.error);