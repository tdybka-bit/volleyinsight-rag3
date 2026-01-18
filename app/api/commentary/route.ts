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

// ============================================================================
// POLISH NAME DECLENSIONS
// ============================================================================
const polishNameDeclensions: Record<string, Record<string, string>> = {
  'Leon': { 
    nominative: 'Leon',
    genitive: 'Leona',
    accusative: 'Leona'
  },
  'Boladz': {
    nominative: 'Boladz',
    genitive: 'Boladza', 
    accusative: 'Boladza'
  },
  'Grozdanov': {
    nominative: 'Grozdanov',
    genitive: 'Grozdanova',
    accusative: 'Grozdanova'
  },
  'Russell': {
    nominative: 'Russell',
    genitive: 'Russella',
    accusative: 'Russella'
  },
  'Bieniek': {
    nominative: 'Bieniek',
    genitive: 'Bienka',
    accusative: 'Bienka'
  },
  'Kwolek': {
    nominative: 'Kwolek',
    genitive: 'Kwolka',
    accusative: 'Kwolka'
  },
  'McCarthy': {
    nominative: 'McCarthy',
    genitive: "McCarthy'ego",
    accusative: "McCarthy'ego"
  },
  'Tavares': {
    nominative: 'Tavares',
    genitive: 'Tavareza',
    accusative: 'Tavareza'
  },
  'Henno': {
    nominative: 'Henno',
    genitive: 'Henno',
    accusative: 'Henno'
  },
  'Sasak': {
    nominative: 'Sasak',
    genitive: 'Sasaka',
    accusative: 'Sasaka'
  },
  'Komenda': {
    nominative: 'Komenda',
    genitive: 'Komendy',
    accusative: 'Komendę'
  },
  'Prokopczuk': {
    nominative: 'Prokopczuk',
    genitive: 'Prokopczuka',
    accusative: 'Prokopczuka'
  },
  'Zniszczol': {
    nominative: 'Zniszczoł',
    genitive: 'Zniszczoła',
    accusative: 'Zniszczoła'
  },
  'Hoss': {
    nominative: 'Hoss',
    genitive: 'Hossa',
    accusative: 'Hossa'
  },
  'Popiwczak': {
    nominative: 'Popiwczak',
    genitive: 'Popiwczaka',
    accusative: 'Popiwczaka'
  },
};

function declinePolishName(name: string, caseType: 'nominative' | 'genitive' | 'accusative'): string {
  if (!polishNameDeclensions[name]) {
    return name;
  }
  return polishNameDeclensions[name][caseType];
}

// ============================================================================
// SCORE VALIDATION & SET END DETECTION
// ============================================================================

function validateAndFixScore(
  scoreBefore: { aluron: number; bogdanka: number },
  scoreAfter: { aluron: number; bogdanka: number },
  teamScored: string,
  rallyNumber: number
): { aluron: number; bogdanka: number; wasFixed: boolean } {
  const totalBefore = scoreBefore.aluron + scoreBefore.bogdanka;
  const totalAfter = scoreAfter.aluron + scoreAfter.bogdanka;
  
  if (totalAfter !== totalBefore + 1) {
    console.error(`❌ Rally #${rallyNumber} Score inconsistency!`, { 
      scoreBefore, 
      scoreAfter, 
      teamScored,
      totalBefore,
      totalAfter,
      diff: totalAfter - totalBefore
    });
    
    const fixed = { ...scoreBefore };
    if (teamScored.toLowerCase().includes('aluron')) {
      fixed.aluron += 1;
    } else {
      fixed.bogdanka += 1;
    }
    
    console.log(`✅ Rally #${rallyNumber} Fixed score:`, fixed);
    return { ...fixed, wasFixed: true };
  }
  
  return { ...scoreAfter, wasFixed: false };
}

