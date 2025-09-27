const { loadAndStoreContent, searchContent, getContentByType, getDatabaseStats, getSystemStatus } = require('./lib/vectorIntegration.js');

async function testVectorStore() {
  console.log('🧪 Testowanie Vector Store...\n');

  try {
    // 1. Sprawdź status systemu
    console.log('1. Sprawdzanie statusu systemu...');
    const status = await getSystemStatus();
    console.log('Status:', JSON.stringify(status, null, 2));

    if (!status.chromaDB) {
      console.log('❌ ChromaDB nie jest dostępny. Uruchom: docker run -p 8000:8000 chromadb/chroma');
      return;
    }

    if (!status.openai) {
      console.log('❌ Brak klucza OpenAI API. Ustaw OPENAI_API_KEY w zmiennych środowiskowych');
      return;
    }

    // 2. Załaduj i zapisz treści
    console.log('\n2. Ładowanie i zapisywanie treści...');
    const loadResult = await loadAndStoreContent('./content', 500, 100);
    console.log('Wynik ładowania:', JSON.stringify(loadResult, null, 2));

    if (!loadResult.success) {
      console.log('❌ Błąd ładowania treści:', loadResult.error);
      return;
    }

    // 3. Pobierz statystyki
    console.log('\n3. Statystyki bazy danych...');
    const stats = await getDatabaseStats();
    console.log('Statystyki:', JSON.stringify(stats, null, 2));

    // 4. Wyszukaj podobne treści
    console.log('\n4. Wyszukiwanie podobnych treści...');
    const searchQueries = [
      'technika ataku',
      'blok w siatkówce',
      'przepisy gry',
      'pozycje zawodników'
    ];

    for (const query of searchQueries) {
      console.log(`\n🔍 Wyszukiwanie: "${query}"`);
      const searchResults = await searchContent(query, 2);
      searchResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.metadata.type} (${result.similarity.toFixed(3)})`);
        console.log(`     ${result.content.substring(0, 100)}...`);
      });
    }

    // 5. Wyszukaj według typu
    console.log('\n5. Wyszukiwanie według typu...');
    const types = ['atak', 'blok', 'przepisy'];
    
    for (const type of types) {
      console.log(`\n📂 Treści typu "${type}":`);
      const typeResults = await getContentByType(type, 2);
      typeResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.metadata.filename}`);
        console.log(`     ${result.content.substring(0, 80)}...`);
      });
    }

    console.log('\n✅ Test zakończony pomyślnie!');

  } catch (error) {
    console.error('❌ Błąd podczas testowania:', error);
  }
}

// Uruchom test
testVectorStore();
