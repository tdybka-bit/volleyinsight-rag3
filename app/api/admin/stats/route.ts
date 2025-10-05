import { NextRequest, NextResponse } from 'next/server';
import { getCollectionStats } from '@/lib/vectorStore';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Pobieranie statystyk bazy danych...');

    // 1. Pobierz statystyki z ChromaDB
    const dbStats = await getCollectionStats();
    console.log('✅ Statystyki ChromaDB:', dbStats);

    // 2. Pobierz listę plików w folderze content
    const contentDir = path.join(process.cwd(), 'content');
    let contentFiles: any[] = [];
    
    try {
      const files = await fs.readdir(contentDir);
      contentFiles = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(contentDir, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            size: stats.size,
            modified: stats.mtime,
            type: path.extname(file).toLowerCase()
          };
        })
      );
    } catch (error) {
      console.log('⚠️ Brak folderu content lub błąd odczytu:', error);
    }

    // 3. Oblicz statystyki według typu
    const typeBreakdown = dbStats?.typeDistribution || {};
    const totalChunks = dbStats?.totalChunks || 0;

    // 4. Pobierz historię uploadów (symulacja - w rzeczywistości można dodać do bazy)
    const recentUploads = [
      {
        id: 1,
        filename: 'Tekst.docx',
        uploadDate: new Date().toISOString(),
        status: 'completed',
        chunksCount: totalChunks,
        fileSize: contentFiles.find(f => f.name === 'Tekst.docx')?.size || 0
      }
    ];

    // 5. Oblicz rozmiar bazy danych (przybliżony)
    const estimatedDbSize = totalChunks * 0.5; // ~0.5KB per chunk

    const stats = {
      success: true,
      timestamp: new Date().toISOString(),
      general: {
        totalChunks: totalChunks,
        totalFiles: contentFiles.length,
        lastUpload: contentFiles.length > 0 
          ? Math.max(...contentFiles.map(f => f.modified.getTime()))
          : null,
        databaseSize: `${estimatedDbSize.toFixed(2)} KB`
      },
      breakdown: {
        byType: typeBreakdown,
        byFile: contentFiles.map(file => ({
          filename: file.name,
          chunks: Math.floor(totalChunks / contentFiles.length), // Przybliżone
          size: `${(file.size / 1024).toFixed(2)} KB`,
          type: file.type
        })),
        totalSize: `${contentFiles.reduce((sum, f) => sum + f.size, 0) / 1024} KB`
      },
      recentUploads: recentUploads,
      files: contentFiles.map(file => ({
        name: file.name,
        size: file.size,
        modified: file.modified,
        type: file.type
      }))
    };

    console.log('📊 Statystyki wygenerowane:', {
      totalChunks: stats.general.totalChunks,
      totalFiles: stats.general.totalFiles,
      types: Object.keys(stats.breakdown.byType).length
    });

    return NextResponse.json(stats);

  } catch (error) {
    console.error('❌ Błąd pobierania statystyk:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Błąd podczas pobierania statystyk bazy danych',
        details: error instanceof Error ? error.message : 'Nieznany błąd',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}



