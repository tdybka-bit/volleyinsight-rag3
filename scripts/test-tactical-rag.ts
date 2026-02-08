// Test: Tactical Knowledge RAG
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const index = pinecone.index('ed-volley');

async function testTacticalKnowledge() {
  console.log('🔍 Testing Tactical Knowledge RAG...\n');

  // 1. Sprawdź ile vectorów w tactical-knowledge
  const stats = await index.describeIndexStats();
  console.log('📊 Namespace Stats:');
  console.log(`  tactical-knowledge: ${stats.namespaces?.['tactical-knowledge']?.recordCount || 0} vectors`);
  console.log(`  tactics: ${stats.namespaces?.['tactics']?.recordCount || 0} vectors`);
  console.log(`  naming-rules: ${stats.namespaces?.['naming-rules']?.recordCount || 0} vectors\n`);

  // 2. Test queries - typowe sytuacje w meczach
  const testQueries = [
    'attack combination quick tempo',
    'serve reception attack strategy',
    'block defense tactics',
    'X5 attack combination',
    'V5 attack pattern',
    'pipe attack from position 1',
  ];

  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    console.log('─'.repeat(60));

    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      dimensions: 768,
    });

    // Sprawdź tactics namespace
    const tacticsResults = await index.namespace('tactics').query({
      vector: embedding.data[0].embedding,
      topK: 2,
      includeMetadata: true,
    });

    console.log(`\n  TACTICS namespace (${tacticsResults.matches.length} matches):`);
    tacticsResults.matches.forEach((match, i) => {
      console.log(`    Match ${i + 1} (score: ${match.score?.toFixed(4)}):`);
      console.log(`      ${(match.metadata?.text || match.metadata?.content || 'N/A').substring(0, 150)}...`);
    });

    // Sprawdź tactical-knowledge namespace
    const tkResults = await index.namespace('tactical-knowledge').query({
      vector: embedding.data[0].embedding,
      topK: 2,
      includeMetadata: true,
    });

    console.log(`\n  TACTICAL-KNOWLEDGE namespace (${tkResults.matches.length} matches):`);
    tkResults.matches.forEach((match, i) => {
      console.log(`    Match ${i + 1} (score: ${match.score?.toFixed(4)}):`);
      console.log(`      ${(match.metadata?.text || match.metadata?.content || 'N/A').substring(0, 150)}...`);
    });
  }

  console.log('\n\n✅ Test complete!');
}

testTacticalKnowledge()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });