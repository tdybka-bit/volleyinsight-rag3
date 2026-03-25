import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index('ed-volley');

// ============================================================================
// SET SUMMARY GENERATOR — full 8-language cultural profiles
// ============================================================================

const SYSTEM_PROMPTS: Record<string, string> = {
  pl: 'Jestes doswiadczonym komentatorem siatkarskim PlusLiga. Generujesz krotkie, emocjonalne podsumowania setow w stylu radiowym. Pisz po polsku.',
  en: `You are an experienced volleyball commentator for Sky Sports / NBC Sports. Generate a short, emotional set summary in ENGLISH.\nStyle: energetic, broadcaster voice, memorable closing line. Min 2 exclamation marks.`,
  it: `Sei un commentatore professionista di pallavolo stile Rai Sport. Scrivi un breve riassunto del set in ITALIANO.\nStile: emozionante, appassionato, con una conclusione memorabile.`,
  de: `Du bist ein professioneller Volleyball-Kommentator Stil Sport1. Schreibe eine kurze Satzzusammenfassung auf DEUTSCH.\nStil: praezise, emotional, mit einer starken Schlusspointe.`,
  tr: `Sen profesyonel bir voleybol yorumcususun TRT Spor tarzi. Set ozetini TURKCE yaz.\nStil: duygusal, enerjik, guclu bir kapanis cumlesiyle.`,
  es: `Eres un comentarista profesional de voleibol estilo Movistar+. Escribe un resumen del set en ESPANOL.\nEstilo: emotivo, narrativo, con una conclusion memorable.`,
  pt: `Voce e um comentarista profissional de volei estilo Globo/SporTV. Escreva um resumo do set em PORTUGUES BRASILEIRO.\nEstilo: apaixonado, crescendo emocional, com uma frase final marcante.`,
  jp: `Anata wa puro no bareboro jikkyo anaunsaa desu NHK/Fuji TV sutairu. Setto no matome wo nihongo de kaite kudasai.\nSutairu: hinkabu to netsuryo wo kanebita jikkyo.`,
};

const LANG_NAMES: Record<string, string> = {
  pl: 'Polish', en: 'English', it: 'Italian', de: 'German',
  tr: 'Turkish', es: 'Spanish', pt: 'Portuguese (Brazilian)', jp: 'Japanese',
};

interface SetSummaryRequest {
  setNumber: number;
  finalScore: { home: number; away: number };
  homeTeam: string;
  awayTeam: string;
  rallies: Array<{
    rally_number: number;
    team_scored: string;
    score_after: { home: number; away: number };
    touches: Array<{ player: string; action: string; team: string }>;
    final_action?: { type: string; player: string };
  }>;
  language?: string;
  topScorers?: Array<{ player: string; points: number }>;
}

