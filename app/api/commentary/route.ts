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

 // ── PL ──────────────────────────────────────────────────────────────────
 pl: `Jestes doswiadczonym komentarorem meczow siatkarskich w Polsce — jak Tomasz Swędrowski lub Wojciech Drzyzga na zywo w radiu lub TV.

STYL PL — RADIO NA ZYWO:
- Prowadz narracje z EMOCJA proporcjonalna do sytuacji. Serve error = krotko i zwiezle. Koniec seta = wybuch emocji!
- UNIKAJ mechanicznych zwrotow: zamiast "zwieksza przewage" uzyj "odskoczy", "dokrecil srube", "nie odpuszcza". Zamiast "zmniejsza strate" uzyj "wraca do gry!", "nie daje sie!", "zapala iskre!".
- UNIKAJ "gra trwa" — uzyj "akcja trwa!", "wymiana!", "pilka zyje!", "nie daja sie!".
- Przeplataj krotkie zdania uderzajace z dluzszymi opisowymi. Czasem zacznij od akcji: "Mocna zagrywka!", "Swietna obrona!".
- Przynajmniej JEDNO zdanie z wykrzyknikiem na komentarz (chyba ze to blad serwisowy — wtedy wystarczy jedno krotkie).`,

 // ── EN ──────────────────────────────────────────────────────────────────
 en: `You are a professional volleyball commentator for Sky Sports / NBC Sports / ESPN. Comment in ENGLISH.

STYLE: Authoritative, precise, builds narrative. Think radio broadcast — paint the picture with words. Controlled excitement, analytical edge.

MANDATORY TERMINOLOGY:
- Atak = "kill" (winning) or "attack/spike" (general) — NEVER "attack" for ace
- Kiwka = "tip" or "roll shot" or "cut shot"
- Blok = "block" or "stuff block"
- Zagrywka = "serve" / "jump serve" / "float serve"
- As = "service ace" or "ace"
- Przyjęcie = "reception" or "pass" — poor = "shank" or "overpass"
- Rozgrywający = "setter" (Komenda is a SURNAME, never translate as "command")
- Gra trwa = "still in play!" or "keeps it alive!" — NEVER "the game continues"

SCORE FORMAT — CRITICAL: ALWAYS numerals with hyphen: "13-10". NEVER words: NOT "thirteen to ten".

SENTENCE STRUCTURE: Lead with action, name follows: "Clean kill from Szerszeń down the line!"
- Quick rallies: PUNCHY. "Ace! Right down the line. 5-3."
- Long rallies: BUILD NARRATIVE. Crescendo to the point.

NEVER: Polish grammatical endings (NO: "Bołądzia", "BOGDANKI") — always base form. Repeating "limiting the setter's options" more than twice per set.`,

 // ── IT ──────────────────────────────────────────────────────────────────
 it: `Sei un commentatore professionista di pallavolo — stile Rai Sport / Andrea Zorzi. Commenta in ITALIANO.

FILOSOFIA: Il commentatore italiano NON traduce, VIVE la partita! Ogni punto è teatro, emozione, spettacolo.

TERMINOLOGIA OBBLIGATORIA:
- Atak = "schiacciata" (potente) o "attacco" (generico)
- Kiwka = "pallonetto" — MAI "finta"
- Blok = "muro" (esclamazione: MURO!)
- Zagrywka = "battuta" o "servizio"
- As = "ace" o "punto diretto in battuta"
- Przyjęcie = "ricezione" — słabe = "ricezione staccata da rete"
- Rozgrywający = "regista" o "palleggiatore" (Komenda è un COGNOME, MAI tradurre!)
- Gra trwa = "la palla è ancora in gioco!" o "si continua!" — MAI "il gioco continua"

STRUTTURA: [Emozione] [cosa è successo] [chi] → "CHE ATTACCO! Schiacciata vincente di Szerszeń!"
- Azioni rapide: BREVI. "Ace di Bieniek! Punto!"
- Scambi lunghi: CRESCENDO.

MAI: Desinenze polacche (NO: "Bołądzia", "BOGDANKI"). "peccato" più di 2 volte per set — varia con "fuori!", "nella rete!", "errore!". "Hoss" — questo giocatore si chiama THALES.`,

 // ── DE ──────────────────────────────────────────────────────────────────
 de: `Du bist ein professioneller Volleyball-Kommentator — Stil Sport1 / ZDF / Eurosport Deutschland. Kommentiere auf DEUTSCH.

PHILOSOPHIE: Präzise, analytisch, professionell. Emotionen sind kontrolliert — aber bei Schlüsselmomenten darf echte Begeisterung durchkommen.

PFLICHTTERMINOLOGIE:
- Atak = "Angriff" oder "Schmetterschlag"
- Kiwka = "Fingerball" oder "Tip"
- Blok = "Block" — Blockpunkt = "Blockpunkt"
- Zagrywka = "Aufschlag" / "Sprungaufschlag" / "Floateraufschlag"
- As = "Aufschlag-Ass" oder "direkter Punkt"
- Przyjęcie = "Annahme" — schlecht = "Annahme geht weit vom Netz weg"
- Rozgrywający = "Zuspieler" (Komenda ist ein EIGENNAME, NIE als Verb übersetzen!)
- Gra trwa = "der Ball ist noch im Spiel!" — NIEMALS "das Spiel geht weiter"

SATZSTRUKTUR: Verb an zweiter Stelle: "Mit einem wuchtigen Angriff eröffnet Szerszeń die Aktion — und trifft!"
- Schnelle Aktionen: KURZ. "Aufschlagfehler — Punkt für Zawiercie."
- Lange Ballwechsel: AUFBAUEND.

NIEMALS: Polnische Wortendungen (NICHT: "Bołądzia", "BOGDANKI"). "schränkt die Optionen des Zuspielers" mehr als zweimal pro Satz.`,

 // ── TR ──────────────────────────────────────────────────────────────────
 tr: `Sen profesyonel bir voleybol yorumcususun — TRT Spor / BeIN Sports tarzı. TÜRKÇE yorum yap.

FELSEFESİ: Türk yorumcu DUYGULARLA ANLATIR. Yüksek enerji, kısa ve güçlü cümleler.

ZORUNLU TERMİNOLOJİ:
- Atak = "hücum" veya "smaç"
- Kiwka = "kısa top" veya "parmak vuruşu"
- Blok = "blok"
- Zagrywka = "servis" / "sıçrama servisi" / "float servis"
- As = "as servis" veya "direkt sayı"
- Przyjęcie = "kabul" — kötü = "top fileden uzaklaşıyor"
- Rozgrywający = "pasör" (Komenda bir ÖZEL İSİM, "komuta/emir" olarak çevirme!)
- Gra trwa = "top hâlâ oyunda!" — ASLA "oyun devam ediyor"

CÜMLE YAPISI: Fiil sonda: "Szerszeń bloğu yarıyor ve SAYIII!"
- Hızlı aksiyonlar: KISA. "Servis hatası — Zawiercie'nin sayısı."

ASLA: Lehçe çekim ekleri (HAYIR: "Bołądzia", "BOGDANKI"). "seçeneklerini kısıtlıyor" 3+ kez tekrarlama.`,

 // ── ES ──────────────────────────────────────────────────────────────────
 es: `Eres un comentarista profesional de voleibol — estilo Movistar+ / DMAX España. Comenta en ESPAÑOL.

FILOSOFÍA: El comentarista español NO traduce, ¡NARRA la emoción! Ritmo musical, dramatismo natural.

TERMINOLOGÍA OBLIGATORIA:
- Atak = "remate" (potente) o "ataque" (genérico)
- Kiwka = "finta" o "dejada" o "toque suave"
- Blok = "bloqueo" o "muro" (¡MURO como exclamación!)
- Zagrywka = "saque" / "saque de salto" / "saque flotante"
- As = "ace" o "saque directo"
- Przyjęcie = "recepción" — mala = "recepción fallida"
- Rozgrywający = "colocador" o "armador" (Komenda es un APELLIDO, ¡nunca traducir!)
- Gra trwa = "¡el balón sigue vivo!" — NUNCA "el juego continúa"

ESTRUCTURA: [Emoción] [qué pasó] [quién] → "¡QUÉ REMATE! ¡Szerszeń por la diagonal!"
- Jugadas rápidas: BREVES. "¡Ace de Bieniek! ¡Punto!"
- Jugadas largas: CRESCENDO.

NUNCA: Desinencias polacas (NO: "Bołądzia", "BOGDANKI"). "limita las opciones del colocador" más de dos veces por set.`,

 // ── PT ──────────────────────────────────────────────────────────────────
 pt: `Você é um comentarista profissional de vôlei — estilo Globo / SporTV Brasil. Comente em PORTUGUÊS BRASILEIRO.

FILOSOFIA: O comentarista brasileiro NARRA COM O CORAÇÃO! PT-BR autêntico — não tradução.

TERMINOLOGIA OBRIGATÓRIA:
- Atak = "ataque" ou "cortada"
- Kiwka = "toque curto" ou "tchau-tchau"
- Blok = "bloqueio"
- Zagrywka = "saque" / "saque em salto" / "saque flutuante"
- As = "ace!" ou "ponto direto no saque!"
- Przyjęcie = "recepção" — ruim = "recepção saiu longe da rede"
- Rozgrywający = "levantador" (Komenda é um SOBRENOME masculino, nunca traduzir!)
- Gra trwa = "a bola ainda está em jogo!" — NUNCA "o jogo continua"

ESTRUTURA: Verbo de ação + nome: "SZERSZEŃ MANDA VER! Que cortada pelo meio!"
- Lances rápidos: CURTOS. "Ace de Bieniek! Ponto!"
- Interjeições naturais: "Eita!", "Caramba!", "Nossa!"

NUNCA: "Che" em exclamações — em português é sempre "Que": "Que ace!", "Que cortada!". Desinências polacas (NÃO: "Bołądzia", "BOGDANKI").`,

 // ── JP ──────────────────────────────────────────────────────────────────
 jp: `あなたはプロのバレーボール実況アナウンサーです — NHK・フジテレビ・テレビ朝日スタイル。日本語でコメントしてください。

スタイル：品格と熱量を兼ね備えた実況。正確な情報と独特の感嘆詞を組み合わせ、視聴者を試合に引き込む。

必須用語：
- Atak = 「スパイク」（強打）または「アタック」
- Kiwka = 「フェイント」または「ショートボール」
- Blok = 「ブロック」— ブロックポイント = 「シャットアウト！」
- Zagrywka = 「サーブ」/「ジャンプサーブ」/「フローターサーブ」
- As = 「サービスエース！」
- Przyjęcie = 「レシーブ」— 悪い = 「レシーブが乱れる」
- Rozgrywający = 「セッター」（コメンダは選手名、「命令」と翻訳しない！）
- Gra trwa = 「まだ続きます！」— 「ゲームが続く」は不自然

カタカナ表記：Leon=レオン、Bołądź=ボワンジ、Grozdanov=グロズダノフ、Komenda=コメンダ、Tavares=タバレス
Hoss選手はTHALES（サレス）— 常に「サレス」を使うこと

文構造：感嘆 + 動作 + 結果：「素晴らしいスパイク！シェルシェニがブロックを打ち抜きました！」
- 短い動作：「サービスエース！ザヴィエルチェに点が入ります。」
- 長いラリー：「一本目…二本目…三本目！まだ続きます！決まったー！」

絶対禁止：
- コメントを「」で囲むこと — 絶対に使わない
- 「選択肢が限られ」を3回以上繰り返すこと
- ポーランド語の語尾変化を持ち込むこと`,

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

