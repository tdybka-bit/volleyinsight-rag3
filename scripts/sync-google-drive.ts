/**
 * ============================================================================
 * GOOGLE DRIVE ΓåÆ PINECONE SYNC
 * ============================================================================
 * 
 * ONE SCRIPT TO RULE THEM ALL!
 * 
 * Automatically syncs ALL content from Google Drive to Pinecone:
 * - Markdown files (.md)
 * - Word documents (.docx) - both binary and Google Docs native
 * - PDFs (.pdf)
 * - Text files (.txt)
 * 
 * WORKFLOW:
 * 1. Upload any file to Google Drive folder
 * 2. Run: npx tsx scripts/sync-google-drive.ts
 * 3. DONE! File automatically uploaded to correct Pinecone namespace
 * 
 * NO MORE MANUAL UPLOADS! NO MORE MULTIPLE SCRIPTS!
 * 
 * ============================================================================
 */

import { google, drive_v3 } from 'googleapis';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

dotenv.config({ path: '.env.local' });

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID!,
  PINECONE_INDEX: 'ed-volley',
  CHUNK_SIZE: 1000,
  CHUNK_OVERLAP: 200,
  SUPPORTED_EXTENSIONS: ['.md', '.docx', '.pdf', '.txt'],
  
  // Namespace mapping based on folder structure
  NAMESPACE_FOLDERS: {
    'tactical-knowledge': 'tactical-knowledge',
    'set-summaries': 'set-summaries',
    'commentary-phrases': 'commentary-phrases',
    'player-profiles': 'player-profiles',
    'naming-rules': 'naming-rules',
  }
};

// ============================================================================
// INITIALIZE CLIENTS
// ============================================================================

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index(CONFIG.PINECONE_INDEX);

// Google Drive authentication
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

// ============================================================================
// FILE PARSERS - SUPPORTS ALL FORMATS
// ============================================================================

/**
 * Parse Markdown file
 */
async function parseMarkdown(fileId: string, fileName: string): Promise<string> {
  console.log('   ≡ƒô¥ Parsing as Markdown...');
  
  const response = await drive.files.get({
    fileId,
    alt: 'media',
  }, { responseType: 'text' });
  
  return response.data as string;
}

/**
 * Parse Google Docs native document
 */
async function parseGoogleDoc(fileId: string): Promise<string> {
  console.log('   ≡ƒôä Parsing as Google Doc (native)...');
  
  const response = await drive.files.export({
    fileId,
    mimeType: 'text/plain',
  });
  
  return response.data as string;
}

/**
 * Parse binary DOCX file
 */
async function parseBinaryDocx(fileId: string): Promise<string> {
  console.log('   ≡ƒôä Parsing as binary DOCX...');
  
  // Download file to temp location
  const tempFile = path.join(process.env.TEMP || 'C:\\Windows\\Temp', `temp-${fileId}.docx`);
  
  const dest = fs.createWriteStream(tempFile);
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  
  await new Promise<void>((resolve, reject) => {
    (response.data as any)
      .pipe(dest)
      .on('finish', resolve)
      .on('error', reject);
  });
  
  // Parse with mammoth
  const result = await mammoth.extractRawText({ path: tempFile });
  
  // Cleanup
  fs.unlinkSync(tempFile);
  
  return result.value;
}

/**
 * Parse PDF file
 */
async function parsePdf(fileId: string): Promise<string> {
  console.log('   ≡ƒôò Parsing as PDF...');
  
  // Download to buffer
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  
  const buffer = Buffer.from(response.data as ArrayBuffer);
  const data = await pdfParse(buffer);
  
  return data.text;
}

/**
 * Parse text file
 */
async function parseTextFile(fileId: string): Promise<string> {
  console.log('   ≡ƒôâ Parsing as text file...');
  
  const response = await drive.files.get({
    fileId,
    alt: 'media',
  }, { responseType: 'text' });
  
  return response.data as string;
}

/**
 * MASTER PARSER - detects format and uses correct parser
 */