export async function POST(request: NextRequest) {
  console.log('[SET-SUMMARY] Generating set summary...');
  
  try {
    const { setNumber, finalScore, homeTeam, awayTeam, rallies, language = 'pl', topScorers: frontendTopScorers }: SetSummaryRequest = await request.json();

    const stats = calculateSetStats(rallies, homeTeam, awayTeam);

    let ragContext = '';
    try {
      const queryText = `podsumowanie seta kluczowe momenty seria punktow momentum zmiana prowadzenia`;
      const embedding = await openai.embeddings.create({ model: 'text-embedding-3-small', input: queryText, dimensions: 768 });
      const results = await index.namespace('set-summaries').query({ vector: embedding.data[0].embedding, topK: 3, includeMetadata: true });
      if (results.matches && results.matches.length > 0) {
        ragContext = results.matches.filter(m => (m.score || 0) > 0.3).map(m => m.metadata?.content || m.metadata?.text || '').filter(Boolean).join('\n\n');
      }
    } catch (err) {
      console.log('[SET-SUMMARY] RAG query error (continuing without):', err);
    }

    const winner = finalScore.home > finalScore.away ? homeTeam : awayTeam;
    const topScorersToUse = (frontendTopScorers && frontendTopScorers.length > 0) ? frontendTopScorers : stats.topScorers;
    const langName = LANG_NAMES[language] || 'English';

    const prompt = `SET ${setNumber} SUMMARY

SCORE: ${homeTeam} ${finalScore.home}:${finalScore.away} ${awayTeam}
WINNER: ${winner}

STATISTICS:
- Total rallies: ${stats.totalRallies}
- Longest rally: ${stats.longestRally} touches
- TOP SCORERS: ${topScorersToUse.map((s: any, i: number) => `${i+1}. ${s.player} (${s.points} pts)`).join(', ')}
- MVP: ${topScorersToUse[0]?.player || stats.mvp.name} (${topScorersToUse[0]?.points || stats.mvp.points} pts)
- Service aces: ${stats.aces.map(a => `${a.player} (${a.count})`).join(', ') || 'none'}
- Blocks: ${stats.blocks.map(b => `${b.player} (${b.count})`).join(', ') || 'none'}

KEY MOMENTS:
${stats.keyMoments.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n')}

SCORING RUNS:
${stats.streaks.map((s: any) => `${s.team}: ${s.length} points in a row (at ${s.atScore})`).join('\n') || 'no major runs'}

${ragContext ? `CONTEXT:\n${ragContext}\n` : ''}

Write 3-4 sentences of set summary. Who won, key moments, MVP, drama.
Do NOT state the exact score.
Write ENTIRELY in ${langName}. Zero Polish words allowed.
CRITICAL: Every word must be in ${langName}.`;

    const systemPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.en;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 250,
    });

    const narrative = completion.choices[0].message.content || '';
    console.log('[SET-SUMMARY]', language, narrative.substring(0, 100) + '...');

    return new Response(JSON.stringify({ 
      narrative,
      stats: { mvp: stats.mvp, totalRallies: stats.totalRallies, longestRally: stats.longestRally, keyMoments: stats.keyMoments }
    }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

  } catch (error) {
    console.error('[SET-SUMMARY] Error:', error);
    return new Response(JSON.stringify({ narrative: '', error: 'Failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

function calculateSetStats(rallies: any[], homeTeam: string, awayTeam: string) {
  const playerPoints: Record<string, { points: number; team: string }> = {};
  const playerAces: Record<string, number> = {};
  const playerBlocks: Record<string, number> = {};

  for (const rally of rallies) {
    const lastTouch = rally.touches?.[rally.touches.length - 1];
    if (lastTouch && rally.team_scored) {
      const player = lastTouch.player;
      const isWinningTeam = lastTouch.team === rally.team_scored;
      const act = (lastTouch.action || '').toLowerCase();
      if (player && isWinningTeam && !act.includes('error') && !act.includes('blad') && !act.includes('zablokowany')) {
        if (!playerPoints[player]) playerPoints[player] = { points: 0, team: lastTouch.team };
        playerPoints[player].points++;
        const action = (lastTouch.action || '').toLowerCase();
        if (action.includes('as') || action.includes('ace')) playerAces[player] = (playerAces[player] || 0) + 1;
        if (action.includes('blok') || action.includes('block')) playerBlocks[player] = (playerBlocks[player] || 0) + 1;
      }
    }
  }

  const sortedPlayers = Object.entries(playerPoints).sort(([, a], [, b]) => b.points - a.points);
  const mvp = sortedPlayers[0] ? { name: sortedPlayers[0][0], points: sortedPlayers[0][1].points, team: sortedPlayers[0][1].team } : { name: 'N/A', points: 0, team: '' };
  const aces = Object.entries(playerAces).sort(([, a], [, b]) => b - a).slice(0, 3).map(([player, count]) => ({ player, count }));
  const blocks = Object.entries(playerBlocks).sort(([, a], [, b]) => b - a).slice(0, 3).map(([player, count]) => ({ player, count }));
  const longestRally = Math.max(...rallies.map(r => r.touches?.length || 0), 0);

  const streaks: Array<{ team: string; length: number; atScore: string }> = [];
  let currentStreak = 0; let streakTeam = '';
  for (const rally of rallies) {
    if (rally.team_scored === streakTeam) { currentStreak++; }
    else {
      if (currentStreak >= 4) { const teamName = streakTeam === 'home' ? homeTeam : awayTeam; streaks.push({ team: teamName, length: currentStreak, atScore: `${rally.score_after?.home || 0}:${rally.score_after?.away || 0}` }); }
      currentStreak = 1; streakTeam = rally.team_scored;
    }
  }
  if (currentStreak >= 4) { const lastRally = rallies[rallies.length - 1]; const teamName = streakTeam === 'home' ? homeTeam : awayTeam; streaks.push({ team: teamName, length: currentStreak, atScore: `${lastRally?.score_after?.home || 0}:${lastRally?.score_after?.away || 0}` }); }

  const keyMoments: string[] = [];
  let leadChanges = 0; let prevLeader = '';
  for (const rally of rallies) {
    const s = rally.score_after; if (!s) continue;
    const leader = s.home > s.away ? 'home' : s.away > s.home ? 'away' : '';
    if (leader && leader !== prevLeader && prevLeader !== '') leadChanges++;
    if (leader) prevLeader = leader;
  }
  if (leadChanges >= 3) keyMoments.push(`${leadChanges} lead changes — tight set!`);
  for (const s of streaks) keyMoments.push(`${s.length}-point run by ${s.team} at ${s.atScore}`);
  const totalAces = Object.values(playerAces).reduce((sum, c) => sum + c, 0);
  if (totalAces >= 3) keyMoments.push(`${totalAces} service aces in this set`);
  const lastRally = rallies[rallies.length - 1];
  const finalDiff = lastRally ? Math.abs((lastRally.score_after?.home || 0) - (lastRally.score_after?.away || 0)) : 0;
  if (finalDiff <= 2 && (lastRally?.score_after?.home || 0) >= 25) keyMoments.push('Close finish — went to extra points!');

  return { totalRallies: rallies.length, longestRally, mvp, topScorers: sortedPlayers.slice(0, 5).map(([name, data]) => ({ player: name, points: data.points })), aces, blocks, streaks, keyMoments: keyMoments.slice(0, 4), leadChanges };
}