⚠️ ABSOLUTE LANGUAGE RULE: Write 100% in the language above. Context data may contain Polish technical words — TRANSLATE them ALL:
- "zagrywka z wyskoku" → IT:"servizio in salto" / ES:"saque en salto" / TR:"sıçrama servisi" / DE:"Sprungaufschlag" / JP:"ジャンプサーブ"
- "przyjęcie" → IT:"ricezione" / ES:"recepción" / TR:"kabul" / DE:"Annahme" / JP:"レセプション"
- "potężny" → IT:"potente" / ES:"potente" / TR:"güçlü" / DE:"kraftvoll" / JP:"強力な"
- "punkt dla" → IT:"punto per" / ES:"punto para" / TR:"sayı" / DE:"Punkt für" / JP:"ポイント"
Player surnames stay as-is. NEVER copy Polish words verbatim.

Your task is to generate professional, factual volleyball match commentary in RADIO STYLE.

RADIO STYLE MEANS:
- You receive a PRZEBIEG AKCJI (touch chain) - describe EXACTLY what happened step by step
- Follow the EXACT order of touches. Do NOT rearrange, skip, or invent actions.
- If the data says "zagrywka" (without "BLAD"), the serve was GOOD - do NOT say it was an error!
- If data says "blok PRZEBITY", the BLOCKER lost - the attacker beat them. Do NOT say the blocker broke through.
- The LAST touch in the chain determines the point. Do NOT add extra actions after it.
- FOCUS ON CLIMAX: Lead with who scored and how. Earlier touches = brief context only, NOT play-by-play.
- 1-2 touches (ace/serve error) = max 1 sentence. 3-5 touches = 1-2 sentences. 6+ touches = max 3 sentences with climax at end.

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

SCORE ACCURACY — KRYTYCZNE:
- ALWAYS use SCORE SITUATION and WHO LEADS from the prompt — they tell you EXACTLY what happened
- NIGDY nie wymyslaj wlasnej interpretacji wyniku
- If SCORE SITUATION says team is trailing — do NOT say that team is "leading" or "maintaining advantage"!
- If WHO LEADS says "[team] LEADS" — that team IS leading, not the other way around!
- NIGDY nie wymyslaj konkretnego wyniku liczbowego (np. "9:9") — wynik jest widoczny w UI
- Uzywaj ogolnych zwrotow: "prowadza", "wyrownuja", "zmniejszaja strate", "odskoczyly"
- EXCEPTION: at set end, mention the final score explicitly

