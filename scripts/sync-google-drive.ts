import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// scripts/sync-google-drive.ts
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!; // "EdVolley RAG" folder ID
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
const SERVICE_ACCOUNT_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const index = pinecone.index('ed-volley');

const METADATA_FILE = path.join(process.cwd(), '.sync-metadata.json');

// ============================================================================
// TYPES
// ============================================================================

interface FileMetadata {
  path: string;
  last_modified: string;
  hash: string;
  synced_at: string;
  namespace: string;
}

interface SyncMetadata {
  [filePath: string]: FileMetadata;
}

interface ParsedContent {
  chunks: Array<{
    id: string;
    text: string;
    metadata: Record<string, any>;
  }>;
  namespace: string;
}

// ============================================================================
// GOOGLE DRIVE SETUP
// ============================================================================

async function initGoogleDrive() {
  const auth = new GoogleAuth({
    credentials: {
      client_email: SERVICE_ACCOUNT_EMAIL,
      private_key: SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });
  return drive;
}

// ============================================================================
// FILE READING
// ============================================================================

async function readDocxFile(drive: any, fileId: string): Promise<string> {
  // Export as plain text
  const response = await drive.files.export({
    fileId,
    mimeType: 'text/plain',
  }, { responseType: 'text' });
  
  return response.data;
}

async function readPdfFile(drive: any, fileId: string): Promise<string> {
  // Download PDF and extract text (using pdf-parse or similar)
  const response = await drive.files.get({
    fileId,
    alt: 'media',
  }, { responseType: 'arraybuffer' });
  
  // Simple text extraction (you can use pdf-parse for better results)
  const buffer = Buffer.from(response.data);
  return buffer.toString('utf-8'); // Basic extraction
}

async function readTxtFile(drive: any, fileId: string): Promise<string> {
  const response = await drive.files.get({
    fileId,
    alt: 'media',
  }, { responseType: 'text' });
  
  return response.data;
}

async function readFile(drive: any, file: any): Promise<string> {
  const mimeType = file.mimeType;
  
  if (mimeType === 'application/vnd.google-apps.document') {
    return await readDocxFile(drive, file.id);
  } else if (mimeType === 'application/pdf') {
    return await readPdfFile(drive, file.id);
  } else if (mimeType === 'text/plain') {
    return await readTxtFile(drive, file.id);
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return await readDocxFile(drive, file.id);
  } else {
    console.log(`   ⚠️  Unsupported file type: ${mimeType}`);
    return '';
  }
}

// ============================================================================
// AI PARSING WITH GEMINI
// ============================================================================

async function parseContentWithAI(content: string, namespace: string, filename: string): Promise<ParsedContent> {
  const systemPrompt = `Jesteś ekspertem w analizie tekstów dla systemu RAG generującego komentarze siatkarskie.

KONTEKST:
- Namespace: ${namespace}
- Plik: ${filename}

ZADANIE:
Przeanalizuj tekst i wyciągnij kluczowe informacje. Zwróć TYLKO JSON array (bez markdown, bez \`\`\`).

FORMAT:
[
  {
    "id": "unique-id",
    "text": "pełny tekst do embeddingu (po polsku)",
    "metadata": { /* metadata zależne od namespace */ }
  }
]

METADATA DLA NAMESPACES:

**naming-rules:**
{
  "rule_category": "surname_declension",
  "player_name": "Leon Venero",
  "pattern": "ending_in_o",
  "origin": "italian",
  "rule_text": "krótki opis zasady",
  "examples": "Vico → Vica, Vikiem"
}

**player-profiles:**
{
  "player_name": "Bartosz Kwolek",
  "team": "Aluron CMC Warta Zawiercie",
  "position": "środkowy",
  "strengths": "blok, energia",
  "commentary_hints": "nieprzebity mur Aluronu",
  "personality": "energiczny"
}

**commentary-phrases:**
{
  "category": "block",
  "phrase": "Zamknął drzwi i zgasił światło!",
  "intensity": "dramatic",
  "when_to_use": "drużyna ma przewagę",
  "frequency": "rare"
}

**set-summaries:**
{
  "scenario": "close_set_win",
  "template": "tekst z {team}, {score}",
  "when_to_use": "różnica 1-3 punktów",
  "key_elements": "wynik, emocje"
}

**tactical-knowledge:**
{
  "topic": "blok obrona",
  "level": "advanced",
  "description": "opis taktyki",
  "when_applicable": "kiedy stosować"
}

WAŻNE:
- Wyciągnij WSZYSTKIE istotne informacje
- Każda odrębna info = osobny chunk
- "text" musi być kompletny i zrozumiały
- Zwróć TYLKO JSON array`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const responseText = response.choices[0].message.content || '[]';
    
    // Clean response
    let cleanJson = responseText.trim();
    cleanJson = cleanJson.replace(/```json\n?/g, '');
    cleanJson = cleanJson.replace(/```\n?/g, '');
    cleanJson = cleanJson.trim();
    
    const chunks = JSON.parse(cleanJson);
    
    return {
      chunks,
      namespace,
    };
  } catch (error: any) {
    console.error(`   ❌ GPT parsing error:`, error.message);
    
    // Fallback: treat entire content as one chunk
    return {
      chunks: [{
        id: `${namespace}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: content,
        metadata: {
          filename,
          raw_content: true,
        },
      }],
      namespace,
    };
  }
}

// ============================================================================
// EMBEDDING & UPLOAD
// ============================================================================

async function createEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 768,  // ← DODAJ TĘ LINIĘ!
  });
  return response.data[0].embedding;
}

async function uploadToPinecone(parsed: ParsedContent) {
  const vectors = [];
  
  for (const chunk of parsed.chunks) {
    const embedding = await createEmbedding(chunk.text);
    
    vectors.push({
      id: chunk.id,
      values: embedding,
      metadata: {
        ...chunk.metadata,
        text_preview: chunk.text.substring(0, 500),
      },
    });
    
    // Rate limit protection
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Batch upsert
  if (vectors.length > 0) {
    await index.namespace(parsed.namespace).upsert(vectors);
  }
  
  return vectors.length;
}

// ============================================================================
// METADATA TRACKING
// ============================================================================

function loadMetadata(): SyncMetadata {
  if (fs.existsSync(METADATA_FILE)) {
    return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
  }
  return {};
}

function saveMetadata(metadata: SyncMetadata) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

function generateHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

// ============================================================================
// MAIN SYNC
// ============================================================================

async function syncGoogleDrive() {
  console.log('🚀 Starting Google Drive → Pinecone sync...\n');
  
  const drive = await initGoogleDrive();
  const metadata = loadMetadata();
  
  const stats = {
    total: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    chunks: 0,
  };

  // Get subfolders (namespaces)
  const foldersResponse = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  });

  const folders = foldersResponse.data.files || [];
  
  console.log(`📁 Found ${folders.length} namespace folders\n`);

  for (const folder of folders) {
    const namespace = folder.name!;
    console.log(`\n📋 Processing namespace: ${namespace}`);
    console.log('─'.repeat(60));

    // Get files in folder
    const filesResponse = await drive.files.list({
      q: `'${folder.id}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, modifiedTime)',
    });

    const files = filesResponse.data.files || [];
    console.log(`   Found ${files.length} files`);

    for (const file of files) {
      stats.total++;
      const filePath = `${namespace}/${file.name}`;
      
      try {
        // Read file content
        const content = await readFile(drive, file);
        
        if (!content || content.trim() === '') {
          stats.skipped++;
          console.log(`   ⏭️  Skipped (empty): ${file.name}`);
          continue;
        }

        const contentHash = generateHash(content);
        const lastModified = file.modifiedTime!;

        // Check if needs sync
        const existingMeta = metadata[filePath];
        if (existingMeta && existingMeta.hash === contentHash) {
          stats.skipped++;
          continue;
        }

        // Parse with AI
        console.log(`   🤖 Parsing: ${file.name}...`);
        const parsed = await parseContentWithAI(content, namespace, file.name!);

        // Upload to Pinecone
        const uploadedCount = await uploadToPinecone(parsed);
        stats.chunks += uploadedCount;

        // Update metadata
        metadata[filePath] = {
          path: filePath,
          last_modified: lastModified,
          hash: contentHash,
          synced_at: new Date().toISOString(),
          namespace,
        };

        if (existingMeta) {
          stats.updated++;
          console.log(`   ✏️  Updated: ${file.name} (${uploadedCount} chunks)`);
        } else {
          stats.added++;
          console.log(`   ✅ Added: ${file.name} (${uploadedCount} chunks)`);
        }

      } catch (error: any) {
        stats.errors++;
        console.error(`   ❌ Error processing ${file.name}:`, error.message);
      }
    }
  }

  // Save metadata
  saveMetadata(metadata);

  // Final stats
  console.log('\n' + '='.repeat(60));
  console.log('📊 SYNC COMPLETE!');
  console.log('='.repeat(60));
  console.log(`Total files processed: ${stats.total}`);
  console.log(`✅ Added: ${stats.added}`);
  console.log(`✏️  Updated: ${stats.updated}`);
  console.log(`⏭️  Skipped: ${stats.skipped}`);
  console.log(`❌ Errors: ${stats.errors}`);
  console.log(`📦 Total chunks uploaded: ${stats.chunks}`);
  console.log('='.repeat(60));
}

// Run
syncGoogleDrive().catch(console.error);