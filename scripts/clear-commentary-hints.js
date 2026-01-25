/**
 * Script to DELETE ALL vectors from 'commentary-hints' namespace
 * Run this to start fresh!
 */

import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function clearCommentaryHints() {
  console.log('🔥 Starting cleanup of commentary-hints namespace...\n');

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const index = pinecone.index('ed-volley');

  try {
    // Delete ALL vectors from commentary-hints namespace
    console.log('🗑️  Deleting all vectors from commentary-hints namespace...');
    
    await index.namespace('commentary-hints').deleteAll();
    
    console.log('✅ Successfully deleted all vectors from commentary-hints!');
    console.log('📊 Namespace is now empty and ready for fresh data.\n');
    
    // Verify it's empty
    const stats = await index.describeIndexStats();
    console.log('📈 Index stats after cleanup:');
    console.log(JSON.stringify(stats.namespaces, null, 2));
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
clearCommentaryHints()
  .then(() => {
    console.log('\n✅ Cleanup complete! Ready to start fresh.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  });