NAMING — KRYTYCZNE:
- Uzywaj nazwisk z PRZEBIEGU AKCJI jako podstawe. Mozesz uzyc IMIENIA jesli masz je z CHARAKTERYSTYKI ZAWODNIKA lub NAMING RULES ponizej.
- NIGDY nie WYMYSLAJ imion od siebie! Jesli nie masz danych o imieniu gracza — uzywaj TYLKO nazwiska.
- DOBRZE: "Demyanenko" (samo nazwisko) lub "Danny Demyanenko" (jesli RAG potwierdza imie)
- ZLE: "Konrad Stankowski" (wymyslony gracz), "Roberto Toniutti" (zgadywane imie)
- Od czasu do czasu uzyj kombinacji imie+nazwisko dla urozmaicenia (jesli masz dane!)

ANTI-REDUNDANCY:
- NEVER repeat what is obvious from the action itself
- Serve error = brief mention of the error — do NOT add "ball out", "end of action", "point for rivals" etc.
- Attack error = just say "blad w ataku" — do NOT explain what error means
- Block point = just describe the block — do NOT say "koniec akcji"
- NEVER mention the exact score in commentary — it is shown in the UI. EXCEPTION: at set end, always state the final score.
- NEVER say the exact score number in commentary — use general phrases like "leads", "equalizes", "pulling away"
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
3. Announce SET OVER in your target language (e.g. IT: "SET!", DE: "SATZGEWINN!", TR: "SET BITTI!", ES: "¡SET!", PT: "SET!", JP: "セット終了!")
4. Mention if it was close/dramatic ending

EXAMPLES:
- IT: "Ace di McCarthy! SET per JSW 25:22! Vittoria netta!"
- ES: "¡Bloqueo de Grozdanov! ¡SET para los locales 25:23! ¡Qué final de set!"
- PT: "Ace de McCarthy! SET para JSW 25:22! Vitória convincente!"
- JP: "マッカーシーのサービスエース！セット終了、25対22！"
- DE: "Ass von McCarthy! SATZGEWINN für JSW 25:22!"
- TR: "McCarthy'den servis ace! SET JSW'nin, 25-22!"

NEVER use Polish "KONIEC SETA" — always use target language!`;
 }

if (isHotSituation) {
 return basePrompt + `
- ZONE HOT (20+)! Pelna petarda — kazdy punkt to dramat!
- Maksymalna emocja, krotkie i mocne zdania. Czas na kulminacje narracji.
- Jesli byl watek narracyjny (dominujacy zawodnik, seria) — teraz jest moment by go zamknac lub podkreslic.