function checkSetEnd(
  score: { aluron: number; bogdanka: number },
  setNumber: number = 1
): {
  isSetEnd: boolean;
  winner: string;
  finalScore: string;
  isTieBreak: boolean;
} {
  const aluron = score.aluron;
  const bogdanka = score.bogdanka;
  const isTieBreak = setNumber === 5;
  const targetScore = isTieBreak ? 15 : 25;
  
  const hasTargetScore = aluron >= targetScore || bogdanka >= targetScore;
  const hasTwoPointLead = Math.abs(aluron - bogdanka) >= 2;
  const isSetEnd = hasTargetScore && hasTwoPointLead;
  
  if (isSetEnd) {
    const winner = aluron > bogdanka ? 'Aluron CMC Warta Zawiercie' : 'BOGDANKA LUK Lublin';
    const finalScore = `${aluron}:${bogdanka}`;
    
    console.log(`🏁 SET END DETECTED! Winner: ${winner}, Score: ${finalScore}`);
    
    return {
      isSetEnd: true,
      winner,
      finalScore,
      isTieBreak
    };
  }
  
  return { 
    isSetEnd: false, 
    winner: '', 
    finalScore: '',
    isTieBreak
  };
}

// ============================================================================
// MULTI-LANGUAGE SYSTEM PROMPTS
// ============================================================================

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

const getCommentarySystemPrompt = (
  isSetEnd: boolean,
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
- Use proper Polish grammar and declensions for names

VOCABULARY IMPROVEMENTS:
- NEVER say "chaos w przyjęciu" → use "niedokładne przyjęcie", "przyjęcie daleko od siatki", "bardzo trudne przyjęcie"
- NEVER say "błąd blokowy" → use "błąd w bloku"
- For block errors: praise the ATTACKER who broke through, not the blocker's mistake
  Example: "Leon przebija blok Kwolka! Potężny atak!"

SCORE ACCURACY:
- When team ALREADY LEADS, say "zwiększa przewagę" NOT "prowadzi"
- When trailing team scores, say "zmniejsza stratę" or "zmniejsza przewagę przeciwnika"
- Be PRECISE about score changes

AVOID PHRASES:
- "kluczowy moment" (unless 20+ points or tie-break)
- "wpłynąć na morale" (never use)
- "presja ze strony przeciwnika" (never for serves)
- "błąd blokowy" (say "błąd w bloku")
- "chaos w przyjęciu" (use better vocabulary)
- Any dramatic language before 15 points`;

  if (isSetEnd) {
    return basePrompt + `

🏁 SET END! This is the FINAL POINT of the set!

MANDATORY ELEMENTS:
1. Describe the winning action
2. Announce the FINAL SCORE explicitly
3. Say "KONIEC SETA!" or "SET dla [team]!"
4. Mention if it was close/dramatic ending

EXAMPLES (Polish):
- "Leon kończy set potężnym atakiem! KONIEC SETA 30:28 dla Bogdanki! Dramatyczna końcówka z prolongatą!"
- "As serwisowy McCarthy! KONIEC SETA 25:22! Aluron wygrywa pewnie drugiego seta!"
- "Blok Grozdanova! SET dla Bogdanki 25:23! Zacięta walka, ale gospodarze zdobywają seta!"

ALWAYS mention it's the END OF SET!`;
  }

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
- "Grozdanov skuteczny w bloku. Dobry początek."
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

// ============================================================================
// INTERFACES
// ============================================================================

interface RallyData {
  rally_number: number;
  set_number?: number;
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

interface RallyAnalysis {
  numTouches: number;
  passQuality: string;
  passPlayer: string;
  serverPlayer: string;
  setterPlayer: string;
  attackerPlayer: string;
  dramaScore: number;
  isLongRally: boolean;
  isDramatic: boolean;
}

interface CommentaryRequest {
  rally: RallyData;
  language?: string;
  playerStats?: Record<string, PlayerStats>;
  recentRallies?: RallyData[];
  rallyAnalysis?: RallyAnalysis;
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { rally, language = 'pl', playerStats = {}, recentRallies = [], rallyAnalysis }: CommentaryRequest = await request.json();

