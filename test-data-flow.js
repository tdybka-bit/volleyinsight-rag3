const fs = require('fs');
const path = require('path');

// Test przepływu danych w VolleyInsight
async function testDataFlow() {
  console.log('🔍 TEST PRZEPŁYWU DANYCH VOLLEYINSIGHT\n');
  
  try {
    // 1. Sprawdź pliki w /content/
    console.log('1️⃣ SPRAWDZANIE PLIKÓW TREŚCI:');
    const contentDir = path.join(__dirname, 'content');
    
    if (!fs.existsSync(contentDir)) {
      console.log('❌ Folder /content/ nie istnieje');
      return;
    }
    
    const files = fs.readdirSync(contentDir).filter(file => file.endsWith('.md'));
    console.log(`✅ Znaleziono ${files.length} plików markdown:`);
    
    for (const file of files) {
      const filePath = path.join(contentDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').length;
      const size = content.length;
      console.log(`   📄 ${file}: ${lines} linii, ${size} znaków`);
    }
    
    // 2. Test API endpoints
    console.log('\n2️⃣ TEST API ENDPOINTS:');
    
    const testEndpoint = async (url, name) => {
      try {
        const response = await fetch(`http://localhost:3000${url}`);
        const data = await response.json();
        
        if (data.success) {
          console.log(`✅ ${name}: OK`);
          return data.data;
        } else {
          console.log(`❌ ${name}: ${data.error}`);
          return null;
        }
      } catch (error) {
        console.log(`❌ ${name}: Błąd sieci - ${error.message}`);
        return null;
      }
    };
    
    // Test wszystkich endpointów debug
    const contentData = await testEndpoint('/api/debug/content', 'Content API');
    const chunksData = await testEndpoint('/api/debug/chunks', 'Chunks API');
    const sourcesData = await testEndpoint('/api/debug/sources', 'Sources API');
    
    // 3. Analiza przepływu danych
    console.log('\n3️⃣ ANALIZA PRZEPŁYWU DANYCH:');
    
    if (contentData) {
      console.log(`📊 Pliki → Chunki:`);
      console.log(`   • ${contentData.totalFiles} plików → ${contentData.totalChunks} chunków`);
      console.log(`   • Typy: ${contentData.summary.typesAvailable.join(', ')}`);
      console.log(`   • Średnio ${contentData.summary.averageChunksPerFile} chunków na plik`);
      
      console.log(`\n📋 Szczegóły plików:`);
      contentData.fileStats.forEach(file => {
        console.log(`   • ${file.filename}: ${file.chunks} chunków, typ "${file.type}"`);
      });
    }
    
    if (chunksData) {
      console.log(`\n🗄️ ChromaDB:`);
      console.log(`   • Kolekcja: ${chunksData.collectionName}`);
      console.log(`   • Łącznie chunków: ${chunksData.totalChunks}`);
      console.log(`   • Typy w bazie: ${chunksData.typeDistribution.length}`);
      
      console.log(`\n📈 Dystrybucja typów:`);
      chunksData.typeDistribution.forEach(type => {
        console.log(`   • ${type.type}: ${type.count} chunków (${type.percentage}%)`);
      });
    }
    
    if (sourcesData) {
      console.log(`\n🔍 Mapowanie źródeł:`);
      console.log(`   • Unikalne źródła: ${sourcesData.sourceMap.length}`);
      console.log(`   • Zapytań z wynikami: ${sourcesData.summary.queriesWithResults}/${sourcesData.summary.totalTestQueries}`);
      
      console.log(`\n🎯 Test zapytań:`);
      Object.entries(sourcesData.testQueries).forEach(([query, data]) => {
        const status = data.found > 0 ? '✅' : '❌';
        console.log(`   ${status} "${query}": ${data.found} wyników`);
      });
    }
    
    // 4. Test pełnego przepływu
    console.log('\n4️⃣ TEST PEŁNEGO PRZEPŁYWU:');
    
    const testChatFlow = async (query) => {
      try {
        console.log(`\n💬 Test chatu: "${query}"`);
        const response = await fetch('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: query, limit: 3 })
        });
        
        const data = await response.json();
        if (data.success) {
          console.log(`   ✅ Odpowiedź: ${data.message.substring(0, 100)}...`);
          if (data.context) {
            console.log(`   📚 Kontekst: ${data.context.sourcesCount} źródeł`);
          }
        } else {
          console.log(`   ❌ Błąd: ${data.message}`);
        }
      } catch (error) {
        console.log(`   ❌ Błąd sieci: ${error.message}`);
      }
    };
    
    // Test różnych zapytań
    await testChatFlow('Jak poprawić technikę bloku?');
    await testChatFlow('Jakie są podstawy ataku?');
    await testChatFlow('Opowiedz o przepisach siatkówki');
    
    console.log('\n✅ TEST ZAKOŃCZONY');
    
  } catch (error) {
    console.error('❌ Błąd podczas testu:', error);
  }
}

// Uruchom test
testDataFlow();




