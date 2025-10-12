/**
 * Debug Regex
 * Debuguje regex do znajdowania tytułów
 */

require('dotenv').config({ path: '.env.local' });
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

async function debugRegex() {
  console.log('🔍 Debugowanie regex...\n');

  try {
    const filePath = path.join(__dirname, 'content', 'Tekst.docx');
    const fileBuffer = fs.readFileSync(filePath);
    
    const result = await mammoth.convertToHtml({ buffer: fileBuffer });
    const cleanHtml = result.value.replace(/<[^>]*>/g, '').replace(/<br\s*\/?>/gi, '\n');
    
    console.log(`📝 Clean HTML długość: ${cleanHtml.length} znaków`);
    console.log('\n📄 Pierwsze 500 znaków:');
    console.log(cleanHtml.substring(0, 500));
    
    // Test regex
    const titleRegex = /(\n|^)(\d+\s+[A-ZĄĆĘŁŃÓŚŹŻ][^\n]*(?:\n(?!\d+\s+[A-ZĄĆĘŁŃÓŚŹŻ])[^\n]*)*)/gm
    const matches = Array.from(cleanHtml.matchAll(titleRegex));
    
    console.log(`\n🔍 Znaleziono ${matches.length} dopasowań:`);
    
    matches.slice(0, 5).forEach((match, i) => {
      const fullText = match[2].trim();
      const lines = fullText.split('\n');
      const title = lines[0].trim();
      const content = lines.slice(1).join('\n').trim();
      
      console.log(`\n${i + 1}. Tytuł: "${title}"`);
      console.log(`   Treść: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
      console.log(`   Długość treści: ${content.length} znaków`);
    });

  } catch (error) {
    console.error('❌ Błąd:', error);
  }
}

debugRegex().catch(console.error);