    if (!rally) {
      return new Response('Rally data is required', { status: 400 });
    }

    // ========================================================================
    // STEP 1: VALIDATE AND FIX SCORE
    // ========================================================================
    const validatedScore = validateAndFixScore(
      rally.score_before,
      rally.score_after,
      rally.team_scored,
      rally.rally_number
    );

    if (validatedScore.wasFixed) {
      console.log(`⚠️ Rally #${rally.rally_number}: Score was corrected!`);
    }

    const finalScore = {
      aluron: validatedScore.aluron,
      bogdanka: validatedScore.bogdanka
    };

    // ========================================================================
    // STEP 2: CHECK IF SET ENDED
    // ========================================================================
    const setNumber = rally.set_number || 1;
    const setEndInfo = checkSetEnd(finalScore, setNumber);

    // ========================================================================
    // STEP 3: EXTRACT FINAL ACTION INFO
    // ========================================================================
    const finalTouch = rally.touches[rally.touches.length - 1];
    let scoringPlayer = finalTouch.player;
    let scoringAction = finalTouch.action;
    let playerTeam = finalTouch.team;
    
    let attackingPlayer = '';
    let attackingTeam = '';
    if (finalTouch.action.toLowerCase().includes('block') && finalTouch.action.toLowerCase().includes('error')) {
      const attackTouch = rally.touches.find(t => 
        t.team !== finalTouch.team && 
        t.action.toLowerCase().includes('attack')
      );
      if (attackTouch) {
        attackingPlayer = attackTouch.player;
        attackingTeam = attackTouch.team;
      }
    }
    
    const teamNames: Record<string, string> = {
      'aluron': 'Aluron CMC Warta Zawiercie',
      'bogdanka': 'BOGDANKA LUK Lublin'
    };
    
    const playerTeamName = teamNames[playerTeam] || rally.team_scored;
    const attackingTeamName = attackingTeam ? teamNames[attackingTeam] : '';

    // ========================================================================
    // STEP 4: SITUATION ANALYSIS
    // ========================================================================
    
    const isHotSituation = finalScore.aluron >= 20 && finalScore.bogdanka >= 20 && !setEndInfo.isSetEnd;
    const isEarlySet = rally.rally_number <= 10;
    
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
    
    let currentStreak = 0;
    let streakTeam = '';
    
    if (recentRallies.length >= 5) {
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
    
    const scoreDiff = Math.abs(finalScore.aluron - finalScore.bogdanka);
    const isBigLead = scoreDiff >= 10;
    const isFirstPoint = (finalScore.aluron === 1 && finalScore.bogdanka === 0) || 
                         (finalScore.aluron === 0 && finalScore.bogdanka === 1);
    const leadingTeam = finalScore.aluron > finalScore.bogdanka 
      ? 'Aluron CMC Warta Zawiercie' 
      : 'BOGDANKA LUK Lublin';
    const trailingTeam = finalScore.aluron < finalScore.bogdanka 
      ? 'Aluron CMC Warta Zawiercie' 
      : 'BOGDANKA LUK Lublin';

    console.log('🎯 Commentary request:', {
      rally_number: rally.rally_number,
      player: scoringPlayer,
      action: scoringAction,
      validated_score: `${finalScore.aluron}:${finalScore.bogdanka}`,
      is_set_end: setEndInfo.isSetEnd,
      set_winner: setEndInfo.winner,
      is_hot: isHotSituation,
      is_early: isEarlySet,
      score_diff: scoreDiff,
      is_big_lead: isBigLead,
      milestone: milestone || 'none',
      streak: currentStreak > 0 ? `${streakTeam} ${currentStreak} points` : 'none',
    });

    // ========================================================================
    // STEP 5: RAG QUERY - TACTICS NAMESPACE
    // ========================================================================
    
    const actionType = scoringAction.toLowerCase();
    let tacticsQuery = '';
    
    if (actionType.includes('block')) {
      tacticsQuery = 'block blok technique tactics timing';
    } else if (actionType.includes('attack') || actionType.includes('kill')) {
      tacticsQuery = 'attack atak spike technique';
    } else if (actionType.includes('ace') || actionType.includes('serve')) {
      tacticsQuery = 'serve zagrywka service technique';
    } else if (actionType.includes('dig') || actionType.includes('defense')) {
      tacticsQuery = 'defense obrona dig technique';
    }

    let tacticsContext = '';
    if (tacticsQuery) {
      console.log('🎯 Tactics query:', tacticsQuery);
      
      try {
        const tacticsEmbedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: tacticsQuery,
          dimensions: 768,
        });
        
        const tacticsResults = await index.namespace('tactics').query({
          vector: tacticsEmbedding.data[0].embedding,
          topK: 2,
          includeMetadata: true,
        });
        
        if (tacticsResults.matches && tacticsResults.matches.length > 0) {
          tacticsContext = tacticsResults.matches
            .map((match) => match.metadata?.text || '')
            .join('\n\n')
            .substring(0, 400);
          console.log('✅ Tactics context:', tacticsContext.substring(0, 80) + '...');
        }
      } catch (error) {
        console.error('❌ Tactics error:', error);
      }
    }

