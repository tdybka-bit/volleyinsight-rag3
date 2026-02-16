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
 genitive: 'Boladzia', 
 accusative: 'Boladzia'
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
 genitive: 'Tavaresa',
 accusative: 'Tavaresa'
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
 accusative: 'Komende'
 },
 'Prokopczuk': {
 nominative: 'Prokopczuk',
 genitive: 'Prokopczuka',
 accusative: 'Prokopczuka'
 },
 'Zniszczol': {
 nominative: 'Zniszczol',
 genitive: 'Zniszczola',
 accusative: 'Zniszczola'
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
 scoreBefore: { home: number; away: number },
 scoreAfter: { home: number; away: number },
 teamScored: string,
 rallyNumber: number
): { home: number; away: number; wasFixed: boolean } {
 const totalBefore = scoreBefore.home + scoreBefore.away;
 const totalAfter = scoreAfter.home + scoreAfter.away;

 if (totalAfter !== totalBefore + 1) {
 console.error(`aOE Rally #${rallyNumber} Score inconsistency!`, { 
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
 
 console.log(`aoe... Rally #${rallyNumber} Fixed score:`, fixed);
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
Your task is to generate professional, factual volleyball match commentary.

CRITICAL RULES:
- Be FACTUAL, not dramatic
- NEVER exaggerate situation importance (3:2 is NOT critical!)
- NEVER mention "morale" or "pressure" in early set
- "Block error" NOT "blad blokowy" 
- Focus on WHAT HAPPENED, not speculation
- 1-2 sentences MAX
- NEVER use quotation marks (" ") around commentary - write directly
- NEVER invent or add first names - use only surnames provided in data
- Use proper Polish grammar and declensions for names

VOCABULARY IMPROVEMENTS:
- NEVER say "chaos w przyjeciu" use "niedokladne przyjecie", "przyjecie daleko od siatki", "bardzo trudne przyjecie"
- NEVER say "blad blokowy" -> use "blad w bloku"
- For block errors: praise the ATTACKER who broke through, not the blocker's mistake
 Example: "Leon przebija blok Kwolka! Potezny atak!"

SCORE ACCURACY:
- When team ALREADY LEADS, say "zwieksza przewage" NOT "prowadzi"
- When trailing team scores, say "zmniejsza strate" or "zmniejsza przewage przeciwnika"
- Be PRECISE about score changes

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
- "Leon konczy set poteznym atakiem! KONIEC SETA 30:28 dla Bogdanki! Dramatyczna koncowka z prolongata!"
- "As serwisowy McCarthy! KONIEC SETA 25:22! Aluron wygrywa pewnie drugiego seta!"
- "Blok Grozdanova! SET dla Bogdanki 25:23! Zacieta walka, ale gospodarze zdobywaja seta!"

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
- "Kolejny punkt w serii! Zawiercie buduje przewage!"
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
- "Zawiercie prowadzi 15:5. Grozdanov dolozyl kolejny punkt."
- "Punkt dla Bogdanki, ale wciaz spory dystans - 8:18."`;
 } else if (isEarlySet) {
 return basePrompt + `
- EARLY SET (1-10 points): Keep it calm and factual!

EXAMPLES (Polish):
- "Grozdanov skuteczny w bloku. Dobry poczatek."
- "Blad serwisowy McCarthy. Punkt dla przeciwnika."
- "Sasak konczy atak. Prowadzenie dla Bogdanki."

NO DRAMA - just describe what happened!`;
 } else {
 return basePrompt + `
- MID-SET (11-19 points): Factual but with ENERGY!

EXAMPLES (Polish):
- "Grozdanov skuteczny w bloku! Zatrzymal rywala."
- "McCarthy pewny w zagrywce. Punkt dla Zawiercia!"
- "Sasak konczy atak! Bogdanka zwieksza przewage."
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
 score_before: { aluron: number; bogdanka: number };
 score_after: { aluron: number; bogdanka: number };
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
 console.log(`Ac!A A-A,A Rally #${rally.rally_number}: Score was corrected!`);
 }

 const finalScore = {
 home: validatedScore.home || 0,
 away: validatedScore.away || 0
 };

 // ========================================================================
 // STEP 2: CHECK IF SET ENDED
 // ========================================================================
 const setNumber = rally.set_number || 1;
 const setEndInfo = checkSetEnd(finalScore, setNumber);

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
 console.warn(`Ac!A A-A,A Rally #${rally.rally_number} has no touches, returning basic commentary`);
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

 const teamNames: Record<string, string> = {
 'aluron': 'Aluron CMC Warta Zawiercie',
 'bogdanka': 'BOGDANKA LUK Lublin'
 };

 const playerTeamName = teamNames[playerTeam.toLowerCase()] || rally.team_scored;
 const attackingTeamName = attackingTeam ? teamNames[attackingTeam.toLowerCase()] : '';

 // ========================================================================
 // STEP 4: SITUATION ANALYSIS
 // ========================================================================
 
 const isHotSituation = finalScore.home >= 20 && finalScore.away >= 20 && !setEndInfo.isSetEnd;
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
 
 const scoreDiff = Math.abs(finalScore.home - finalScore.away);
 const isBigLead = scoreDiff >= 10;
 const isFirstPoint = (finalScore.home === 1 && finalScore.away === 0) || 
 (finalScore.home === 0 && finalScore.away === 1);
 const leadingTeam = finalScore.home > finalScore.away 
 ? 'Aluron CMC Warta Zawiercie' 
 : 'BOGDANKA LUK Lublin';
 const trailingTeam = finalScore.home < finalScore.away 
 ? 'Aluron CMC Warta Zawiercie' 
 : 'BOGDANKA LUK Lublin';

 console.log('Adeg,1/2A- Commentary request:', {
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
 
 const [tacticsResults1, tacticsResults2] = await Promise.all([
 index.namespace('tactics').query({
 vector: tacticsEmbedding.data[0].embedding,
 topK: 2,
 includeMetadata: true,
 }),
 index.namespace('tactical-knowledge').query({
 vector: tacticsEmbedding.data[0].embedding,
 topK: 2,
 includeMetadata: true,
 }),
 ]);

 const tacticsResults = {
 matches: [
 ...(tacticsResults1.matches || []),
 ...(tacticsResults2.matches || []),
 ].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3),
 };
 
 if (tacticsResults.matches && tacticsResults.matches.length > 0) {
 tacticsContext = tacticsResults.matches
 .map((match) => match.metadata?.text || '')
 .join('\n\n')
 .substring(0, 400);
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
 console.log('Ac!A A-A,A No relevant hints (all scores < 0.3)');
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
 .filter(match => match.score && match.score > 0.7)
 .map(match => match.metadata?.text || '')
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
 .map((match) => match.metadata?.rule || match.metadata?.text || '')
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

 const searchResults = await index.namespace('default').query({
 vector: queryEmbedding,
 topK: 3,
 includeMetadata: true,
 });

 console.log('RAG results:', searchResults.matches.length, 'matches');

 let playerContext = '';
 if (searchResults.matches.length > 0) {
 playerContext = searchResults.matches
 .map((match) => match.metadata?.text || '')
 .join('\n\n');
 console.log('Player context found:', playerContext.substring(0, 200) + '...');
 } else {
 console.log('Ac!A A-A,A No RAG context found for player');
 }

 // ========================================================================
 // STEP 7: BUILD COMMENTARY PROMPT
 // ========================================================================
 
 const score = `${finalScore.home}:${finalScore.away}`;

 const homeLeading = finalScore.home > finalScore.away;
 const awayLeading = finalScore.away > finalScore.home;
 const leadingTeamName = homeLeading ? 'gospodarze' : awayLeading ? 'go>cie' : 'remis';

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
 
 if (rallyAnalysis) {
 const passQualityDescriptions: Record<string, string> = {
 'perfect': 'perfekcyjne przyjecie',
 'good': 'dobre przyjecie',
 'average': 'niedokladne przyjecie',
 'negative': 'przyjecie daleko od siatki',
 'error': 'blad w przyjeciu - ACE!'
 };
 
 const passDesc = passQualityDescriptions[rallyAnalysis.passQuality] || rallyAnalysis.passQuality;
 
 touchContext = `
RALLY COMPLEXITY:
- Touches: ${rallyAnalysis.numTouches} ${rallyAnalysis.isLongRally ? '(DLUGA WYMIANA!)' : ''}
- Drama score: ${rallyAnalysis.dramaScore.toFixed(1)}/5.0 ${rallyAnalysis.isDramatic ? 'DRAMATIC!' : ''}
- Pass quality: ${passDesc}
${serveType ? `- Serve type: ${serveType}` : ''}
${attackCombo ? `- Attack combination: ${attackCombo}` : ''}
${attackLocation ? `- Attack location: ${attackLocation}` : ''}
${attackStyle ? `- Attack style: ${attackStyle}` : ''}
${attackZone ? `- Zone: ${attackZone}` : ''}

KEY PLAYERS IN CHAIN:
${rallyAnalysis.serverPlayer ? `- Serve: ${rallyAnalysis.serverPlayer}` : ''}
${rallyAnalysis.passPlayer ? `- Pass: ${rallyAnalysis.passPlayer} (${passDesc})` : ''}
${rallyAnalysis.setterPlayer ? `- Set: ${rallyAnalysis.setterPlayer}` : ''}
${rallyAnalysis.attackerPlayer ? `- Attack: ${rallyAnalysis.attackerPlayer}` : ''}`;
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
 const attackerDeclined = declinePolishName(attackingPlayer, 'nominative');
 const blockerDeclined = declinePolishName(scoringPlayer, 'genitive');
 
 errorContext = `\nBLOK ERROR - WAZNE: ${attackerDeclined} (${attackingTeamName}) PRZEBIL.A BLOK ${blockerDeclined}!
Skomentuj ATAK ${attackerDeclined}, nie blad blokujacego!
Przyklad: "${attackerDeclined} przebija blok ${blockerDeclined}! Potezny atak!"`;
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

 const commentaryPrompt = `
AKCJA MECZOWA:
Rally #${rally.rally_number}
Zawodnik ktory wykonal ostatnia akcje: ${scoringPlayer} (${playerTeamName})
Akcja: ${scoringAction}
Wynik po akcji: ${score}
Punkt zdobyla: ${rally.team_scored}
PROWADZI: ${leadingTeamName}${touchContext}${situationContext}${errorContext}${substitutionContext}

${tacticsContext ? `WIEDZA TAKTYCZNA O AKCJI:\n${tacticsContext}\n\n` : ''}${commentaryExamplesContext ? `PRZYKLADY DOBRYCH KOMENTARZY:\n${commentaryExamplesContext}\n\n` : ''}${commentaryHintsContext ? `[!!] USER CORRECTIONS & HINTS (PRIORITY!):\n${commentaryHintsContext}\n\n` : ''}${namingRulesContext ? `NAMING RULES (PRIORITY!):\n${namingRulesContext}\n\n` : ''}${commentaryPhrasesContext ? `VARIACJE ZWROTOW:\n${commentaryPhrasesContext}\n\n` : ''}${setSummariesContext ? `SET-LEVEL STRATEGIC INSIGHTS:\n${setSummariesContext}\n\n` : ''}${toneRulesContext ? `TONE GUIDANCE:\n${toneRulesContext}\n\n` : ''}${playerContext ? `CHARAKTERYSTYKA ZAWODNIKA:\n${playerContext}` : ''}

INSTRUKCJE:
- ${setEndInfo.isSetEnd ? `TO JEST KONIEC SETA! MUSISZ TO POWIEDZIEC! Wynik koncowy: ${score}. Zwyciezca: ${setEndInfo.winner}.` : isFirstPoint ? 'PIERWSZY PUNKT! Uzyj: "Dobry poczatek [team]", "Udany start", "Pierwszy punkt na koncie [team]"' : isHotSituation ? 'KONCOWKA SETA - emocje!' : currentStreak >= 5 ? 'SERIA - podkresl momentum!' : milestone ? 'MILESTONE - wspomniej liczbe punktow/blokow/asow!' : isBigLead ? 'Duza przewaga - zauwaZ sytuacje' : isEarlySet ? 'Poczatek - spokojnie' : 'Srodek seta - rzeczowo'}
- ${attackingPlayer ? `To ATAK ${attackingPlayer} - pochwal ATAKUJACEGO, nie blad bloku! Uzyj formy: "${attackingPlayer} przebija blok ${declinePolishName(scoringPlayer, 'genitive')}!"` : ''}
- ${milestone ? `WAZNE: Wspomniej ze to ${milestone}!` : ''}${passInstructions}
- ${commentaryHintsContext ? 'APPLY USER HINTS - they have PRIORITY over other context!' : ''}
- Wynik ${score} - prowadzi ${leadingTeamName}
- ${isFirstPoint ? 'NIE uzywaj "zwieksza/zmniejsza przewage" - to PIERWSZY punkt!' : 'NIE mow "prowadzac" jesli druzyna juz prowadzila - powiedz "zwieksza/zmniejsza przewage"'}
- Uzywaj POPRAWNEJ odmiany nazwisk (Leon -> Leona w dopelniaczu)
- ${attackCombo ? `DANE TAKTYCZNE: Atak typu ${attackCombo}${attackLocation ? `, strefa: ${attackLocation}` : ''}${attackStyle ? `, styl: ${attackStyle}` : ''}. Uzyj tych danych by opisac KONKRETNIE co sie stalo (np. atak po skosie, atak pipe, szybki atak srodkiem) zamiast ogolnikow!` : serveType ? `DANE TAKTYCZNE: Zagrywka typu ${serveType}. Opisz ja konkretnie!` : ''}
- ${rally.substitutions?.length ? 'ZMIANA! Wplec ja naturalnie w komentarz - kto za kogo wchodzi, co to moze oznaczac (reakcja trenera, swieze sily, zmiana taktyki). To wazna informacja narracyjna!' : ''}
- 1-3 zdania max, konkretnie i energicznie!
`;

 
 // DEBUG: Check if naming rules are in prompt
 if (namingRulesContext) {
 console.log('[NAMING-IN-PROMPT] aoe... Naming rules WILL BE SENT to GPT:');
 console.log('[NAMING-IN-PROMPT] Content:', namingRulesContext.substring(0, 200) + '...');
 } else {
 console.log('[NAMING-IN-PROMPT] aOE NO naming rules in this prompt!');
 }
 
 console.log('Adeg,1/2A* Generating commentary...');

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
 max_tokens: 200,
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
 if (scoreDiff >= 5 && rally.team_scored === trailingTeam) {
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