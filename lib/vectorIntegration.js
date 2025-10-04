const { loadMarkdownFiles } = require('./markdownLoader');
const { embedAndStore, searchSimilar, searchByType, getCollectionStats, checkConnection } = require('./vectorStore');

/**
 * Główna funkcja integrująca markdown loader z vector store
 * Ładuje pliki markdown i zapisuje je jako embeddings w ChromaDB
 * @param {string} contentDir - Ścieżka do katalogu z plikami markdown
 * @param {number} chunkSize - Rozmiar chunków (domyślnie 500)
 * @param {number} overlap - Nakładanie między chunkami (domyślnie 100)
 * @returns Promise<Object> - Statystyki operacji
 */
async function loadAndStoreContent(contentDir = './content', chunkSize = 500, overlap = 100) {
  try {
    console.log('🚀 Rozpoczynam ładowanie i zapisywanie treści...');
    
    // Sprawdź połączenie z ChromaDB
    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('Brak połączenia z ChromaDB. Upewnij się, że serwer działa na localhost:8000');
    }

    // Załaduj pliki markdown
    console.log('📁 Ładowanie plików markdown...');
    const chunks = await loadMarkdownFiles(contentDir, chunkSize, overlap);
    
    if (chunks.length === 0) {
      return {
        success: false,
        chunksLoaded: 0,
        chunksStored: 0,
        stats: null,
        error: 'Nie znaleziono plików markdown do załadowania'
      };
    }

    console.log(`✅ Załadowano ${chunks.length} chunków`);

    // Zapisz jako embeddings
    console.log('💾 Zapisywanie embeddings...');
    await embedAndStore(chunks);

    // Pobierz statystyki
    const stats = await getCollectionStats();

    console.log('🎉 Pomyślnie zakończono ładowanie i zapisywanie treści!');
    
    return {
      success: true,
      chunksLoaded: chunks.length,
      chunksStored: chunks.length,
      stats
    };

  } catch (error) {
    console.error('❌ Błąd podczas ładowania i zapisywania treści:', error);
    return {
      success: false,
      chunksLoaded: 0,
      chunksStored: 0,
      stats: null,
      error: error instanceof Error ? error.message : 'Nieznany błąd'
    };
  }
}

/**
 * Wyszukuje treści podobne do zapytania
 * @param {string} query - Zapytanie do wyszukania
 * @param {number} limit - Maksymalna liczba wyników
 * @returns Promise<Array> - Array podobnych treści
 */
async function searchContent(query, limit = 3) {
  try {
    console.log(`🔍 Wyszukiwanie: "${query}"`);
    const results = await searchSimilar(query, limit);
    return results;
  } catch (error) {
    console.error('Błąd wyszukiwania:', error);
    return [];
  }
}

/**
 * Wyszukuje treści według typu
 * @param {string} type - Typ treści (blok, atak, przepisy, etc.)
 * @param {number} limit - Maksymalna liczba wyników
 * @returns Promise<Array> - Array treści danego typu
 */
async function getContentByType(type, limit = 5) {
  try {
    console.log(`📂 Wyszukiwanie treści typu: ${type}`);
    const results = await searchByType(type, limit);
    return results;
  } catch (error) {
    console.error('Błąd wyszukiwania według typu:', error);
    return [];
  }
}

/**
 * Pobiera statystyki bazy danych
 * @returns Promise<Object> - Statystyki bazy danych
 */
async function getDatabaseStats() {
  try {
    const stats = await getCollectionStats();
    return stats;
  } catch (error) {
    console.error('Błąd pobierania statystyk:', error);
    return null;
  }
}

/**
 * Sprawdza status systemu
 * @returns Promise<Object> - Status systemu
 */
async function getSystemStatus() {
  try {
    const chromaDB = await checkConnection();
    const openai = !!process.env.OPENAI_API_KEY;
    const contentDir = true; // Można dodać sprawdzenie istnienia katalogu
    
    let stats = null;
    if (chromaDB) {
      stats = await getDatabaseStats();
    }

    return {
      chromaDB,
      openai,
      contentDir,
      stats
    };
  } catch (error) {
    console.error('Błąd sprawdzania statusu systemu:', error);
    return {
      chromaDB: false,
      openai: false,
      contentDir: false
    };
  }
}

/**
 * Przykład użycia - ładuje treści i wykonuje wyszukiwanie
 */
async function exampleUsage() {
  console.log('🧪 Przykład użycia systemu vector store...\n');

  try {
    // 1. Sprawdź status systemu
    console.log('1. Sprawdzanie statusu systemu...');
    const status = await getSystemStatus();
    console.log('Status:', status);

    // 2. Załaduj i zapisz treści
    console.log('\n2. Ładowanie i zapisywanie treści...');
    const loadResult = await loadAndStoreContent('./content', 500, 100);
    console.log('Wynik ładowania:', loadResult);

    // 3. Wyszukaj podobne treści
    console.log('\n3. Wyszukiwanie podobnych treści...');
    const searchResults = await searchContent('technika ataku', 3);
    console.log('Wyniki wyszukiwania:', searchResults);

    // 4. Wyszukaj według typu
    console.log('\n4. Wyszukiwanie według typu...');
    const typeResults = await getContentByType('atak', 2);
    console.log('Treści typu "atak":', typeResults);

    // 5. Pobierz statystyki
    console.log('\n5. Statystyki bazy danych...');
    const stats = await getDatabaseStats();
    console.log('Statystyki:', stats);

  } catch (error) {
    console.error('Błąd w przykładzie użycia:', error);
  }
}

module.exports = {
  loadAndStoreContent,
  searchContent,
  getContentByType,
  getDatabaseStats,
  getSystemStatus,
  exampleUsage
};


