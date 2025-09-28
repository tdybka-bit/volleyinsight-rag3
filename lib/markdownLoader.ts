import fs from 'fs';
import path from 'path';

interface MarkdownChunk {
  content: string;
  filename: string;
  chunkIndex: number;
  metadata: {
    type: string;
    originalFile: string;
  };
}

/**
 * Helper function to split text into chunks with overlap
 * @param text - The text to chunk
 * @param chunkSize - Size of each chunk in characters (default: 500)
 * @param overlap - Number of characters to overlap between chunks (default: 100)
 * @returns Array of text chunks
 */
function chunkText(text: string, chunkSize: number = 500, overlap: number = 100): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;
    
    // If this isn't the last chunk, try to break at a sentence or word boundary
    if (end < text.length) {
      // Look for sentence endings first
      const sentenceEnd = text.lastIndexOf('.', end);
      const questionEnd = text.lastIndexOf('?', end);
      const exclamationEnd = text.lastIndexOf('!', end);
      
      const sentenceBreak = Math.max(sentenceEnd, questionEnd, exclamationEnd);
      
      if (sentenceBreak > start + chunkSize * 0.5) {
        end = sentenceBreak + 1;
      } else {
        // Look for word boundary
        const wordBreak = text.lastIndexOf(' ', end);
        if (wordBreak > start + chunkSize * 0.5) {
          end = wordBreak;
        }
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move start position with overlap
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Extract metadata from filename
 * @param filename - The filename without extension
 * @returns Object with type and other metadata
 */
function extractMetadata(filename: string): { type: string; originalFile: string } {
  // Map common volleyball terms to types
  const typeMap: { [key: string]: string } = {
    'blok': 'blok',
    'atak': 'atak', 
    'przyjecie': 'przyjecie',
    'zagrywka': 'zagrywka',
    'przepisy': 'przepisy',
    'ustawienia': 'ustawienia',
    'podstawy': 'podstawy',
    'technika': 'technika',
    'taktyka': 'taktyka',
    'trening': 'trening'
  };

  const type = typeMap[filename.toLowerCase()] || 'ogolne';
  
  return {
    type,
    originalFile: filename
  };
}

/**
 * Load all markdown files from content/ directory and chunk them
 * @param contentDir - Path to content directory (default: './content')
 * @param chunkSize - Size of each chunk in characters (default: 500)
 * @param overlap - Number of characters to overlap between chunks (default: 100)
 * @returns Promise<MarkdownChunk[]> - Array of chunked content
 */
export async function loadMarkdownFiles(
  contentDir: string = './content',
  chunkSize: number = 500,
  overlap: number = 100
): Promise<MarkdownChunk[]> {
  try {
    // Check if content directory exists
    if (!fs.existsSync(contentDir)) {
      console.warn(`Content directory ${contentDir} does not exist`);
      return [];
    }

    // Read all files in content directory
    const files = fs.readdirSync(contentDir);
    const markdownFiles = files.filter(file => file.endsWith('.md'));

    if (markdownFiles.length === 0) {
      console.warn(`No markdown files found in ${contentDir}`);
      return [];
    }

    const allChunks: MarkdownChunk[] = [];

    for (const file of markdownFiles) {
      try {
        const filePath = path.join(contentDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        
        // Clean up markdown content (remove headers, links, etc. for better chunking)
        const cleanContent = fileContent
          .replace(/^#+\s*/gm, '') // Remove markdown headers
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to plain text
          .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold formatting
          .replace(/\*([^*]+)\*/g, '$1') // Remove italic formatting
          .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double
          .trim();

        // Split content into chunks
        const chunks = chunkText(cleanContent, chunkSize, overlap);
        
        // Extract metadata from filename
        const filename = path.basename(file, '.md');
        const metadata = extractMetadata(filename);

        // Create chunk objects
        chunks.forEach((chunk, index) => {
          allChunks.push({
            content: chunk,
            filename: file,
            chunkIndex: index,
            metadata: {
              type: metadata.type,
              originalFile: metadata.originalFile
            }
          });
        });

        console.log(`Processed ${file}: ${chunks.length} chunks`);
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
      }
    }

    console.log(`Total chunks created: ${allChunks.length}`);
    return allChunks;

  } catch (error) {
    console.error('Error loading markdown files:', error);
    return [];
  }
}

/**
 * Load markdown files and return them grouped by type
 * @param contentDir - Path to content directory
 * @param chunkSize - Size of each chunk in characters
 * @param overlap - Number of characters to overlap between chunks
 * @returns Promise<{ [type: string]: MarkdownChunk[] }> - Chunks grouped by type
 */
export async function loadMarkdownFilesByType(
  contentDir: string = './content',
  chunkSize: number = 500,
  overlap: number = 100
): Promise<{ [type: string]: MarkdownChunk[] }> {
  const chunks = await loadMarkdownFiles(contentDir, chunkSize, overlap);
  
  return chunks.reduce((acc, chunk) => {
    const type = chunk.metadata.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(chunk);
    return acc;
  }, {} as { [type: string]: MarkdownChunk[] });
}

/**
 * Search chunks by content or metadata
 * @param chunks - Array of chunks to search
 * @param query - Search query
 * @param searchInContent - Whether to search in content (default: true)
 * @param searchInMetadata - Whether to search in metadata (default: true)
 * @returns Filtered chunks
 */
export function searchChunks(
  chunks: MarkdownChunk[],
  query: string,
  searchInContent: boolean = true,
  searchInMetadata: boolean = true
): MarkdownChunk[] {
  const lowerQuery = query.toLowerCase();
  
  return chunks.filter(chunk => {
    let matches = false;
    
    if (searchInContent && chunk.content.toLowerCase().includes(lowerQuery)) {
      matches = true;
    }
    
    if (searchInMetadata && (
      chunk.metadata.type.toLowerCase().includes(lowerQuery) ||
      chunk.metadata.originalFile.toLowerCase().includes(lowerQuery) ||
      chunk.filename.toLowerCase().includes(lowerQuery)
    )) {
      matches = true;
    }
    
    return matches;
  });
}

export type { MarkdownChunk };

