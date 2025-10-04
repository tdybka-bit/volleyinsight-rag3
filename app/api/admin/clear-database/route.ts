import { NextRequest, NextResponse } from 'next/server';
import { ChromaApi, ChromaClient } from 'chromadb';

const COLLECTION_NAME = 'volleyball-insights';

export async function POST(request: NextRequest) {
  try {
    console.log(`🗑️ ===== CLEAR DATABASE REQUEST =====`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    
    // Get current stats before clearing
    let previousCount = 0;
    try {
      const client = new ChromaClient({
        path: process.env.CHROMADB_URL || 'http://localhost:8000'
      });
      
      const collection = await client.getCollection({ name: COLLECTION_NAME });
      const count = await collection.count();
      previousCount = count;
      
      console.log(`📊 Current chunks in database: ${previousCount}`);
    } catch (error) {
      console.error('❌ Error getting current count:', error);
    }

    // Clear the database
    try {
      const client = new ChromaClient({
        path: process.env.CHROMADB_URL || 'http://localhost:8000'
      });

      // Delete the existing collection
      try {
        await client.deleteCollection({ name: COLLECTION_NAME });
        console.log(`✅ Deleted collection: ${COLLECTION_NAME}`);
      } catch (error) {
        console.log(`⚠️ Collection ${COLLECTION_NAME} may not exist, continuing...`);
      }

      // Create new empty collection
      await client.createCollection({
        name: COLLECTION_NAME,
        metadata: {
          description: 'VolleyInsight volleyball knowledge base',
          created: new Date().toISOString(),
          cleared: new Date().toISOString()
        }
      });
      console.log(`✅ Created new empty collection: ${COLLECTION_NAME}`);

      // Verify the new collection is empty
      const newCollection = await client.getCollection({ name: COLLECTION_NAME });
      const newCount = await newCollection.count();

      // Log the operation
      console.log(`🗑️ Database cleared successfully`);
      console.log(`📊 Previous chunks: ${previousCount}`);
      console.log(`📊 New chunks: ${newCount}`);
      console.log(`⏰ Operation completed: ${new Date().toISOString()}`);
      console.log(`===== CLEAR DATABASE COMPLETED =====\n`);

      return NextResponse.json({
        success: true,
        message: `Usunięto ${previousCount} chunków. Baza danych jest teraz pusta.`,
        previousCount: previousCount,
        newCount: newCount,
        timestamp: new Date().toISOString()
      });

    } catch (chromaError) {
      console.error('❌ ChromaDB error during clear operation:', chromaError);
      
      return NextResponse.json({
        success: false,
        message: 'Błąd połączenia z ChromaDB',
        error: chromaError instanceof Error ? chromaError.message : 'Nieznany błąd ChromaDB',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ General error in clear-database API:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Wystąpił nieoczekiwany błąd podczas czyszczenia bazy danych',
      error: error instanceof Error ? error.message : 'Nieznany błąd',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET endpoint to check if clear operation is available
export async function GET() {
  try {
    const client = new ChromaClient({
      path: process.env.CHROMADB_URL || 'http://localhost:8000'
    });

    // Try to get collection info
    try {
      const collection = await client.getCollection({ name: COLLECTION_NAME });
      const count = await collection.count();
      
      return NextResponse.json({
        success: true,
        canClear: true,
        currentChunks: count,
        collectionName: COLLECTION_NAME,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Collection doesn't exist
      return NextResponse.json({
        success: true,
        canClear: false,
        currentChunks: 0,
        message: 'Kolekcja nie istnieje',
        collectionName: COLLECTION_NAME,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      canClear: false,
      message: 'Błąd połączenia z ChromaDB',
      error: error instanceof Error ? error.message : 'Nieznany błąd',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

