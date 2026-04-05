import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const index = pinecone.index('ed-volley');

// ============================================================================
// PLAYER PROFILE ENDPOINT v1.4
// Fix: semantic search zamiast ID listing (Colab sync używa hashów jako ID)
// ============================================================================

// Strip diacritics: ń→n, ą→a, ć→c, ę→e, ł→l, ó→o, ś→s, ź→z, ż→z
function stripDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0142/g, 'l').replace(/\u0141/g, 'L');
}

function getNameParts(playerName: string): string[] {
  return stripDiacritics(playerName)
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(p => p.length >= 3);
}

// Semantic search + filtr po nazwisku w treści
async function findBySemantic(
  playerName: string,
  namespace: string
): Promise<Array<{ id: string; text: string }>> {
  const nameParts = getNameParts(playerName);
  console.log(`[PROFILE] Semantic search in ns="${namespace || '(default)'}" for:`, nameParts);

  const query = `${playerName} siatkarz PlusLiga profil`;  // Short query — more specific to player name
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
    dimensions: 768,
  });

  const searchResults = await index.namespace(namespace).query({
    vector: embedding.data[0].embedding,
    topK: 50,
    includeMetadata: true,
  });

  // Filtr: nazwisko musi pojawić się w ID lub w treści chunka
  const filtered = searchResults.matches.filter(m => {
    const idNorm = stripDiacritics(m.id).toLowerCase();
    const textNorm = stripDiacritics(
      ((m.metadata?.text as string) || (m.metadata?.content as string) || '')
    ).toLowerCase();
    return nameParts.some(part => idNorm.includes(part) || textNorm.includes(part));
  });

  console.log(`[PROFILE] Semantic: ${searchResults.matches.length} total → ${filtered.length} after name filter`);

  if (filtered.length === 0) {
    // Last resort: return top 3 results without name filter
    // We're in player-profiles namespace so anything returned is a player profile
    console.log(`[PROFILE] Name filter returned 0 — trying top 3 without filter`);
    const topResults: Array<{ id: string; text: string }> = [];
    for (const m of searchResults.matches.slice(0, 3)) {
      const text = (m.metadata?.text as string) || (m.metadata?.content as string) || '';
      if (text) topResults.push({ id: m.id, text });
    }
    // But only if name appears in text of at least one result
    const nameInResults = topResults.some(r => 
      stripDiacritics(r.text).toLowerCase().includes(nameParts[0] || '')
    );
    if (!nameInResults) return [];
    return topResults;
  }

  const seenTexts = new Set<string>();
  const results: Array<{ id: string; text: string }> = [];
  for (const m of filtered) {
    const text = (m.metadata?.text as string) || (m.metadata?.content as string) || '';
    const textKey = text.substring(0, 100);
    if (text && !seenTexts.has(textKey)) {
      seenTexts.add(textKey);
      results.push({ id: m.id, text });
    }
  }
  return results;
}

export async function POST(request: NextRequest) {
  console.log('========= PLAYER-PROFILE v1.4 =========');

  try {
    const { playerName } = await request.json();

    if (!playerName) {
      return Response.json({ error: 'playerName is required' }, { status: 400 });
    }

    console.log('[PROFILE] Querying for:', playerName, '→ normalized:', getNameParts(playerName));

    let allChunks: Array<{ id: string; text: string }> = [];

    // 1) player-profiles namespace — semantic search
    //    (Colab sync v2 używa hashów jako ID, nie nazwisk — stąd semantic zamiast ID listing)
    try {
      const ppChunks = await findBySemantic(playerName, 'player-profiles');
      allChunks.push(...ppChunks);
      console.log(`[PROFILE] player-profiles: ${ppChunks.length} chunks`);
    } catch (e) {
      console.error('[PROFILE] player-profiles search error:', e);
    }

    // 2) Default namespace "" — fallback jeśli za mało wyników
    if (allChunks.length < 3) {
      try {
        const defaultChunks = await findBySemantic(playerName, '');
        allChunks.push(...defaultChunks);
        console.log(`[PROFILE] default ns: ${defaultChunks.length} chunks`);
      } catch (e) {
        console.error('[PROFILE] default ns search error:', e);
      }
    }

    console.log('[PROFILE] Total chunks:', allChunks.length);

    if (allChunks.length === 0) {
      console.log('[PROFILE] No data found for', playerName);
      return Response.json({
        playerName,
        found: false,
        profile: null,
        summary: '',
        chunks: [],
      });
    }

    // GPT Summary
    const fullContent = allChunks.map(c => c.text).join('\n\n');

    let summary = '';
    try {
      const summaryCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Jestes ekspertem siatkarskim. Na podstawie danych z bazy wiedzy, przygotuj KROTKI profil zawodnika po polsku.

FORMAT (uzyj dokladnie tych sekcji, kazda MAX 1-2 zdania):
🏐 POZYCJA: [pozycja na boisku]
💪 MOCNE STRONY: [2-3 kluczowe atuty]
⚡ STYL GRY: [krotki opis stylu]
📊 CIEKAWOSTKA: [jeden fakt/statystyka]

Jesli brakuje danych dla jakiejs sekcji - POMIN ja. NIE wymyslaj!
Pisz zwiezle, konkretnie. Max 4-5 linijek.`,
          },
          {
            role: 'user',
            content: `Zawodnik: ${playerName}\n\nDane z bazy wiedzy:\n${fullContent.substring(0, 2000)}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });
      summary = summaryCompletion.choices[0].message.content || '';
      console.log('[PROFILE] GPT summary OK:', summary.substring(0, 80) + '...');
    } catch (error) {
      console.error('[PROFILE] GPT summary error:', error);
      summary = fullContent.substring(0, 500);
    }

    return Response.json({
      playerName,
      found: true,
      profile: {
        name: playerName,
        team: '',
        position: '',
        nationality: '',
        content: fullContent.substring(0, 2000),
      },
      summary,
      chunks: allChunks.map(c => ({
        content: c.text.substring(0, 500),
        category: 'profile',
        score: 1.0,
      })),
    });
  } catch (error) {
    console.error('[PROFILE] Error:', error);
    return Response.json(
      { error: 'Error fetching player profile', playerName: '', found: false },
      { status: 500 }
    );
  }
}