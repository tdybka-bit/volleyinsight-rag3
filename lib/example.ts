import { loadMarkdownFiles, loadMarkdownFilesByType, searchChunks } from './markdownLoader';

// Example usage of the markdown loader functions

async function example() {
  console.log('Loading markdown files...');
  
  // Load all markdown files with default settings (500 chars, 100 overlap)
  const chunks = await loadMarkdownFiles('./content');
  console.log(`Loaded ${chunks.length} chunks`);
  
  // Load with custom settings
  const customChunks = await loadMarkdownFiles('./content', 300, 50);
  console.log(`Loaded ${customChunks.length} chunks with custom settings`);
  
  // Load chunks grouped by type
  const chunksByType = await loadMarkdownFilesByType('./content');
  console.log('Chunks by type:', Object.keys(chunksByType));
  
  // Search for specific content
  const searchResults = searchChunks(chunks, 'blok');
  console.log(`Found ${searchResults.length} chunks containing 'blok'`);
  
  // Display first few chunks as example
  chunks.slice(0, 3).forEach((chunk, index) => {
    console.log(`\n--- Chunk ${index + 1} ---`);
    console.log(`File: ${chunk.filename}`);
    console.log(`Type: ${chunk.metadata.type}`);
    console.log(`Chunk Index: ${chunk.chunkIndex}`);
    console.log(`Content: ${chunk.content.substring(0, 100)}...`);
  });
}

// Run example if this file is executed directly
if (require.main === module) {
  example().catch(console.error);
}

export { example };
