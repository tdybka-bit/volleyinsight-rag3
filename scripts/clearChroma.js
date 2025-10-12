require('dotenv').config({ path: '.env.local' });
const { embedAndStore, checkConnection, getCollectionStats } = require('../lib/vectorStore');
// ... reszta kodu
const { clearCollection, checkConnection } = require('../lib/vectorStore');

async function main() {
  console.log('🗑️  Czyszczenie kolekcji ChromaDB...\n');
  
  // Sprawdź połączenie
  const connected = await checkConnection();
  if (!connected) {
    console.error('❌ Nie można połączyć się z ChromaDB. Czy docker-compose up działa?');
    process.exit(1);
  }

  // Usuń kolekcję
  await clearCollection();
  
  console.log('\n✅ Kolekcja wyczyszczona!');
}

main().catch(error => {
  console.error('❌ Błąd:', error);
  process.exit(1);
});
