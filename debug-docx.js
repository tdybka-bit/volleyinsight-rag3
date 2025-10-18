/**
 * Debug DOCX Parser
 * Debuguje parsowanie plików DOCX
 */

require('dotenv').config({ path: '.env.local' });
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

async function debugDocx() {
  console.log('🔍 Debugowanie DOCX Parser...\n');

  try {
    const filePath = path.join(__dirname, 'content', 'Tekst.docx');
    const fileBuffer = fs.readFileSync(filePath);
    
    console.log(`📁 Plik: ${filePath}`);
    console.log(`📊 Rozmiar: ${fileBuffer.length} bajtów`);
    
    // Test mammoth bezpośrednio
    console.log('\n🧪 Testowanie mammoth...');
    const result = await mammoth.convertToHtml({ buffer: fileBuffer });
    
    console.log('✅ Mammoth zakończone pomyślnie!');
    console.log(`📝 HTML długość: ${result.value.length} znaków`);
    console.log(`⚠️ Ostrzeżenia: ${result.messages.length}`);
    
    if (result.messages.length > 0) {
      console.log('\n📋 Ostrzeżenia:');
      result.messages.forEach((msg, index) => {
        console.log(`  ${index + 1}. ${msg.message}`);
      });
    }
    
    console.log('\n📄 Pierwsze 500 znaków HTML:');
    console.log(result.value.substring(0, 500));
    
    console.log('\n📄 Ostatnie 500 znaków HTML:');
    console.log(result.value.substring(Math.max(0, result.value.length - 500)));

  } catch (error) {
    console.error('❌ Błąd podczas debugowania:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Uruchom debug
debugDocx().catch(console.error);
















