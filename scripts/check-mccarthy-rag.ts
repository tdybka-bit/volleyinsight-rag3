// check-mccarthy-rag.ts
// Check if "John McCarthy" is in RAG namespaces

import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const index = pinecone.index('ed-volley');

async function checkMcCarthy() {
  console.log('🔍 Checking for McCarthy in RAG...\n');

  // Check naming-rules
  const namingEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: 'McCarthy preferred name surname declension',
    dimensions: 768,
  });

  const namingResults = await index.namespace('naming-rules').query({
    vector: namingEmbedding.data[0].embedding,
    topK: 5,
    includeMetadata: true,
  });

  console.log('📝 NAMING-RULES for McCarthy:');
  namingResults.matches.forEach((match, i) => {
    console.log(`\n  Match ${i + 1} (score: ${match.score?.toFixed(4)}):`);
    console.log(`    rule_text: ${match.metadata?.rule_text || 'N/A'}`);
    console.log(`    content: ${match.metadata?.content?.substring(0, 200) || 'N/A'}`);
    console.log(`    text: ${match.metadata?.text?.substring(0, 200) || 'N/A'}`);
  });

  // Check default (player-info)
  const playerEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: 'McCarthy player profile characteristics',
    dimensions: 768,
  });

  const playerResults = await index.namespace('default').query({
    vector: playerEmbedding.data[0].embedding,
    topK: 3,
    includeMetadata: true,
  });

  console.log('\n\n👤 DEFAULT (player-info) for McCarthy:');
  if (playerResults.matches.length === 0) {
    console.log('  ❌ EMPTY - no player profiles yet!');
  } else {
    playerResults.matches.forEach((match, i) => {
      console.log(`\n  Match ${i + 1} (score: ${match.score?.toFixed(4)}):`);
      console.log(`    text: ${match.metadata?.text?.substring(0, 300) || 'N/A'}`);
    });
  }

  // Check ALL namespaces for "John"
  console.log('\n\n🔎 Searching ALL namespaces for "John McCarthy"...\n');
  
  const johnEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: 'John McCarthy player',
    dimensions: 768,
  });

  const namespaces = ['naming-rules', 'commentary-examples', 'commentary-phrases', 'tactics', 'default'];
  
  for (const ns of namespaces) {
    try {
      const results = await index.namespace(ns).query({
        vector: johnEmbedding.data[0].embedding,
        topK: 2,
        includeMetadata: true,
      });
      
      if (results.matches.length > 0 && results.matches[0].score && results.matches[0].score > 0.5) {
        console.log(`  ⚠️ ${ns}: Found high-scoring match (${results.matches[0].score.toFixed(4)})`);
        console.log(`     Metadata:`, JSON.stringify(results.matches[0].metadata, null, 2).substring(0, 300));
      }
    } catch (error) {
      // Skip empty namespaces
    }
  }
}

checkMcCarthy().then(() => {
  console.log('\n✅ Check complete!');
  process.exit(0);
}).catch(console.error);