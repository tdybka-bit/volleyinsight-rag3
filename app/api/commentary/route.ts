import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const index = pinecone.index('ed-volley');

// Multi-language system prompts
const getLanguagePrompt = (lang: string) => {
  const prompts: Record<string, string> = {
    pl: 'Jesteś doświadczonym komentarorem meczów siatkarskich w Polsce. Komentuj po POLSKU.',
    en: 'You are an experienced volleyball commentator. Comment in ENGLISH.',
    it: 'Sei un commentatore esperto di pallavolo. Commenta in ITALIANO.',
    de: 'Du bist ein erfahrener Volleyball-Kommentator. Kommentiere auf DEUTSCH.',
    tr: 'Deneyimli bir voleybol spikerisin. TÜRKÇE yorum yap.',
    es: 'Eres un comentarista experimentado de voleibol. Comenta en ESPAÑOL.',
    pt: 'Você é um comentarista experiente de vôlei. Comente em PORTUGUÊS.',
    jp: 'あなたは経験豊富なバレーボールの実況者です。日本語でコメントしてください。',
  };
  return prompts[lang] || prompts.pl;
};

// System prompt dla komentarza meczowego - dynamiczny w zależności od sytuacji
const getCommentarySystemPrompt = (
  isHotSituation: boolean, 
  isEarlySet: boolean, 
  isBigLead: boolean,
  hasStreak: boolean,
  hasMilestone: boolean,
  language: string = 'pl'
) => {
  const langPrompt = getLanguagePrompt(language);
  
  const basePrompt = `${langPrompt}
Your task is to generate professional, factual volleyball match commentary.

CRITICAL RULES:
- Be FACTUAL, not dramatic
- NEVER exaggerate situation importance (3:2 is NOT critical!)
- NEVER mention "morale" or "pressure" in early set
- "Block error" NOT "błąd blokowy" 
- Focus on WHAT HAPPENED, not speculation
- 1-2 sentences MAX

AVOID PHRASES:
- "kluczowy moment" (unless 20+ points or tie-break)
- "wpłynąć na morale" (never use)
- "presja ze strony przeciwnika" (never for serves)
- "błąd blokowy" (say "błąd w bloku")
- Any dramatic language before 15 points

CONTEXT AWARENESS:
- Check ACTUAL score before commenting on "przewaga"
- Team leading 9:5 does NOT need to "improve" after one error
- Early set errors are just errors, not "critical moments"`;

  if (isHotSituation) {
    return basePrompt + `
- HOT SITUATION (20:20+)! NOW you can add emotion!

EXAMPLES (Polish):
- "W kluczowym momencie Grozdanov pokazuje klasę! Blok który może zadecydować o secie!"
- "McCarthy as serwisowy w najważniejszym momencie! Nerwy ze stali!"`;
  } else if (hasStreak) {
    return basePrompt + `
- SCORING STREAK (5+)! Emphasize the momentum!

EXAMPLES (Polish):
- "Kolejny punkt w serii! Zawiercie buduje przewagę!"
- "Seria trwa! Już piąty punkt pod rząd!"`;
  } else if (hasMilestone) {
    return basePrompt + `
- PLAYER MILESTONE! Celebrate and MENTION THE NUMBER!

EXAMPLES (Polish):
- "Po raz PIĄTY Grozdanov zatrzymuje rywala blokiem! Dominuje w tym elemencie!"
- "Trzeci as serwisowy McCarthy w tym secie! Rozgrzał rękę!"
- "DZIESIĄTY punkt Sasaka! Kapitalna dyspozycja atakującego!"
- "Kwolek już 8. udany atak - skuteczność imponująca!"

ALWAYS mention the milestone number!`;
  } else if (isBigLead) {
    return basePrompt + `
- BIG LEAD (10+)! Mention the situation factually!

EXAMPLES (Polish):
- "Zawiercie prowadzi 15:5. Grozdanov dołożył kolejny punkt."
- "Punkt dla Bogdanki, ale wciąż spory dystans - 8:18."`;
  } else if (isEarlySet) {
    return basePrompt + `
- EARLY SET (1-10 points): Keep it calm and factual!

EXAMPLES (Polish):
- "Grozdanov skuteczny blok. Dobry początek."
- "Błąd serwisowy McCarthy. Punkt dla przeciwnika."
- "Sasak kończy atak. Prowadzenie dla Bogdanki."

NO DRAMA - just describe what happened!`;
  } else {
    return basePrompt + `
- MID-SET (11-19 points): Factual but with ENERGY!

EXAMPLES (Polish):
- "Grozdanov skuteczny w bloku! Zatrzymał rywala."
- "McCarthy pewny w zagrywce. Punkt dla Zawiercia!"
- "Sasak kończy atak! Bogdanka zwiększa przewagę."
- "Kwolek przebija blok! Świetne uderzenie!"

Factual YES, but keep VOLLEYBALL ENERGY!`;
  }
};

