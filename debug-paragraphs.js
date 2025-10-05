/**
 * Debug Paragraphs
 * Debuguje parsowanie paragrafów z HTML
 */

require('dotenv').config({ path: '.env.local' });
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

async function debugParagraphs() {
  console.log('🔍 Debugowanie paragrafów...\n');

  try {
    const filePath = path.join(__dirname, 'content', 'Tekst.docx');
    const fileBuffer = fs.readFileSync(filePath);
    
    const result = await mammoth.convertToHtml({ buffer: fileBuffer });
    const html = result.value;
    
    console.log(`📝 HTML długość: ${html.length} znaków`);
    
    // Split by paragraphs
    const paragraphs = html.split(/<p[^>]*>/gi);
    console.log(`📊 Liczba paragrafów: ${paragraphs.length}`);
    
    console.log('\n📋 Pierwsze 10 paragrafów:');
    paragraphs.slice(0, 10).forEach((p, i) => {
      const text = p.replace(/<[^>]*>/g, '').replace(/<br\s*\/?>/gi, '\n').trim();
      if (text) {
        console.log(`\n${i + 1}. "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
        console.log(`   Długość: ${text.length} znaków`);
        
        // Test title detection
        const isTitle = text.length <= 100 && (
          /^\d+\s+[A-ZĄĆĘŁŃÓŚŹŻ]/.test(text) ||
          /^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+\s+[a-ząćęłńóśźż]/.test(text) ||
          /^(Wprowadzenie|Historia|Podstawy|Technika|Taktyka|Ćwiczenia|Zakończenie)/i.test(text)
        );
        console.log(`   Czy tytuł: ${isTitle ? '✅' : '❌'}`);
      }
    });

  } catch (error) {
    console.error('❌ Błąd:', error);
  }
}

debugParagraphs().catch(console.error);



