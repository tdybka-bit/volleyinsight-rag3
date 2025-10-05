const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '../content');
const OUTPUT_FILE = path.join(CONTENT_DIR, 'chunks.json');

// Funkcja do tworzenia chunków z tekstu
function createChunks(text, filename, type, chunkSize = 500) {
  const chunks = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  let chunkIndex = 0;
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    
    if ((currentChunk + trimmedSentence).length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        filename: filename,
        chunkIndex: chunkIndex++,
        metadata: {
          type: type,
          originalFile: filename,
          contentLength: currentChunk.length
        }
      });
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
    }
  }
  
  // Dodaj ostatni chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      filename: filename,
      chunkIndex: chunkIndex,
      metadata: {
        type: type,
        originalFile: filename,
        contentLength: currentChunk.length
      }
    });
  }
  
  return chunks;
}

// Określ typ na podstawie nazwy pliku
function getTypeFromFilename(filename) {
  const name = filename.toLowerCase();
  if (name.includes('atak')) return 'atak';
  if (name.includes('blok')) return 'blok';
  if (name.includes('przepis')) return 'przepisy';
  if (name.includes('ustawien')) return 'ustawienia';
  if (name.includes('general') || name.includes('ogolne')) return 'ogólne';
  return 'inne';
}

async function parseAllDocuments() {
  console.log('📚 Parsowanie dokumentów z folderu content/...\n');
  
  const files = fs.readdirSync(CONTENT_DIR);
  const allChunks = [];
  
  for (const file of files) {
    const filePath = path.join(CONTENT_DIR, file);
    const ext = path.extname(file).toLowerCase();
    
    // Pomiń chunks.json jeśli już istnieje
    if (file === 'chunks.json') continue;
    
    try {
      let content = '';
      
      if (ext === '.md') {
        console.log('📄 Parsowanie Markdown:', file);
        content = fs.readFileSync(filePath, 'utf8');
      } else if (ext === '.docx') {
        console.log('⏭️  Pomijam DOCX (wymaga TypeScript):', file);
        continue;
      } else {
        console.log('⏭️  Pomijam:', file);
        continue;
      }
      
      if (!content || content.trim().length === 0) {
        console.log('⚠️  Plik pusty:', file);
        continue;
      }
      
      const type = getTypeFromFilename(file);
      const chunks = createChunks(content, file, type);
      allChunks.push(...chunks);
      
      console.log('   ✅ Utworzono chunków:', chunks.length, '(typ:', type + ')');
      
    } catch (error) {
      console.error('❌ Błąd parsowania', file + ':', error.message);
    }
  }
  
  console.log('\n📊 Podsumowanie:');
  console.log('- Wszystkich chunków:', allChunks.length);
  
  // Zlicz po typach
  const typeCounts = allChunks.reduce((acc, chunk) => {
    const type = chunk.metadata.type;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  console.log('- Rozkład typów:', typeCounts);
  
  // Zapisz do pliku
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allChunks, null, 2), 'utf8');
  console.log('\n✅ Zapisano do:', OUTPUT_FILE);
}

parseAllDocuments().catch(error => {
  console.error('❌ Błąd:', error);
  process.exit(1);
});
