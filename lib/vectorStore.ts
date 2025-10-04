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
      const collection = await chromaClient.getCollection({ name: COLLECTION_NAME });
      
      // Sprawdź czy kolekcja ma embedding function
      const collectionInfo = await collection.get();
      if (!collectionInfo.embeddingFunction) {
        console.log(`⚠️ Kolekcja ${COLLECTION_NAME} nie ma embedding function - usuwam i tworzę nową`);
        await chromaClient.deleteCollection({ name: COLLECTION_NAME });
        return await createNewCollection();
      }
      
      return collection;
    }

    // Utwórz nową kolekcję z embedding function
    return await createNewCollection();
  } catch (error) {
    console.error('Błąd inicjalizacji ChromaDB:', error);
    throw error;
  }
}

/**
 * Tworzy nową kolekcję z właściwą embedding function
 */
async function createNewCollection() {
  const collection = await chromaClient.createCollection({
    name: COLLECTION_NAME,
    metadata: {
      description: "Volleyball training insights and techniques",
      created_at: new Date().toISOString()
    },
    embeddingFunction: {
      // Użyj OpenAI embedding function
      generate: async (texts: string[]) => {
        const embeddings = await Promise.all(
          texts.map(text => generateEmbedding(text))
        );
        return embeddings;
      }
    }
  });

  console.log(`✅ Utworzono kolekcję ${COLLECTION_NAME} z embedding function`);
  return collection;
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
    
    // Przygotuj dane do zapisania (ChromaDB wygeneruje embeddings automatycznie)
    const ids = chunks.map((_, index) => `chunk_${Date.now()}_${index}`);
    const documents = chunks.map(chunk => chunk.content);
    const metadatas = chunks.map(chunk => ({
      filename: chunk.filename,
      chunkIndex: chunk.chunkIndex,
      type: chunk.metadata.type,
      originalFile: chunk.metadata.originalFile,
      contentLength: chunk.content.length
    }));

    // Zapisz do ChromaDB (bez embeddings - ChromaDB wygeneruje je automatycznie)
    await collection.add({
      ids,
      documents,
      metadatas
    });

    console.log(`✅ Pomyślnie zapisano ${chunks.length} chunków do ChromaDB z automatycznymi embeddings`);
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
    
    // Wyszukaj podobne treści (ChromaDB wygeneruje embedding dla zapytania automatycznie)
    const results = await collection.query({
      queryTexts: [query],
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

/**
 * Testuje czy embedding function działa poprawnie
 * @returns Promise<boolean> - Czy embedding function działa
 */
export async function testEmbeddingFunction(): Promise<boolean> {
  try {
    const collection = await initChromaDB();
    
    // Test: zapisz 1 chunk testowy
    const testChunk = {
      id: 'test_chunk_' + Date.now(),
      document: 'Test siatkówki - blok to podstawowy element obrony',
      metadata: {
        type: 'test',
        filename: 'test.md',
        chunkIndex: 0,
        originalFile: 'test.md',
        contentLength: 50
      }
    };
    
    console.log('🧪 Testowanie embedding function...');
    
    // Zapisz test chunk
    await collection.add({
      ids: [testChunk.id],
      documents: [testChunk.document],
      metadatas: [testChunk.metadata]
    });
    
    console.log('✅ Test chunk zapisany');
    
    // Test: wyszukaj podobne treści
    const searchResults = await collection.query({
      queryTexts: ['blok siatkówka'],
      nResults: 1,
      include: ['documents', 'metadatas', 'distances']
    });
    
    if (searchResults.documents[0].length > 0) {
      const similarity = 1 - searchResults.distances[0][0];
      console.log(`✅ Embedding function działa! Similarity: ${(similarity * 100).toFixed(1)}%`);
      
      // Usuń test chunk
      await collection.delete({ ids: [testChunk.id] });
      console.log('✅ Test chunk usunięty');
      
      return true;
    } else {
      console.log('❌ Embedding function nie działa - brak wyników wyszukiwania');
      return false;
    }
  } catch (error) {
    console.error('❌ Błąd testowania embedding function:', error);
    return false;
  }
}
