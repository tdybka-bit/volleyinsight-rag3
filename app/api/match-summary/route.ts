import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// MATCH SUMMARY — generated after the final rally of the match
// Different from set-summary: emotional, narrative, holistic view of the match
// ============================================================================

const getMatchSummaryPrompt = (language: string) => {
  const prompts: Record<string, string> = {
    pl: `Jesteś doświadczonym komentatorem siatkarskim. Napisz emocjonalne, narracyjne podsumowanie CAŁEGO MECZU po polsku.
Styl: jak zakończenie transmisji w Polsacie Sport / TVP Sport. Chwytliwe, z emocją, z pointą.`,
    en: `You are a professional volleyball commentator for Sky Sports / NBC. Write an emotional, narrative match summary in ENGLISH.
Style: like a post-match wrap on Sky Sports. Punchy, evocative, with a memorable closing line.`,
    it: `Sei un commentatore professionista. Scrivi un riassunto della partita in ITALIANO stile Rai Sport.
Stile: emozionante, teatrale, con una conclusione memorabile.`,
    de: `Du bist ein professioneller Kommentator. Schreibe eine Zusammenfassung des Spiels auf DEUTSCH im Stil von Sport1.
Stil: präzise, emotional, mit einer starken Schlusspointe.`,
    tr: `Sen profesyonel bir voleybol yorumcususun. Maçın özetini TÜRKÇE yaz, TRT Spor tarzında.
Stil: duygusal, enerjik, güçlü bir kapanış cümlesiyle.`,
    es: `Eres un comentarista profesional. Escribe un resumen del partido en ESPAÑOL estilo Movistar+.
Estilo: emotivo, narrativo, con una conclusión memorable.`,
    pt: `Você é um comentarista profissional. Escreva um resumo da partida em PORTUGUÊS BRASILEIRO estilo Globo/SporTV.
Estilo: apaixonado, crescendo emocional, com uma frase final marcante.`,
    jp: `あなたはプロのバレーボール実況アナウンサーです。NHKスタイルで試合のまとめを日本語で書いてください。
スタイル：品格があり、感情豊かで、印象的な締めの一文で終わること。`,
  };
  return prompts[language] || prompts.pl;
};

interface SetResult {
  setNumber: number;
  homeScore: number;
  awayScore: number;
  homeWon: boolean;
}

interface TopScorer {
  player: string;
  points: number;
  team: 'home' | 'away';
}

interface MatchSummaryRequest {
  homeTeam: string;
  awayTeam: string;
  matchScore: { home: number; away: number };  // sets won
  setResults: SetResult[];
  topScorers: TopScorer[];
  totalRallies: number;
  language: string;
  // Optional drama indicators
  hadComeback?: boolean;
  longestStreak?: { team: string; length: number };
  totalAces?: number;
}

export async function POST(request: NextRequest) {
  try {
    const {
      homeTeam,
      awayTeam,
      matchScore,
      setResults,
      topScorers,
      totalRallies,
      language = 'pl',
      hadComeback = false,
      longestStreak,
      totalAces = 0,
    }: MatchSummaryRequest = await request.json();

    const winner = matchScore.home > matchScore.away ? homeTeam : awayTeam;
    const loser  = matchScore.home > matchScore.away ? awayTeam : homeTeam;
    const matchScoreStr = `${matchScore.home}:${matchScore.away}`;
    const was5setter = setResults.length === 5;
    const was3setter = setResults.length === 3;

    // Build set scores string
    const setScoresStr = setResults
      .map(s => `${s.setNumber}. set: ${s.homeScore}:${s.awayScore}${s.homeWon ? ` (${homeTeam.split(' ')[0]})` : ` (${awayTeam.split(' ')[0]})`}`)
      .join(', ');

    // Build top scorers string
    const topScorersStr = topScorers
      .slice(0, 5)
      .map(s => `${s.player} ${s.points} pkt (${s.team === 'home' ? homeTeam.split(' ')[0] : awayTeam.split(' ')[0]})`)
      .join(', ');

    const dramaContext = [
      was5setter ? '⚡ TIE-BREAK! Pełne 5 setów — dramatyczny finał.' : '',
      hadComeback ? '🔥 Comeback — jedna z drużyn odrabiała dużą stratę.' : '',
      longestStreak ? `💥 Najdłuższa seria: ${longestStreak.length} punktów z rzędu przez ${longestStreak.team}.` : '',
      totalAces > 15 ? `🎯 Mecz zagrywki — łącznie ${totalAces} asów serwisowych!` : '',
    ].filter(Boolean).join('\n');

    const systemPrompt = getMatchSummaryPrompt(language);

    const userPrompt = `Napisz podsumowanie meczu na podstawie tych danych:

MECZ: ${homeTeam} vs ${awayTeam}
WYNIK: ${winner} wygrywa ${matchScoreStr} w setach
SETY: ${setScoresStr}
NAJLEPSI PUNKTUJĄCY: ${topScorersStr}
LICZBA AKCJI: ${totalRallies}
${dramaContext ? `DRAMATURGIA:\n${dramaContext}` : ''}

Wymagania:
- 3-4 zdania maksymalnie
- Zacznij od wyniku i zwycięzcy
- Wymień jednego lub dwóch kluczowych zawodników
- Zakończ emocjonalną, zapadającą w pamięć pointą
- ${was5setter ? 'Podkreśl dramatyzm tie-breaka!' : was3setter ? 'Zaznacz że to było pewne zwycięstwo.' : 'Opisz wyrównaną walkę.'}
- NIGDY nie używaj cudzysłowów wokół całego tekstu`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    let narrative = completion.choices[0].message.content || '';
    // Clean up quotes
    narrative = narrative.replace(/^["「"']|["」"']$/g, '').trim();

    console.log(`[MATCH-SUMMARY] ${language} generated: "${narrative.substring(0, 80)}..."`);

    return new Response(JSON.stringify({ narrative, winner, matchScoreStr }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[MATCH-SUMMARY] Error:', error);
    return new Response(JSON.stringify({ error: 'Match summary failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}