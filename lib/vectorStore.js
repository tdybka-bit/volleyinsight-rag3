const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');

// Inicjalizacja klientów
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'ed-volley';

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
      encoding_format: "float",
      dimensions: 768 // ✅ Dopasowane do Pinecone
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Błąd generowania embeddings:', error);
    throw error;
  }
}

/**
 * Inicjalizuje połączenie z Pinecone
 * @returns Promise<Index> - Pinecone index
 */
async function initPinecone() {
  try {
    const index = pinecone.index(INDEX_NAME);
    console.log(`Połączono z Pinecone index: ${INDEX_NAME}`);
    return index;
  } catch (error) {
    console.error('Błąd inicjalizacji Pinecone:', error);
    throw error;
  }
}

/**
 * Zapisuje chunks jako embeddings w Pinecone
 * @param {Array} chunks - Array chunków do zapisania
 * @returns Promise<void>
 */
async function embedAndStore(chunks) {
  try {
    const index = await initPinecone();
    
    console.log(`Zapisywanie ${chunks.length} chunków do Pinecone...`);
    
    // Przetwarzaj w batches (Pinecone limit: 100 wektorów na raz)
    const batchSize = 100;
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      console.log(`Przetwarzanie batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}...`);
      
      // Generuj embeddings dla batcha
      const embeddings = await Promise.all(
        batch.map(chunk => generateEmbedding(chunk.content))
      );

      // Przygotuj wektory dla Pinecone
      const vectors = batch.map((chunk, idx) => ({
        id: `chunk_${Date.now()}_${i + idx}`,
        values: embeddings[idx],
        metadata: {
          content: chunk.content,
          filename: chunk.filename,
          chunkIndex: chunk.chunkIndex,
          type: chunk.metadata.type,
          originalFile: chunk.metadata.originalFile,
          contentLength: chunk.content.length
        }
      }));

      // Zapisz do Pinecone
      await index.upsert(vectors);
      
      console.log(`✅ Zapisano batch ${Math.floor(i/batchSize) + 1}`);
    }

    console.log(`✅ Pomyślnie zapisano ${chunks.length} chunków do Pinecone`);
  } catch (error) {
    console.error('Błąd zapisywania embeddings:', error);
    throw error;
  }
}

/**
 * Wyszukuje podobne treści w Pinecone
 * @param {string} query - Zapytanie do wyszukania
 * @param {number} limit - Maksymalna liczba wyników (domyślnie 3)
 * @returns Promise<Array> - Array podobnych chunków z metadanymi
 */
async function searchSimilar(query, limit = 3) {
  try {
    const index = await initPinecone();
    
    // Generuj embedding dla zapytania
    const queryEmbedding = await generateEmbedding(query);
    
    // Wyszukaj podobne treści
    const results = await index.query({
      vector: queryEmbedding,
      topK: limit,
      includeMetadata: true
    });

    // Formatuj wyniki
    const formattedResults = results.matches.map((match) => ({
      content: match.metadata.content,
      metadata: {
        filename: match.metadata.filename,
        type: match.metadata.type,
        originalFile: match.metadata.originalFile,
        chunkIndex: match.metadata.chunkIndex
      },
      score: match.score,
      similarity: match.score, // Pinecone cosine score jest już 0-1
      similarityPercent: `${(match.score * 100).toFixed(1)}%`
    }));

    console.log(`Znaleziono ${formattedResults.length} podobnych treści dla zapytania: "${query}"`);
    formattedResults.forEach((result, i) => {
      console.log(`  ${i+1}. Similarity: ${result.similarityPercent} (score: ${result.score.toFixed(4)})`);
    });
    
    return formattedResults;
  } catch (error) {
    console.error('Błąd wyszukiwania:', error);
    throw error;
  }
}

/**
 * Pobiera statystyki indexu
 * @returns Promise<Object> - Statystyki indexu
 */
async function getCollectionStats() {
  try {
    const index = await initPinecone();
    const stats = await index.describeIndexStats();
    
    return {
      totalVectors: stats.totalRecordCount || 0,
      dimension: stats.dimension,
      indexName: INDEX_NAME,
      namespaces: stats.namespaces
    };
  } catch (error) {
    console.error('Błąd pobierania statystyk:', error);
    throw error;
  }
}

/**
 * Usuwa wszystkie wektory z indexu
 * @returns Promise<void>
 */
async function clearCollection() {
  try {
    const index = await initPinecone();
    
    // Pinecone wymaga usuwania po namespace lub po ID
    // Usuń wszystkie wektory (deleteAll)
    await index.deleteAll();
    
    console.log(`Usunięto wszystkie wektory z indexu ${INDEX_NAME}`);
  } catch (error) {
    console.error('Błąd usuwania wektorów:', error);
    throw error;
  }
}

/**
 * Sprawdza połączenie z Pinecone
 * @returns Promise<boolean> - Czy połączenie działa
 */
async function checkConnection() {
  try {
    await pinecone.listIndexes();
    console.log('✅ Połączenie z Pinecone działa');
    return true;
  } catch (error) {
    console.error('❌ Błąd połączenia z Pinecone:', error);
    return false;
  }
}

module.exports = {
  initPinecone,
  embedAndStore,
  searchSimilar,
  getCollectionStats,
  clearCollection,
  checkConnection
};