async function parseFile(file: drive_v3.Schema$File): Promise<string> {
  const fileName = file.name || 'unknown';
  const mimeType = file.mimeType || '';
  const fileId = file.id!;
  
  console.log(`   ≡ƒôï File type: ${mimeType}`);
  
  try {
    // Google Docs native
    if (mimeType === 'application/vnd.google-apps.document') {
      return await parseGoogleDoc(fileId);
    }
    
    // Markdown
    if (fileName.endsWith('.md') || mimeType === 'text/markdown' || mimeType === 'text/plain') {
      return await parseMarkdown(fileId, fileName);
    }
    
    // DOCX binary
    if (fileName.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await parseBinaryDocx(fileId);
    }
    
    // PDF
    if (fileName.endsWith('.pdf') || mimeType === 'application/pdf') {
      return await parsePdf(fileId);
    }
    
    // Text file
    if (fileName.endsWith('.txt') || mimeType === 'text/plain') {
      return await parseTextFile(fileId);
    }
    
    throw new Error(`Unsupported file type: ${mimeType} (${fileName})`);
    
  } catch (error) {
    console.error(`   Γ¥î Parse error:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// ============================================================================
// CHUNKING & EMBEDDING
// ============================================================================

/**
 * Split content into chunks
 */
function chunkContent(content: string, chunkSize: number = CONFIG.CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  const sentences = content.split(/[.!?]+\s+/);
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(c => c.length > 50); // Filter out too short chunks
}

/**
 * Create embedding for chunk
 */
async function createEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 768  // ΓåÉ DODAJ TO!
  });
  
  return response.data[0].embedding;
}

// ============================================================================
// PINECONE OPERATIONS
// ============================================================================

/**
 * Upload chunks to Pinecone
 */
async function uploadToPinecone(
  chunks: Array<{ text: string; index: number }>,
  fileName: string,
  fileId: string,
  namespace: string,
  metadata?: Record<string, any>
): Promise<void> {
  console.log(`   ≡ƒôñ Uploading ${chunks.length} chunks to Pinecone...`);

  const batchSize = 50;
  let uploadedCount = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    const vectors = await Promise.all(
      batch.map(async (chunk) => {
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk.text,
          dimensions: 768,
        });

        // SANITIZE FILENAME - fix polskie znaki!
        const sanitizedFileName = fileName
          .replace(/─à/g, 'a').replace(/─ç/g, 'c').replace(/─Ö/g, 'e')
          .replace(/┼é/g, 'l').replace(/┼ä/g, 'n').replace(/├│/g, 'o')
          .replace(/┼¢/g, 's').replace(/┼║/g, 'z').replace(/┼╝/g, 'z')
          .replace(/─ä/g, 'A').replace(/─å/g, 'C').replace(/─ÿ/g, 'E')
          .replace(/┼ü/g, 'L').replace(/┼â/g, 'N').replace(/├ô/g, 'O')
          .replace(/┼Ü/g, 'S').replace(/┼╣/g, 'Z').replace(/┼╗/g, 'Z')
          .replace(/[^\x00-\x7F]/g, '')
          .replace(/[^a-zA-Z0-9._-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '');

        const vectorId = `${sanitizedFileName}-chunk-${chunk.index}-${Date.now()}`;

        return {
          id: vectorId,
          values: embedding.data[0].embedding,
          metadata: {
            ...metadata,
            text: chunk.text,
            chunk_index: chunk.index,
            file_id: fileId,
            source: fileName,
            created_at: new Date().toISOString(),
            total_chunks: chunks.length,
          },
        };
      })
    );

    try {
      await index.namespace(namespace).upsert(vectors);
      uploadedCount += batch.length;
      console.log(`   Γ£à Uploaded ${uploadedCount}/${chunks.length} chunks`);
    } catch (error) {
      console.error(`   ΓÜá∩╕Å  Failed to upload chunk ${i}:`, error);
    }
  }
}

// ============================================================================
// GOOGLE DRIVE OPERATIONS
// ============================================================================

/**
 * Get all folders (namespaces)
 */
async function getNamespaceFolders(): Promise<drive_v3.Schema$File[]> {
  const response = await drive.files.list({
    q: `'${CONFIG.GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  });
  
  return response.data.files || [];
}

/**
 * Get files in folder
 */
async function getFilesInFolder(folderId: string): Promise<drive_v3.Schema$File[]> {
  const allFiles: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  
  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime)',
      pageSize: 100,
      pageToken: pageToken,
    });
    
    const files = response.data.files || [];
    allFiles.push(...files);
    pageToken = response.data.nextPageToken || undefined;
    
    if (pageToken) {
      console.log(`   ... fetched ${allFiles.length} files so far, getting next page...`);
    }
  } while (pageToken);
  
  return allFiles;
}

