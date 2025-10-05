const { searchSimilar, checkConnection } = require('../lib/vectorStore');

const testQueries = [
  'Jak poprawić technikę bloku?',
  'Najlepsze ćwiczenia na atak',
  'Zasady rotacji w siatkówce',
  'Jak trenować zagrywkę?'
];

async function main() {
  console.log('🧪 Test systemu RAG - VolleyInsight\n');
  
  // Sprawdź połączenie
  const connected = await checkConnection();
  if (!connected) {
    console.error('❌ Nie można połączyć się z ChromaDB. Czy docker-compose up działa?');
    process.exit(1);
  }

  console.log('='.repeat(60), '\n');

  // Testuj każde zapytanie
  for (const query of testQueries) {
    console.log('🔍 Zapytanie:', query);
    console.log('-'.repeat(60));
    
    const results = await searchSimilar(query, 3);
    
    if (results.length === 0) {
      console.log('⚠️  Brak wyników\n');
      continue;
    }

    results.forEach((result, index) => {
      console.log('Wynik', index + 1, ':');
      console.log('  📊 Similarity:', result.similarityPercent);
      console.log('  📄 Typ:', result.metadata.type);
      console.log('  📁 Plik:', result.metadata.originalFile);
      console.log('  📝 Treść:', result.content.substring(0, 150) + '...');
      console.log('');
    });

    console.log('='.repeat(60), '\n');
  }

  console.log('✅ Test zakończony!');
}

main().catch(error => {
  console.error('❌ Błąd:', error);
  process.exit(1);
});
