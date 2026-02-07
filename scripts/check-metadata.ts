// check-metadata.ts
// Check actual metadata structure in Pinecone namespaces

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

async function checkMetadata() {
  console.log('🔍 Checking metadata structure...\n');

  // 1. Check tactics with REAL query (not dummy vector)
  console.log('🎯 TACTICS NAMESPACE:');
  try {
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'attack block spike',
      dimensions: 768,
    });

    const results = await index.namespace('tactics').query({
      vector: embedding.data[0].embedding,
      topK: 3,
      includeMetadata: true,
    });

    if (results.matches.length > 0) {
      console.log(`  ✅ Found ${results.matches.length} matches`);
      results.matches.forEach((match, i) => {
        console.log(`\n  Match ${i + 1}:`);
        console.log(`    Score: ${match.score?.toFixed(4)}`);
        console.log(`    Metadata keys:`, Object.keys(match.metadata || {}));
        console.log(`    Metadata:`, JSON.stringify(match.metadata, null, 2).substring(0, 300));
      });
    } else {
      console.log('  ❌ No matches found');
    }
  } catch (error) {
    console.log('  ❌ Error:', error);
  }

  // 2. Check naming-rules with REAL query
  console.log('\n\n📝 NAMING-RULES NAMESPACE:');
  try {
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'Leon Venero surname name declension',
      dimensions: 768,
    });

    const results = await index.namespace('naming-rules').query({
      vector: embedding.data[0].embedding,
      topK: 3,
      includeMetadata: true,
    });

    if (results.matches.length > 0) {
      console.log(`  ✅ Found ${results.matches.length} matches`);
      results.matches.forEach((match, i) => {
        console.log(`\n  Match ${i + 1}:`);
        console.log(`    Score: ${match.score?.toFixed(4)}`);
        console.log(`    Metadata keys:`, Object.keys(match.metadata || {}));
        console.log(`    Metadata:`, JSON.stringify(match.metadata, null, 2).substring(0, 300));
      });
    } else {
      console.log('  ❌ No matches found');
    }
  } catch (error) {
    console.log('  ❌ Error:', error);
  }

  // 3. Check commentary-examples with REAL query
  console.log('\n\n💬 COMMENTARY-EXAMPLES NAMESPACE:');
  try {
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'attack kill spike better commentary',
      dimensions: 768,
    });

    const results = await index.namespace('commentary-examples').query({
      vector: embedding.data[0].embedding,
      topK: 3,
      includeMetadata: true,
    });

    if (results.matches.length > 0) {
      console.log(`  ✅ Found ${results.matches.length} matches`);
      results.matches.forEach((match, i) => {
        console.log(`\n  Match ${i + 1}:`);
        console.log(`    Score: ${match.score?.toFixed(4)}`);
        console.log(`    Metadata keys:`, Object.keys(match.metadata || {}));
        console.log(`    Metadata:`, JSON.stringify(match.metadata, null, 2).substring(0, 300));
      });
    } else {
      console.log('  ❌ No matches found');
    }
  } catch (error) {
    console.log('  ❌ Error:', error);
  }

  // 4. Check commentary-phrases with REAL query
  console.log('\n\n💬 COMMENTARY-PHRASES NAMESPACE:');
  try {
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'ace serwis zagrywka punktowy',
      dimensions: 768,
    });

    const results = await index.namespace('commentary-phrases').query({
      vector: embedding.data[0].embedding,
      topK: 3,
      includeMetadata: true,
    });

    if (results.matches.length > 0) {
      console.log(`  ✅ Found ${results.matches.length} matches`);
      results.matches.forEach((match, i) => {
        console.log(`\n  Match ${i + 1}:`);
        console.log(`    Score: ${match.score?.toFixed(4)}`);
        console.log(`    Metadata keys:`, Object.keys(match.metadata || {}));
        console.log(`    Metadata:`, JSON.stringify(match.metadata, null, 2).substring(0, 300));
      });
    } else {
      console.log('  ❌ No matches found');
    }
  } catch (error) {
    console.log('  ❌ Error:', error);
  }
}

checkMetadata().then(() => {
  console.log('\n\n✅ Metadata check complete!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});