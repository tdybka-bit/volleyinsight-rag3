require('dotenv').config({ path: '.env.local' });
const { ChromaClient } = require('chromadb');
const OpenAI = require('openai');

// Inicjalizacja klientów
const chromaClient = new ChromaClient({
  path: "http://localhost:8000"
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
});

/**
 * Generuje embeddings dla tekstu używając OpenAI API
 * @param {string} text - Tekst do embedowania
 * @returns Promise<number[]> - Wektor embeddings
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float"
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Błąd generowania embeddings:', error);
    throw error;
  }
}

const COLLECTION_NAME = 'volleyball-insights';

/**
 * Inicjalizuje kolekcję ChromaDB dla insights siatkówki
 * @returns Promise<Collection> - Kolekcja ChromaDB
 */
async function initChromaDB() {
  try {
    const collections = await chromaClient.listCollections();
    const existingCollection = collections.find(col => col.name === COLLECTION_NAME);
    
    if (existingCollection) {
      console.log(`Kolekcja ${COLLECTION_NAME} już istnieje`);
      return await chromaClient.getCollection({ name: COLLECTION_NAME });
    }

    // Utwórz nową kolekcję z COSINE similarity
    const collection = await chromaClient.createCollection({
      name: COLLECTION_NAME,
      metadata: {
        description: "Volleyball training insights and techniques",
        created_at: new Date().toISOString(),
        "hnsw:space": "cosine" // ✅ KRYTYCZNE: Wymusza cosine similarity
      }
    });

    console.log(`Utworzono kolekcję ${COLLECTION_NAME} z cosine similarity`);
    return collection;
  } catch (error) {
    console.error('Błąd inicjalizacji ChromaDB:', error);
    throw error;
  }
}

/**
 * Zapisuje chunks jako embeddings w ChromaDB
 * @param {Array} chunks - Array chunków do zapisania
 * @returns Promise<void>
 */
async function embedAndStore(chunks) {
  try {
    const collection = await initChromaDB();
    
    console.log(`Zapisywanie ${chunks.length} chunków do ChromaDB...`);
    
    // Generuj embeddings dla wszystkich chunków
    const embeddings = await Promise.all(
      chunks.map(chunk => generateEmbedding(chunk.content))
    );

    // Przygotuj dane do zapisania
    const ids = chunks.map((_, index) => `chunk_${Date.now()}_${index}`);
    const documents = chunks.map(chunk => chunk.content);
    const metadatas = chunks.map(chunk => ({
      filename: chunk.filename,
      chunkIndex: chunk.chunkIndex,
      type: chunk.metadata.type,
      originalFile: chunk.metadata.originalFile,
      contentLength: chunk.content.length
    }));

    // Zapisz do ChromaDB
    await collection.add({
      ids,
      embeddings,
      documents,
      metadatas
    });

    console.log(`✅ Pomyślnie zapisano ${chunks.length} chunków do ChromaDB`);
  } catch (error) {
    console.error('Błąd zapisywania embeddings:', error);
    throw error;
  }
}

/**
 * Konwertuje distance na similarity score w zależności od metryki
 * @param {number} distance - Dystans z ChromaDB
 * @param {string} metric - Metryka używana ('cosine', 'l2', 'ip')
 * @returns {number} - Similarity score (0-1)
 */
function convertDistanceToSimilarity(distance, metric = 'cosine') {
  switch(metric) {
    case 'cosine':
      // Cosine distance: już zwraca wartości 0-2, gdzie 0=identyczne
      // Cosine similarity = 1 - cosine_distance
      return Math.max(0, Math.min(1, 1 - distance));
    
    case 'l2':
      // Squared L2 distance: mniejsza wartość = bardziej podobne
      // Konwersja: 1 / (1 + distance)
      return 1 / (1 + distance);
    
    case 'ip':
      // Inner product: wyższa wartość = bardziej podobne
      // Już jest w zakresie similarity
      return distance;
    
    default:
      return 1 - distance;
  }
}

