import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Brak pliku' },
        { status: 400 }
      );
    }

    // Sprawdź rozszerzenie pliku
    const fileName = file.name;
    const fileExt = path.extname(fileName).toLowerCase();
    
    if (!['.docx', '.md', '.pdf'].includes(fileExt)) {
      return NextResponse.json(
        { error: 'Nieobsługiwany format pliku. Dozwolone: .docx, .md, .pdf' },
        { status: 400 }
      );
    }

    // Utwórz folder content jeśli nie istnieje
    const contentDir = path.join(process.cwd(), 'content');
    if (!existsSync(contentDir)) {
      await mkdir(contentDir, { recursive: true });
    }

    // Zapisz plik
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(contentDir, fileName);
    
    await writeFile(filePath, buffer);
    console.log(`Zapisano plik: ${filePath}`);

    // Uruchom parsowanie w tle
    const projectRoot = process.cwd();
    
    // Parsuj dokumenty
    console.log('Rozpoczynam parsowanie dokumentów...');
    const parseCommand = process.platform === 'win32' 
      ? `cd ${projectRoot} && npx tsx scripts/parseAllDocuments.ts`
      : `cd ${projectRoot} && npx tsx scripts/parseAllDocuments.ts`;
    
    const { stdout: parseOutput, stderr: parseError } = await execAsync(parseCommand);
    
    if (parseError) {
      console.error('Błąd parsowania:', parseError);
    }
    console.log('Parsowanie zakończone:', parseOutput);

    // Wyczyść starą kolekcję
    console.log('Czyszczenie ChromaDB...');
    const clearCommand = process.platform === 'win32'
      ? `cd ${projectRoot} && node scripts/clearChroma.js`
      : `cd ${projectRoot} && node scripts/clearChroma.js`;
    
    await execAsync(clearCommand);

    // Zaindeksuj do ChromaDB
    console.log('Rozpoczynam indeksowanie...');
    const embedCommand = process.platform === 'win32'
      ? `cd ${projectRoot} && node scripts/embedDocuments.js`
      : `cd ${projectRoot} && node scripts/embedDocuments.js`;
    
    const { stdout: embedOutput, stderr: embedError } = await execAsync(embedCommand);
    
    if (embedError) {
      console.error('Błąd indeksowania:', embedError);
    }
    console.log('Indeksowanie zakończone:', embedOutput);

    return NextResponse.json({
      success: true,
      message: `Plik ${fileName} został pomyślnie dodany i zaindeksowany`,
      filename: fileName,
      details: {
        parsed: parseOutput.includes('✅'),
        indexed: embedOutput.includes('✅')
      }
    });

  } catch (error) {
    console.error('Błąd uploadu:', error);
    return NextResponse.json(
      { 
        error: 'Błąd podczas przetwarzania pliku',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}

// Konfiguracja - maksymalny rozmiar pliku 10MB
export const config = {
  api: {
    bodyParser: false,
  },
};