interface RallyData {
  rally_number: number;
  score_before: { aluron: number; bogdanka: number };
  score_after: { aluron: number; bogdanka: number };
  team_scored: string;
  touches: Array<{
    action: string;
    player: string;
    number: string;
    team: string;
  }>;
  final_action: {
    type: string;
    player: string;
    number: string;
  };
}

interface PlayerStats {
  blocks: number;
  aces: number;
  attacks: number;
  errors: number;
  points: number;
}

interface CommentaryRequest {
  rally: RallyData;
  language?: string;
  playerStats?: Record<string, PlayerStats>; // NEW: cumulative stats
  recentRallies?: RallyData[]; // NEW: for momentum detection
}

export async function POST(request: NextRequest) {
  try {
    const { rally, language = 'pl', playerStats = {}, recentRallies = [] }: CommentaryRequest = await request.json();

    if (!rally) {
      return new Response('Rally data is required', { status: 400 });
    }

    // Extract final action info
    const finalTouch = rally.touches[rally.touches.length - 1];
    let scoringPlayer = finalTouch.player;
    let scoringAction = finalTouch.action;
    let playerTeam = finalTouch.team; // 'aluron' or 'bogdanka' from JSON
    
    // NEW: For block errors, find who ATTACKED (they deserve praise!)
    let attackingPlayer = '';
    let attackingTeam = '';
    if (finalTouch.action.toLowerCase().includes('block') && finalTouch.action.toLowerCase().includes('error')) {
      // Find the attacker (opposite team, attack action before block error)
      const attackTouch = rally.touches.find(t => 
        t.team !== finalTouch.team && 
        t.action.toLowerCase().includes('attack')
      );
      if (attackTouch) {
        attackingPlayer = attackTouch.player;
        attackingTeam = attackTouch.team;
      }
    }
    
    // Map team codes to full names
    const teamNames: Record<string, string> = {
      'aluron': 'Aluron CMC Warta Zawiercie',
      'bogdanka': 'BOGDANKA LUK Lublin'
    };
    
    const playerTeamName = teamNames[playerTeam] || rally.team_scored;
    const attackingTeamName = attackingTeam ? teamNames[attackingTeam] : '';

    // Determine if hot situation (score >= 20:20)
    const isHotSituation = rally.score_after.aluron >= 20 && rally.score_after.bogdanka >= 20;
    const isEarlySet = rally.rally_number <= 10;
    
    // NEW: Detect player milestones
    const currentPlayerStats = playerStats[scoringPlayer] || { blocks: 0, aces: 0, attacks: 0, errors: 0, points: 0 };
    let milestone = '';
    
    const actionLower = scoringAction.toLowerCase();
    if (actionLower.includes('block') && currentPlayerStats.blocks >= 5) {
      milestone = `${currentPlayerStats.blocks}. blok w secie`;
    } else if (actionLower.includes('ace') && currentPlayerStats.aces >= 3) {
      milestone = `${currentPlayerStats.aces}. as serwisowy w secie`;
    } else if (currentPlayerStats.points >= 10) {
      milestone = `${currentPlayerStats.points}. punkt w secie`;
    }
    
    // NEW: Detect scoring streaks (momentum)
    let currentStreak = 0;
    let streakTeam = '';
    
    if (recentRallies.length >= 5) {
      // Check last 5 rallies for same team scoring
      const lastFive = recentRallies.slice(-5);
      const lastTeam = lastFive[lastFive.length - 1]?.team_scored;
      
      let streak = 0;
      for (let i = lastFive.length - 1; i >= 0; i--) {
        if (lastFive[i].team_scored === lastTeam) {
          streak++;
        } else {
          break;
        }
      }
      
      if (streak >= 5) {
        currentStreak = streak;
        streakTeam = lastTeam;
      }
    }
    
    // Detect big lead (10+ point difference)
    const scoreDiff = Math.abs(rally.score_after.aluron - rally.score_after.bogdanka);
    const isBigLead = scoreDiff >= 10;
    const leadingTeam = rally.score_after.aluron > rally.score_after.bogdanka 
      ? 'Aluron CMC Warta Zawiercie' 
      : 'BOGDANKA LUK Lublin';
    const trailingTeam = rally.score_after.aluron < rally.score_after.bogdanka 
      ? 'Aluron CMC Warta Zawiercie' 
      : 'BOGDANKA LUK Lublin';

    console.log('🎯 Commentary request:', {
      rally_number: rally.rally_number,
      player: scoringPlayer,
      action: scoringAction,
      player_team_code: playerTeam,
      player_team_name: playerTeamName,
      team_scored: rally.team_scored,
      is_hot: isHotSituation,
      is_early: isEarlySet,
      score_diff: scoreDiff,
      is_big_lead: isBigLead,
      milestone: milestone || 'none',
      streak: currentStreak > 0 ? `${streakTeam} ${currentStreak} points` : 'none',
    });

    // KROK 1: Query RAG dla zawodnika
    const searchQuery = `${scoringPlayer} ${scoringAction} characteristics playing style`;
    console.log('🔍 RAG query:', searchQuery);

    // Generate embedding for search
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: searchQuery,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search Pinecone
    const searchResults = await index.namespace('default').query({
      vector: queryEmbedding,
      topK: 3,
      includeMetadata: true,
    });

    console.log('📊 RAG results:', searchResults.matches.length, 'matches');

    // KROK 2: Extract context from RAG
    let playerContext = '';
    if (searchResults.matches.length > 0) {
      playerContext = searchResults.matches
        .map((match) => match.metadata?.text || '')
        .join('\n\n');
      console.log('✅ Player context found:', playerContext.substring(0, 200) + '...');
    } else {
      console.log('⚠️ No RAG context found for player');
    }

    // KROK 3: Generate commentary prompt
    const score = `${rally.score_after.aluron}:${rally.score_after.bogdanka}`;
    
    // Determine who is leading
    const aluronLeading = rally.score_after.aluron > rally.score_after.bogdanka;
    const bogdankaLeading = rally.score_after.bogdanka > rally.score_after.aluron;
    const leadingTeamName = aluronLeading ? 'Aluron CMC Warta Zawiercie' : bogdankaLeading ? 'BOGDANKA LUK Lublin' : 'remis';
    
    let situationContext = '';
    if (currentStreak >= 5) {
      situationContext += `\nMOMENTUM: ${streakTeam} ma serię ${currentStreak} punktów pod rząd!`;
    }
    if (milestone) {
      situationContext += `\nMILESTONE: To jest ${milestone} dla ${scoringPlayer}! WSPOMNIEJ O TYM!`;
    }
    if (isBigLead) {
      situationContext += `\nSYTUACJA: Duża przewaga ${scoreDiff} punktów! ${leadingTeamName} prowadzi ${score}.`;
    }
    
    // Add block error context with attacker info
    let errorContext = '';
    if (attackingPlayer) {
      errorContext = `\nBLOK ERROR - WAŻNE: ${attackingPlayer} (${attackingTeamName}) PRZEBIŁ BLOK ${scoringPlayer}!
Skomentuj ATAK ${attackingPlayer}, nie błąd blokującego!
Przykład: "${attackingPlayer} przebija blok ${scoringPlayer}! Potężny atak!"`;
    } else if (scoringAction.toLowerCase().includes('error')) {
      errorContext = `\nUWAGA: To był BŁĄD zawodnika ${scoringPlayer}. Nie dramatyzuj - po prostu opisz błąd.`;
    }
    
    const commentaryPrompt = `
AKCJA MECZOWA:
Rally #${rally.rally_number}
Zawodnik który wykonał ostatnią akcję: ${scoringPlayer} (${playerTeamName})
Akcja: ${scoringAction}
Wynik po akcji: ${score}
Punkt zdobyła: ${rally.team_scored}
PROWADZI: ${leadingTeamName}${situationContext}${errorContext}

${playerContext ? `CHARAKTERYSTYKA ZAWODNIKA:\n${playerContext}` : ''}

INSTRUKCJE:
- ${isHotSituation ? 'KOŃCÓWKA SETA - emocje!' : currentStreak >= 5 ? 'SERIA - podkreśl momentum!' : milestone ? 'MILESTONE - wspomniej liczbę punktów/bloków/asów!' : isBigLead ? 'Duża przewaga - zauważ sytuację' : isEarlySet ? 'Początek - spokojnie' : 'Środek seta - rzeczowo'}
- ${attackingPlayer ? `To ATAK ${attackingPlayer} - pochwał ATAKUJĄCEGO, nie błąd bloku!` : ''}
- ${milestone ? `WAŻNE: Wspomniej że to ${milestone}!` : ''}
- Wynik ${score} - prowadzi ${leadingTeamName}
- NIE mów "prowadząc" jeśli drużyna już prowadziła - powiedz "zwiększa/zmniejsza przewagę"
- 1-2 zdania max, konkretnie i energicznie!
`;

    console.log('🎤 Generating commentary...');

    // KROK 4: Stream commentary from GPT-4o-mini with dynamic system prompt
    const systemPrompt = getCommentarySystemPrompt(
      isHotSituation, 
      isEarlySet, 
      isBigLead, 
      currentStreak >= 5,
      milestone !== '',
      language
    );
    
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: commentaryPrompt },
      ],
      temperature: isHotSituation ? 0.9 : currentStreak >= 5 ? 0.85 : isBigLead ? 0.8 : 0.7,
      max_tokens: 150,
      stream: true,
    });

    // Create streaming response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          console.error('❌ Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('❌ Commentary API error:', error);
    return new Response('Error generating commentary', { status: 500 });
  }
}