EXAMPLES (Polish):
- "BUTRYN! W koncowce seta to on bierze sprawy w swoje rece!"
- "McCarthy as w kluczowym momencie! Nerwy ze stali — mistrzowski serwis!"
- "Blok Grozdanova! Juz piatym blokiem zamyka rywala! To moze byc punkt przelomowy!"
- "Nikt nie ustepuje! Kazde dotkniecie pilki to oddzielna historia!"`;
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
- "Point for gosci, ale wciaz spory dystans - 8:18."`;
 } else if (isEarlySet) {
 return basePrompt + `
- ZONE CALM (wynik do 8): Spokojny, rzeczowy start. Zero dramy, zero oceniania.
- Krotkie zdania, sam fakt. Budujemy atmosfere powoli.

EXAMPLES (Polish):
- "Grozdanov skuteczny w bloku. Dobry poczatek."
- "Serve error McCarthy. Point for rywali."
- "Sasak konczy atak. Goscie obejmuja prowadzenie."`;
 } else {
 return basePrompt + `
- ZONE MID (9-19): Rosnie napiecie. Rzeczowy ale z energia. Akcent na taktykę i walkę.
- Mozesz wspomniec wątek narracyjny jesli pojawia sie w danych (kto dominuje, mini-seria).

EXAMPLES (Polish):
- "Grozdanov znow przy siatce! Juz trzeci blok w tym secie!"
- "McCarthy celny w zagrywce — rosnie przewaga gospodarzy."
- "Sasak przebija blok po przekatnej! Walka trwa."
- "Kwolek z kontra! Goscie nie oddaja pola."`;
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
 phase?: string;
 homeRotation?: number;
 awayRotation?: number;
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
 playerPositions?: Record<string, string>;
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
 try {
 const { rally, language = 'pl', playerStats = {}, recentRallies = [], rallyAnalysis, homeTeamFullName = 'Gospodarze', awayTeamFullName = 'Goscie', playerPositions = {} }: CommentaryRequest = await request.json();

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
 // Problem: "Serve error Tavaresa" when it was McCarthy
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
 
 // OPCJA D: Strefy napięcia — na podstawie max wyniku w secie
  const maxScore = Math.max(finalScore.home, finalScore.away);
  const isEarlySet = maxScore <= 8;           // ZONE CALM: spokojny start, zero dramy
  const isHotSituation = maxScore >= 20 && !setEndInfo.isSetEnd;  // ZONE HOT: pełna petarda

  // WĄTEK NARRACYJNY: kto dominuje w ostatnich akcjach?
  let setNarrativeContext = '';
  if (recentRallies.length >= 5) {
    const dominantPlayer: Record<string, number> = {};
    recentRallies.slice(-8).forEach(r => {
      const lastTouch = r.touches?.[r.touches.length - 1];
      if (lastTouch?.player) {
        dominantPlayer[lastTouch.player] = (dominantPlayer[lastTouch.player] || 0) + 1;
      }
    });
    const topPlayer = Object.entries(dominantPlayer).sort(([,a],[,b]) => b - a)[0];
    if (topPlayer && topPlayer[1] >= 3) {
      setNarrativeContext = `\nNARRATIVE THREAD: ${topPlayer[0]} is dominant — ${topPlayer[1]} of last ${Math.min(recentRallies.length, 8)} points. Mention naturally if it fits.`;
    }
  }
 
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
 let brokenStreak = 0;
 let brokenStreakTeam = '';
 let momentumContext = '';
 
 if (recentRallies.length >= 2) {
 // Count current streak from end
 const lastTeam = recentRallies[recentRallies.length - 1]?.team_scored;
 let streak = 0;
 for (let i = recentRallies.length - 1; i >= 0; i--) {
   if (recentRallies[i].team_scored === lastTeam) {
     streak++;
   } else {
     break;
   }
 }
 
 if (streak >= 3) {
   currentStreak = streak;
   streakTeam = lastTeam;
 }
 
 // Detect BROKEN streak (opponent had 3+ but this point broke it)
 if (streak === 1 && recentRallies.length >= 4) {
   const prevTeam = recentRallies[recentRallies.length - 2]?.team_scored;
   let prevStreak = 0;
   for (let i = recentRallies.length - 2; i >= 0; i--) {
     if (recentRallies[i].team_scored === prevTeam) {
       prevStreak++;
     } else {
       break;
     }
   }
   if (prevStreak >= 3) {
     brokenStreak = prevStreak;
     brokenStreakTeam = prevTeam;
   }
 }
 
 // Scoring pattern last 6 rallies (e.g. "4-2 run for home")
 if (recentRallies.length >= 6) {
   const last6 = recentRallies.slice(-6);
   const homePoints = last6.filter(r => r.team_scored === 'home').length;
   const awayPoints = last6.filter(r => r.team_scored === 'away').length;
   if (homePoints >= 5) {
     momentumContext = `MOMENTUM: Home team dominating - ${homePoints}:${awayPoints} in last 6 rallies!`;
   } else if (awayPoints >= 5) {
     momentumContext = `MOMENTUM: Away team dominating - ${awayPoints}:${homePoints} in last 6 rallies!`;
   }
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
 const otherTeamName = rally.team_scored === 'home' ? awayTeamFull : homeTeamFull;
 
 // Key: is the scoring team now LEADING or TRAILING?
 const scoringTeamScore = rally.team_scored === 'home' ? finalScore.home : finalScore.away;
 const otherTeamScore = rally.team_scored === 'home' ? finalScore.away : finalScore.home;
 const scoringTeamLeads = scoringTeamScore > otherTeamScore;
 const scoringTeamTrails = scoringTeamScore < otherTeamScore;
 
 // Score string needed for situation context (main `const score` is defined later but we need it here)
 const scoreDisplay = `${finalScore.home}:${finalScore.away}`;
 
 let scoreSituation = '';
 if (isFirstPoint) {
   scoreSituation = `FIRST POINT of set for ${scoringTeamName}. Score: ${scoreDisplay}.`;
 } else if (isTied) {
   scoreSituation = `TIED ${scoreDisplay}! ${scoringTeamName} equalizes.`;
 } else if (wasTiedBefore && !isTied) {
   scoreSituation = `${scoringTeamName} TAKES THE LEAD ${scoreDisplay}.`;
 } else if (scoringTeamLeads && scoreDiff >= 2) {
   scoreSituation = `${scoringTeamName} scores, leads by ${scoreDiff}. Score: ${scoreDisplay}.`;
 } else if (scoringTeamLeads && scoreDiff === 1) {
   scoreSituation = `${scoringTeamName} leads by 1. Score: ${scoreDisplay}.`;
 } else if (scoringTeamTrails) {
   scoreSituation = `${scoringTeamName} scores. Score: ${scoreDisplay}. ${otherTeamName} still leads by ${scoreDiff}.`;
 } else {
   scoreSituation = `Score: ${scoreDisplay}. Point for ${scoringTeamName}.`;
 }
 
 // EXPLICIT who leads — GPT must not invent its own interpretation
 const leadInfo = isTied ? 'TIED'
   : `${leadingTeam} LEADS ${scoreDisplay}`;

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
 // STEP 4.9: RAG DEBUG COLLECTOR
 // ========================================================================
 const ragDebug: Array<{
   namespace: string;
   query: string;
   topScore: number;
   retrieved: number;
   used: boolean;
   preview: string;
 }> = [];

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
 
 // FIX: scoringAction is in Polish - check both Polish AND English terms
 if (actionType.includes('block') || actionType.includes('blok')) {
   tacticsQuery = `block blok ${rallyAttackCombo} ${rallyAttackLocation}`.trim();
 } else if (actionType.includes('attack') || actionType.includes('kill') || actionType.includes('atak')) {
   tacticsQuery = `attack atak ${rallyAttackCombo} ${rallyAttackLocation}`.trim();
 } else if (actionType.includes('ace') || actionType.includes('serve') || actionType.includes('serwis') || actionType.includes('zagrywka')) {
   tacticsQuery = `serve zagrywka ${rallyServeType}`.trim();
 } else if (actionType.includes('dig') || actionType.includes('defense') || actionType.includes('obrona')) {
   tacticsQuery = `defense obrona dig ${rallyAttackCombo}`.trim();
 } else if (actionType.includes('przyjeci') || actionType.includes('receive') || actionType.includes('pass')) {
   tacticsQuery = `reception przyjecie ${rallyServeType}`.trim();
 }
 // Fallback: always query tactical-knowledge with generic context
 if (!tacticsQuery) {
   tacticsQuery = `volleyball taktyka akcja ${scoringAction}`.trim();
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
 ragDebug.push({
   namespace: 'tactical-knowledge',
   query: tacticsQuery,
   topScore: tacticsResults.matches[0]?.score || 0,
   retrieved: tacticsResults.matches.length,
   used: tacticsContext.length > 0,
   preview: tacticsContext.substring(0, 120),
 });
 } catch (error) {
 console.error('Tactics error:', error);
 ragDebug.push({ namespace: 'tactical-knowledge', query: tacticsQuery, topScore: 0, retrieved: 0, used: false, preview: 'ERROR' });
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
 .filter((match) => (match.score || 0) > 0.30)
 .map((match) => {
   // FIX: try all possible metadata keys
   return match.metadata?.commentary ||
     match.metadata?.betterCommentary ||
     match.metadata?.better_commentary ||
     match.metadata?.content ||
     match.metadata?.text ||
     match.metadata?.text_preview ||
     match.metadata?.example ||
     '';
 })
 .filter(Boolean)
 .join('\n')
 .substring(0, 300);
 console.log('Commentary examples found:', commentaryExamplesContext.substring(0, 80) + '...');
 console.log('[RAG-DEBUG] Examples scores:', examplesResults.matches.map(m => m.score?.toFixed(3)).join(', '));
 }
 ragDebug.push({
   namespace: 'commentary-examples',
   query: commentaryQuery,
   topScore: examplesResults.matches[0]?.score || 0,
   retrieved: examplesResults.matches.length,
   used: commentaryExamplesContext.length > 0,
   preview: commentaryExamplesContext.substring(0, 120),
 });
 } catch (error) {
 console.error('Commentary examples error:', error);
 ragDebug.push({ namespace: 'commentary-examples', query: commentaryQuery, topScore: 0, retrieved: 0, used: false, preview: 'ERROR' });
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
 // FIX: raised threshold from 0.3 to 0.5 to avoid random hint matches
 const HINTS_THRESHOLD = 0.5;
 const relevantHints = hintsResults.matches
 .filter(match => (match.score || 0) > HINTS_THRESHOLD)
 .map((match) => match.metadata?.betterCommentary || match.metadata?.content || match.metadata?.text || '')
 .filter(Boolean);
 
 if (relevantHints.length > 0) {
 commentaryHintsContext = relevantHints.join('\n').substring(0, 600);
 console.log('Commentary hints found:', commentaryHintsContext.substring(0, 150) + '...');
 console.log('Hints scores:', hintsResults.matches.map(m => m.score?.toFixed(3)));
 ragDebug.push({ namespace: 'commentary-hints', query: hintsQuery, topScore: hintsResults.matches[0]?.score || 0, retrieved: hintsResults.matches.length, used: true, preview: commentaryHintsContext.substring(0, 120) });
 } else {
 console.log(`No relevant hints (all scores < ${HINTS_THRESHOLD})`);
 ragDebug.push({ namespace: 'commentary-hints', query: hintsQuery, topScore: hintsResults.matches[0]?.score || 0, retrieved: hintsResults.matches.length, used: false, preview: `all scores < ${HINTS_THRESHOLD} (top: ${hintsResults.matches[0]?.score?.toFixed(3)})` });
 }
 } else {
 console.log('No commentary hints found for this query');
 ragDebug.push({ namespace: 'commentary-hints', query: hintsQuery, topScore: 0, retrieved: 0, used: false, preview: 'no matches' });
 }
 } catch (error) {
 console.error('Commentary hints error:', error);
 ragDebug.push({ namespace: 'commentary-hints', query: hintsQuery, topScore: 0, retrieved: 0, used: false, preview: 'ERROR' });
 }

 // ========================================================================
 // NEW NAMESPACES - NAMING RULES, PHRASES, TONE
 // ========================================================================

 // ========================================================================
 // NAMING RULES (preferred names, declensions per language)
 // ========================================================================

 let namingRulesContext = '';
    
    // GPT fallback for name declensions when RAG has no rules
    // NOTE: Parser now normalizes names (Leon Venero → Leon, Tavares Rodrigues → Tavares)
    // These fallbacks catch edge cases where RAG naming-rules namespace has no match
    const getGPTNamingFallback = (player: string): string => {
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
 ragDebug.push({
   namespace: 'naming-rules',
   query: namingResults.matches[0] ? `${scoringPlayer} naming rule declension odmiana` : '',
   topScore: namingResults.matches[0]?.score || 0,
   retrieved: namingResults.matches.length,
   used: namingRulesContext.length > 0,
   preview: namingRulesContext.substring(0, 120),
 });
 }
 } catch (error) {
 console.log('Naming rules namespace not yet populated');
 ragDebug.push({ namespace: 'naming-rules', query: `${scoringPlayer} naming rule`, topScore: 0, retrieved: 0, used: false, preview: 'namespace empty/error' });
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
 ragDebug.push({
   namespace: 'commentary-phrases',
   query: phrasesQuery,
   topScore: phrasesResults.matches[0]?.score || 0,
   retrieved: phrasesResults.matches.length,
   used: commentaryPhrasesContext.length > 0,
   preview: commentaryPhrasesContext.substring(0, 120),
 });
 }
 }
 } catch (error) {
 console.log('Commentary phrases namespace not yet populated');
 ragDebug.push({ namespace: 'commentary-phrases', query: '', topScore: 0, retrieved: 0, used: false, preview: 'namespace empty/error' });
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
 currentStreak >= 3 ? `streak ${currentStreak} points series` : '',
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
 ragDebug.push({
   namespace: 'tone-rules',
   query: toneQuery,
   topScore: toneResults.matches[0]?.score || 0,
   retrieved: toneResults.matches.length,
   used: toneRulesContext.length > 0,
   preview: toneRulesContext.substring(0, 120),
 });
 }
 } catch (error) {
 console.log('i, Tone rules namespace not yet populated');
 ragDebug.push({ namespace: 'tone-rules', query: '', topScore: 0, retrieved: 0, used: false, preview: 'ERROR' });
 }

 // ========================================================================
 // STEP 6: RAG QUERY - PLAYER INFO
 // ========================================================================
 
 // FIX B+: use position + team name to disambiguate player profiles
 const playerPosition = playerPositions[scoringPlayer] || '';
 const playerTeamShort = playerTeamName.split(' ').slice(0, 2).join(' '); // FIX: use player's OWN team, not scoring team
 const searchQuery = [scoringPlayer, playerPosition, playerTeamShort, 'profil zawodnik charakterystyka']
   .filter(Boolean).join(' ');
 console.log('[PLAYER-PROFILE-QUERY]', searchQuery);
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
 // FIX: filter by score > 0.5 to avoid wrong player profiles being returned
 const PROFILE_THRESHOLD = 0.5;
 const goodProfileMatches = searchResults.matches.filter(m => (m.score || 0) > PROFILE_THRESHOLD);
 if (goodProfileMatches.length > 0) {
 playerContext = goodProfileMatches
 .map((match) => match.metadata?.content || match.metadata?.text || '')
 .filter(Boolean)
 .join('\n\n');
 console.log('Player context found:', playerContext.substring(0, 200) + '...');
 ragDebug.push({
   namespace: 'player-profiles',
   query: searchQuery,
   topScore: searchResults.matches[0]?.score || 0,
   retrieved: searchResults.matches.length,
   used: playerContext.length > 0,
   preview: playerContext.substring(0, 120),
 });
 } else {
 console.log(`player-profiles: all scores < ${PROFILE_THRESHOLD} (top: ${searchResults.matches[0]?.score?.toFixed(3) || 'none'}) → fallback`);
 console.log('No RAG context in player-profiles, trying expert-knowledge...');
 ragDebug.push({ namespace: 'player-profiles', query: searchQuery, topScore: searchResults.matches[0]?.score || 0, retrieved: searchResults.matches.length, used: false, preview: `scores < ${PROFILE_THRESHOLD} → fallback to expert-knowledge` });
 
 // Fallback: query expert-knowledge namespace
 // FIX: player-focused query + higher threshold + filter out rulebook content
 const expertQuery = `${scoringPlayer} zawodnik profil charakterystyka styl gry`;
 try {
   const expertEmbedding = await openai.embeddings.create({
     model: 'text-embedding-3-small',
     input: expertQuery,
     dimensions: 768,
   });
   const expertResults = await index.namespace('expert-knowledge').query({
     vector: expertEmbedding.data[0].embedding,
     topK: 3,
     includeMetadata: true,
   });
   
   const EXPERT_THRESHOLD = 0.5;
   const RULEBOOK_KEYWORDS = ['12.6', '12.7', 'przepis', 'regulamin', 'sędzia', 'FIVB', 'art.', 'punkt zasad', 'błędy po uderzeniu'];
   
   if (expertResults.matches && expertResults.matches.length > 0) {
     const expertContext = expertResults.matches
       .filter(m => (m.score || 0) > EXPERT_THRESHOLD)
       .map((match) => match.metadata?.content || match.metadata?.text || '')
       .filter(Boolean)
       .filter(text => !RULEBOOK_KEYWORDS.some(kw => text.includes(kw)))
       .join('\n\n');
     if (expertContext) {
       playerContext = expertContext;
       console.log('[EXPERT-KNOWLEDGE] Found player context:', playerContext.substring(0, 200) + '...');
       ragDebug.push({ namespace: 'expert-knowledge', query: expertQuery, topScore: expertResults.matches[0]?.score || 0, retrieved: expertResults.matches.length, used: true, preview: playerContext.substring(0, 120) });
     } else {
       console.log('[EXPERT-KNOWLEDGE] No useful content (low score or rulebook filtered)');
       ragDebug.push({ namespace: 'expert-knowledge', query: expertQuery, topScore: expertResults.matches[0]?.score || 0, retrieved: expertResults.matches.length, used: false, preview: `scores < ${EXPERT_THRESHOLD} or rulebook filtered` });
     }
   }
 } catch (err) {
   console.log('expert-knowledge namespace error:', err);
   ragDebug.push({ namespace: 'expert-knowledge', query: expertQuery, topScore: 0, retrieved: 0, used: false, preview: 'ERROR' });
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
     const serveDesc = sType.includes('Float') ? 'float serve' : sType.includes('Spin') ? 'jump serve' : 'serve';
     const isLastTouch = idx === rally.touches!.length - 1;
     
     if (actionLower.includes('as ') || actionLower.includes('ace')) {
       desc += ` - ${serveDesc} >>> ACE! Direct point!`;
     } else if ((actionLower.includes('blad') || actionLower.includes('error')) && isLastTouch) {
       desc += ` - ${serveDesc} >>> SERVE ERROR`;
     } else {
       desc += ` - ${serveDesc}`;
     }
   // RECEIVE
   } else if (actionLower.includes('przyjecie') || actionLower.includes('pass') || actionLower.includes('receive')) {
     if (actionLower.includes('perfect')) desc += ' - perfect reception';
     else if (actionLower.includes('positive')) desc += ' - good reception';
     else if (actionLower.includes('negative') || actionLower.includes('poor')) {
       const poorVariants = [
         ' - imprecise reception',
         ' - difficult reception',
         ' - reception far from setter zone',
         ' - poor reception',
         ' - forced reception',
         ' - weak reception',
         ' - reception out of system',
       ];
       desc += poorVariants[Math.floor(Math.random() * poorVariants.length)];
     }
     else desc += ' - reception';
   // SET
   } else if (actionLower.includes('rozegranie') || actionLower.includes('setting') || actionLower === 'set') {
     const combo = touch.attackCombination || '';
     const loc = touch.attackLocation || '';
     let setDesc = 'sets the ball';
     if (loc.includes('Left')) setDesc = 'sets left';
     else if (loc.includes('Right')) setDesc = 'sets right';
     else if (loc.includes('Middle') || combo.includes('K1') || combo.includes('K2') || combo.includes('K7')) setDesc = 'quick set middle';
     else if (combo.toLowerCase().includes('pipe')) setDesc = 'sets pipe';
     desc += ` - ${setDesc}`;
   // ATTACK
   } else if (actionLower.includes('atak') || actionLower.includes('attack')) {
     const loc = touch.attackLocation || '';
     const style = touch.attackStyle || '';
     const combo = touch.attackCombination || '';
     
     const isBackRow = loc.includes('Back') || loc.toLowerCase().includes('pipe') || combo.toLowerCase().includes('pipe');
     
     let atkDesc = 'attack';
     if (loc.toLowerCase() === 'pipe') atkDesc = 'pipe back-row attack';
     else if (loc.includes('Left') && loc.includes('Back')) atkDesc = 'back-row attack from left';
     else if (loc.includes('Left')) atkDesc = 'attack from left';
     else if (loc.includes('Right') && loc.includes('Back')) atkDesc = 'back-row attack from right';
     else if (loc.includes('Right')) atkDesc = 'attack from right';
     else if (loc.includes('Middle')) atkDesc = 'quick attack first tempo';
     else if (combo.toLowerCase().includes('pipe')) atkDesc = 'pipe back-row attack';
     else if (isBackRow) atkDesc = 'back-row attack';
     else atkDesc = 'attack';
     
     if (style === 'Tip') atkDesc += ', tip shot';
     else if (style === 'Tool') atkDesc += ', tool off block';
     
     const isLastTouch = idx === rally.touches!.length - 1;
     
     if (actionLower.includes('blad') || actionLower.includes('error')) {
       if (isLastTouch) {
         desc += ` - ${atkDesc} >>> ATTACK ERROR`;
       } else {
         desc += ` - ${atkDesc} (failed, play continues)`;
       }
     } else if (actionLower.includes('zablok') || actionLower.includes('block')) {
       if (isLastTouch) {
         desc += ` - ${atkDesc} >>> BLOCKED`;
       } else {
         desc += ` - ${atkDesc} (blocked, play continues)`;
       }
     } else if (isLastTouch) {
       desc += ` - ${atkDesc} >>> POINT!`;
     } else {
       desc += ` - ${atkDesc} (defended, play continues)`;
     }
   // BLOCK
   } else if (actionLower.includes('blok') || actionLower.includes('block')) {
     const isLastTouch = idx === rally.touches!.length - 1;
     if (actionLower.includes('przebity') || actionLower.includes('error') || actionLower.includes('fail')) {
       const blockSynonyms = [
         ' - block attempt failed, attacker won the point',
         ' - attacker beat the block',
         ' - found a gap in the block',
         ' - block touched, ball into the court',
         ' - late block, attacker scores',
       ];
       desc += blockSynonyms[Math.floor(Math.random() * blockSynonyms.length)];
     } else if (isLastTouch) {
       desc += ' - BLOCK POINT!';
     } else {
       desc += ' - block (ball in play)';
     }
   // DIG
   } else if (actionLower.includes('obrona') || actionLower.includes('dig')) {
     desc += ' - defensive dig';
   // FREE
   } else if (actionLower.includes('wolna') || actionLower.includes('free')) {
     desc += ' - free ball';
   } else {
     desc += ` - ${action}`;
   }
   
   touchChainLines.push(desc);
 });

 const winnerTeamLabel = rally.team_scored === 'home' ? homeTeamFull : awayTeamFull;

 
 touchContext = `
TOUCH CHAIN (${numTouches} touches${isLongRally ? ' - LONG RALLY!' : ''}):
${touchChainLines.join('\n')}
=> POINT FOR: ${winnerTeamLabel}

CRITICAL COMMENTARY RULES:
1. Describe ONLY what is in the touch chain above. Nothing else!
2. CLIMAX FIRST — describe who scored and how. Earlier touches = brief context only.
3. SERVE: Error only when ">>> SERVE ERROR" is written. Otherwise the serve was good and play continues.
4. BLOCK: "attacker beat the block" = ATTACKER scored. Do NOT describe the blocker as the scorer.
5. If serve is good → reception follows logically. If serve error → rally ends there.
6. 2-3 touches = 1 short sentence. 5+ touches = fuller description.`;
 }
 
 let situationContext = '';
 if (setEndInfo.isSetEnd) {
 situationContext += `\nSET OVER! Final score: ${score}. Winner: ${setEndInfo.winner}. YOU MUST ANNOUNCE THE SET IS OVER!`;
 }
 if (currentStreak >= 5) {
 situationContext += `\nMOMENTUM: ${streakTeam === 'home' ? homeTeamFull : awayTeamFull} on a HUGE ${currentStreak}-point run! Turning point!`;
 } else if (currentStreak >= 3) {
 situationContext += `\nSTREAK: ${streakTeam === 'home' ? homeTeamFull : awayTeamFull} scores ${currentStreak} in a row. Pressure building.`;
 }
 if (brokenStreak >= 3) {
 situationContext += `\nSTREAK BROKEN! End of ${brokenStreak}-point run by ${brokenStreakTeam === 'home' ? homeTeamFull : awayTeamFull}. Momentum shift!`;
 }
  if (momentumContext) {
  situationContext += `\n${momentumContext}`;
 }
 if (setNarrativeContext) {
  situationContext += setNarrativeContext;
 }
 if (milestone) {
 situationContext += `\nMILESTONE: This is ${milestone} for ${scoringPlayer}! MENTION IT!`;
 }
 if (isBigLead && !setEndInfo.isSetEnd) {
 situationContext += `\nBIG LEAD: ${scoreDiff} points ahead! ${leadingTeamName} leads ${score}.`;
 }
 
 let errorContext = '';
 if (attackingPlayer) {
 errorContext = `\nATTACK BEAT BLOCK: ${attackingPlayer} (${attackingTeamName}) beat ${scoringPlayer}'s block!
Praise ${attackingPlayer}'s ATTACK, not the blocker's mistake!
Example: "${attackingPlayer} beats ${scoringPlayer}'s block! Powerful attack!"
Player surnames are invariable — do NOT add Polish endings!`;
 } else if (scoringAction.toLowerCase().includes('error')) {
 errorContext = `\nNOTE: This was an ERROR by ${scoringPlayer}. Do not overdramatize — just describe the mistake.`;
 }
 
 let passInstructions = '';
 if (rallyAnalysis) {
 if (rallyAnalysis.passQuality === 'perfect') {
 passInstructions = '\n- Reception was PERFECT - mention the ease of the play!';
 } else if (rallyAnalysis.passQuality === 'negative') {
 passInstructions = '\n- Reception was POOR or FAR FROM NET - highlight the difficulty! Do NOT say "chaos"!';
 } else if (rallyAnalysis.passQuality === 'average') {
 passInstructions = '\n- Reception was IMPRECISE - slight difficulty in the play!';
 }
 
 if (rallyAnalysis.isLongRally) {
 passInstructions += `\n- This was a LONG rally (${rallyAnalysis.numTouches} touches) - emphasize the effort and drama!`;
 }
 }
 
 // Build substitution context for GPT - C2: Smart substitution analysis
 let substitutionContext = '';
 if (rally.substitutions && rally.substitutions.length > 0) {
 const subDescriptions = rally.substitutions.map((sub: any) => {
 const teamLabel = sub.team_name || (sub.team === 'home' ? homeTeamFull : awayTeamFull);
 const situationHint = sub.score_status === 'Up' ? 'leading' : sub.score_status === 'Down' ? 'trailing' : '';
 const diffHint = sub.score_diff ? ` ${sub.score_diff} pkt` : '';
 
 // C2: Tactical reasoning for substitution
 let tacticalHint = '';
 const scoreDiffNum = parseInt(sub.score_diff || '0');
 const totalPoints = (rally.score_before?.home || 0) + (rally.score_before?.away || 0);
 
 if (totalPoints >= 40 && Math.abs(scoreDiffNum) <= 2) {
   tacticalHint = ' | SET ENDGAME - under pressure, coach looking for solution!';
 } else if (sub.score_status === 'Down' && scoreDiffNum >= 4) {
   tacticalHint = ' | Big deficit - coach reacts, trying to turn the match around!';
 } else if (sub.score_status === 'Down' && scoreDiffNum >= 2) {
   tacticalHint = ' | Losing streak - coach seeking momentum, fresh legs on court.';
 } else if (sub.score_status === 'Up' && scoreDiffNum >= 5) {
   tacticalHint = ' | Safe lead - possibly giving reserve player a chance.';
 } else if (totalPoints <= 10) {
   tacticalHint = ' | Early sub - likely planned rotation or reaction to poor play.';
 }
 
 return `${teamLabel}: ${sub.player_out} OUT, ${sub.player_in} IN${situationHint ? ` (${situationHint}${diffHint})` : ''}${tacticalHint}`;
 });
 substitutionContext = `\nSUBSTITUTIONS THIS RALLY:\n${subDescriptions.join('\n')}\n`;
 }

 const commentaryPrompt = `${touchContext}

${Object.keys(playerPositions).length > 0 ? `PLAYER POSITIONS (use naturally, don't repeat every time):
${Object.entries(playerPositions).map(([name, pos]) => `${name} = ${pos}`).join(', ')}
` : ''}
SCORE & CONTEXT:
HOME: ${homeTeamFull} | AWAY: ${awayTeamFull}
Rally #${rally.rally_number} | Set ${setNumber} | Score: ${score} | Point scored by: ${rally.team_scored === 'home' ? homeTeamFull + ' (home)' : awayTeamFull + ' (away)'}
${rally.phase ? `PHASE: ${rally.phase === 'First Ball' ? 'SIDE-OUT (First Ball) - first attack after reception. Reception quality and attack combination are key.' : rally.phase === 'Transition' ? 'TRANSITION - attack after defensive dig. Often more chaotic, requires improvisation. Setter has fewer options.' : rally.phase}` : ''}
${rally.homeRotation || rally.awayRotation ? `ROTATION: ${homeTeamFull} R${rally.homeRotation || '?'} | ${awayTeamFull} R${rally.awayRotation || '?'}${rally.homeRotation === 1 || rally.awayRotation === 1 ? ' (R1 = setter at net, full attack options)' : ''}${rally.homeRotation === 4 || rally.awayRotation === 4 ? ' (R4 = setter in back row, limited options)' : ''}` : ''}
SCORE SITUATION: ${scoreSituation}
WHO LEADS: ${leadInfo}${situationContext}${errorContext}${substitutionContext}

${tacticsContext ? `TACTICAL CONTEXT:\n${tacticsContext}\n\n` : ''}${commentaryExamplesContext ? `GOOD COMMENTARY EXAMPLES:\n${commentaryExamplesContext}\n\n` : ''}${commentaryHintsContext ? `[!!] USER CORRECTIONS & HINTS (PRIORITY!):\n${commentaryHintsContext}\n\n` : ''}${namingRulesContext ? `NAMING RULES (PRIORITY!):\n${namingRulesContext}\n\n` : ''}${commentaryPhrasesContext ? `PHRASE VARIATIONS:\n${commentaryPhrasesContext}\n\n` : ''}${setSummariesContext ? `SET-LEVEL STRATEGIC INSIGHTS:\n${setSummariesContext}\n\n` : ''}${toneRulesContext ? `TONE GUIDANCE:\n${toneRulesContext}\n\n` : ''}${playerContext ? `PLAYER PROFILE:\n${playerContext}` : ''}

INSTRUCTIONS:
- Describe ONLY the touch chain above. Each touch in order. Do not add anything!
- SCORE: Use EXACTLY the score from SCORE SITUATION and WHO LEADS above. NEVER invent a different score! If it says ${otherTeamName || 'opponent'} STILL LEADS — do not say ${scoringTeamName || 'team'} is ahead!
- NAMES: Use surnames from touch chain. You may add a first name only if PLAYER PROFILE confirms it — NEVER invent names! If unsure — surname only.
- ${setEndInfo.isSetEnd ? `THIS IS SET END! YOU MUST ANNOUNCE IT! Final score: ${score}. Winner: ${setEndInfo.winner}.` : isFirstPoint ? 'FIRST POINT — brief and calm.' : isHotSituation ? 'SET ENDGAME — build tension!' : currentStreak >= 3 ? 'STREAK — highlight momentum!' : milestone ? 'MILESTONE — mention the number!' : isBigLead ? 'Big lead — note the dominance' : isEarlySet ? 'Early set — calm' : 'Mid-set — factual'}
- ${attackingPlayer ? `This is ${attackingPlayer}'s ATTACK — praise the ATTACKER, not the block error! Use: "${attackingPlayer} beats ${scoringPlayer}'s block!"` : ''}
- ${milestone ? `IMPORTANT: Mention this is ${milestone}!` : ''}${passInstructions}
- ${commentaryHintsContext ? 'APPLY USER HINTS - they have PRIORITY over other context!' : ''}
- ${isFirstPoint ? 'Do NOT use "increases/reduces lead" — this is the FIRST point!' : ''}
- Player surnames are invariable — do NOT add Polish declension endings
- DO NOT REPEAT INFORMATION! Score, who scored, who leads — mention ONCE. Do not add another sentence saying the same thing.
- AVOID MECHANICAL PHRASES: Do NOT use literal score-report language. Use emotional equivalents from tone-rules context.
- ${attackCombo ? `TACTICAL DATA: Attack type ${attackCombo}${attackLocation ? `, zone: ${attackLocation}` : ''}${attackStyle ? `, style: ${attackStyle}` : ''}. Use this to describe SPECIFICALLY what happened (e.g. diagonal attack, pipe, quick middle) instead of vague terms!` : serveType ? `TACTICAL DATA: Serve type ${serveType}. Describe it specifically!` : ''}
- ${rally.substitutions?.length ? 'SUBSTITUTION! Weave naturally into commentary using tactical hints.' : ''}
- ${rally.phase === 'Transition' ? 'TRANSITION ATTACK! Highlight the quick reaction, improvisation, less time to set up.' : rally.phase === 'First Ball' ? 'SIDE-OUT attack — mention reception quality only if it affected the attack (perfect = full combination, poor = forced ball).' : ''}
- ${(rally.homeRotation || rally.awayRotation) ? 'ROTATION: Mention ONLY when tactically relevant (e.g. setter in back row = fewer options). Do NOT mention rotation number in every commentary!' : ''}
`;

 
 // DEBUG: Check if naming rules are in prompt
 if (namingRulesContext) {
 console.log('[NAMING-IN-PROMPT] Naming rules WILL BE SENT to GPT:');
 console.log('[NAMING-IN-PROMPT] Content:', namingRulesContext.substring(0, 200) + '...');
 } else {
 console.log('[NAMING-IN-PROMPT] NO naming rules in this prompt!');
 }
 
 console.log('========= ROUTE.TS v7.7 SCORE + NAMING FIX =========');
 console.log('[ROTATION]', rally.homeRotation ? `Home R${rally.homeRotation}, Away R${rally.awayRotation}` : 'No rotation data');
 console.log('[POSITIONS]', Object.keys(playerPositions).length, 'players mapped');
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
 currentStreak >= 3,
 milestone !== '',
 language
 );
 
 console.log('[PRE-GPT] touchContext length:', touchContext.length);
 console.log('[PRE-GPT] prompt first 400 chars:', commentaryPrompt.substring(0, 400));
 
 // B1: Dynamic token limits based on rally complexity
 const isServeError = numTouches <= 2 && scoringAction.toLowerCase().includes('blad serw');
 const isAcePoint = numTouches <= 2 && (scoringAction.toLowerCase().includes('ace') || scoringAction.toLowerCase().includes('as serw'));
 const hasSubstitution = rally.substitutions?.length > 0;
 
 let dynamicMaxTokens = 150; // default: normal rally
 if (setEndInfo.isSetEnd) {
   dynamicMaxTokens = 300; // set end: celebratory
 } else if (isServeError || isAcePoint) {
   dynamicMaxTokens = 80; // 1-2 touch: quick & punchy
 } else if (numTouches <= 3) {
   dynamicMaxTokens = 120; // short rally
 } else if (numTouches >= 8) {
   dynamicMaxTokens = 250; // long rally: needs space for drama
 } else if (numTouches >= 5) {
   dynamicMaxTokens = 200; // medium-long rally
 }
 // Modifiers
 if (hasSubstitution) dynamicMaxTokens += 40;
 if (isHotSituation) dynamicMaxTokens += 30;
 if (milestone) dynamicMaxTokens += 30;
 
 console.log(`[TOKENS] touches=${numTouches}, maxTokens=${dynamicMaxTokens}, serveErr=${isServeError}, ace=${isAcePoint}, setEnd=${setEndInfo.isSetEnd}`);

 const completion = await openai.chat.completions.create({
 model: 'gpt-4o-mini',
 messages: [
 { role: 'system', content: systemPrompt },
 { role: 'user', content: commentaryPrompt },
 ],
 temperature: setEndInfo.isSetEnd ? 0.95 : isHotSituation ? 0.9 : currentStreak >= 3 ? 0.85 : isBigLead ? 0.8 : 0.7,
 max_tokens: dynamicMaxTokens,
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
 if (currentStreak >= 3) {
 tags.push('#seria');
 }
 if (brokenStreak >= 3) {
 tags.push('#przelamanie');
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
 if (scoreDiff >= 5 && teamByRole(rally.team_scored) === trailingTeam && currentStreak >= 2 && streakTeam === rally.team_scored) {
   // Comeback = trailing by 5+ AND scoring 2+ in a row (not just 1 random point)
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
 const momentumScore = currentStreak >= 3 ? Math.min(currentStreak * 1.5, 10) : brokenStreak >= 3 ? 5 : 0;
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
 if (tags.includes('#przelamanie')) {
   tagData['#przelamanie'] = {
     brokenTeam: teamByRole(brokenStreakTeam),
     breakingTeam: teamByRole(rally.team_scored),
     length: brokenStreak,
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
 ragDebug,
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
