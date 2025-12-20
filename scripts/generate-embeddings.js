// Na samej górze pliku, przed require('openai')
require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateEmbeddings() {
  console.log('📖 Loading chunks...');
  
  const chunksPath = path.join(__dirname, '../data/chunks/COMPLETE_EXPERT_KNOWLEDGE.json');
  const chunks = JSON.parse(await fs.readFile(chunksPath, 'utf-8'));
  
  console.log(`✅ Loaded ${chunks.length} chunks`);
  console.log('\n🔄 Generating embeddings...');
  
  const chunksWithEmbeddings = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    console.log(`[${i + 1}/${chunks.length}] ${chunk.id}`);
    
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunk.content,
        encoding_format: 'float',
        dimensions: 768  // <-- DODAJ TĘ LINIĘ
      });
      
      chunksWithEmbeddings.push({
        ...chunk,
        embedding: response.data[0].embedding
      });
      
      // Rate limiting - 3 requests/sec for tier 1
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 350));
      }
      
    } catch (error) {
      console.error(`❌ Error on chunk ${chunk.id}:`, error.message);
      throw error;
    }
  }
  
  // Save
  const outputPath = path.join(__dirname, '../data/chunks/COMPLETE_EXPERT_KNOWLEDGE_WITH_EMBEDDINGS.json');
  await fs.writeFile(outputPath, JSON.stringify(chunksWithEmbeddings, null, 2));
  
  console.log(`\n✅ Saved ${chunksWithEmbeddings.length} chunks with embeddings`);
  console.log(`💾 File: ${outputPath}`);
}

generateEmbeddings().catch(console.error);