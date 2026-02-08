// check-new-naming-rules.ts
// Sprawdź czy nowe pliki Leon_Venero i Tavares_Rodrigues są w Pinecone

import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const index = pinecone.index('ed-volley');

async function checkNewNamingRules() {
  console.log('🔍 Checking if new naming rules are in Pinecone...\n');

  // 1. Sprawdź ile jest vectorów w naming-rules
  const stats = await index.describeIndexStats();
  const namingRulesCount = stats.namespaces?.['naming-rules']?.recordCount || 0;
  console.log(`📊 Total vectors in naming-rules namespace: ${namingRulesCount}\n`);

  // 2. Szukaj po specyficznych frazach z nowych plików
  const testQueries = [
    'Wilfredo Leon Venero podwójne nazwisko latino',
    'Miguel Tavares Rodrigues podwójne nazwisko portugalskie',
    'UŻYWAJ Leon tylko nazwisko 1',
    'UŻYWAJ Tavares tylko nazwisko 1',
  ];

  for (const query of testQueries) {
    console.log(`📝 Query: "${query}"`);
    console.log('─'.repeat(60));

    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      dimensions: 768,
    });

    const results = await index.namespace('naming-rules').query({
      vector: embedding.data[0].embedding,
      topK: 3,
      includeMetadata: true,
    });

    if (results.matches.length === 0) {
      console.log('❌ NO MATCHES!\n');
      continue;
    }

    results.matches.forEach((match, i) => {
      const content = match.metadata?.content || '';
      const source = match.metadata?.source || 'unknown';
      
      console.log(`  Match ${i + 1} (score: ${match.score?.toFixed(4)}):`);
      console.log(`    Source: ${source}`);
      console.log(`    Content: ${content.substring(0, 150)}...`);
      
      // Check if this is our new file
      if (source.includes('Leon_Venero') || source.includes('Tavares_Rodrigues')) {
        console.log(`    ✅ THIS IS THE NEW FILE!`);
      }
    });
    console.log('');
  }

  // 3. List all vectors in naming-rules (first 20)
  console.log('\n📋 Listing vectors in naming-rules namespace (checking sources)...\n');
  
  const listResults = await index.namespace('naming-rules').query({
    vector: Array(768).fill(0), // Dummy vector
    topK: 20,
    includeMetadata: true,
  });

  const sources = new Set<string>();
  listResults.matches.forEach(match => {
    const source = match.metadata?.source || 'unknown';
    sources.add(source);
  });

  console.log('📁 Files in naming-rules:');
  Array.from(sources).sort().forEach(source => {
    console.log(`   - ${source}`);
    if (source.includes('Leon_Venero') || source.includes('Tavares_Rodrigues')) {
      console.log(`     ✅ NEW FILE FOUND!`);
    }
  });

  console.log('\n✅ Check complete!');
  
  if (![...sources].some(s => s.includes('Leon_Venero') || s.includes('Tavares_Rodrigues'))) {
    console.log('\n⚠️  NEW FILES NOT FOUND IN PINECONE!');
    console.log('   → Run: npx tsx scripts/sync-google-drive.ts');
    console.log('   → Then check again');
  }
}

checkNewNamingRules()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });