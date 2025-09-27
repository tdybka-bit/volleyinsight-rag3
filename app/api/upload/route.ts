import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { loadMarkdownFiles } from '@/lib/markdownLoader';
import { embedAndStore, getCollectionStats } from '@/lib/vectorStore';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'general';

    if (!file) {
      return NextResponse.json(
        { error: 'Brak pliku do przesłania' },
        { status: 400 }
      );
    }

    // Sprawdź typ pliku
    if (!file.name.endsWith('.md')) {
      return NextResponse.json(
        { error: 'Tylko pliki .md są obsługiwane' },
        { status: 400 }
      );
    }

    console.log(`📁 Upload pliku: ${file.name} (typ: ${type})`);

    // Zapisz plik do katalogu content
    const contentDir = join(process.cwd(), 'content');
    const filePath = join(contentDir, file.name);

    try {
      // Utwórz katalog content jeśli nie istnieje
      await mkdir(contentDir, { recursive: true });
      
      // Zapisz plik
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);
      
      console.log(`✅ Plik zapisany: ${filePath}`);
    } catch (fileError) {
      console.error('Błąd zapisywania pliku:', fileError);
      return NextResponse.json(
        { error: 'Błąd zapisywania pliku' },
        { status: 500 }
      );
    }

    // Załaduj i przetwórz plik
    try {
      console.log('🔄 Przetwarzanie pliku...');
      const chunks = await loadMarkdownFiles(contentDir, 500, 100);
      
      // Filtruj tylko chunks z tego pliku
      const fileChunks = chunks.filter(chunk => chunk.filename === file.name);
      
      if (fileChunks.length === 0) {
        return NextResponse.json(
          { error: 'Nie udało się przetworzyć pliku' },
          { status: 500 }
        );
      }

      // Dodaj do ChromaDB
      console.log(`💾 Dodawanie ${fileChunks.length} chunków do ChromaDB...`);
      await embedAndStore(fileChunks);

      // Pobierz aktualne statystyki
      const stats = await getCollectionStats();

      console.log(`🎉 Plik pomyślnie przetworzony i dodany do bazy danych`);

      return NextResponse.json({
        success: true,
        message: `Plik "${file.name}" został pomyślnie przetworzony i dodany do bazy wiedzy`,
        data: {
          filename: file.name,
          chunksCount: fileChunks.length,
          type: type,
          totalChunks: stats?.totalChunks || 0,
          typeDistribution: stats?.typeDistribution || {}
        },
        timestamp: new Date().toISOString()
      });

    } catch (processingError) {
      console.error('Błąd przetwarzania pliku:', processingError);
      return NextResponse.json(
        {
          success: false,
          error: 'Błąd przetwarzania pliku',
          details: processingError instanceof Error ? processingError.message : 'Nieznany błąd'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Błąd API upload:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Błąd podczas przesyłania pliku',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}

// GET endpoint do sprawdzenia statusu upload
export async function GET() {
  try {
    const stats = await getCollectionStats();
    
    return NextResponse.json({
      success: true,
      status: 'Upload API działa',
      database: {
        connected: true,
        totalChunks: stats?.totalChunks || 0,
        types: stats?.typeDistribution || {}
      },
      supportedFormats: ['.md'],
      maxFileSize: '10MB',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        status: 'Upload API - błąd połączenia z bazą danych',
        error: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}
