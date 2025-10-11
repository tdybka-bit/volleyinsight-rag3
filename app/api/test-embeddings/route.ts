import { NextRequest, NextResponse } from 'next/server';
import { testEmbeddingFunction, checkConnection, clearCollection } from '@/lib/vectorStore';

export async function POST(request: NextRequest) {
  try {
    console.log('\n🧪 ===== TEST EMBEDDING FUNCTION =====');
    
    // 1. Sprawdź połączenie z ChromaDB
    console.log('1️⃣ Sprawdzanie połączenia z ChromaDB...');
    const connectionOk = await checkConnection();
    if (!connectionOk) {
      return NextResponse.json({
        success: false,
        message: 'Błąd połączenia z ChromaDB',
        step: 'connection'
      }, { status: 500 });
    }
    
    // 2. Test embedding function
    console.log('2️⃣ Testowanie embedding function...');
    const embeddingOk = await testEmbeddingFunction();
    if (!embeddingOk) {
      return NextResponse.json({
        success: false,
        message: 'Embedding function nie działa poprawnie',
        step: 'embedding_test'
      }, { status: 500 });
    }
    
    console.log('✅ Wszystkie testy przeszły pomyślnie!');
    console.log('===== KONIEC TEST EMBEDDING =====\n');
    
    return NextResponse.json({
      success: true,
      message: 'Embedding function działa poprawnie',
      tests: {
        connection: true,
        embedding: true
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Błąd testowania embeddings:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Błąd podczas testowania embeddings',
      error: error instanceof Error ? error.message : 'Nieznany błąd',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('\n🗑️ ===== CLEAR COLLECTION FOR RE-INIT =====');
    
    // Wyczyść kolekcję aby można było ją ponownie zainicjalizować
    await clearCollection();
    
    console.log('✅ Kolekcja wyczyszczona - gotowa do re-inicjalizacji');
    console.log('===== KONIEC CLEAR COLLECTION =====\n');
    
    return NextResponse.json({
      success: true,
      message: 'Kolekcja wyczyszczona - gotowa do re-inicjalizacji',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Błąd czyszczenia kolekcji:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Błąd podczas czyszczenia kolekcji',
      error: error instanceof Error ? error.message : 'Nieznany błąd',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}






