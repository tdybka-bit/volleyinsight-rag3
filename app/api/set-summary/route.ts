import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index('ed-volley');

// ============================================================================
// SET SUMMARY GENERATOR
// ============================================================================

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
}

export async function POST(request: NextRequest) {
  console.log('[SET-SUMMARY] Generating set summary...');
  
  try {
    const { setNumber, finalScore, homeTeam, awayTeam, rallies, language = 'pl' }: SetSummaryRequest = await request.json();

    // ====================================================================
    // STEP 1: Calculate set statistics from rallies
    // ====================================================================
    const stats = calculateSetStats(rallies, homeTeam, awayTeam);
    console.log('[SET-SUMMARY] Stats:', JSON.stringify(stats, null, 2));

    // ====================================================================
    // STEP 2: Query Pinecone set-summaries namespace for style/context
    // ====================================================================
    let ragContext = '';
    try {
      const queryText = `podsumowanie seta kluczowe momenty seria punktow momentum zmiana prowadzenia`;
      
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: queryText,
        dimensions: 768,
      });

      const results = await index.namespace('set-summaries').query({
        vector: embedding.data[0].embedding,
        topK: 3,
        includeMetadata: true,
      });

      if (results.matches && results.matches.length > 0) {
        ragContext = results.matches
          .filter(m => (m.score || 0) > 0.3)
          .map(m => m.metadata?.content || m.metadata?.text || '')
          .filter(Boolean)
          .join('\n\n');
        console.log('[SET-SUMMARY] RAG context found:', ragContext.substring(0, 150) + '...');
      }
    } catch (err) {
      console.log('[SET-SUMMARY] RAG query error (continuing without):', err);
    }

    // ====================================================================
    // STEP 3: Generate narrative with GPT
    // ====================================================================
    const winner = finalScore.home > finalScore.away ? homeTeam : awayTeam;
    const loser = finalScore.home > finalScore.away ? awayTeam : homeTeam;

    const prompt = `PODSUMOWANIE SETA ${setNumber}

WYNIK: ${homeTeam} ${finalScore.home}:${finalScore.away} ${awayTeam}
ZWYCIEZCA: ${winner}

STATYSTYKI:
- Liczba akcji: ${stats.totalRallies}
- Najdluzsza wymiana: ${stats.longestRally} dotknieci
- MVP seta: ${stats.mvp.name} (${stats.mvp.points} pkt)
- Asy serwisowe: ${stats.aces.map(a => `${a.player} (${a.count})`).join(', ') || 'brak'}
- Bloki: ${stats.blocks.map(b => `${b.player} (${b.count})`).join(', ') || 'brak'}

KLUCZOWE MOMENTY:
${stats.keyMoments.map((m, i) => `${i + 1}. ${m}`).join('\n')}

SERIE PUNKTOWE:
${stats.streaks.map(s => `${s.team}: ${s.length} pkt z rzedu (przy ${s.atScore})`).join('\n') || 'brak duzych serii'}

${ragContext ? `KONTEKST Z BAZY WIEDZY:\n${ragContext}\n` : ''}

Napisz 3-4 zdania podsumowania w stylu radiowego komentatora sportowego.
- Kto wygral i jak przebiegal set
- Kluczowe momenty (serie, asy, bloki, zwroty akcji)
- Kto byl MVP i dlaczego
- Emocje i dramatyzm (jesli byl)
NIE podawaj dokladnego wyniku liczbowego - jest wyswietlany w UI.
Pisz po polsku, naturalnie, z emocjami.`;

    const systemPrompt = language === 'pl' 
      ? 'Jestes doswiadczonym komentatorem siatkarskim PlusLiga. Generujesz krotkie, emocjonalne podsumowania setow w stylu radiowym.'
      : `You are an experienced volleyball commentator. Generate a short, emotional set summary in ${language === 'en' ? 'English' : language === 'it' ? 'Italian' : language === 'de' ? 'German' : language === 'tr' ? 'Turkish' : language === 'es' ? 'Spanish' : language === 'pt' ? 'Portuguese' : language === 'jp' ? 'Japanese' : 'English'}.`;

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
    console.log('[SET-SUMMARY] Narrative generated:', narrative.substring(0, 100) + '...');

    return new Response(JSON.stringify({ 
      narrative,
      stats: {
        mvp: stats.mvp,
        totalRallies: stats.totalRallies,
        longestRally: stats.longestRally,
        keyMoments: stats.keyMoments,
      }
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    console.error('[SET-SUMMARY] Error:', error);
    return new Response(JSON.stringify({ narrative: '', error: 'Failed to generate summary' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ============================================================================
// STATS CALCULATION
// ============================================================================

function calculateSetStats(rallies: any[], homeTeam: string, awayTeam: string) {
  // Points per player
  const playerPoints: Record<string, { points: number; team: string }> = {};
  const playerAces: Record<string, number> = {};
  const playerBlocks: Record<string, number> = {};

  for (const rally of rallies) {
    // Count points from last touch
    const lastTouch = rally.touches?.[rally.touches.length - 1];
    if (lastTouch && rally.team_scored) {
      const player = lastTouch.player;
      if (player) {
        if (!playerPoints[player]) playerPoints[player] = { points: 0, team: lastTouch.team };
        playerPoints[player].points++;

        const action = (lastTouch.action || '').toLowerCase();
        if (action.includes('as') || action.includes('ace')) {
          playerAces[player] = (playerAces[player] || 0) + 1;
        }
        if (action.includes('blok') || action.includes('block')) {
          playerBlocks[player] = (playerBlocks[player] || 0) + 1;
        }
      }
    }
  }

  // MVP
  const sortedPlayers = Object.entries(playerPoints)
    .sort(([, a], [, b]) => b.points - a.points);
  const mvp = sortedPlayers[0] 
    ? { name: sortedPlayers[0][0], points: sortedPlayers[0][1].points, team: sortedPlayers[0][1].team }
    : { name: 'N/A', points: 0, team: '' };

  // Aces
  const aces = Object.entries(playerAces)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([player, count]) => ({ player, count }));

  // Blocks
  const blocks = Object.entries(playerBlocks)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([player, count]) => ({ player, count }));

  // Longest rally
  const longestRally = Math.max(...rallies.map(r => r.touches?.length || 0), 0);

  // Streaks (4+ points in a row)
  const streaks: Array<{ team: string; length: number; atScore: string }> = [];
  let currentStreak = 0;
  let streakTeam = '';
  
  for (const rally of rallies) {
    if (rally.team_scored === streakTeam) {
      currentStreak++;
    } else {
      if (currentStreak >= 4) {
        const teamName = streakTeam === 'home' ? homeTeam : awayTeam;
        streaks.push({ 
          team: teamName, 
          length: currentStreak,
          atScore: `${rally.score_after?.home || 0}:${rally.score_after?.away || 0}`
        });
      }
      currentStreak = 1;
      streakTeam = rally.team_scored;
    }
  }
  // Don't forget last streak
  if (currentStreak >= 4) {
    const lastRally = rallies[rallies.length - 1];
    const teamName = streakTeam === 'home' ? homeTeam : awayTeam;
    streaks.push({ 
      team: teamName, 
      length: currentStreak,
      atScore: `${lastRally?.score_after?.home || 0}:${lastRally?.score_after?.away || 0}`
    });
  }

  // Key moments
  const keyMoments: string[] = [];
  
  // Lead changes
  let leadChanges = 0;
  let prevLeader = '';
  for (const rally of rallies) {
    const s = rally.score_after;
    if (!s) continue;
    const leader = s.home > s.away ? 'home' : s.away > s.home ? 'away' : '';
    if (leader && leader !== prevLeader && prevLeader !== '') leadChanges++;
    if (leader) prevLeader = leader;
  }
  if (leadChanges >= 3) keyMoments.push(`${leadChanges} zmian prowadzenia - wyrownany set!`);

  // Big streaks
  for (const s of streaks) {
    keyMoments.push(`Seria ${s.length} punktow ${s.team} przy ${s.atScore}`);
  }

  // Aces
  const totalAces = Object.values(playerAces).reduce((sum, c) => sum + c, 0);
  if (totalAces >= 3) keyMoments.push(`${totalAces} asow serwisowych w secie`);

  // Close ending
  const lastRally = rallies[rallies.length - 1];
  const finalDiff = lastRally ? Math.abs((lastRally.score_after?.home || 0) - (lastRally.score_after?.away || 0)) : 0;
  if (finalDiff <= 2 && (lastRally?.score_after?.home || 0) >= 25) {
    keyMoments.push('Zacieta koncowka z prolongata!');
  }

  return {
    totalRallies: rallies.length,
    longestRally,
    mvp,
    topScorers: sortedPlayers.slice(0, 5).map(([name, data]) => ({ player: name, points: data.points })),
    aces,
    blocks,
    streaks,
    keyMoments: keyMoments.slice(0, 4),
    leadChanges,
  };
}