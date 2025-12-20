// scripts/upload-to-pinecone-test.js
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const fs = require('fs').promises;
const path = require('path');

async function uploadTestChunk() {
  console.log('🔌 Connecting to Pinecone...');
  
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  });
  
  const index = pc.index(process.env.PINECONE_INDEX_NAME);
  
  console.log('📖 Loading chunks...');
  const chunksPath = path.join(__dirname, '../data/chunks/COMPLETE_EXPERT_KNOWLEDGE_WITH_EMBEDDINGS.json');
  const chunks = JSON.parse(await fs.readFile(chunksPath, 'utf-8'));
  
  // Upload FIRST chunk only (test)
  const testChunk = chunks[0];
  
  console.log('\n🚀 Uploading test chunk...');
  console.log(`ID: ${testChunk.id}`);
  console.log(`Topic: ${testChunk.metadata.topic}`);
  console.log(`Embedding dims: ${testChunk.embedding.length}`);
  
  await index.namespace('expert-knowledge').upsert([
    {
      id: testChunk.id,
      values: testChunk.embedding,
      metadata: {
        content: testChunk.content,
        ...testChunk.metadata
      }
    }
  ]);
  
  console.log('\n✅ Test chunk uploaded!');
  console.log('\n🔍 Testing retrieval...');
  
  // Query test
  const queryResults = await index.namespace('expert-knowledge').query({
    vector: testChunk.embedding,
    topK: 3,
    includeMetadata: true
  });
  
  console.log('\nTop 3 matches:');
  queryResults.matches.forEach((match, i) => {
    console.log(`\n${i + 1}. ${match.id} (score: ${match.score.toFixed(4)})`);
    console.log(`   Topic: ${match.metadata.topic}`);
    console.log(`   Content preview: ${match.metadata.content.substring(0, 100)}...`);
  });
}

uploadTestChunk().catch(console.error);