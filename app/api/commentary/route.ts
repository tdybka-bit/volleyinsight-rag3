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
// SCORE VALIDATION & SET END DETECTION
// ============================================================================

function validateAndFixScore(
 scoreBefore: { home: number; away: number },
 scoreAfter: { home: number; away: number },
 teamScored: string,
 rallyNumber: number
): { home: number; away: number; wasFixed: boolean } {
 const totalBefore = scoreBefore.home + scoreBefore.away;
 const totalAfter = scoreAfter.home + scoreAfter.away;

 if (totalAfter !== totalBefore + 1) {
 console.error(`Rally #${rallyNumber} Score inconsistency!`, { 
 scoreBefore, 
 scoreAfter, 
 teamScored,
 totalBefore,
 totalAfter,
 diff: totalAfter - totalBefore
 });
 
 const fixed = { ...scoreBefore };
 if (teamScored === 'home') {
 fixed.home += 1;
 } else {
 fixed.away += 1;
 }
 
 console.log(`Rally #${rallyNumber} Fixed score:`, fixed);
 return { ...fixed, wasFixed: true };
 }
 
 return { ...scoreAfter, wasFixed: false };
}

function checkSetEnd(
 score: { home: number; away: number },
 setNumber: number = 1,
 homeTeamName: string = 'Gospodarze',
 awayTeamName: string = 'Goscie'
): {
 isSetEnd: boolean;
 winner: string;
 finalScore: string;
 isTieBreak: boolean;
} {
 const home = score.home;
 const away = score.away;
 const isTieBreak = setNumber === 5;
 const targetScore = isTieBreak ? 15 : 25;
 
 const hasTargetScore = home >= targetScore || away >= targetScore;
 const hasTwoPointLead = Math.abs(home - away) >= 2;
 const isSetEnd = hasTargetScore && hasTwoPointLead;
 
 if (isSetEnd) {
 const winner = home > away ? homeTeamName : awayTeamName;
 const finalScore = `${home}:${away}`;
 
 console.log(`SET END DETECTED! Winner: ${winner}, Score: ${finalScore}`);
 
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
 pl: 'Jestes doswiadczonym komentarorem meczow siatkarskich w Polsce. Komentuj po POLSKU.',
 en: 'You are an experienced volleyball commentator. Comment in ENGLISH.',
 it: 'Sei un commentatore esperto di pallavolo. Commenta in ITALIANO.',
 de: 'Du bist ein erfahrener Volleyball-Kommentator. Kommentiere auf DEUTSCH.',
 tr: 'Deneyimli bir voleybol spikerisin. TURKCE yorum yap.',
 es: 'Eres un comentarista experimentado de voleibol. Comenta en ESPANOL.',
 pt: 'Voce um comentarista experiente de volei. Comente em PORTUGUES.',
 jp: 'Experienced volleyball commentator. Comment in JAPANESE.',
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
Your task is to generate professional, factual volleyball match commentary in RADIO STYLE.

RADIO STYLE MEANS:
- You receive a PRZEBIEG AKCJI (touch chain) - describe EXACTLY what happened step by step
- Follow the EXACT order of touches. Do NOT rearrange, skip, or invent actions.
- If the data says "zagrywka" (without "BLAD"), the serve was GOOD - do NOT say it was an error!
- If data says "blok PRZEBITY", the BLOCKER lost - the attacker beat them. Do NOT say the blocker broke through.
- The LAST touch in the chain determines the point. Do NOT add extra actions after it.
- Short rallies (2-3 touches) = 1-2 sentences. Longer rallies (5+) = 2-3 sentences.

CRITICAL RULES:
- Be FACTUAL - describe ONLY what is in the touch chain data
- NEVER exaggerate situation importance (3:2 is NOT critical!)
- NEVER mention "morale" or "pressure" in early set
- Focus on WHAT HAPPENED, not speculation
- NEVER use quotation marks (" ") around commentary - write directly
- NEVER invent or add first names - use only surnames provided in data
- Use proper Polish grammar and declensions for names

VOCABULARY IMPROVEMENTS:
- NEVER say "chaos w przyjeciu" use "niedokladne przyjecie", "przyjecie daleko od siatki", "bardzo trudne przyjecie"
- NEVER say "blad blokowy" -> use "blad w bloku"
- For block errors: praise the ATTACKER who broke through, not the blocker's mistake
 Example: "Leon przebija blok Kwolka! Potezny atak!"

SCORE ACCURACY:
- ALWAYS use the SYTUACJA PUNKTOWA from the prompt - it tells you EXACTLY what happened (wyrownanie, objecie prowadzenia, zwiekszenie przewagi etc.)
- NEVER invent your own interpretation of the score
- NEVER say "zwieksza przewage" when score is tied (that's WYROWNANIE!)
- Be PRECISE about score changes

ANTI-REDUNDANCY:
- NEVER repeat what is obvious from the action itself
- Serve error = just say "blad serwisowy [player]" — do NOT add "pilka w aut", "koniec akcji", "punkt dla rywali" etc.
- Attack error = just say "blad w ataku" — do NOT explain what error means
- Block point = just describe the block — do NOT say "koniec akcji"
- NIGDY nie podawaj dokladnego wyniku liczbowego (np. "2:1", "15:12") w komentarzu! Wynik jest wyswietlany w interfejsie. JEDYNY WYJATEK: koniec seta — wtedy PODAJ wynik koncowy.
- NIGDY nie mow "Wynik X:Y" ani "prowadzi X:Y" — zamiast tego uzywaj ogolnych zwrotow jak "prowadza", "wyrownuja", "odskoczyly"
- ONE sentence per simple rally (serve error, single attack). Max 2-3 for long rallies.

AVOID PHRASES:
- "kluczowy moment" (unless 20+ points or tie-break)
- "wplynac na morale" (never use)
- "presja ze strony przeciwnika" (never for serves)
- "blad blokowy" (say "blad w bloku")
- "chaos w przyjeciu" (use better vocabulary)
- Any dramatic language before 15 points

RAG KNOWLEDGE USAGE:
- If NAMING RULES are provided above a+' FOLLOW THEM EXACTLY for declensions
- If TACTICAL KNOWLEDGE is provided a+' use it to enrich commentary
- If COMMENTARY EXAMPLES are provided a+' match their style and energy
- If TONE GUIDANCE is provided a+' adjust your tone accordingly
- RAG knowledge has PRIORITY over these general rules`;

 if (isSetEnd) {
 return basePrompt + `

SET END! This is the FINAL POINT of the set!

MANDATORY ELEMENTS:
1. Describe the winning action
2. Announce the FINAL SCORE explicitly
3. Say "KONIEC SETA!" or "SET dla [team]!"
4. Mention if it was close/dramatic ending

EXAMPLES (Polish):
- "Leon konczy set poteznym atakiem! KONIEC SETA 30:28 dla gospodarzy! Dramatyczna koncowka z prolongata!"
- "As serwisowy McCarthy! KONIEC SETA 25:22! Gospodarze wygrywaja pewnie drugiego seta!"
- "Blok Grozdanova! SET dla gospodarzy 25:23! Zacieta walka, ale zdobywaja seta!"

ALWAYS mention it's the END OF SET!`;
 }

 if (isHotSituation) {
 return basePrompt + `
- HOT SITUATION (20:20+)! NOW you can add emotion!

EXAMPLES (Polish):
- "W kluczowym momencie Grozdanov pokazuje klase! Blok ktory moze zadecydowac o secie!"
- "McCarthy as serwisowy w najwazniejszym momencie! Nerwy ze stali!"`;
 } else if (hasStreak) {
 return basePrompt + `
- SCORING STREAK (5+)! Emphasize the momentum!

EXAMPLES (Polish):
- "Kolejny punkt w serii! Gospodarze buduja przewage!"
- "Seria trwa! Juz piaty punkt pod rzad!"`;
 } else if (hasMilestone) {
 return basePrompt + `
- PLAYER MILESTONE! Celebrate and MENTION THE NUMBER!

EXAMPLES (Polish):
- "Po raz PIATY Grozdanov zatrzymuje rywala blokiem! Dominuje w tym elemencie!"
- "Trzeci as serwisowy McCarthy w tym secie! Rozgrzal reke!"
- "DZIESIATY punkt Sasaka! Kapitalna dyspozycja atakujacego!"
- "Kwolek juz 8. udany atak - skutecznosc imponujaca!"

ALWAYS mention the milestone number!`;
 } else if (isBigLead) {
 return basePrompt + `
- BIG LEAD (10+)! Mention the situation factually!

EXAMPLES (Polish):
- "Gospodarze prowadza 15:5. Grozdanov dolozyl kolejny punkt."
- "Punkt dla gosci, ale wciaz spory dystans - 8:18."`;
 } else if (isEarlySet) {
 return basePrompt + `
- EARLY SET (1-10 points): Keep it calm and factual!

EXAMPLES (Polish):
- "Grozdanov skuteczny w bloku. Dobry poczatek."
- "Blad serwisowy McCarthy. Punkt dla przeciwnika."
- "Sasak konczy atak. Prowadzenie dla gosci."

NO DRAMA - just describe what happened!`;
 } else {
 return basePrompt + `
- MID-SET (11-19 points): Factual but with ENERGY!

EXAMPLES (Polish):
- "Grozdanov skuteczny w bloku! Zatrzymal rywala."
- "McCarthy pewny w zagrywce. Punkt dla gospodarzy!"
- "Sasak konczy atak! Goscie zwieksza przewage."
- "Kwolek przebija blok! Swietne uderzenie!"

Factual YES, but keep VOLLEYBALL ENERGY!`;
 }
};

// ============================================================================
// INTERFACES
// ============================================================================

interface RallyData {
 rally_number: number;
 set_number?: number;
 score_before: { home: number; away: number };
 score_after: { home: number; away: number };
 team_scored: string;
 touches: Array<{
 action: string;
 player: string;
 number: string;
 team: string;
 attackCombination?: string;
 attackLocation?: string;
 attackStyle?: string;
 serveType?: string;
 zone?: string;
 fromZone?: string;
 toZone?: string;
 middleRoute?: string;
 }>;
 final_action: {
 type: string;
 player: string;
 number: string;
 };
 substitutions?: Array<{
 player_out: string;
 player_in: string;
 team: string;
 team_name?: string;
 score_diff?: string;
 score_status?: string;
 }>;
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
 homeTeamFullName?: string;
 awayTeamFullName?: string;
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
 console.log('========= ROUTE.TS v7.4 RAG-UNLEASHED LOADED =========');
 try {
 const { rally, language = 'pl', playerStats = {}, recentRallies = [], rallyAnalysis, homeTeamFullName = 'Gospodarze', awayTeamFullName = 'Goscie' }: CommentaryRequest = await request.json();

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
 console.log(`Rally #${rally.rally_number}: Score was corrected!`);
 }

 const finalScore = {
 home: validatedScore.home || 0,
 away: validatedScore.away || 0
 };

 // ========================================================================
 // STEP 2: CHECK IF SET ENDED
 // ========================================================================
 const setNumber = rally.set_number || 1;
 const setEndInfo = checkSetEnd(finalScore, setNumber, homeTeamFullName, awayTeamFullName);

 // ========================================================================
 // STEP 3: EXTRACT FINAL ACTION INFO (FIXED!)
 // ========================================================================

 // FIX: Use final_action.player instead of last touch!
 // Problem: "Blad serwisowy Tavaresa" when it was McCarthy
 // Reason: Last touch != player who made the final action

 // FIX: final_action.player is correct, but final_action.type is too short!
// Use touches[last].action which has full description: "Serve error" not "Error"

// Guard: Skip rallies without touches
if (!rally.touches || rally.touches.length === 0) {
 console.warn(`Rally #${rally.rally_number} has no touches, returning basic commentary`);
 return Response.json({
 commentary: `Rally #${rally.rally_number} played`,
 tags: [],
 milestones: [],
 icon: 'as!',
 momentumScore: 0,
 dramaScore: 0
 });
}


 // Get final action info
 const finalTouch = rally.touches[rally.touches.length - 1];
 let scoringPlayer = finalTouch?.player || '';
    
    // Display name handled by RAG naming rules
    const displayScoringPlayer = scoringPlayer;
 let scoringAction = finalTouch?.action || '';
 let playerTeam = finalTouch?.team || '';

 console.log('Final touch:', scoringPlayer, '| Action:', scoringAction, '| Team:', playerTeam, '| Rally won by:', rally.team_scored);

 // Determine who actually scored the point
 // If action is an error, the OPPOSITE team scored
 const isError = scoringAction.toLowerCase().includes('error');

 if (isError) {
 // Error means opposite team scored
 // Switch to the team that WON the rally
 const winningTeam = rally.team_scored; // 'home' or 'away'
 
 // Player who made error stays the same (for "blad serwisowy X")
 // But we note it was an error
 console.log(`Error detected! ${scoringPlayer} made error, ${winningTeam} team scored`);
 } else {
 // Normal point - player who did final action scored
 console.log(`${scoringPlayer} scored for ${playerTeam} team`);
 }
 // Special case: Block error -> praise attacker, not blocker
 let attackingPlayer = '';
 let attackingTeam = '';
 if (scoringAction.toLowerCase().includes('block') && scoringAction.toLowerCase().includes('error')) {
 // Find the attacker (from opposite team who did the attack)
 const attackTouch = rally.touches.find(t => 
 t.team !== playerTeam && 
 t.action.toLowerCase().includes('attack')
 );
 if (attackTouch) {
 attackingPlayer = attackTouch.player;
 attackingTeam = attackTouch.team;
 console.log('Block error detected! Attacker:', attackingPlayer, 'broke through blocker:', scoringPlayer);
 }
 }

 // Dynamic team names from frontend (no more hardcoded!)
 const homeTeamFull = homeTeamFullName || 'Gospodarze';
 const awayTeamFull = awayTeamFullName || 'Goscie';
 const teamByRole = (role: string) => role === 'home' ? homeTeamFull : awayTeamFull;

 const playerTeamName = playerTeam === 'home' ? homeTeamFull : playerTeam === 'away' ? awayTeamFull : playerTeam;
 const attackingTeamName = attackingTeam ? (attackingTeam === 'home' ? homeTeamFull : awayTeamFull) : '';

 // ========================================================================
 // STEP 4: SITUATION ANALYSIS
 // ========================================================================
 
 const isHotSituation = finalScore.home >= 20 && finalScore.away >= 20 && !setEndInfo.isSetEnd;
 const isEarlySet = rally.rally_number <= 10;
 
 const currentPlayerStats = playerStats[scoringPlayer] || { blocks: 0, aces: 0, attacks: 0, errors: 0, points: 0 };
 let milestone = '';
 
 const actionLower = scoringAction.toLowerCase();
 // Milestone only at SPECIFIC round numbers to avoid spam
 const blockMilestones = [3, 5, 7, 10];
 const aceMilestones = [2, 3, 5];
 const pointMilestones = [10, 15, 20, 25, 30];
 
 if (actionLower.includes('block') && blockMilestones.includes(currentPlayerStats.blocks)) {
 milestone = `${currentPlayerStats.blocks}. blok w secie`;
 } else if (actionLower.includes('ace') && aceMilestones.includes(currentPlayerStats.aces)) {
 milestone = `${currentPlayerStats.aces}. as serwisowy w secie`;
 } else if (pointMilestones.includes(currentPlayerStats.points)) {
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
 
 const scoreDiff = Math.abs(finalScore.home - finalScore.away);
 const isBigLead = scoreDiff >= 10;
 const isFirstPoint = (finalScore.home === 1 && finalScore.away === 0) || 
 (finalScore.home === 0 && finalScore.away === 1);
 const isTied = finalScore.home === finalScore.away;
 const leadingTeam = finalScore.home > finalScore.away 
 ? homeTeamFull 
 : awayTeamFull;
 const trailingTeam = finalScore.home < finalScore.away 
 ? homeTeamFull 
 : awayTeamFull;
 
 // Compute EXACT score situation for GPT so it doesn't hallucinate
 const scoreBefore = rally.score_before || { home: 0, away: 0 };
 const wasTiedBefore = scoreBefore.home === scoreBefore.away;
 const scoringTeamName = rally.team_scored === 'home' ? homeTeamFull : awayTeamFull;
 
 let scoreSituation = '';
 if (isFirstPoint) {
   scoreSituation = `PIERWSZY PUNKT w secie dla ${scoringTeamName}.`;
 } else if (isTied) {
   scoreSituation = `WYROWNANIE! ${scoringTeamName} wyrownuje.`;
 } else if (wasTiedBefore && !isTied) {
   scoreSituation = `${scoringTeamName} OBEJMUJE PROWADZENIE.`;
 } else if (scoreDiff === 1 && !wasTiedBefore) {
   scoreSituation = `${scoringTeamName} UTRZYMUJE minimalna przewage.`;
 } else if (scoreDiff >= 2 && rally.team_scored === (finalScore.home > finalScore.away ? 'home' : 'away')) {
   scoreSituation = `${scoringTeamName} ZWIEKSZA PRZEWAGE do ${scoreDiff} punktow.`;
 } else {
   scoreSituation = `${scoringTeamName} ZMNIEJSZA STRATE (${scoreDiff} pkt roznica).`;
 }

 console.log('[COMMENTARY] Request:', {
 rally_number: rally.rally_number,
 player: scoringPlayer,
 action: scoringAction,
 validated_score: `${finalScore.home}:${finalScore.away}`,
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
 
 // Extract tactical data from touches for precise RAG query
 let rallyAttackCombo = '';
 let rallyAttackLocation = '';
 let rallyServeType = '';
 if (rally.touches) {
 for (const touch of rally.touches) {
 if (touch.attackCombination && !rallyAttackCombo) rallyAttackCombo = touch.attackCombination;
 if (touch.attackLocation && !rallyAttackLocation) rallyAttackLocation = touch.attackLocation;
 if (touch.serveType && !rallyServeType) rallyServeType = touch.serveType;
 }
 }
 
 if (actionType.includes('block')) {
 tacticsQuery = `block blok ${rallyAttackCombo} ${rallyAttackLocation}`.trim();
 } else if (actionType.includes('attack') || actionType.includes('kill')) {
 tacticsQuery = `attack atak ${rallyAttackCombo} ${rallyAttackLocation}`.trim();
 } else if (actionType.includes('ace') || actionType.includes('serve')) {
 tacticsQuery = `serve zagrywka ${rallyServeType}`.trim();
 } else if (actionType.includes('dig') || actionType.includes('defense')) {
 tacticsQuery = `defense obrona ${rallyAttackCombo}`.trim();
 }

 let tacticsContext = '';
 if (tacticsQuery) {
 console.log('Tactics query:', tacticsQuery);
 
 try {
 const tacticsEmbedding = await openai.embeddings.create({
 model: 'text-embedding-3-small',
 input: tacticsQuery,
 dimensions: 768,
 });
 
 const tacticsResults = await index.namespace('tactical-knowledge').query({
 vector: tacticsEmbedding.data[0].embedding,
 topK: 4,
 includeMetadata: true,
 });
 
 if (tacticsResults.matches && tacticsResults.matches.length > 0) {
 const relevantTactics = tacticsResults.matches
 .filter(match => (match.score || 0) > 0.3);
 tacticsContext = relevantTactics
 .map((match) => match.metadata?.content || match.metadata?.text || '')
 .join('\n\n')
 .substring(0, 800);
 console.log('Tactics context:', tacticsContext.substring(0, 80) + '...');
 }
 } catch (error) {
 console.error('Tactics error:', error);
 }
 }

 // ========================================================================
 // STEP 5.5: RAG QUERY - COMMENTARY EXAMPLES
 // ========================================================================

 let commentaryExamplesContext = '';
 const commentaryQuery = `${scoringAction} better commentary example ${scoringPlayer}`;

 try {
 console.log('Commentary examples query:', commentaryQuery);
 
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
 .filter((match) => (match.score || 0) > 0.30) // Low threshold - accept relevant examples
 .map((match) => match.metadata?.commentary || match.metadata?.betterCommentary || '')
 .filter(Boolean)
 .join('\n')
 .substring(0, 300);
 console.log('Commentary examples found:', commentaryExamplesContext.substring(0, 80) + '...');
 console.log('[RAG-DEBUG] Examples scores:', examplesResults.matches.map(m => m.score?.toFixed(3)).join(', '));
 }
 } catch (error) {
 console.error('Commentary examples error:', error);
 }

 // ========================================================================
 // STEP 5.7: RAG QUERY - COMMENTARY HINTS (IMPROVED!)
 // ========================================================================

 let commentaryHintsContext = '';

 // Extract ALL player names from rally (full surnames without initials)
 const allPlayersInRally = rally.touches
 .map(t => t.player)
 .map(name => {
 // Remove initials: "M.Tavares" -> "Tavares", "W.Venero Leon" -> "Venero Leon"
 const parts = name.split('.');
 return parts.length > 1 ? parts[parts.length - 1].trim() : name.trim();
 })
 .filter((name, index, self) => self.indexOf(name) === index); // unique

 // ALSO add individual name parts for better matching
 const nameVariants: string[] = [];
 allPlayersInRally.forEach(name => {
 nameVariants.push(name); // Full name: "Venero Leon"
 const parts = name.split(' ');
 parts.forEach(part => {
 if (part.length >= 3) { // Only meaningful parts
 nameVariants.push(part); // Individual parts: "Venero", "Leon"
 }
 });
 });

 // Build hints query with ALL name variants + action
 const uniqueVariants = [...new Set(nameVariants)]; // Remove duplicates
 const hintsQuery = `${scoringPlayer} ${scoringAction} naming correction hint better`;

 // Commentary hints - re-enabled
 try {
 console.log('Commentary hints query:', hintsQuery);
 console.log('Players in rally:', allPlayersInRally);
 console.log('Name variants:', uniqueVariants);
 
 const hintsEmbedding = await openai.embeddings.create({
 model: 'text-embedding-3-small',
 input: hintsQuery,
 dimensions: 768,
 });
 
 const hintsResults = await index.namespace('commentary-hints').query({
 vector: hintsEmbedding.data[0].embedding,
 topK: 5,
 includeMetadata: true,
 });
 
 if (hintsResults.matches && hintsResults.matches.length > 0) {
 // Filter hints with score > 0.3 (better quality)
 const relevantHints = hintsResults.matches
 .filter(match => (match.score || 0) > 0.3)
 .map((match) => match.metadata?.betterCommentary || '')
 .filter(Boolean);
 
 if (relevantHints.length > 0) {
 commentaryHintsContext = relevantHints.join('\n').substring(0, 600);
 console.log('Commentary hints found:', commentaryHintsContext.substring(0, 150) + '...');
 console.log('Hints scores:', hintsResults.matches.map(m => m.score?.toFixed(3)));
 } else {
 console.log('No relevant hints (all scores < 0.3)');
 }
 } else {
 console.log('No commentary hints found for this query');
 }
 } catch (error) {
 console.error('Commentary hints error:', error);
 }

 // ========================================================================
 // NEW NAMESPACES - NAMING RULES, PHRASES, TONE
 // ========================================================================

 // ========================================================================
 // NAMING RULES (preferred names, declensions per language)
 // ========================================================================

 let namingRulesContext = '';
    
    // GPT fallback for name declensions when RAG has no rules
    const getGPTNamingFallback = (player: string): string => {
      // Preferred display names (parser output -> commentary name)
      const preferredNames: Record<string, string> = {
        'Leon Venero': 'Venero Leon',
        'Tavares Rodrigues': 'Tavares',
      };
      const displayName = preferredNames[player] || player;
      if (preferredNames[player]) {
        return `NAMING: ${player} -> uzywaj "${displayName}" zamiast "${player}". Odmien nazwisko wg zasad jezyka polskiego.`;
      }
      return `NAMING: Odmien nazwisko "${player}" wg zasad jezyka polskiego (mianownik, dopelniacz, biernik).`;
    };

 try {
 // Query with all player name variants
 const namingQuery = `${scoringPlayer} naming rule declension odmiana`;
 
 console.log('Naming rules query:', namingQuery);
 
 const namingEmbedding = await openai.embeddings.create({
 model: 'text-embedding-3-small',
 input: namingQuery,
 dimensions: 768,
 });
 
 const namingResults = await index.namespace('naming-rules').query({
 vector: namingEmbedding.data[0].embedding,
 topK: 10, // More results - we want all relevant names
 includeMetadata: true,
 });
 
 if (namingResults.matches && namingResults.matches.length > 0) {
 const relevantRules = namingResults.matches
 .filter(match => (match.score || 0) > 0.30) // Lower threshold - we need naming help!
 .map((match) => {
 // Support multiple metadata structures
 return match.metadata?.rule_text || 
 match.metadata?.content || 
 match.metadata?.rule || 
 match.metadata?.text || '';
 })
 .filter(Boolean);
 
 if (relevantRules.length > 0) {
 namingRulesContext = relevantRules.join('\n').substring(0, 1500);
 console.log('Naming rules found:', namingRulesContext.substring(0, 100) + '...');
 console.log('[RAG-DEBUG] Naming scores:', namingResults.matches.map(m => m.score?.toFixed(3)).join(', '));
 }
 }
 } catch (error) {
 console.log('Naming rules namespace not yet populated');
 }

    // Fallback: if no RAG naming rules found, ask GPT to decline name
    if (!namingRulesContext && scoringPlayer) {
      namingRulesContext = getGPTNamingFallback(scoringPlayer);
      console.log('[NAMING-FALLBACK] Using GPT fallback for', scoringPlayer);
    }

 // ========================================================================
 // COMMENTARY PHRASES (variacje zwrotow)
 // ========================================================================

 let commentaryPhrasesContext = '';

 try {
 // Query based on action type
 const actionType = scoringAction.toLowerCase();
 let phrasesQuery = '';
 
 if (actionType.includes('ace') || actionType.includes('serve')) {
 phrasesQuery = 'ace serwis zagrywka punktowy asowy doskonaly perfekcyjny';
 } else if (actionType.includes('block') && !actionType.includes('error')) {
 phrasesQuery = 'blok skuteczny zatrzymuje muruje powstrzymuje obrona';
 } else if (actionType.includes('attack') || actionType.includes('kill')) {
 phrasesQuery = 'atak konczy przebija potezny skuteczny spike';
 } else if (actionType.includes('dig')) {
 phrasesQuery = 'obrona dig ratuje wyciaga odbija';
 }
 
 if (phrasesQuery) {
 console.log('Commentary phrases query:', phrasesQuery);
 
 const phrasesEmbedding = await openai.embeddings.create({
 model: 'text-embedding-3-small',
 input: phrasesQuery,
 dimensions: 768,
 });
 
 const phrasesResults = await index.namespace('commentary-phrases').query({
 vector: phrasesEmbedding.data[0].embedding,
 topK: 5,
 includeMetadata: true,
 });
 
 if (phrasesResults.matches && phrasesResults.matches.length > 0) {
 const phrases = phrasesResults.matches
 .filter((match) => (match.score || 0) > 0.30) // Accept relevant phrases
 .map((match) => {
 // Support multiple metadata structures
 return match.metadata?.text_preview || 
 match.metadata?.content || 
 match.metadata?.phrase || 
 match.metadata?.text || '';
 })
 .filter(Boolean);
 
 if (phrases.length > 0) {
 commentaryPhrasesContext = `VARIACJE ZWROTOW (uzywaj zamiennie):\n${phrases.join(' / ')}`;
 console.log('Commentary phrases found:', phrases.length, 'variants');
 console.log('[RAG-DEBUG] Phrases scores:', phrasesResults.matches.map(m => m.score?.toFixed(3)).join(', '));
 }
 }
 }
 } catch (error) {
 console.log('Commentary phrases namespace not yet populated');
 }

 // ========================================================================
 // SET SUMMARIES (wzorce podsumowan setow/meczow)
 // ========================================================================

 let setSummariesContext = '';

 try {
 // Query set-summaries for strategic insights
 const summaryQuery = `set strategy analysis key moments ${scoringPlayer} ${scoringAction}`;
 
 console.log('Set summaries query:', summaryQuery);
 
 const summaryEmbedding = await openai.embeddings.create({
 model: 'text-embedding-3-small',
 input: summaryQuery,
 dimensions: 768,
 });
 
 const setSummariesResults = await index.namespace('set-summaries').query({
 vector: summaryEmbedding.data[0].embedding,
 topK: 3,
 includeMetadata: true,
 });
 
 if (setSummariesResults.matches && setSummariesResults.matches.length > 0) {
 setSummariesContext = setSummariesResults.matches
 .filter(match => match.score && match.score > 0.35)
 .map(match => match.metadata?.content || match.metadata?.text || '')
 .join('\n\n');
 
 if (setSummariesContext) {
 console.log('Set summaries found:', setSummariesContext.substring(0, 100) + '...');
 }
 }
 } catch (error) {
 console.log('Set summaries namespace not yet populated');
 }

 // ========================================================================
 // TONE RULES (kiedy dramatycznie, kiedy spokojnie)
 // ========================================================================

 let toneRulesContext = '';

 try {
 // Build context about current situation
 const situationContext = [
 isHotSituation ? 'hot situation 20+ points' : '',
 isEarlySet ? 'early set 1-10 points' : '',
 rallyAnalysis?.isLongRally ? `long rally ${rallyAnalysis.numTouches} touches` : '',
 rallyAnalysis?.isDramatic ? 'dramatic high drama' : '',
 currentStreak >= 5 ? `streak ${currentStreak} points series` : '',
 milestone ? 'milestone achievement' : '',
 isBigLead ? 'big lead difference' : '',
 ].filter(Boolean).join(' ');
 
 const toneQuery = `${situationContext} temperature emotion energy tone`;
 
 console.log('i, Tone rules query:', toneQuery);
 
 const toneEmbedding = await openai.embeddings.create({
 model: 'text-embedding-3-small',
 input: toneQuery,
 dimensions: 768,
 });
 
 const toneResults = await index.namespace('tone-rules').query({
 vector: toneEmbedding.data[0].embedding,
 topK: 3,
 includeMetadata: true,
 });
 
 if (toneResults.matches && toneResults.matches.length > 0) {
 const toneRules = toneResults.matches
 .filter(m => (m.score || 0) > 0.3)
 .map((match) => match.metadata?.content || match.metadata?.rule || match.metadata?.rule_text || match.metadata?.text || '')
 .filter(Boolean);
 
 if (toneRules.length > 0) {
 toneRulesContext = `TONE GUIDANCE:\n${toneRules.join('\n')}`;
 console.log('Tone rules found:', toneRules.length, 'rules');
 }
 }
 } catch (error) {
 console.log('i, Tone rules namespace not yet populated');
 }

 // ========================================================================
 // STEP 6: RAG QUERY - PLAYER INFO
 // ========================================================================
 
 const searchQuery = `${scoringPlayer} ${scoringAction} characteristics playing style`;
 console.log('RAG query:', searchQuery);

 const embeddingResponse = await openai.embeddings.create({
 model: 'text-embedding-3-small',
 input: searchQuery,
 dimensions: 768,
 });

 const queryEmbedding = embeddingResponse.data[0].embedding;

 const searchResults = await index.namespace('player-profiles').query({
 vector: queryEmbedding,
 topK: 3,
 includeMetadata: true,
 });

 console.log('RAG results:', searchResults.matches.length, 'matches');

 let playerContext = '';
 if (searchResults.matches.length > 0) {
 playerContext = searchResults.matches
 .map((match) => match.metadata?.content || match.metadata?.text || '')
 .join('\n\n');
 console.log('Player context found:', playerContext.substring(0, 200) + '...');
 } else {
 console.log('No RAG context in player-profiles, trying expert-knowledge...');
 
 // Fallback: query expert-knowledge namespace
 try {
   const expertResults = await index.namespace('expert-knowledge').query({
     vector: queryEmbedding,
     topK: 3,
     includeMetadata: true,
   });
   
   if (expertResults.matches && expertResults.matches.length > 0) {
     playerContext = expertResults.matches
       .filter(m => (m.score || 0) > 0.3)
       .map((match) => match.metadata?.content || match.metadata?.text || '')
       .filter(Boolean)
       .join('\n\n');
     if (playerContext) {
       console.log('[EXPERT-KNOWLEDGE] Found context:', playerContext.substring(0, 200) + '...');
     }
   }
 } catch (err) {
   console.log('expert-knowledge namespace error:', err);
 }
 }

 // ========================================================================
 // STEP 7: BUILD COMMENTARY PROMPT
 // ========================================================================
 
 const score = `${finalScore.home}:${finalScore.away}`;

 const homeLeading = finalScore.home > finalScore.away;
 const awayLeading = finalScore.away > finalScore.home;
 const leadingTeamName = homeLeading ? homeTeamFull : awayLeading ? awayTeamFull : 'remis';

 let touchContext = '';
 
 // Extract tactical data from touches
 let attackCombo = '';
 let attackLocation = '';
 let attackStyle = '';
 let serveType = '';
 let attackZone = '';
 
 if (rally.touches && rally.touches.length > 0) {
 for (const touch of rally.touches) {
 if (touch.attackCombination && !attackCombo) attackCombo = touch.attackCombination;
 if (touch.attackLocation && !attackLocation) attackLocation = touch.attackLocation;
 if (touch.attackStyle && !attackStyle) attackStyle = touch.attackStyle;
 if (touch.serveType && !serveType) serveType = touch.serveType;
 if (touch.zone && !attackZone) attackZone = touch.zone;
 }
 }
 
 // ================================================================
 // FULL TOUCH CHAIN (radio-style) - ALWAYS build from rally.touches
 // ================================================================
 const numTouches = rally.touches?.length || 0;
 const isLongRally = numTouches >= 8;
 
 if (rally.touches && rally.touches.length > 0) {
 const touchChainLines: string[] = [];
 
 rally.touches.forEach((touch, idx) => {
   const action = touch.action || '';
   const player = touch.player || '?';
   const actionLower = action.toLowerCase();
   const teamLabel = touch.team === 'home' ? `[${homeTeamFull}]` : `[${awayTeamFull}]`;
   
   let desc = `${idx + 1}. ${teamLabel} ${player}`;
   
   // SERVE
   if (actionLower.includes('zagrywka') || actionLower.includes('serwis') || actionLower.includes('serve')) {
     const sType = touch.serveType || '';
     const serveDesc = sType.includes('Float') ? 'zagrywka floatowa' : sType.includes('Spin') ? 'zagrywka z wyskoku' : 'zagrywka';
     const isLastTouch = idx === rally.touches!.length - 1;
     
     if (actionLower.includes('as ') || actionLower.includes('ace')) {
       desc += ` - ${serveDesc} >>> AS SERWISOWY!`;
     } else if ((actionLower.includes('blad') || actionLower.includes('error')) && isLastTouch) {
       // REAL serve error - only if this is the LAST touch (rally ended here)
       desc += ` - ${serveDesc} >>> BLAD SERWISU`;
     } else {
       // Serve continues play (even if VolleyStation says "Blad" - if there are more touches, it wasn't a terminal error)
       desc += ` - ${serveDesc}`;
     }
   // RECEIVE
   } else if (actionLower.includes('przyjecie') || actionLower.includes('pass') || actionLower.includes('receive')) {
     if (actionLower.includes('perfect')) desc += ' - idealne przyjecie';
     else if (actionLower.includes('positive')) desc += ' - dobre przyjecie';
     else if (actionLower.includes('negative') || actionLower.includes('poor')) desc += ' - bardzo slabe przyjecie, pilka daleko od siatki';
     else desc += ' - przyjecie';
   // SET
   } else if (actionLower.includes('rozegranie') || actionLower.includes('setting') || actionLower === 'set') {
     const combo = touch.attackCombination || '';
     const loc = touch.attackLocation || '';
     let setDesc = 'rozegranie';
     if (loc.includes('Left')) setDesc = 'wystawia na lewa strone';
     else if (loc.includes('Right')) setDesc = 'wystawia na prawa strone';
     else if (loc.includes('Middle') || combo.includes('K1') || combo.includes('K2') || combo.includes('K7')) setDesc = 'szybka pilka srodkiem';
     else if (combo.toLowerCase().includes('pipe')) setDesc = 'wystawia pipe';
     desc += ` - ${setDesc}`;
   // ATTACK
   } else if (actionLower.includes('atak') || actionLower.includes('attack')) {
     const loc = touch.attackLocation || '';
     const style = touch.attackStyle || '';
     const combo = touch.attackCombination || '';
     let atkDesc = 'atak';
     if (loc.includes('Left')) atkDesc = 'atak z lewej strony';
     else if (loc.includes('Right')) atkDesc = 'atak z prawej strony';
     else if (loc.includes('Middle')) atkDesc = 'atak pierwszym tempem';
     else if (combo.toLowerCase().includes('pipe')) atkDesc = 'atak pipe z drugiej linii';
     
     if (style === 'Tip') atkDesc += ', kiwka';
     else if (style === 'Tool') atkDesc += ', od bloku';
     
     if (actionLower.includes('blad') || actionLower.includes('error')) {
       if (idx === rally.touches!.length - 1) {
         desc += ` - ${atkDesc} >>> BLAD ATAKU`;
       } else {
         desc += ` - ${atkDesc} (nieudany, gra trwa)`;
       }
     } else if (actionLower.includes('zablok') || actionLower.includes('block')) {
       if (idx === rally.touches!.length - 1) {
         desc += ` - ${atkDesc} >>> ZATRZYMANY BLOKIEM`;
       } else {
         desc += ` - ${atkDesc} (zablokowany, gra trwa)`;
       }
     } else {
       desc += ` - ${atkDesc} >>> SKUTECZNY! Punkt!`;
     }
   // BLOCK
   } else if (actionLower.includes('blok') || actionLower.includes('block')) {
     if (actionLower.includes('przebity') || actionLower.includes('error') || actionLower.includes('fail')) desc += ' - probowal blokowac, blok PRZEBITY (przegral z atakujacym)';
     else desc += ' - SKUTECZNY BLOK! Punkt!';
   // DIG
   } else if (actionLower.includes('obrona') || actionLower.includes('dig')) {
     desc += ' - obrona w polu';
   // FREE
   } else if (actionLower.includes('wolna') || actionLower.includes('free')) {
     desc += ' - wolna pilka';
   } else {
     desc += ` - ${action}`;
   }
   
   touchChainLines.push(desc);
 });
 
 const winnerTeamLabel = rally.team_scored === 'home' ? homeTeamFull : awayTeamFull;
 
 touchContext = `
PRZEBIEG AKCJI (${numTouches} dotkniec${isLongRally ? ' - DLUGA WYMIANA!' : ''}):
${touchChainLines.join('\n')}
=> PUNKT DLA: ${winnerTeamLabel}

KRYTYCZNE ZASADY KOMENTARZA - LAMANIE = PORAZKA:
1. OPISUJ TYLKO TO CO JEST W PRZEBIEGU AKCJI POWYZEJ. Nic wiecej!
2. Zachowaj DOKLADNA kolejnosc dotkniec - krok po kroku.
3. ZAGRYWKA: Blad serwisowy jest TYLKO gdy jest napisane ">>> BLAD SERWISU". W kazdym innym przypadku zagrywka jest dobra i gra toczy sie dalej - nie musisz tego podkreslac.
4. BLOK PRZEBITY: Ostatnie dotkniecie z "(przegral z atakujacym)" oznacza ze ATAKUJACY zdobyl punkt. NIE opisuj blokujacego jako zdobywce punktu.
5. Jesli zagrywka jest poprawna, to nastepuje przyjecie - to jest LOGICZNE. Jesli zagrywka jest bledem, to akcja sie KONCZY i nie ma przyjecia.
6. Jesli sa 2-3 dotkniecia, komentarz = 1 krotkie zdanie. Jesli 5+, opisz pelniej.`;
 }
 
 let situationContext = '';
 if (setEndInfo.isSetEnd) {
 situationContext += `\nKONIEC SETA! To byl OSTATNI PUNKT! Wynik koncowy: ${score}. Zwyciezca: ${setEndInfo.winner}. MUSISZ POWIEDZIEC ZE SET SIE SKONCZYL!`;
 }
 if (currentStreak >= 5) {
 situationContext += `\nMOMENTUM: ${streakTeam} ma serie ${currentStreak} punktow pod rzad!`;
 }
 if (milestone) {
 situationContext += `\nMILESTONE: To jest ${milestone} dla ${scoringPlayer}! WSPOMNIEJ O TYM!`;
 }
 if (isBigLead && !setEndInfo.isSetEnd) {
 situationContext += `\nSYTUACJA: Duza przewaga ${scoreDiff} punktow! ${leadingTeamName} prowadzi ${score}.`;
 }
 
 let errorContext = '';
 if (attackingPlayer) {
 errorContext = `\nBLOK ERROR - WAZNE: ${attackingPlayer} (${attackingTeamName}) PRZEBIL BLOK ${scoringPlayer}!
Skomentuj ATAK ${attackingPlayer}, nie blad blokujacego!
Przyklad: "${attackingPlayer} przebija blok ${scoringPlayer}! Potezny atak!"
Odmien nazwiska poprawnie wg zasad jezyka polskiego!`;
 } else if (scoringAction.toLowerCase().includes('error')) {
 errorContext = `\nUWAGA: To byl BLAD zawodnika ${scoringPlayer}. Nie dramatyzuj - po prostu opisz blad.`;
 }
 
 let passInstructions = '';
 if (rallyAnalysis) {
 if (rallyAnalysis.passQuality === 'perfect') {
 passInstructions = '\n- Przyjecie bylo PERFEKCYJNE - wspomniej o latwosci wykonania akcji!';
 } else if (rallyAnalysis.passQuality === 'negative') {
 passInstructions = '\n- Przyjecie DALEKO OD SIATKI lub BARDZO TRUDNE - podkresl trudnosc i walke zespolu! NIE mow "chaos"!';
 } else if (rallyAnalysis.passQuality === 'average') {
 passInstructions = '\n- Przyjecie bylo NIEDOKLADNE - troche trudnosci w akcji!';
 }
 
 if (rallyAnalysis.isLongRally) {
 passInstructions += `\n- To byla DLUGA wymiana (${rallyAnalysis.numTouches} dotkniec) - podkresl wysilek i dramatyzm!`;
 }
 }
 
 // Build substitution context for GPT
 let substitutionContext = '';
 if (rally.substitutions && rally.substitutions.length > 0) {
 const subDescriptions = rally.substitutions.map((sub: any) => {
 const teamLabel = sub.team_name || (sub.team === 'home' ? 'Gospodarze' : 'Goscie');
 const situationHint = sub.score_status === 'Up' ? 'prowadzac' : sub.score_status === 'Down' ? 'przegrywajac' : '';
 const diffHint = sub.score_diff ? ` ${sub.score_diff} pkt` : '';
 return `${teamLabel}: ${sub.player_out} schodzi, ${sub.player_in} wchodzi${situationHint ? ` (${situationHint}${diffHint})` : ''}`;
 });
 substitutionContext = `\nZMIANY W TYM RALLY:\n${subDescriptions.join('\n')}\n`;
 }

 const commentaryPrompt = `${touchContext}

WYNIK I KONTEKST:
GOSPODARZE: ${homeTeamFull} | GOSCIE: ${awayTeamFull}
Rally #${rally.rally_number} | Set ${setNumber} | Wynik: ${score} | Punkt zdobyla: ${rally.team_scored === 'home' ? homeTeamFull + ' (gospodarze)' : awayTeamFull + ' (goscie)'}
${rally.phase ? `FAZA GRY: ${rally.phase === 'First Ball' ? 'ATAK PO PRZYJECIU (First Ball / Side-out) - pierwsza szansa na atak po przyjeciu zagrywki. Kluczowa jest jakosc przyjecia i wybor kombinacji ataku.' : rally.phase === 'Transition' ? 'KONTRA (Transition) - atak po obronie w polu. Czesto bardziej chaotyczny, wymaga improwizacji. Rozgrywajacy ma mniej opcji, atakujacy musza reagowac szybko.' : rally.phase}` : ''}
SYTUACJA PUNKTOWA: ${scoreSituation}${situationContext}${errorContext}${substitutionContext}

${tacticsContext ? `WIEDZA TAKTYCZNA O AKCJI:\n${tacticsContext}\n\n` : ''}${commentaryExamplesContext ? `PRZYKLADY DOBRYCH KOMENTARZY:\n${commentaryExamplesContext}\n\n` : ''}${commentaryHintsContext ? `[!!] USER CORRECTIONS & HINTS (PRIORITY!):\n${commentaryHintsContext}\n\n` : ''}${namingRulesContext ? `NAMING RULES (PRIORITY!):\n${namingRulesContext}\n\n` : ''}${commentaryPhrasesContext ? `VARIACJE ZWROTOW:\n${commentaryPhrasesContext}\n\n` : ''}${setSummariesContext ? `SET-LEVEL STRATEGIC INSIGHTS:\n${setSummariesContext}\n\n` : ''}${toneRulesContext ? `TONE GUIDANCE:\n${toneRulesContext}\n\n` : ''}${playerContext ? `CHARAKTERYSTYKA ZAWODNIKA:\n${playerContext}` : ''}

INSTRUKCJE:
- OPISUJ TYLKO PRZEBIEG AKCJI powyzej. Kazde dotkniecie po kolei. Nic nie dodawaj!
- ${setEndInfo.isSetEnd ? `TO JEST KONIEC SETA! MUSISZ TO POWIEDZIEC! Wynik koncowy: ${score}. Zwyciezca: ${setEndInfo.winner}.` : isFirstPoint ? 'PIERWSZY PUNKT - krotko, spokojnie.' : isHotSituation ? 'KONCOWKA SETA - emocje!' : currentStreak >= 5 ? 'SERIA - podkresl momentum!' : milestone ? 'MILESTONE - wspomniej liczbe punktow/blokow/asow!' : isBigLead ? 'Duza przewaga - zauwaz sytuacje' : isEarlySet ? 'Poczatek - spokojnie' : 'Srodek seta - rzeczowo'}
- ${attackingPlayer ? `To ATAK ${attackingPlayer} - pochwal ATAKUJACEGO, nie blad bloku! Uzyj formy: "${attackingPlayer} przebija blok (odmien nazwisko!) ${scoringPlayer}!"` : ''}
- ${milestone ? `WAZNE: Wspomniej ze to ${milestone}!` : ''}${passInstructions}
- ${commentaryHintsContext ? 'APPLY USER HINTS - they have PRIORITY over other context!' : ''}
- ${isFirstPoint ? 'NIE uzywaj "zwieksza/zmniejsza przewage" - to PIERWSZY punkt!' : 'SYTUACJA PUNKTOWA powyzej jest DOKLADNA - uzyj JEJ. Nie wymyslaj wlasnej interpretacji wyniku!'}
- Uzywaj POPRAWNEJ odmiany nazwisk (Leon -> Leona w dopelniaczu)
- NIE POWTARZAJ INFORMACJI! Wynik, kto zdobyl punkt, kto prowadzi — wymien MAKSYMALNIE RAZ. Jesli opisales akcje i wspomniales o wyniku, NIE dodawaj kolejnego zdania o tym samym.
- ${attackCombo ? `DANE TAKTYCZNE: Atak typu ${attackCombo}${attackLocation ? `, strefa: ${attackLocation}` : ''}${attackStyle ? `, styl: ${attackStyle}` : ''}. Uzyj tych danych by opisac KONKRETNIE co sie stalo (np. atak po skosie, atak pipe, szybki atak srodkiem) zamiast ogolnikow!` : serveType ? `DANE TAKTYCZNE: Zagrywka typu ${serveType}. Opisz ja konkretnie!` : ''}
- ${rally.substitutions?.length ? 'ZMIANA! Wplec ja naturalnie w komentarz - kto za kogo wchodzi, co to moze oznaczac (reakcja trenera, swieze sily, zmiana taktyki). To wazna informacja narracyjna!' : ''}
- ${rally.phase === 'Transition' ? 'KONTRA! Podkresl dynamike kontry - szybka reakcja po obronie, improwizacja atakujacego, mniej czasu na rozegranie.' : rally.phase === 'First Ball' ? 'Atak po przyjeciu - mozesz wspomniec jakosc przyjecia jesli wplywa na atak (np. idealne przyjecie = pelna kombinacja, slabe = pilka wymuszona).' : ''}
`;

 
 // DEBUG: Check if naming rules are in prompt
 if (namingRulesContext) {
 console.log('[NAMING-IN-PROMPT] Naming rules WILL BE SENT to GPT:');
 console.log('[NAMING-IN-PROMPT] Content:', namingRulesContext.substring(0, 200) + '...');
 } else {
 console.log('[NAMING-IN-PROMPT] NO naming rules in this prompt!');
 }
 
 console.log('========= ROUTE.TS v7.4 RAG-UNLEASHED LOADED =========');
 console.log('[RALLY-TOUCHES]', rally.touches?.length || 0, 'touches');
 if (rally.touches && rally.touches.length > 0) {
   console.log('[FIRST-3-TOUCHES]', JSON.stringify(rally.touches.slice(0, 3)));
 } else {
   console.log('[NO-TOUCHES] rally keys:', Object.keys(rally));
 }
 console.log('[TOUCH-CHAIN-RESULT]', touchContext ? 'BUILT OK (' + touchContext.length + ' chars)' : 'EMPTY!!!');

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
 
 console.log('[PRE-GPT] touchContext length:', touchContext.length);
 console.log('[PRE-GPT] prompt first 400 chars:', commentaryPrompt.substring(0, 400));
 
 const completion = await openai.chat.completions.create({
 model: 'gpt-4o-mini',
 messages: [
 { role: 'system', content: systemPrompt },
 { role: 'user', content: commentaryPrompt },
 ],
 temperature: setEndInfo.isSetEnd ? 0.95 : isHotSituation ? 0.9 : currentStreak >= 5 ? 0.85 : isBigLead ? 0.8 : 0.7,
 max_tokens: rally.touches?.length >= 5 ? 300 : rally.touches?.length >= 3 ? 200 : 150,
 });

 const commentary = completion.choices[0].message.content || '';

 // ========================================================================
 // STEP 9: GENERATE TAGS, MILESTONES, ICONS, SCORES
 // ========================================================================
 
 // Determine icon based on action
 let icon = 'LIGHTNING'; // default
 const actionTypeLower = scoringAction.toLowerCase();

 if (setEndInfo.isSetEnd) {
 icon = 'TROPHY';
 } else if (actionTypeLower.includes('ace')) {
 icon = 'TARGET';
 } else if (actionTypeLower.includes('block') && !actionTypeLower.includes('error')) {
 icon = 'UNLOCK'; // Broken block
 } else if (actionTypeLower.includes('block') && actionTypeLower.includes('error')) {
 icon = 'UNLOCK'; // Broken block
 } else if (actionTypeLower.includes('attack') || actionTypeLower.includes('kill')) {
 icon = 'LIGHTNING';
 } else if (actionTypeLower.includes('serve') && actionTypeLower.includes('error')) {
 icon = 'WARNING';
 } else if (actionTypeLower.includes('dig') && actionTypeLower.includes('error')) {
 icon = 'RELOAD';
 } else if (actionTypeLower.includes('pass') && actionTypeLower.includes('error')) {
 icon = 'WARNING';
 } else if (actionTypeLower.includes('error')) {
 icon = 'CROSS';
 } else if (rallyAnalysis?.passQuality === 'perfect') {
 icon = 'MUSCLE';
 }

 // Generate tags
 const tags: string[] = [];

 if (setEndInfo.isSetEnd) {
 tags.push('#koniec_seta');
 }
 if (currentStreak >= 4) {
 tags.push('#seria');
 }
 if (rallyAnalysis?.isDramatic || isHotSituation) {
 tags.push('#drama');
 }
 if (rallyAnalysis?.isLongRally) {
 tags.push('#dluga_wymiana');
 }
 if (milestone) {
 tags.push('#milestone');
 }
 if (scoreDiff >= 5 && teamByRole(rally.team_scored) === trailingTeam) {
 tags.push('#comeback');
 }
 if (rally.substitutions && rally.substitutions.length > 0) {
 tags.push('#zmiana');
 }

 // Generate milestone messages
 const milestones: string[] = [];
 if (milestone) {
 milestones.push(`${scoringPlayer}: ${milestone}`);
 }

 // Momentum and drama scores
 const momentumScore = currentStreak >= 4 ? Math.min(currentStreak * 1.5, 10) : 0;
 const dramaScore = rallyAnalysis?.dramaScore || 0;

 console.log('Tags:', tags);
 console.log('Milestones:', milestones);
 console.log('Scores:', { momentum: momentumScore, drama: dramaScore });
 console.log('Icon:', icon);

 // ========================================================================
 // STEP 10: BUILD TAG DATA FOR POPUPS
 // ========================================================================

 const tagData: Record<string, any> = {};
 
 if (tags.includes('#seria')) {
   tagData['#seria'] = {
     team: teamByRole(streakTeam),
     length: currentStreak,
     score: score,
   };
 }
 if (tags.includes('#comeback')) {
   tagData['#comeback'] = {
     team: teamByRole(rally.team_scored),
     scoreDiff: scoreDiff,
     score: score,
   };
 }
 if (tags.includes('#drama')) {
   tagData['#drama'] = {
     dramaScore: rallyAnalysis?.dramaScore || 0,
     isHot: isHotSituation,
     score: score,
   };
 }
 if (tags.includes('#dluga_wymiana')) {
   tagData['#dluga_wymiana'] = {
     numTouches: rallyAnalysis?.numTouches || 0,
   };
 }
 if (tags.includes('#milestone')) {
   tagData['#milestone'] = {
     player: displayScoringPlayer,
     achievement: milestone,
   };
 }
 if (tags.includes('#zmiana') && rally.substitutions) {
   tagData['#zmiana'] = {
     subs: rally.substitutions.map((sub: any) => ({
       playerIn: sub.player_in,
       playerOut: sub.player_out,
       team: sub.team_name || sub.team,
     })),
   };
 }
 if (tags.includes('#koniec_seta')) {
   tagData['#koniec_seta'] = {
     winner: setEndInfo.winner,
     score: score,
   };
 }

 // ========================================================================
 // STEP 11: RETURN JSON RESPONSE
 // ========================================================================

 return new Response(JSON.stringify({
 commentary,
 tags,
 tagData,
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
 console.error('Commentary API error:', error);
 return new Response(JSON.stringify({ 
 error: 'Error generating commentary',
 commentary: '',
 tags: [],
 milestones: [],
 icon: '',
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