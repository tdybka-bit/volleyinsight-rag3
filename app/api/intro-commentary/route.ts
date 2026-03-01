import { NextRequest } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index('ed-volley');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  try {
    const { 
      homeTeam, 
      awayTeam, 
      language = 'pl',
      homePlayers = [],
      awayPlayers = [],
      playerPositions = {},
    } = await request.json();

    if (!homeTeam || !awayTeam) {
      return new Response(JSON.stringify({ intro: '' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[INTRO] Generating intro for ${homeTeam} vs ${awayTeam} (${language})`);
    console.log(`[INTRO] Players: home=${homePlayers.length}, away=${awayPlayers.length}, positions=${Object.keys(playerPositions).length}`);

    // ========================================================================
    // STEP 1: Build player context from REAL lineup data (no hallucination!)
    // ========================================================================
    let playerContext = '';
    
    if (homePlayers.length > 0 || awayPlayers.length > 0) {
      const formatPlayer = (name: string) => {
        const pos = playerPositions[name];
        return pos ? `${name} (${pos})` : name;
      };
      
      if (homePlayers.length > 0) {
        playerContext += `\n${homeTeam}: ${homePlayers.map(formatPlayer).join(', ')}`;
      }
      if (awayPlayers.length > 0) {
        playerContext += `\n${awayTeam}: ${awayPlayers.map(formatPlayer).join(', ')}`;
      }
    }

    // ========================================================================
    // STEP 2: Query Pinecone for additional context (player profiles, tactics)
    // ========================================================================
    let ragContext = '';
    try {
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: `${homeTeam} vs ${awayTeam} mecz siatkowka druzyna`,
        dimensions: 768, // Match Pinecone index dimensions!
      });
      const vector = embedding.data[0].embedding;

      const [profilesRes, tacticsRes] = await Promise.all([
        index.namespace('player-profiles').query({ vector, topK: 4, includeMetadata: true }),
        index.namespace('tactical-knowledge').query({ vector, topK: 2, includeMetadata: true }),
      ]);

      const profileSnippets = (profilesRes.matches || [])
        .filter(m => (m.score || 0) > 0.3)
        .map(m => m.metadata?.text || '')
        .filter(Boolean);

      const tacticsSnippets = (tacticsRes.matches || [])
        .filter(m => (m.score || 0) > 0.3)
        .map(m => m.metadata?.text || '')
        .filter(Boolean);

      if (profileSnippets.length > 0) {
        ragContext += `\nPROFILE ZAWODNIKOW Z BAZY:\n${profileSnippets.join('\n').substring(0, 800)}`;
      }
      if (tacticsSnippets.length > 0) {
        ragContext += `\nKONTEKST TAKTYCZNY:\n${tacticsSnippets.join('\n').substring(0, 400)}`;
      }
      
      console.log(`[INTRO] RAG: ${profileSnippets.length} profiles, ${tacticsSnippets.length} tactics`);
    } catch (err) {
      console.error('[INTRO] RAG error:', err);
      // Continue without RAG - we still have real player data from frontend
    }

    // ========================================================================
    // STEP 3: Generate intro (always in Polish)
    // ========================================================================
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Jestes komentatorem radiowym meczu siatkowki. Generujesz INTRO przed meczem - 2-3 zdania budujace nastroj i napiecie.

ZASADY:
- KROTKO: 2-3 zdania, max 60 slow
- Wymien OBE druzyny z pelna nazwa
- Zbuduj napiecie i atmosfere (hala, kibice, stawka)
- Jesli masz info o zawodnikach - wspomniej 1-2 kluczowych graczy PO NAZWISKU
- NIGDY NIE WYMYSLAJ graczy! Uzywaj TYLKO nazwisk z listy SKLAD DRUZYN ponizej!
- Jesli nie znasz graczy — NIE wspominaj zadnych nazwisk, mow ogolnie o druzynie
- NIE wymyslaj konkretnych wynikow ani statystyk
- NIE uzywaj emoji
- Styl: jakbys wlasnie wlaczyl transmisje radiowa`,
        },
        {
          role: 'user',
          content: `MECZ: ${homeTeam} vs ${awayTeam}
${playerContext ? `\nSKLAD DRUZYN (TYLKO TE NAZWISKA SA PRAWDZIWE!):${playerContext}` : ''}
${ragContext}

Wygeneruj intro do meczu po polsku.`,
        },
      ],
      temperature: 0.9,
      max_tokens: 150,
    });

    const intro = completion.choices[0].message.content || '';
    console.log(`[INTRO] Generated: ${intro.substring(0, 100)}...`);

    return new Response(JSON.stringify({ intro }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[INTRO] Error:', error);
    return new Response(JSON.stringify({ intro: '' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}