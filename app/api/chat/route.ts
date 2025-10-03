import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { searchSimilar, getCollectionStats } from '@/lib/vectorStore';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
});

export async function POST(request: NextRequest) {
  try {
    const { message, limit = 3, responseLength = 'medium' } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Brak wiadomości do przetworzenia' },
        { status: 400 }
      );
    }

    console.log(`\n🔍 ===== RAG CHAT TEST =====`);
    console.log(`📝 Pytanie: "${message}"`);
    console.log(`🎯 Threshold podobieństwa: 0.6`);

    // 1. Wyszukaj podobne treści w ChromaDB z threshold
    let context = '';
    let searchResults = [];
    let responseSource = 'openai'; // 'database', 'hybrid', 'openai'
    const SIMILARITY_THRESHOLD = 0.3; // Minimum similarity score (lowered from 0.6)
    
    try {
      searchResults = await searchSimilar(message, limit);
      
      console.log(`📊 Znaleziono ${searchResults.length} wyników w bazie`);
      
      if (searchResults.length > 0) {
        // Loguj wszystkie wyniki z podobieństwem
        console.log(`📈 Szczegóły wyników:`);
        searchResults.forEach((result, index) => {
          const isRelevant = result.similarity >= SIMILARITY_THRESHOLD;
          console.log(`  ${index + 1}. ${result.metadata.type} - ${(result.similarity * 100).toFixed(1)}% ${isRelevant ? '✅' : '❌'}`);
        });
        
        // Filtruj wyniki według threshold podobieństwa
        const relevantResults = searchResults.filter(result => result.similarity >= SIMILARITY_THRESHOLD);
        
        if (relevantResults.length > 0) {
          context = relevantResults
            .map((result, index) => 
              `Źródło ${index + 1} (${result.metadata.type}, podobieństwo: ${(result.similarity * 100).toFixed(1)}%):\n${result.content}\n`
            )
            .join('\n');
          
          responseSource = relevantResults.length === searchResults.length ? 'database' : 'hybrid';
          console.log(`✅ Wybrano ${relevantResults.length} wysokiej jakości treści`);
          console.log(`🎯 Response source: ${responseSource.toUpperCase()}`);
        } else {
          console.log(`❌ Wszystkie treści mają zbyt niskie podobieństwo (max: ${Math.max(...searchResults.map(r => r.similarity)).toFixed(3)})`);
          console.log(`🎯 Response source: OPENAI (fallback)`);
        }
      } else {
        console.log('❌ Brak podobnych treści w bazie danych');
        console.log(`🎯 Response source: OPENAI (fallback)`);
      }
    } catch (searchError) {
      console.error('❌ Błąd wyszukiwania w ChromaDB:', searchError);
      console.log(`🎯 Response source: OPENAI (fallback)`);
      // Kontynuuj bez kontekstu jeśli wyszukiwanie się nie powiedzie
    }

    // 2. Przygotuj smart prompt z kontekstem
    const hasContext = context.length > 0;
    
    // Determine response length instructions
    let lengthInstruction = '';
    switch (responseLength) {
      case 'short':
        lengthInstruction = 'Odpowiadaj BARDZO ZWIĘŹLE (2-3 zdania maksymalnie).';
        break;
      case 'detailed':
        lengthInstruction = 'Możesz udzielić pełnej, szczegółowej odpowiedzi.';
        break;
      default: // 'medium'
        lengthInstruction = 'Odpowiadaj ZWIĘŹLE (3-5 zdań maksymalnie).';
    }

    let systemPrompt = `Jesteś ekspertem siatkówki w VolleyInsight. 

ZASADY ODPOWIEDZI:
- Odpowiadaj KONKRETNIE i ZWIĘŹLE (3-5 zdań max)
- Używaj bullet points dla list elementów
- Krótkie paragrafy (max 2-3 zdania każdy)
- Struktura: Główna odpowiedź → Opcjonalne detale

FORMATOWANIE:
- Numerowane listy dla kroków (1. 2. 3.)
- Bullet points (•) dla cech/elementów
- Pogrubienie dla kluczowych terminów
- Podział na sekcje tylko gdy niezbędne

PRZYKŁAD DOBREJ ODPOWIEDZI:
"Blok wymaga trzech kluczowych elementów:
- Pozycja: stopy na szerokość barków, kolana lekko ugięte
- Timing: skok dokładnie w momencie uderzenia przez atakującego
- Ręce: maksymalnie wyciągnięte, palce rozstawione

Kluczowy jest timing - za wcześnie lub za późno znacząco obniża skuteczność."

UNIKAJ:
- Rozwlekłych wprowadzeń
- Powtarzania oczywistości
- Nadmiernych wyjaśnień
- Długich akapitów bez podziału

${lengthInstruction}

${hasContext ? 'Bazuj na kontekście z bazy wiedzy.' : 'Używaj wiedzy eksperckiej.'}`;

    // Smart prompt logic based on response source
    if (responseSource === 'database') {
      systemPrompt += `\n\nKONTEKST Z BAZY WIEDZY VOLLEYINSIGHT:
${context}

Użyj powyższego kontekstu jako głównego źródła informacji. Odpowiadaj na podstawie tych materiałów, dodając swoje eksperckie komentarze.`;
    } else if (responseSource === 'hybrid') {
      systemPrompt += `\n\nKONTEKST Z BAZY WIEDZY VOLLEYINSIGHT (częściowo odpowiedni):
${context}

Użyj powyższego kontekstu jako punktu wyjścia, ale uzupełnij odpowiedź swoją wiedzą ekspercką o siatkówce.`;
    } else {
      systemPrompt += `\n\nNie masz dostępu do bazy wiedzy VolleyInsight, więc odpowiadaj na podstawie swojej wiedzy eksperckiej o siatkówce.`;
    }

    // 3. Generuj odpowiedź używając OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || 'Przepraszam, nie mogę wygenerować odpowiedzi.';

    // 4. Przygotuj smart response z metadanymi
    const responseData = {
      success: true,
      message: response,
      context: {
        hasContext: context.length > 0,
        responseSource: responseSource,
        responseLength: responseLength,
        sourcesCount: searchResults.length,
        relevantSourcesCount: searchResults.filter(r => r.similarity >= SIMILARITY_THRESHOLD).length,
        similarityThreshold: SIMILARITY_THRESHOLD,
        sources: searchResults.map(result => ({
          type: result.metadata.type,
          filename: result.metadata.filename,
          similarity: result.similarity,
          isRelevant: result.similarity >= SIMILARITY_THRESHOLD,
          content: result.content.substring(0, 100) + '...'
        }))
      },
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Odpowiedź wygenerowana (${response.length} znaków)`);
    console.log(`🎯 Final response source: ${responseSource.toUpperCase()}`);
    console.log(`📏 Response length: ${responseLength.toUpperCase()}`);
    console.log(`📊 Context length: ${context.length} znaków`);
    console.log(`===== KONIEC RAG TEST =====\n`);
    
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ Błąd API chat:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Błąd podczas generowania odpowiedzi',
        details: error instanceof Error ? error.message : 'Nieznany błąd',
        message: 'Przepraszam, wystąpił błąd podczas przetwarzania Twojego pytania. Spróbuj ponownie.'
      },
      { status: 500 }
    );
  }
}

// GET endpoint do sprawdzenia statusu
export async function GET() {
  try {
    const stats = await getCollectionStats();
    
    return NextResponse.json({
      success: true,
      status: 'RAG Chat API działa',
      database: {
        connected: true,
        totalChunks: stats?.totalChunks || 0,
        types: stats?.typeDistribution || {}
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        status: 'RAG Chat API - błąd połączenia z bazą danych',
        error: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}

