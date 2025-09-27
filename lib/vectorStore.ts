import { ChromaClient } from 'chromadb';
import OpenAI from 'openai';
import { MarkdownChunk } from './markdownLoader';

// Inicjalizacja klientów
const chromaClient = new ChromaClient({
  path: "http://localhost:8000" // Domyślny adres ChromaDB
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
});

/**
 * Generuje embeddings dla tekstu używając OpenAI API
 * @param text - Tekst do embedowania
 * @returns Promise<number[]> - Wektor embeddings
 */
async function generateEmbedding(text: string): Promise<number[]> {
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
export async function initChromaDB() {
  try {
    // Sprawdź czy kolekcja już istnieje
    const collections = await chromaClient.listCollections();
    const existingCollection = collections.find(col => col.name === COLLECTION_NAME);
    
    if (existingCollection) {
      console.log(`Kolekcja ${COLLECTION_NAME} już istnieje`);
      return await chromaClient.getCollection({ name: COLLECTION_NAME });
    }

    // Utwórz nową kolekcję
    const collection = await chromaClient.createCollection({
      name: COLLECTION_NAME,
      metadata: {
        description: "Volleyball training insights and techniques",
        created_at: new Date().toISOString()
      }
    });

    console.log(`Utworzono kolekcję ${COLLECTION_NAME}`);
    return collection;
  } catch (error) {
    console.error('Błąd inicjalizacji ChromaDB:', error);
    throw error;
  }
}


/**
 * Zapisuje chunks jako embeddings w ChromaDB
 * @param chunks - Array chunków do zapisania
 * @returns Promise<void>
 */
export async function embedAndStore(chunks: MarkdownChunk[]): Promise<void> {
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
 * Wyszukuje podobne treści w ChromaDB
 * @param query - Zapytanie do wyszukania
 * @param limit - Maksymalna liczba wyników (domyślnie 3)
 * @returns Promise<Array> - Array podobnych chunków z metadanymi
 */
export async function searchSimilar(query: string, limit: number = 3): Promise<any[]> {
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

    // Formatuj wyniki
    const formattedResults = results.documents[0].map((doc, index) => ({
      content: doc,
      metadata: results.metadatas[0][index],
      distance: results.distances[0][index],
      similarity: 1 - results.distances[0][index] // Konwersja distance na similarity
    }));

    console.log(`Znaleziono ${formattedResults.length} podobnych treści dla zapytania: "${query}"`);
    return formattedResults;
  } catch (error) {
    console.error('Błąd wyszukiwania:', error);
    throw error;
  }
}

/**
 * Wyszukuje treści według typu (blok, atak, przepisy, etc.)
 * @param type - Typ treści do wyszukania
 * @param limit - Maksymalna liczba wyników
 * @returns Promise<Array> - Array chunków danego typu
 */
export async function searchByType(type: string, limit: number = 5): Promise<any[]> {
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
export async function getCollectionStats(): Promise<any> {
  try {
    const collection = await initChromaDB();
    const count = await collection.count();
    
    // Pobierz wszystkie metadane aby policzyć typy
    const allData = await collection.get({
      include: ['metadatas']
    });

    const typeCounts = allData.metadatas.reduce((acc: any, metadata: any) => {
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
export async function clearCollection(): Promise<void> {
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
export async function checkConnection(): Promise<boolean> {
  try {
    await chromaClient.heartbeat();
    console.log('✅ Połączenie z ChromaDB działa');
    return true;
  } catch (error) {
    console.error('❌ Błąd połączenia z ChromaDB:', error);
    return false;
  }
}
