// delete-bad-naming-rules.ts
// Usuń stare złe reguły "Leon Venero" i "Tavares Rodrigues"

import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const index = pinecone.index('ed-volley');

async function deleteBadNamingRules() {
  console.log('🗑️ Deleting bad naming rules from Pinecone...\n');

  // Search for Leon Venero entries
  const leonEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: 'Leon Venero naming declension',
    dimensions: 768,
  });

  const leonResults = await index.namespace('naming-rules').query({
    vector: leonEmbedding.data[0].embedding,
    topK: 10,
    includeMetadata: true,
  });

  console.log(`🔍 Found ${leonResults.matches.length} potential Leon Venero matches\n`);

  const toDelete: string[] = [];

  leonResults.matches.forEach((match, i) => {
    const content = match.metadata?.content || '';
    const text = match.metadata?.text || '';
    
    // Szukaj ZŁE reguły która mówi "Leon Venero → Leona Venero"
    const hasBadRule = content.includes('Leon Venero → Leona Venero') ||
                      content.includes('Leon Venero - włoskie nazwisko');

    if (hasBadRule) {
      console.log(`⚠️ Match ${i + 1} (ID: ${match.id}) - BAD RULE (will delete)`);
      console.log(`   Score: ${match.score?.toFixed(4)}`);
      console.log(`   Content: ${content.substring(0, 100)}...`);
      toDelete.push(match.id);
    } else {
      console.log(`✓ Match ${i + 1} - OK (keeping)`);
    }
  });

  // Search for bad example with "Tavares Rodrigues"
  const badExampleEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: 'Tavares Rodrigues serwuje Leon Venero',
    dimensions: 768,
  });

  const badExampleResults = await index.namespace('naming-rules').query({
    vector: badExampleEmbedding.data[0].embedding,
    topK: 5,
    includeMetadata: true,
  });

  console.log(`\n🔍 Found ${badExampleResults.matches.length} potential bad examples\n`);

  badExampleResults.matches.forEach((match, i) => {
    const content = match.metadata?.content || '';
    
    // Szukaj BAD EXAMPLE
    const isBadExample = content.includes('❌ OBECNY KOMENTARZ (ZŁY)') &&
                        content.includes('Tavares Rodrigues serwuje');

    if (isBadExample && !toDelete.includes(match.id)) {
      console.log(`⚠️ Match ${i + 1} (ID: ${match.id}) - BAD EXAMPLE (will delete)`);
      console.log(`   Score: ${match.score?.toFixed(4)}`);
      console.log(`   Content: ${content.substring(0, 100)}...`);
      toDelete.push(match.id);
    }
  });

  if (toDelete.length === 0) {
    console.log('\n✅ No bad rules found!');
    return;
  }

  console.log(`\n🗑️ Will delete ${toDelete.length} vector(s):\n`);
  toDelete.forEach(id => console.log(`   - ${id}`));

  console.log('\n⏳ Deleting...');

  await index.namespace('naming-rules').deleteMany(toDelete);

  console.log('✅ Deleted successfully!');
  console.log('\n💡 Now re-run: npx tsx scripts/test-naming-rag.ts');
}

deleteBadNamingRules()
  .then(() => {
    console.log('\n✅ Complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });