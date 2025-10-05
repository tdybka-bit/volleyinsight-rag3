import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

const CONTENT_DIR = path.join(__dirname, '../content');
const OUTPUT_FILE = path.join(CONTENT_DIR, 'chunks.json');

interface Chunk {
  content: string;
  filename: string;
  chunkIndex: number;
  metadata: {
    type: string;
    originalFile: string;
    contentLength: number;
  };
}

function createChunks(text: string, filename: string, type: string, chunkSize = 500): Chunk[] {
  const chunks: Chunk[] = [];
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

function getTypeFromFilename(filename: string): string {
  const name = filename.toLowerCase();
  if (name.includes('atak')) return 'atak';
  if (name.includes('blok')) return 'blok';
  if (name.includes('przepis')) return 'przepisy';
  if (name.includes('ustawien')) return 'ustawienia';
  if (name.includes('general') || name.includes('ogolne')) return 'ogólne';
  return 'inne';
}

async function parseDocxFile(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function parseAllDocuments() {
  console.log('📚 Parsowanie dokumentów z folderu content/...\n');
  
  const files = fs.readdirSync(CONTENT_DIR);
  const allChunks: Chunk[] = [];
  
  for (const file of files) {
    const filePath = path.join(CONTENT_DIR, file);
    const ext = path.extname(file).toLowerCase();
    
    if (file === 'chunks.json') continue;
    
    try {
      let content = '';
      
      if (ext === '.md') {
        console.log('📄 Parsowanie Markdown:', file);
        content = fs.readFileSync(filePath, 'utf8');
      } else if (ext === '.docx') {
        console.log('📄 Parsowanie DOCX:', file);
        content = await parseDocxFile(filePath);
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
      
    } catch (error: any) {
      console.error('❌ Błąd parsowania', file + ':', error.message);
    }
  }
  
  console.log('\n📊 Podsumowanie:');
  console.log('- Wszystkich chunków:', allChunks.length);
  
  const typeCounts = allChunks.reduce((acc, chunk) => {
    const type = chunk.metadata.type;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('- Rozkład typów:', typeCounts);
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allChunks, null, 2), 'utf8');
  console.log('\n✅ Zapisano do:', OUTPUT_FILE);
}

parseAllDocuments().catch(error => {
  console.error('❌ Błąd:', error);
  process.exit(1);
});
