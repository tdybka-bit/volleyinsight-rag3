import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

// ============================================================================
// INTRO COMMENTARY — pre-match atmospheric commentary in target language
// ============================================================================

const INTRO_PROMPTS: Record<string, string> = {
  pl: `Jesteś polskim komentatorem siatkarskim (styl Tomasz Swędrowski / TVP Sport).
Napisz krótkie, emocjonalne intro przed meczem PlusLigi po POLSKU.
2-3 zdania. Atmosfera, napięcie, prezentacja drużyn. Bez statystyk.`,

  en: `You are an English volleyball commentator (Sky Sports / NBC Sports style).
Write a short, atmospheric pre-match introduction in ENGLISH.
2-3 sentences. Build excitement, introduce both teams. No statistics.`,

  it: `Sei un commentatore italiano di pallavolo (stile Rai Sport).
Scrivi una breve, emozionante presentazione pre-partita in ITALIANO.
2-3 frasi. Atmosfera, emozione, presentazione delle squadre. Niente statistiche.`,

  de: `Du bist ein deutscher Volleyball-Kommentator (Sport1/ZDF Stil).
Schreibe eine kurze, atmosphärische Vorstellung vor dem Spiel auf DEUTSCH.
2-3 Sätze. Spannung aufbauen, beide Teams vorstellen. Keine Statistiken.`,

  tr: `Sen profesyonel bir Türk voleybol yorumcususun (TRT Spor tarzı).
Maç öncesi kısa, atmosferik bir giriş yap TÜRKÇE olarak.
2-3 cümle. Heyecan yarat, her iki takımı tanıt. İstatistik yok.`,

  es: `Eres un comentarista de voleibol español (Movistar+ / DMAX estilo).
Escribe una breve presentación pre-partido emocionante en ESPAÑOL.
2-3 frases. Ambiente, emoción, presentación de los equipos. Sin estadísticas.`,

  pt: `Você é um comentarista brasileiro de vôlei (Globo/SporTV estilo).
Escreva uma breve introdução pré-jogo emocionante em PORTUGUÊS BRASILEIRO.
2-3 frases. Atmosfera, emoção, apresentação dos times. Sem estatísticas.`,

  jp: `あなたはプロの日本語バレーボール実況アナウンサーです（NHK・フジテレビスタイル）。
試合前の短い雰囲気ある紹介を日本語で書いてください。
2〜3文。緊張感、両チームの紹介。統計は不要。`,
};

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

    const index = pinecone.Index('ed-volley');

    // Try to get some RAG context for key players
    let ragContext = '';
    try {
      const keyPlayers = [...homePlayers.slice(0, 2), ...awayPlayers.slice(0, 2)];
      if (keyPlayers.length > 0) {
        const queryText = `${homeTeam} ${awayTeam} key players ${keyPlayers.join(' ')}`;
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: queryText,
          dimensions: 768,
        });
        const results = await index.namespace('player-profiles').query({
          vector: embedding.data[0].embedding,
          topK: 3,
          includeMetadata: true,
        });
        ragContext = results.matches
          .filter(m => (m.score || 0) > 0.4)
          .map(m => m.metadata?.content || m.metadata?.text || '')
          .filter(Boolean)
          .join('\n')
          .substring(0, 400);
      }
    } catch (e) {
      // RAG optional — proceed without
    }

    const systemPrompt = INTRO_PROMPTS[language] || INTRO_PROMPTS.pl;

    const userPrompt = `${homeTeam} vs ${awayTeam}
Składy: ${homeTeam}: ${homePlayers.slice(0, 5).join(', ')} | ${awayTeam}: ${awayPlayers.slice(0, 5).join(', ')}
${ragContext ? `Kontekst zawodników:\n${ragContext}` : ''}

Napisz intro w wymaganym języku. NIE używaj innych języków. Tylko ${language.toUpperCase()}.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    let intro = completion.choices[0].message.content?.trim() || '';
    intro = intro.replace(/^["「"']|["」"']$/g, '').trim();

    console.log(`[INTRO] ${language}: "${intro.substring(0, 80)}..."`);

    return new Response(JSON.stringify({ intro }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[INTRO] Error:', error);
    return new Response(JSON.stringify({ error: 'Intro generation failed', intro: '' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
