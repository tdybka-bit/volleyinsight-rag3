/**
 * ============================================================================
 * GOOGLE DRIVE → PINECONE SYNC
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
 * v2.0 - 2026-02-24: Fixed pagination in getFilesInFolder (was missing 100+ files!)
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
  console.log('   📝 Parsing as Markdown...');

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
  console.log('   📄 Parsing as Google Doc (native)...');

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
  console.log('   📄 Parsing as binary DOCX...');

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
  console.log('   📕 Parsing as PDF...');

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
  console.log('   📃 Parsing as text file...');

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

  console.log(`   📋 File type: ${mimeType}`);

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
    console.error(`   ❌ Parse error:`, error instanceof Error ? error.message : String(error));
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
    dimensions: 768,
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
  console.log(`   📤 Uploading ${chunks.length} chunks to Pinecone...`);

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
          .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e')
          .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o')
          .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
          .replace(/Ą/g, 'A').replace(/Ć/g, 'C').replace(/Ę/g, 'E')
          .replace(/Ł/g, 'L').replace(/Ń/g, 'N').replace(/Ó/g, 'O')
          .replace(/Ś/g, 'S').replace(/Ź/g, 'Z').replace(/Ż/g, 'Z')
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
      console.log(`   ✅ Uploaded ${uploadedCount}/${chunks.length} chunks`);
    } catch (error) {
      console.error(`   ⚠️  Failed to upload chunk ${i}:`, error);
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
 * Get ALL files in folder (with pagination — handles 100+ files!)
 * 
 * FIX v2.0: Google Drive API returns max ~100 files per page.
 * Without pagination, folders with 100+ files (like player-profiles with 224)
 * were silently truncated, causing missing data in Pinecone.
 */
async function getFilesInFolder(folderId: string): Promise<drive_v3.Schema$File[]> {
  const allFiles: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined = undefined;
  let pageNum = 0;

  do {
    pageNum++;
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime)',
      pageSize: 100,
      ...(pageToken ? { pageToken } : {}),
    });

    const files = response.data.files || [];
    allFiles.push(...files);
    pageToken = response.data.nextPageToken || undefined;

    if (pageNum > 1) {
      console.log(`   📄 Page ${pageNum}: +${files.length} files (total: ${allFiles.length})`);
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

  console.log(`\n   📄 ${fileName}`);
  console.log('   ' + '-'.repeat(60));

  try {
    // Parse file
    const content = await parseFile(file);

    // Skip if empty
    if (!content || content.trim().length < 50) {
      console.log('   ⏭️  Skipped: Content too short or empty');
      stats.skipped++;
      return;
    }

    console.log(`   ✅ Parsed: ${content.length} characters`);

    // Chunk content
    const rawChunks = chunkContent(content);
    console.log(`   ✂️  Split into ${rawChunks.length} chunks`);

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

    console.log(`   ✅ SUCCESS!`);

  } catch (error) {
    console.error(`   ❌ Error processing ${fileName}:`, error instanceof Error ? error.message : String(error));
    stats.errors++;
  }
}

/**
 * Main sync function
 */
async function syncGoogleDriveToPinecone(): Promise<void> {
  console.log('🚀 Starting Google Drive → Pinecone sync (v2.0 — with pagination fix)...');
  console.log('='.repeat(60));

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
    console.log(`📁 Found ${folders.length} namespace folders\n`);

    // Process each namespace
    for (const folder of folders) {
      const namespace = folder.name || 'default';
      console.log(`📋 Processing namespace: ${namespace}`);
      console.log('─'.repeat(60));

      // Get files in folder (NOW WITH PAGINATION!)
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
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Total files processed: ${stats.totalFiles}`);
    console.log(`✅ Added: ${stats.processed}`);
    console.log(`⏭️  Skipped: ${stats.skipped}`);
    console.log(`❌ Errors: ${stats.errors}`);
    console.log(`📦 Total chunks uploaded: ${stats.totalChunks}`);
    console.log('='.repeat(60));

    if (stats.processed > 0) {
      console.log('\n✨ SUCCESS! Your knowledge base has been updated!');
      console.log('\n💡 Files are now available in RAG queries!');
      console.log('   - Player profiles: namespace player-profiles');
      console.log('   - Tactical knowledge: namespace tactical-knowledge');
      console.log('   - Commentary phrases: namespace commentary-phrases');
      console.log('   - etc.\n');
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

// ============================================================================
// RUN
// ============================================================================

syncGoogleDriveToPinecone();