/**
 * ============================================================================
 * VERIFY PINECONE COMPLETENESS
 * ============================================================================
 * 
 * Compares Google Drive files vs Pinecone vectors per namespace.
 * Ensures ALL MD files from EVERY folder made it to Pinecone.
 * 
 * Usage: npx tsx scripts/verify-pinecone-completeness.ts
 * 
 * ============================================================================
 */

import { google, drive_v3 } from 'googleapis';
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!;
const PINECONE_INDEX = 'ed-volley';

// ============================================================================
// INITIALIZE CLIENTS
// ============================================================================

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index(PINECONE_INDEX);

// Google Drive auth (same as sync-google-drive.ts - uses env vars)
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

// ============================================================================
// HELPERS
// ============================================================================

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
  } while (pageToken);
  
  return allFiles;
}

async function getNamespaceFolders(): Promise<drive_v3.Schema$File[]> {
  const response = await drive.files.list({
    q: `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
  });
  return response.data.files || [];
}

async function getPineconeVectorCount(namespace: string): Promise<number> {
  try {
    const stats = await index.describeIndexStats();
    const nsStats = stats.namespaces?.[namespace];
    return nsStats?.recordCount || 0;
  } catch (error) {
    console.error(`Error getting stats for namespace ${namespace}:`, error);
    return -1;
  }
}

async function listPineconeIds(namespace: string, limit: number = 1000): Promise<string[]> {
  try {
    const results = await index.namespace(namespace).listPaginated({ limit });
    const ids: string[] = [];
    if (results.vectors) {
      for (const v of results.vectors) {
        if (v.id) ids.push(v.id);
      }
    }
    return ids;
  } catch (error) {
    return [];
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function verify(): Promise<void> {
  console.log('🔍 VERIFY PINECONE COMPLETENESS');
  console.log('=' .repeat(70));
  console.log('Comparing Google Drive files vs Pinecone vectors per namespace\n');
  
  const folders = await getNamespaceFolders();
  console.log(`📁 Found ${folders.length} namespace folders in Google Drive\n`);
  
  let totalDriveFiles = 0;
  let totalPineconeVectors = 0;
  let totalMissing = 0;
  
  const results: Array<{
    namespace: string;
    driveFiles: number;
    pineconeVectors: number;
    status: string;
    missingFiles: string[];
  }> = [];
  
  for (const folder of folders) {
    const namespace = folder.name || 'unknown';
    console.log(`📋 ${namespace}`);
    console.log('─'.repeat(50));
    
    // Get Drive files
    const files = await getFilesInFolder(folder.id!);
    const supportedFiles = files.filter(f => {
      const name = f.name || '';
      return name.endsWith('.md') || name.endsWith('.txt') || name.endsWith('.docx') || name.endsWith('.pdf') ||
             f.mimeType === 'application/vnd.google-apps.document';
    });
    
    // Get Pinecone vectors
    const vectorCount = await getPineconeVectorCount(namespace);
    const pineconeIds = await listPineconeIds(namespace);
    
    // Check which files are missing
    const missingFiles: string[] = [];
    for (const file of supportedFiles) {
      const fileId = file.id || '';
      const fileName = file.name || '';
      // Check if any Pinecone ID contains this file's ID or name
      const found = pineconeIds.some(id => 
        id.includes(fileId) || id.includes(fileName.replace(/\.[^.]+$/, ''))
      );
      if (!found && pineconeIds.length > 0) {
        missingFiles.push(fileName);
      }
    }
    
    const status = vectorCount >= supportedFiles.length ? '✅' : 
                   vectorCount > 0 ? '⚠️' : '❌';
    
    console.log(`   Drive files: ${supportedFiles.length}`);
    console.log(`   Pinecone vectors: ${vectorCount}`);
    console.log(`   Status: ${status} ${vectorCount >= supportedFiles.length ? 'COMPLETE' : 'INCOMPLETE'}`);
    
    if (missingFiles.length > 0 && missingFiles.length <= 10) {
      console.log(`   Missing: ${missingFiles.join(', ')}`);
    } else if (missingFiles.length > 10) {
      console.log(`   Missing: ${missingFiles.length} files (too many to list)`);
    }
    
    console.log('');
    
    totalDriveFiles += supportedFiles.length;
    totalPineconeVectors += vectorCount;
    totalMissing += missingFiles.length;
    
    results.push({
      namespace,
      driveFiles: supportedFiles.length,
      pineconeVectors: vectorCount,
      status,
      missingFiles,
    });
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Drive files: ${totalDriveFiles}`);
  console.log(`Total Pinecone vectors: ${totalPineconeVectors}`);
  console.log(`Synced: ${totalDriveFiles - totalMissing}/${totalDriveFiles} (${((totalDriveFiles - totalMissing) / totalDriveFiles * 100).toFixed(1)}%)`);
  
  if (totalMissing > 0) {
    console.log(`\n⚠️  ${totalMissing} files potentially missing from Pinecone!`);
    console.log('Run sync-google-drive.ts to fix.\n');
  } else {
    console.log('\n✅ ALL FILES SYNCED SUCCESSFULLY!\n');
  }
  
  // Table
  console.log('Namespace'.padEnd(25) + 'Drive'.padEnd(8) + 'Pinecone'.padEnd(10) + 'Status');
  console.log('-'.repeat(55));
  for (const r of results) {
    console.log(
      r.namespace.padEnd(25) +
      String(r.driveFiles).padEnd(8) +
      String(r.pineconeVectors).padEnd(10) +
      r.status
    );
  }
}

verify().catch(console.error);