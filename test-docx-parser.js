/**
 * Test DOCX Parser
 * Testuje parsowanie plików DOCX
 */

require('dotenv').config({ path: '.env.local' });
const { DocxParser } = require('./lib/docxParser.ts');
const fs = require('fs');
const path = require('path');

async function testDocxParser() {
  console.log('🧪 Testowanie DOCX Parser...\n');

  try {
    // Sprawdź czy mamy pliki DOCX do testowania
    const contentDir = path.join(__dirname, 'content');
    const files = fs.readdirSync(contentDir);
    const docxFiles = files.filter(file => file.endsWith('.docx'));
    
    if (docxFiles.length === 0) {
      console.log('❌ Brak plików DOCX do testowania');
      console.log('💡 Dodaj plik .docx do folderu content/ aby przetestować parser');
      return;
    }

    console.log(`📁 Znaleziono ${docxFiles.length} plików DOCX:`);
    docxFiles.forEach(file => console.log(`  - ${file}`));

    // Testuj drugi plik (Upload.docx)
    const testFile = docxFiles.find(f => f.includes('Upload')) || docxFiles[0];
    console.log(`\n🔍 Testowanie pliku: ${testFile}`);
    
    // Symuluj File object
    const filePath = path.join(contentDir, testFile);
    const fileBuffer = fs.readFileSync(filePath);
    
    // Stwórz mock File object
    const mockFile = {
      name: testFile,
      arrayBuffer: async () => fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
    };

    // Parse DOCX
    console.log('📝 Parsowanie pliku...');
    const parsedDoc = await DocxParser.parseDocx(mockFile);
    
    console.log('✅ Parsowanie zakończone pomyślnie!');
    console.log(`📊 Statystyki:`);
    console.log(`  - Liczba sekcji: ${parsedDoc.sections.length}`);
    console.log(`  - Całkowita liczba słów: ${parsedDoc.metadata.totalWordCount}`);
    console.log(`  - Tematy: ${parsedDoc.metadata.topics.join(', ')}`);
    
    console.log(`\n📋 Pierwsze 3 sekcje:`);
    parsedDoc.sections.slice(0, 3).forEach((section, index) => {
      console.log(`\n${index + 1}. ${section.title}`);
      console.log(`   Poziom: ${section.level}`);
      console.log(`   Temat: ${section.topic || 'brak'}`);
      console.log(`   Słowa: ${section.metadata.wordCount}`);
      console.log(`   Treść: ${section.content.substring(0, 100)}...`);
    });

    // Test zapisu do markdown
    console.log(`\n💾 Testowanie zapisu do markdown...`);
    const markdownFiles = await DocxParser.saveToContentFolder(parsedDoc.sections);
    
    console.log(`✅ Wygenerowano ${Object.keys(markdownFiles).length} plików markdown:`);
    Object.keys(markdownFiles).forEach(filename => {
      const content = markdownFiles[filename];
      console.log(`  - ${filename} (${content.length} znaków)`);
    });

    console.log('\n🎉 Test DOCX Parser zakończony pomyślnie!');

  } catch (error) {
    console.error('❌ Błąd podczas testowania DOCX Parser:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Uruchom test
testDocxParser().catch(console.error);