    // ========================================================================
    // STEP 5.5: RAG QUERY - COMMENTARY EXAMPLES
    // ========================================================================

    let commentaryExamplesContext = '';
    const commentaryQuery = `${scoringAction} better commentary example ${scoringPlayer}`;

    try {
      console.log('💬 Commentary examples query:', commentaryQuery);
      
      const examplesEmbedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: commentaryQuery,
        dimensions: 768,
      });
      
      const examplesResults = await index.namespace('commentary-examples').query({
        vector: examplesEmbedding.data[0].embedding,
        topK: 2,
        includeMetadata: true,
      });
      
      if (examplesResults.matches && examplesResults.matches.length > 0) {
        commentaryExamplesContext = examplesResults.matches
          .map((match) => match.metadata?.betterCommentary || '')
          .filter(Boolean)
          .join('\n')
          .substring(0, 300);
        console.log('✅ Commentary examples found:', commentaryExamplesContext.substring(0, 80) + '...');
      }
    } catch (error) {
      console.error('❌ Commentary examples error:', error);
    }

    // ========================================================================
    // STEP 5.7: RAG QUERY - COMMENTARY HINTS (USER CORRECTIONS) ⭐ NEW!
    // ========================================================================

    let commentaryHintsContext = '';
    const hintsQuery = `${scoringPlayer} ${scoringAction} correction hint better name`;

    try {
      console.log('💡 Commentary hints query:', hintsQuery);
      
      const hintsEmbedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: hintsQuery,
        dimensions: 768,
      });
      
      const hintsResults = await index.namespace('commentary-hints').query({
        vector: hintsEmbedding.data[0].embedding,
        topK: 3,
        includeMetadata: true,
      });
      
      if (hintsResults.matches && hintsResults.matches.length > 0) {
        commentaryHintsContext = hintsResults.matches
          .map((match) => match.metadata?.betterCommentary || '')
          .filter(Boolean)
          .join('\n')
          .substring(0, 400);
        console.log('✅ Commentary hints found:', commentaryHintsContext.substring(0, 80) + '...');
      } else {
        console.log('ℹ️ No commentary hints found for this query');
      }
    } catch (error) {
      console.error('❌ Commentary hints error:', error);
    }

    // ========================================================================
    // STEP 6: RAG QUERY - PLAYER INFO
    // ========================================================================
    
    const searchQuery = `${scoringPlayer} ${scoringAction} characteristics playing style`;
    console.log('🔍 RAG query:', searchQuery);

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: searchQuery,
      dimensions: 768,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    const searchResults = await index.namespace('default').query({
      vector: queryEmbedding,
      topK: 3,
      includeMetadata: true,
    });

    console.log('📊 RAG results:', searchResults.matches.length, 'matches');

    let playerContext = '';
    if (searchResults.matches.length > 0) {
      playerContext = searchResults.matches
        .map((match) => match.metadata?.text || '')
        .join('\n\n');
      console.log('✅ Player context found:', playerContext.substring(0, 200) + '...');
    } else {
      console.log('⚠️ No RAG context found for player');
    }

    // ========================================================================
    // STEP 7: BUILD COMMENTARY PROMPT
    // ========================================================================
    
    const score = `${finalScore.aluron}:${finalScore.bogdanka}`;
    
    const aluronLeading = finalScore.aluron > finalScore.bogdanka;
    const bogdankaLeading = finalScore.bogdanka > finalScore.aluron;
    const leadingTeamName = aluronLeading ? 'Aluron CMC Warta Zawiercie' : bogdankaLeading ? 'BOGDANKA LUK Lublin' : 'remis';
    
    let touchContext = '';
    if (rallyAnalysis) {
      const passQualityDescriptions: Record<string, string> = {
        'perfect': 'perfekcyjne przyjęcie ✅',
        'good': 'dobre przyjęcie',
        'average': 'niedokładne przyjęcie ⚠️',
        'negative': 'przyjęcie daleko od siatki ⚠️⚠️',
        'error': 'błąd w przyjęciu ❌ ACE!'
      };
      
      const passDesc = passQualityDescriptions[rallyAnalysis.passQuality] || rallyAnalysis.passQuality;
      
      touchContext = `
RALLY COMPLEXITY:
- Touches: ${rallyAnalysis.numTouches} ${rallyAnalysis.isLongRally ? '(DŁUGA WYMIANA!)' : ''}
- Drama score: ${rallyAnalysis.dramaScore.toFixed(1)}/5.0 ${rallyAnalysis.isDramatic ? '⚡ DRAMATIC!' : ''}
- Pass quality: ${passDesc}

KEY PLAYERS IN CHAIN:
${rallyAnalysis.serverPlayer ? `- Serve: ${rallyAnalysis.serverPlayer}` : ''}
${rallyAnalysis.passPlayer ? `- Pass: ${rallyAnalysis.passPlayer} (${passDesc})` : ''}
${rallyAnalysis.setterPlayer ? `- Set: ${rallyAnalysis.setterPlayer}` : ''}
${rallyAnalysis.attackerPlayer ? `- Attack: ${rallyAnalysis.attackerPlayer}` : ''}`;
    }
    
    let situationContext = '';
    if (setEndInfo.isSetEnd) {
      situationContext += `\n🏁 KONIEC SETA! To był OSTATNI PUNKT! Wynik końcowy: ${score}. Zwycięzca: ${setEndInfo.winner}. MUSISZ POWIEDZIEĆ ŻE SET SIĘ SKOŃCZYŁ!`;
    }
    if (currentStreak >= 5) {
      situationContext += `\nMOMENTUM: ${streakTeam} ma serię ${currentStreak} punktów pod rząd!`;
    }
    if (milestone) {
      situationContext += `\nMILESTONE: To jest ${milestone} dla ${scoringPlayer}! WSPOMNIEJ O TYM!`;
    }
    if (isBigLead && !setEndInfo.isSetEnd) {
      situationContext += `\nSYTUACJA: Duża przewaga ${scoreDiff} punktów! ${leadingTeamName} prowadzi ${score}.`;
    }
    
    let errorContext = '';
    if (attackingPlayer) {
      const attackerDeclined = declinePolishName(attackingPlayer, 'nominative');
      const blockerDeclined = declinePolishName(scoringPlayer, 'genitive');
      
      errorContext = `\nBLOK ERROR - WAŻNE: ${attackerDeclined} (${attackingTeamName}) PRZEBIŁ BLOK ${blockerDeclined}!
Skomentuj ATAK ${attackerDeclined}, nie błąd blokującego!
Przykład: "${attackerDeclined} przebija blok ${blockerDeclined}! Potężny atak!"`;
    } else if (scoringAction.toLowerCase().includes('error')) {
      errorContext = `\nUWAGA: To był BŁĄD zawodnika ${scoringPlayer}. Nie dramatyzuj - po prostu opisz błąd.`;
    }
    
    let passInstructions = '';
    if (rallyAnalysis) {
      if (rallyAnalysis.passQuality === 'perfect') {
        passInstructions = '\n- Przyjęcie było PERFEKCYJNE - wspomniej o łatwości wykonania akcji!';
      } else if (rallyAnalysis.passQuality === 'negative') {
        passInstructions = '\n- Przyjęcie DALEKO OD SIATKI lub BARDZO TRUDNE - podkreśl trudność i walkę zespołu! NIE mów "chaos"!';
      } else if (rallyAnalysis.passQuality === 'average') {
        passInstructions = '\n- Przyjęcie było NIEDOKŁADNE - trochę trudności w akcji!';
      }
      
      if (rallyAnalysis.isLongRally) {
        passInstructions += `\n- To była DŁUGA wymiana (${rallyAnalysis.numTouches} dotknięć) - podkreśl wysiłek i dramatyzm!`;
      }
    }
    
    const commentaryPrompt = `
AKCJA MECZOWA:
Rally #${rally.rally_number}
Zawodnik który wykonał ostatnią akcję: ${scoringPlayer} (${playerTeamName})
Akcja: ${scoringAction}
Wynik po akcji: ${score}
Punkt zdobyła: ${rally.team_scored}
PROWADZI: ${leadingTeamName}${touchContext}${situationContext}${errorContext}

${tacticsContext ? `WIEDZA TAKTYCZNA O AKCJI:\n${tacticsContext}\n\n` : ''}${commentaryExamplesContext ? `PRZYKŁADY DOBRYCH KOMENTARZY:\n${commentaryExamplesContext}\n\n` : ''}${commentaryHintsContext ? `⭐ USER CORRECTIONS & HINTS (PRIORITY!):\n${commentaryHintsContext}\n\n` : ''}${playerContext ? `CHARAKTERYSTYKA ZAWODNIKA:\n${playerContext}` : ''}

INSTRUKCJE:
- ${setEndInfo.isSetEnd ? `🏁 TO JEST KONIEC SETA! MUSISZ TO POWIEDZIEĆ! Wynik końcowy: ${score}. Zwycięzca: ${setEndInfo.winner}.` : isFirstPoint ? '⭐ PIERWSZY PUNKT! Użyj: "Dobry początek [team]", "Udany start", "Pierwszy punkt na koncie [team]"' : isHotSituation ? 'KOŃCÓWKA SETA - emocje!' : currentStreak >= 5 ? 'SERIA - podkreśl momentum!' : milestone ? 'MILESTONE - wspomniej liczbę punktów/bloków/asów!' : isBigLead ? 'Duża przewaga - zauważ sytuację' : isEarlySet ? 'Początek - spokojnie' : 'Środek seta - rzeczowo'}
- ${attackingPlayer ? `To ATAK ${attackingPlayer} - pochwał ATAKUJĄCEGO, nie błąd bloku! Użyj formy: "${attackingPlayer} przebija blok ${declinePolishName(scoringPlayer, 'genitive')}!"` : ''}
- ${milestone ? `WAŻNE: Wspomniej że to ${milestone}!` : ''}${passInstructions}
- ${commentaryHintsContext ? '⭐ APPLY USER HINTS - they have PRIORITY over other context!' : ''}
- Wynik ${score} - prowadzi ${leadingTeamName}
- ${isFirstPoint ? 'NIE używaj "zwiększa/zmniejsza przewagę" - to PIERWSZY punkt!' : 'NIE mów "prowadząc" jeśli drużyna już prowadziła - powiedz "zwiększa/zmniejsza przewagę"'}
- Używaj POPRAWNEJ odmiany nazwisk (Leon → Leona w dopełniaczu)
- 1-2 zdania max, konkretnie i energicznie!
`;

    console.log('🎤 Generating commentary...');

    // ========================================================================
    // STEP 8: GENERATE COMMENTARY (NON-STREAMING)
    // ========================================================================
    
    const systemPrompt = getCommentarySystemPrompt(
      setEndInfo.isSetEnd,
      isHotSituation, 
      isEarlySet, 
      isBigLead, 
      currentStreak >= 5,
      milestone !== '',
      language
    );
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: commentaryPrompt },
      ],
      temperature: setEndInfo.isSetEnd ? 0.95 : isHotSituation ? 0.9 : currentStreak >= 5 ? 0.85 : isBigLead ? 0.8 : 0.7,
      max_tokens: 150,
    });

    const commentary = completion.choices[0].message.content || '';

    // ========================================================================
    // STEP 9: GENERATE TAGS, MILESTONES, ICONS, SCORES
    // ========================================================================
    
    // Determine icon based on action
    let icon = '⚡'; // default
    const actionTypeLower = scoringAction.toLowerCase();

    if (setEndInfo.isSetEnd) {
      icon = '🏁';
    } else if (actionTypeLower.includes('ace')) {
      icon = '🎯';
    } else if (actionTypeLower.includes('block') && !actionTypeLower.includes('error')) {
      icon = '🛡️';
    } else if (actionTypeLower.includes('block') && actionTypeLower.includes('error')) {
      icon = '🔓'; // Broken block
    } else if (actionTypeLower.includes('attack') || actionTypeLower.includes('kill')) {
      icon = '⚡';
    } else if (actionTypeLower.includes('serve') && actionTypeLower.includes('error')) {
      icon = '⚠️';
    } else if (actionTypeLower.includes('dig') && actionTypeLower.includes('error')) {
      icon = '🔄';
    } else if (actionTypeLower.includes('pass') && actionTypeLower.includes('error')) {
      icon = '⚠️';
    } else if (actionTypeLower.includes('error')) {
      icon = '❌';
    } else if (rallyAnalysis?.passQuality === 'perfect') {
      icon = '💪';
    }

    // Generate tags
    const tags: string[] = [];

    if (setEndInfo.isSetEnd) {
      tags.push('#koniec_seta');
    }
    if (currentStreak >= 5) {
      tags.push('#momentum');
      tags.push('#seria');
    }
    if (rallyAnalysis?.isDramatic) {
      tags.push('#drama');
    }
    if (isHotSituation) {
      tags.push('#clutch');
    }
    if (rallyAnalysis?.isLongRally) {
      tags.push('#długa_wymiana');
    }
    if (milestone) {
      tags.push('#milestone');
    }
    if (actionTypeLower.includes('ace')) {
      tags.push('#as');
    }
    if (scoreDiff >= 5 && rally.team_scored === trailingTeam) {
      tags.push('#comeback');
    }

    // Generate milestone messages
    const milestones: string[] = [];
    if (milestone) {
      milestones.push(`${scoringPlayer}: ${milestone}`);
    }

    // Momentum and drama scores
    const momentumScore = currentStreak >= 5 ? Math.min(currentStreak * 1.5, 10) : 0;
    const dramaScore = rallyAnalysis?.dramaScore || 0;

    console.log('🏷️ Tags:', tags);
    console.log('🎯 Milestones:', milestones);
    console.log('📊 Scores:', { momentum: momentumScore, drama: dramaScore });
    console.log('🎨 Icon:', icon);

    // ========================================================================
    // STEP 10: RETURN JSON RESPONSE
    // ========================================================================

    return new Response(JSON.stringify({
      commentary,
      tags,
      milestones,
      icon,
      momentumScore,
      dramaScore,
    }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('❌ Commentary API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Error generating commentary',
      commentary: '',
      tags: [],
      milestones: [],
      icon: '❌',
      momentumScore: 0,
      dramaScore: 0,
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
