/**
 * Debug Lines
 * Debuguje dzielenie na linie
 */

require('dotenv').config({ path: '.env.local' });
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

async function debugLines() {
  console.log('🔍 Debugowanie linii...\n');

  try {
    const filePath = path.join(__dirname, 'content', 'Tekst.docx');
    const fileBuffer = fs.readFileSync(filePath);
    
    const result = await mammoth.convertToHtml({ buffer: fileBuffer });
    const cleanHtml = result.value.replace(/<[^>]*>/g, '').replace(/<br\s*\/?>/gi, '\n');
    const lines = cleanHtml.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    console.log(`📝 Liczba linii: ${lines.length}`);
    console.log('\n📋 Pierwsze 20 linii:');
    
    lines.slice(0, 20).forEach((line, i) => {
      const isTitle = /^\d+\s+[A-ZĄĆĘŁŃÓŚŹŻ]/.test(line) && line.length < 100;
      console.log(`${i + 1}. "${line.substring(0, 50)}${line.length > 50 ? '...' : ''}" ${isTitle ? '✅ TYTUŁ' : '❌'}`);
    });

  } catch (error) {
    console.error('❌ Błąd:', error);
  }
}

debugLines().catch(console.error);

