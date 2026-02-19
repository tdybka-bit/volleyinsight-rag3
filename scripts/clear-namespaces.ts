/**
 * Clear specific Pinecone namespaces before re-syncing
 * 
 * Usage: npx tsx scripts/clear-namespaces.ts [namespace1] [namespace2] ...
 * Example: npx tsx scripts/clear-namespaces.ts naming-rules tactical-knowledge
 * 
 * If no namespaces specified, lists all available namespaces with vector counts.
 */

import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const PINECONE_INDEX = 'ed-volley';

async function main() {
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  const index = pinecone.index(PINECONE_INDEX);

  const namespacesToClear = process.argv.slice(2);

  // If no args - show stats for all namespaces
  if (namespacesToClear.length === 0) {
    console.log('\n=== PINECONE INDEX STATS ===\n');
    
    const stats = await index.describeIndexStats();
    const namespaces = stats.namespaces || {};
    
    console.log(`Total vectors: ${stats.totalRecordCount}`);
    console.log(`Dimension: ${stats.dimension}`);
    console.log('\nNamespaces:');
    
    for (const [name, info] of Object.entries(namespaces)) {
      console.log(`  ${name}: ${info.recordCount} vectors`);
    }
    
    console.log('\nUsage: npx tsx scripts/clear-namespaces.ts [namespace1] [namespace2]');
    console.log('Example: npx tsx scripts/clear-namespaces.ts naming-rules tactical-knowledge');
    return;
  }

  // Clear specified namespaces
  for (const ns of namespacesToClear) {
    console.log(`\nClearing namespace: ${ns}...`);
    
    try {
      await index.namespace(ns).deleteAll();
      console.log(`  OK: ${ns} cleared!`);
    } catch (error) {
      console.error(`  ERROR clearing ${ns}:`, error);
    }
  }

  // Show updated stats
  console.log('\n=== AFTER CLEARING ===\n');
  const stats = await index.describeIndexStats();
  const namespaces = stats.namespaces || {};
  
  for (const [name, info] of Object.entries(namespaces)) {
    console.log(`  ${name}: ${info.recordCount} vectors`);
  }
  
  console.log('\nDone! Now run: npx tsx scripts/sync-google-drive.ts');
}

main().catch(console.error);