require('dotenv').config({ path: '.env.local' });
const { embedAndStore, checkConnection, getCollectionStats } = require('../lib/vectorStore');
// ... reszta kodu
const { embedAndStore, checkConnection, getCollectionStats } = require('../lib/vectorStore.ts');
const fs = require('fs');
const path = require('path');

// Funkcja do wczytania chunków z pliku
function loadChunks() {
  const chunksPath = path.join(__dirname, '../content/chunks.json');
  
  if (!fs.existsSync(chunksPath)) {
    throw new Error('Plik chunks.json nie istnieje! Najpierw uruchom parsowanie dokumentów.');
  }

  const data = fs.readFileSync(chunksPath, 'utf8');
  return JSON.parse(data);
}

async function main() {
  console.log('📚 Indeksowanie dokumentów do ChromaDB...\n');
  
  // Sprawdź połączenie
  const connected = await checkConnection();
  if (!connected) {
    console.error('❌ Nie można połączyć się z ChromaDB. Czy docker-compose up działa?');
    process.exit(1);
  }

  // Wczytaj chunki
  console.log('📖 Wczytuję chunki z content/chunks.json...');
  const chunks = loadChunks();
  console.log('Znaleziono chunków:', chunks.length, '\n');

  // Embeduj i zapisz
  await embedAndStore(chunks);

  // Pokaż statystyki
  console.log('\n📊 Statystyki kolekcji:');
  const stats = await getCollectionStats();
  console.log('- Wszystkich chunków:', stats.totalChunks);
  console.log('- Rozkład typów:', stats.typeDistribution);
  
  console.log('\n✅ Indeksowanie zakończone!');
}

main().catch(error => {
  console.error('❌ Błąd:', error);
  process.exit(1);
});