// ============================================================================
// MAIN SYNC LOGIC
// ============================================================================

interface SyncStats {
  totalFiles: number;
  processed: number;
  skipped: number;
  errors: number;
  totalChunks: number;
}

/**
 * Process single file
 */
async function processFile(
  file: drive_v3.Schema$File,
  namespace: string,
  stats: SyncStats
): Promise<void> {
  const fileName = file.name || 'unknown';
  
  console.log(`\n   ≡ƒôä ${fileName}`);
  console.log('   ' + '-'.repeat(60));
  
  try {
    // Parse file
    const content = await parseFile(file);
    
    // Skip if empty
    if (!content || content.trim().length < 50) {
      console.log('   ΓÅ¡∩╕Å  Skipped: Content too short or empty');
      stats.skipped++;
      return;
    }
    
    console.log(`   Γ£à Parsed: ${content.length} characters`);
    
    // Chunk content
    const rawChunks = chunkContent(content);
    console.log(`   Γ£é∩╕Å  Split into ${rawChunks.length} chunks`);
    
    // Format chunks with index
    const chunks = rawChunks.map((text, index) => ({ text, index }));
    
    // Upload to Pinecone
    await uploadToPinecone(
      chunks,
      fileName,
      file.id!,
      namespace,
      { source: fileName }
    );
    
    stats.processed++;
    stats.totalChunks += chunks.length;
    
    console.log(`   Γ£à SUCCESS!`);
    
  } catch (error) {
    console.error(`   Γ¥î Error processing ${fileName}:`, error instanceof Error ? error.message : String(error));
    stats.errors++;
  }
}

/**
 * Main sync function
 */
async function syncGoogleDriveToPinecone(): Promise<void> {
  console.log('≡ƒÜÇ Starting Google Drive ΓåÆ Pinecone sync...');
  console.log('='*60);
  
  const stats: SyncStats = {
    totalFiles: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
    totalChunks: 0,
  };
  
  try {
    // Get namespace folders
    const folders = await getNamespaceFolders();
    console.log(`≡ƒôü Found ${folders.length} namespace folders\n`);
    
    // Process each namespace
    for (const folder of folders) {
      const namespace = folder.name || 'default';
      console.log(`≡ƒôï Processing namespace: ${namespace}`);
      console.log('ΓöÇ'.repeat(60));
      
      // Get files in folder
      const files = await getFilesInFolder(folder.id!);
      console.log(`   Found ${files.length} files`);
      
      stats.totalFiles += files.length;
      
      // Process each file
      for (const file of files) {
        await processFile(file, namespace, stats);
      }
      
      console.log('');
    }
    
    // Print summary
    console.log('\n' + '='*60);
    console.log('≡ƒôè SYNC COMPLETE!');
    console.log('='*60);
    console.log(`Total files processed: ${stats.totalFiles}`);
    console.log(`Γ£à Added: ${stats.processed}`);
    console.log(`ΓÅ¡∩╕Å  Skipped: ${stats.skipped}`);
    console.log(`Γ¥î Errors: ${stats.errors}`);
    console.log(`≡ƒôª Total chunks uploaded: ${stats.totalChunks}`);
    console.log('='*60);
    
    if (stats.processed > 0) {
      console.log('\nΓ£¿ SUCCESS! Your knowledge base has been updated!');
      console.log('\n≡ƒÆí Files are now available in RAG queries!');
      console.log('   - Player profiles: namespace player-profiles');
      console.log('   - Tactical knowledge: namespace tactical-knowledge');
      console.log('   - Commentary phrases: namespace commentary-phrases');
      console.log('   - etc.\n');
    }
    
  } catch (error) {
    console.error('\nΓ¥î FATAL ERROR:', error);
    process.exit(1);
  }
}

// ============================================================================
// RUN
// ============================================================================

syncGoogleDriveToPinecone();