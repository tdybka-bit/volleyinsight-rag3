// scripts/upload-all-chunks.js
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const fs = require('fs').promises;
const path = require('path');

async function uploadAllChunks() {
  console.log('🔌 Connecting to Pinecone...');
  
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  });
  
  const index = pc.index(process.env.PINECONE_INDEX_NAME);
  const namespace = index.namespace('expert-knowledge');
  
  console.log('📖 Loading chunks...');
  const chunksPath = path.join(__dirname, '../data/chunks/COMPLETE_EXPERT_KNOWLEDGE_WITH_EMBEDDINGS.json');
  const chunks = JSON.parse(await fs.readFile(chunksPath, 'utf-8'));
  
  console.log(`✅ Loaded ${chunks.length} chunks`);
  console.log('\n🚀 Uploading to Pinecone...');
  
  // Batch upload (100 at a time - Pinecone limit)
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    
    const vectors = batch.map(chunk => ({
      id: chunk.id,
      values: chunk.embedding,
      metadata: {
        content: chunk.content,
        topic: chunk.metadata.topic,
        subtopic: chunk.metadata.subtopic,
        document: chunk.metadata.document,
        source: chunk.metadata.source,
        type: chunk.metadata.type,
        language: chunk.metadata.language,
        chunk_index: chunk.metadata.chunk_index,
        word_count: chunk.metadata.word_count
      }
    }));
    
    await namespace.upsert(vectors);
    
    console.log(`  ✅ Uploaded ${i + batch.length}/${chunks.length}`);
    
    // Small delay between batches
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('\n🎉 All chunks uploaded!');
  console.log(`📊 Total: ${chunks.length} vectors in namespace 'expert-knowledge'`);
}

uploadAllChunks().catch(console.error);