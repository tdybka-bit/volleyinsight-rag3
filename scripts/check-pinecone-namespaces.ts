// check-pinecone-namespaces.ts
// Script to check if Pinecone namespaces are populated

import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const index = pinecone.index('ed-volley');

const NAMESPACES = [
  'tactics',
  'commentary-examples',
  'naming-rules',
  'commentary-phrases',
  'set-summaries',
  'tone-rules',
  'default', // player-info
];

async function checkNamespaces() {
  console.log('🔍 Checking Pinecone namespaces...\n');

  for (const namespace of NAMESPACES) {
    try {
      // Get stats for namespace
      const stats = await index.describeIndexStats();
      const namespaceStats = stats.namespaces?.[namespace];

      if (namespaceStats && namespaceStats.recordCount && namespaceStats.recordCount > 0) {
        console.log(`✅ ${namespace}: ${namespaceStats.recordCount} records`);
      } else {
        console.log(`❌ ${namespace}: EMPTY or NOT FOUND`);
      }
    } catch (error) {
      console.log(`❌ ${namespace}: ERROR -`, error);
    }
  }

  console.log('\n📊 Testing sample queries...\n');

  // Test tactics query
  try {
    const results = await index.namespace('tactics').query({
      vector: new Array(768).fill(0), // dummy vector
      topK: 1,
      includeMetadata: true,
    });
    console.log(`🎯 Tactics sample:`, results.matches.length > 0 ? 'HAS DATA' : 'NO DATA');
    if (results.matches.length > 0) {
      console.log(`   Text: ${results.matches[0].metadata?.text?.substring(0, 100)}...`);
    }
  } catch (error) {
    console.log(`🎯 Tactics: ERROR -`, error);
  }

  // Test naming-rules query
  try {
    const results = await index.namespace('naming-rules').query({
      vector: new Array(768).fill(0), // dummy vector
      topK: 1,
      includeMetadata: true,
    });
    console.log(`📝 Naming rules sample:`, results.matches.length > 0 ? 'HAS DATA' : 'NO DATA');
    if (results.matches.length > 0) {
      console.log(`   Rule: ${results.matches[0].metadata?.rule || results.matches[0].metadata?.text?.substring(0, 100)}...`);
    }
  } catch (error) {
    console.log(`📝 Naming rules: ERROR -`, error);
  }

  // Test commentary-examples query
  try {
    const results = await index.namespace('commentary-examples').query({
      vector: new Array(768).fill(0), // dummy vector
      topK: 1,
      includeMetadata: true,
    });
    console.log(`💬 Commentary examples sample:`, results.matches.length > 0 ? 'HAS DATA' : 'NO DATA');
    if (results.matches.length > 0) {
      console.log(`   Example: ${results.matches[0].metadata?.betterCommentary?.substring(0, 100)}...`);
    }
  } catch (error) {
    console.log(`💬 Commentary examples: ERROR -`, error);
  }
}

checkNamespaces().then(() => {
  console.log('\n✅ Check complete!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});