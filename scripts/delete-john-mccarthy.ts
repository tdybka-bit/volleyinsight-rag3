// delete-john-mccarthy.ts
// Delete "John McCarthy" entries from Pinecone naming-rules namespace

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

async function deleteJohnMcCarthy() {
  console.log('🗑️ Deleting "John McCarthy" from Pinecone...\n');

  // Search for John McCarthy entries
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: 'John McCarthy preferred name declension',
    dimensions: 768,
  });

  const results = await index.namespace('naming-rules').query({
    vector: embedding.data[0].embedding,
    topK: 10,
    includeMetadata: true,
  });

  console.log(`🔍 Found ${results.matches.length} potential matches\n`);

  // Filter for entries that actually contain "John McCarthy"
  const toDelete: string[] = [];

  results.matches.forEach((match, i) => {
    const content = match.metadata?.content || '';
    const text = match.metadata?.text || '';
    const ruleText = match.metadata?.rule_text || '';
    
    const hasJohn = content.toLowerCase().includes('john mccarthy') ||
                   text.toLowerCase().includes('john mccarthy') ||
                   ruleText.toLowerCase().includes('john mccarthy');

    if (hasJohn) {
      console.log(`⚠️ Match ${i + 1} (ID: ${match.id}) - CONTAINS "John McCarthy"`);
      console.log(`   Score: ${match.score?.toFixed(4)}`);
      console.log(`   Content: ${content.substring(0, 100)}...`);
      toDelete.push(match.id);
    } else {
      console.log(`✓ Match ${i + 1} - does NOT contain "John McCarthy" (skipping)`);
    }
  });

  if (toDelete.length === 0) {
    console.log('\n✅ No entries to delete!');
    return;
  }

  console.log(`\n🗑️ Will delete ${toDelete.length} vector(s):\n`);
  toDelete.forEach(id => console.log(`   - ${id}`));

  console.log('\n⏳ Deleting...');

  // Delete vectors
  await index.namespace('naming-rules').deleteMany(toDelete);

  console.log('✅ Deleted successfully!');
  console.log('\n💡 Now you can either:');
  console.log('   1. Add correct "Fynnian McCarthy" or just "McCarthy" to Google Drive');
  console.log('   2. Or leave it - GPT will use hardcoded declensions from route.ts');
}

deleteJohnMcCarthy()
  .then(() => {
    console.log('\n✅ Complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });