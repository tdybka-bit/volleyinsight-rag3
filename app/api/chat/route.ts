import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { searchSimilar, getCollectionStats } from '@/lib/vectorStore';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
});

export async function POST(request: NextRequest) {
  try {
    const { message, limit = 3 } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Brak wiadomości do przetworzenia' },
        { status: 400 }
      );
    }

    console.log(`🔍 RAG Chat: "${message}"`);

    // 1. Wyszukaj podobne treści w ChromaDB
    let context = '';
    let searchResults = [];
    
    try {
      searchResults = await searchSimilar(message, limit);
      
      if (searchResults.length > 0) {
        context = searchResults
          .map((result, index) => 
            `Źródło ${index + 1} (${result.metadata.type}):\n${result.content}\n`
          )
          .join('\n');
        
        console.log(`📚 Znaleziono ${searchResults.length} podobnych treści`);
      } else {
        console.log('⚠️ Brak podobnych treści w bazie danych');
      }
    } catch (searchError) {
      console.error('Błąd wyszukiwania w ChromaDB:', searchError);
      // Kontynuuj bez kontekstu jeśli wyszukiwanie się nie powiedzie
    }

    // 2. Przygotuj prompt z kontekstem
    const systemPrompt = `Jesteś ekspertem od siatkówki i trenerem VolleyInsight. 
Odpowiadaj na pytania dotyczące techniki, taktyki, przepisów i treningu siatkówki.

${context ? `KONTEKST Z BAZY WIEDZY:
${context}

Użyj powyższego kontekstu aby udzielić dokładnej i szczegółowej odpowiedzi. Jeśli kontekst nie zawiera odpowiedzi na pytanie, powiedz to jasno i zaproponuj inne pytanie.` : 'Nie masz dostępu do bazy wiedzy, więc odpowiadaj na podstawie swojej wiedzy o siatkówce.'}

Odpowiadaj po polsku, profesjonalnie i pomocnie. Jeśli pytanie dotyczy konkretnej techniki, podaj szczegółowe instrukcje.`;

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

    // 4. Przygotuj odpowiedź z metadanymi
    const responseData = {
      success: true,
      message: response,
      context: {
        hasContext: context.length > 0,
        sourcesCount: searchResults.length,
        sources: searchResults.map(result => ({
          type: result.metadata.type,
          filename: result.metadata.filename,
          similarity: result.similarity,
          content: result.content.substring(0, 100) + '...'
        }))
      },
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Odpowiedź wygenerowana (${response.length} znaków)`);
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
