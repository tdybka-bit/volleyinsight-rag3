import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Import vector store dla RAG
const { searchSimilar } = require('../../../lib/vectorStore');

// ✅ Lazy initialization - tworzy klienta tylko gdy jest potrzebny
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Brak wiadomości' },
        { status: 400 }
      );
    }

    // Wyszukaj podobne treści w RAG
    let ragContext = '';
    try {
      const similarDocs = await searchSimilar(message, 3);
      if (similarDocs && similarDocs.length > 0) {
        ragContext = similarDocs
          .map((doc: any) => `[${doc.metadata.type}] ${doc.content}`)
          .join('\n\n');
      }
    } catch (ragError) {
      console.error('RAG search error:', ragError);
      // Continue without RAG context
    }

    // System prompt zależny od kontekstu
    let systemPrompt = `Jesteś ekspertem od siatkówki i pomocnym asystentem AI dla aplikacji VolleyLive AI.`;

    if (context === 'live-match') {
      systemPrompt += `\n\nOdpowiadasz na pytania użytkownika który ogląda mecz NA ŻYWO.
Twoje odpowiedzi powinny być:
- KRÓTKIE i zwięzłe (2-4 zdania max)
- Napisane prostym językiem
- Z emoji dla lepszej czytelności 🏐
- Skoncentrowane na konkretnej akcji z meczu
- Praktyczne i przydatne podczas oglądania

Format odpowiedzi:
1. Krótkie wyjaśnienie (1-2 zdania)
2. Ciekawostka lub dodatkowy kontekst (1 zdanie)
3. Emoji na końcu dla lepszego efektu wizualnego`;
    } else {
      systemPrompt += `\n\nTwoje odpowiedzi powinny być rzeczowe, pomocne i oparte na faktach.
Wykorzystuj dostępną wiedzę z dokumentacji siatkówki.`;
    }

    if (ragContext) {
      systemPrompt += `\n\nMasz dostęp do następującej wiedzy z bazy dokumentów:\n${ragContext}`;
      
      // CRITICAL: Player stats accuracy rules
      systemPrompt += `\n\n🎯 KRYTYCZNE ZASADY dla statystyk graczy:
    1. Używaj TYLKO liczb bezpośrednio ze źródeł powyżej - ZERO halucynacji!
    2. Jeśli pytanie dotyczy konkretnego sezonu/ligi - cytuj TYLKO dane z tego sezonu/ligi
    3. Jeśli gracz grał w wielu ligach - wymień wszystkie i porównaj
    4. Jeśli nie masz pewnych danych - powiedz "nie mam tych danych"
    5. ZAWSZE podawaj ligę i sezon przy statystykach
    
    Przykład: "Aleksandra Gryka w sezonie 2024-2025 w LegaVolley Femminile zdobyła 95 punktów w 32 meczach."`;
    }

    // ✅ Pobierz klienta OpenAI dopiero tutaj
    const openai = getOpenAI();

    // Wywołanie OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: context === 'live-match' ? 200 : 500
    });

    const response = completion.choices[0]?.message?.content || 'Przepraszam, nie mogę odpowiedzieć.';

    return NextResponse.json({
      response,
      context: context || 'general',
      ragUsed: !!ragContext
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: 'Błąd podczas przetwarzania zapytania',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}