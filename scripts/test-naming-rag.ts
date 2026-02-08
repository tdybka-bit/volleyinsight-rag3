// Test: Co RAG zwraca dla naming rules Tavares i Leon
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const index = pinecone.index('ed-volley');

async function testNamingRules() {
  console.log('🔍 Testing Naming Rules RAG for Tavares and Leon...\n');

  const testCases = [
    'Tavares preferred name declension',
    'Leon preferred name declension',
    'Tavares Rodrigues naming',
    'Leon Venero naming',
    'Miguel Tavares',
    'Leona Venero',
  ];

  for (const query of testCases) {
    console.log(`\n📝 Query: "${query}"`);
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
      console.log('❌ NO MATCHES FOUND!');
      continue;
    }

    results.matches.forEach((match, i) => {
      console.log(`\n  Match ${i + 1} (score: ${match.score?.toFixed(4)}):`);
      console.log(`    rule_text: ${match.metadata?.rule_text || 'N/A'}`);
      console.log(`    content: ${(match.metadata?.content || 'N/A').substring(0, 200)}...`);
      console.log(`    text: ${match.metadata?.text || 'N/A'}`);
    });
  }

  console.log('\n\n✅ Test complete!');
}

testNamingRules()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });