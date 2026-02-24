/**
 * verify-pinecone-completeness.ts
 * 
 * Porównuje pliki na Google Drive z vectorami w Pinecone.
 * Pokazuje które pliki BRAKUJĄ w Pinecone.
 * 
 * Użycie: npx tsx scripts/verify-pinecone-completeness.ts
 */

import { google, drive_v3 } from 'googleapis';
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!;

// Google Drive auth (from .env.local — same as sync script)
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

// Pinecone
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index('ed-volley');

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get ALL files in folder (with pagination!)
 */
async function getAllFilesInFolder(folderId: string): Promise<drive_v3.Schema$File[]> {
  const allFiles: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime)',
      pageSize: 100,
      ...(pageToken ? { pageToken } : {}),
    });

    const files = response.data.files || [];
    allFiles.push(...files);
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return allFiles;
}

/**
 * Get unique source filenames from Pinecone namespace
 */
async function getPineconeSources(namespace: string): Promise<Set<string>> {
  const sources = new Set<string>();
  
  // Query with zero vector to get all results
  const results = await index.namespace(namespace).query({
    vector: Array(768).fill(0),
    topK: 10000,
    includeMetadata: true,
  });

  for (const match of results.matches) {
    const source = match.metadata?.source as string;
    if (source) {
      sources.add(source);
    }
  }

  return sources;
}

// ============================================================================
// MAIN
// ============================================================================

async function verify(): Promise<void> {
  console.log('🔍 WERYFIKACJA: Google Drive vs Pinecone\n');
  console.log('='.repeat(70));

  // Get namespace folders
  const foldersResponse = await drive.files.list({
    q: `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  });
  const folders = foldersResponse.data.files || [];

  let totalDriveFiles = 0;
  let totalPineconeSources = 0;
  let totalMissing = 0;

  for (const folder of folders) {
    const namespace = folder.name || 'unknown';
    console.log(`\n📁 ${namespace}`);
    console.log('─'.repeat(70));

    // Get Drive files (WITH PAGINATION!)
    const driveFiles = await getAllFilesInFolder(folder.id!);
    const driveFileNames = new Set(driveFiles.map(f => f.name || ''));

    // Get Pinecone sources
    const pineconeSources = await getPineconeSources(namespace);

    // Compare
    const missing: string[] = [];
    for (const fileName of driveFileNames) {
      // Check if filename appears in any Pinecone source
      const found = [...pineconeSources].some(source => 
        source === fileName || 
        source.includes(fileName.replace(/\.[^.]+$/, '')) // strip extension
      );
      if (!found) {
        missing.push(fileName);
      }
    }

    // Extra in Pinecone (uploaded but deleted from Drive)
    const extra: string[] = [];
    for (const source of pineconeSources) {
      const found = [...driveFileNames].some(name => 
        source === name || 
        source.includes(name.replace(/\.[^.]+$/, ''))
      );
      if (!found) {
        extra.push(source);
      }
    }

    totalDriveFiles += driveFiles.length;
    totalPineconeSources += pineconeSources.size;
    totalMissing += missing.length;

    console.log(`   Drive files:     ${driveFiles.length}`);
    console.log(`   Pinecone sources: ${pineconeSources.size}`);
    
    if (missing.length === 0) {
      console.log(`   ✅ KOMPLETNE — wszystkie pliki z Drive są w Pinecone`);
    } else {
      console.log(`   ❌ BRAKUJE ${missing.length} plików w Pinecone:`);
      missing.slice(0, 20).forEach(f => console.log(`      • ${f}`));
      if (missing.length > 20) {
        console.log(`      ... i ${missing.length - 20} więcej`);
      }
    }

    if (extra.length > 0) {
      console.log(`   ⚠️  ${extra.length} źródeł w Pinecone nie ma już na Drive:`);
      extra.slice(0, 10).forEach(f => console.log(`      • ${f}`));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 PODSUMOWANIE');
  console.log('='.repeat(70));
  console.log(`Pliki na Drive (łącznie):      ${totalDriveFiles}`);
  console.log(`Źródła w Pinecone (łącznie):   ${totalPineconeSources}`);
  console.log(`Brakujące w Pinecone:          ${totalMissing}`);
  
  if (totalMissing === 0) {
    console.log('\n✅ WSZYSTKO ZSYNCHRONIZOWANE!');
  } else {
    console.log(`\n❌ ${totalMissing} plików wymaga ponownego synca!`);
    console.log('   Najpierw napraw paginację w sync-google-drive.ts,');
    console.log('   potem odpal: npx tsx scripts/sync-google-drive.ts');
  }
}

verify().catch(console.error);