/**
 * Wyszukuje podobne treści w ChromaDB
 * @param {string} query - Zapytanie do wyszukania
 * @param {number} limit - Maksymalna liczba wyników (domyślnie 3)
 * @returns Promise<Array> - Array podobnych chunków z metadanymi
 */
async function searchSimilar(query, limit = 3) {
  try {
    const collection = await initChromaDB();
    
    // Generuj embedding dla zapytania
    const queryEmbedding = await generateEmbedding(query);
    
    // Wyszukaj podobne treści
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
      include: ['documents', 'metadatas', 'distances']
    });

    // Formatuj wyniki z POPRAWNĄ konwersją
    const formattedResults = results.documents[0].map((doc, index) => {
      const distance = results.distances[0][index];
      const similarity = convertDistanceToSimilarity(distance, 'cosine');
      
      return {
        content: doc,
        metadata: results.metadatas[0][index],
        distance: distance,
        similarity: similarity,
        similarityPercent: `${(similarity * 100).toFixed(1)}%` // ✅ Czytelny format
      };
    });

    console.log(`Znaleziono ${formattedResults.length} podobnych treści dla zapytania: "${query}"`);
    formattedResults.forEach((result, i) => {
      console.log(`  ${i+1}. Similarity: ${result.similarityPercent} (distance: ${result.distance.toFixed(4)})`);
    });
    
    return formattedResults;
  } catch (error) {
    console.error('Błąd wyszukiwania:', error);
    throw error;
  }
}

/**
 * Wyszukuje treści według typu (blok, atak, przepisy, etc.)
 * @param {string} type - Typ treści do wyszukania
 * @param {number} limit - Maksymalna liczba wyników
 * @returns Promise<Array> - Array chunków danego typu
 */
async function searchByType(type, limit = 5) {
  try {
    const collection = await initChromaDB();
    
    const results = await collection.get({
      where: { type: type },
      limit: limit,
      include: ['documents', 'metadatas']
    });

    const formattedResults = results.documents.map((doc, index) => ({
      content: doc,
      metadata: results.metadatas[index]
    }));

    console.log(`Znaleziono ${formattedResults.length} treści typu: ${type}`);
    return formattedResults;
  } catch (error) {
    console.error('Błąd wyszukiwania według typu:', error);
    throw error;
  }
}

/**
 * Pobiera statystyki kolekcji
 * @returns Promise<Object> - Statystyki kolekcji
 */
async function getCollectionStats() {
  try {
    const collection = await initChromaDB();
    const count = await collection.count();
    
    const allData = await collection.get({
      include: ['metadatas']
    });

    const typeCounts = allData.metadatas.reduce((acc, metadata) => {
      const type = metadata.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return {
      totalChunks: count,
      typeDistribution: typeCounts,
      collectionName: COLLECTION_NAME
    };
  } catch (error) {
    console.error('Błąd pobierania statystyk:', error);
    throw error;
  }
}

/**
 * Usuwa wszystkie dane z kolekcji
 * @returns Promise<void>
 */
async function clearCollection() {
  try {
    const collections = await chromaClient.listCollections();
    const existingCollection = collections.find(col => col.name === COLLECTION_NAME);
    
    if (existingCollection) {
      await chromaClient.deleteCollection({ name: COLLECTION_NAME });
      console.log(`Usunięto kolekcję ${COLLECTION_NAME}`);
    } else {
      console.log(`Kolekcja ${COLLECTION_NAME} nie istnieje`);
    }
  } catch (error) {
    console.error('Błąd usuwania kolekcji:', error);
    throw error;
  }
}

/**
 * Sprawdza połączenie z ChromaDB
 * @returns Promise<boolean> - Czy połączenie działa
 */
async function checkConnection() {
  try {
    await chromaClient.heartbeat();
    console.log('✅ Połączenie z ChromaDB działa');
    return true;
  } catch (error) {
    console.error('❌ Błąd połączenia z ChromaDB:', error);
    return false;
  }
}

module.exports = {
  initChromaDB,
  embedAndStore,
  searchSimilar,
  searchByType,
  getCollectionStats,
  clearCollection,
  checkConnection
};