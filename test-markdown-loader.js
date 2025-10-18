const { loadMarkdownFiles, loadMarkdownFilesByType, searchChunks } = require('./lib/markdownLoader');

async function testMarkdownLoader() {
  console.log('🧪 Testing Markdown Loader...\n');
  
  try {
    // Test 1: Load all markdown files
    console.log('📁 Loading all markdown files...');
    const chunks = await loadMarkdownFiles('./content');
    console.log(`✅ Loaded ${chunks.length} chunks from markdown files\n`);
    
    // Test 2: Show first few chunks
    console.log('📄 First 3 chunks:');
    chunks.slice(0, 3).forEach((chunk, index) => {
      console.log(`\n--- Chunk ${index + 1} ---`);
      console.log(`File: ${chunk.filename}`);
      console.log(`Type: ${chunk.metadata.type}`);
      console.log(`Chunk Index: ${chunk.chunkIndex}`);
      console.log(`Content: ${chunk.content.substring(0, 150)}...`);
    });
    
    // Test 3: Load by type
    console.log('\n\n📊 Loading chunks by type...');
    const chunksByType = await loadMarkdownFilesByType('./content');
    Object.entries(chunksByType).forEach(([type, typeChunks]) => {
      console.log(`${type}: ${typeChunks.length} chunks`);
    });
    
    // Test 4: Search functionality
    console.log('\n🔍 Testing search functionality...');
    const searchResults = searchChunks(chunks, 'atak');
    console.log(`Found ${searchResults.length} chunks containing 'atak'`);
    
    const blockResults = searchChunks(chunks, 'blok');
    console.log(`Found ${blockResults.length} chunks containing 'blok'`);
    
    // Test 5: Custom chunk size
    console.log('\n⚙️ Testing custom chunk size (300 chars, 50 overlap)...');
    const customChunks = await loadMarkdownFiles('./content', 300, 50);
    console.log(`Created ${customChunks.length} chunks with custom settings`);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

// Run the test
testMarkdownLoader();

















