const { loadAndStoreContent, searchContent, getDatabaseStats } = require('./lib/vectorIntegration.js');

async function testRAGSystem() {
  console.log('🧪 Testowanie pełnego RAG systemu...\n');

  try {
    // 1. Sprawdź status systemu
    console.log('1. Sprawdzanie statusu systemu...');
    const status = await getDatabaseStats();
    console.log('Status bazy danych:', status);

    // 2. Załaduj przykładowe treści
    console.log('\n2. Ładowanie treści do bazy danych...');
    const loadResult = await loadAndStoreContent('./content', 500, 100);
    
    if (!loadResult.success) {
      console.log('❌ Błąd ładowania treści:', loadResult.error);
      return;
    }

    console.log(`✅ Załadowano ${loadResult.chunksLoaded} chunków`);

    // 3. Test wyszukiwania
    console.log('\n3. Test wyszukiwania...');
    const testQueries = [
      'technika ataku w siatkówce',
      'jak poprawnie wykonać blok',
      'podstawowe przepisy siatkówki',
      'pozycje zawodników na boisku'
    ];

    for (const query of testQueries) {
      console.log(`\n🔍 Wyszukiwanie: "${query}"`);
      const results = await searchContent(query, 2);
      
      if (results.length > 0) {
        console.log(`   Znaleziono ${results.length} wyników:`);
        results.forEach((result, index) => {
          console.log(`   ${index + 1}. ${result.metadata.type} (${result.similarity.toFixed(3)})`);
          console.log(`      ${result.content.substring(0, 80)}...`);
        });
      } else {
        console.log('   Brak wyników');
      }
    }

    // 4. Test API endpoints
    console.log('\n4. Test API endpoints...');
    
    // Test chat API
    try {
      const chatResponse = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Jak poprawić technikę ataku?', limit: 3 })
      });
      
      if (chatResponse.ok) {
        const chatData = await chatResponse.json();
        console.log('✅ Chat API działa');
        console.log(`   Odpowiedź: ${chatData.message.substring(0, 100)}...`);
        console.log(`   Kontekst: ${chatData.context?.hasContext ? 'TAK' : 'NIE'}`);
      } else {
        console.log('❌ Chat API nie działa');
      }
    } catch (error) {
      console.log('❌ Błąd testowania Chat API:', error.message);
    }

    // Test upload API
    try {
      const uploadResponse = await fetch('http://localhost:3001/api/upload');
      
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        console.log('✅ Upload API działa');
        console.log(`   Status: ${uploadData.status}`);
      } else {
        console.log('❌ Upload API nie działa');
      }
    } catch (error) {
      console.log('❌ Błąd testowania Upload API:', error.message);
    }

    console.log('\n🎉 Test RAG systemu zakończony!');

  } catch (error) {
    console.error('❌ Błąd podczas testowania RAG systemu:', error);
  }
}

// Uruchom test
testRAGSystem();
