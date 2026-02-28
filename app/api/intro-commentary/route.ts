import { NextRequest } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index('ed-volley');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  try {
    const { homeTeam, awayTeam, language = 'pl' } = await request.json();

    if (!homeTeam || !awayTeam) {
      return new Response(JSON.stringify({ intro: '' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[INTRO] Generating intro for ${homeTeam} vs ${awayTeam} (${language})`);

    // Query Pinecone for team/player context
    let teamContext = '';
    try {
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: `${homeTeam} vs ${awayTeam} mecz siatkowka druzyna`,
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
        teamContext += `\nZNANI ZAWODNICY:\n${profileSnippets.join('\n').substring(0, 800)}`;
      }
      if (tacticsSnippets.length > 0) {
        teamContext += `\nKONTEKST TAKTYCZNY:\n${tacticsSnippets.join('\n').substring(0, 400)}`;
      }
    } catch (err) {
      console.error('[INTRO] RAG error:', err);
    }

    // Language-specific system prompts
    const langInstructions: Record<string, string> = {
      pl: 'Pisz po polsku. Styl: polski komentator radiowy, cieply, budujacy napieie.',
      en: 'Write in English. Style: warm British sports commentator building anticipation.',
      de: 'Schreibe auf Deutsch. Stil: sachlicher, aber enthusiastischer Sportkommentator.',
      it: 'Scrivi in italiano. Stile: commentatore appassionato, emotivo, teatrale.',
      es: 'Escribe en español. Estilo: comentarista apasionado, dramático.',
      tr: 'Türkçe yaz. Stil: heyecanlı ve tutkulu spor yorumcusu.',
      pt: 'Escreva em português. Estilo: comentarista caloroso e entusiasmado.',
      jp: '日本語で書いてください。スタイル：熱血スポーツアナウンサー。',
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Jestes komentatorem radiowym meczu siatkowki. Generujesz INTRO przed meczem - 2-3 zdania budujace nastroj i napiecie.
${langInstructions[language] || langInstructions.pl}

ZASADY:
- KROTKO: 2-3 zdania, max 60 slow
- Wymien OBE druzyny z pelna nazwa
- Zbuduj napiecie i atmosfere (hala, kibice, stawka)
- Jesli masz info o zawodnikach - wspomniej 1-2 kluczowych graczy
- NIE wymyslaj konkretnych wynikow ani statystyk
- NIE uzywaj emoji
- Styl: jakbys wlasnie wlaczyl transmisje radiowa`,
        },
        {
          role: 'user',
          content: `MECZ: ${homeTeam} vs ${awayTeam}
${teamContext}

Wygeneruj intro do meczu.`,
        },
      ],
      temperature: 0.9,
      max_tokens: 120,
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