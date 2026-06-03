import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { COMMENTARY_RULES_PL } from './commentary_rules';

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

// ── SHORT_RULES: esencja zasad dla GPT (max 50 linii) ──────────────────────
// Pełna dokumentacja: commentary_rules.ts
// postProcess obsługuje deterministycznie: recepcja, powiększa przewagę, punkt dla, Bieniekk
// GPT musi wiedzieć poniższe:

const SHORT_RULES_PL = `
ZASADY KOMENTARZA (bezwzględne):

ZAKAZY JĘZYKOWE:
[F53] "nie daje się/dają się" → ZAKAZ. Użyj: odpowiada!, walczy dalej!, rośnie w siłę!
[F54] "wraca do gry" → TYLKO gdy drużyna odrabia stratę 5+ pkt. Inaczej: odpowiada!, zmniejsza stratę!
[F55] "znowu/znów/ponownie" → ZAKAZ bez kontekstu powtórzenia
[F59] "kończy akcję" → ZAKAZ. Konkretnie: kończy atakiem!, zamyka blokiem!, wbija w boisko!
[F61] "recepcja/recepcji/recepcję" → ZAKAZ (kalka z ang.). Zawsze: przyjęcie, odbiór zagrywki
[F63] Po zdobyciu punktu: zawsze wykrzyknik, nigdy średnik
[F66] "poza systemem" → ZAKAZ. Użyj: daleko od siatki, wystawienie sytuacyjne
[F78] "ale piłka wychodzi" → zawsze dodaj dokąd: poza boisko!, na aut!, za linię!

SEMANTYKA:
[F68] Po BŁĘDZIE SERWISOWYM: ZAKAZ dokręca śrubę/rośnie w siłę/nie odpuszcza/odpowiada.
      Drużyna dostaje punkt ZA DARMO. Poprawnie: zdobywa punkt!, korzysta z prezentu!
[F72] Po BŁĘDZIE SERWISOWYM: ZAKAZ nie odpuszcza/dokręca śrubę/rośnie w siłę/buduje przewagę
[F73] Podwójne creditowanie ZAKAZ: "X wbija piłkę i X zdobywa punkt" → tylko raz
[F74] "Błąd X i X zdobywa punkt" → NONSENS. X popełnił błąd = X STRACIŁ punkt
[F75] "zdobywa kolejny punkt" → ZAKAZ (ukryte znowu). Użyj: zdobywa punkt!

NARRACJA:
[M11] Gdy obrońca próbował zatrzymać piłkę po ataku → wspomnij OBYDWU:
      "Tavares próbuje obrony po ataku Sasaka, ale piłka wychodzi poza boisko!"
[F77] Rozgrywający atakuje bezpośrednio (2. kontakt) → "kiwka z drugiej piłki!", "atak z drugiej!"
      Wystawienie z trudnej pozycji → "wystawienie sytuacyjne", "piłka sytuacyjna"

WYBLOK — 6 SCENARIUSZY (F76):
A) Attack error → punkt dla PRZECIWNEJ drużyny
B) Atak bez bloku → punkt dla ATAKUJĄCEJ ("wbija w boisko!")  
C) Piłka po bloku wpada w boisko BLOKUJĄCYCH → BLOCK POINT ("zamyka blokiem!")
D) Piłka po bloku wpada w boisko ATAKUJĄCYCH → ATTACK POINT ("przebija blok!")
D2) Blok-out: piłka leci od razu na aut → ATTACK POINT ("blok-out — punkt!")
E) Atakujący dotknął piłki po bloku → WYBLOK, akcja trwa ("wyblok — akcja trwa!")
ZAKAZ: "wyblok i punkt dla blokujących" = sprzeczność!
`;

const getLanguagePrompt = (lang: string) => {
 const prompts: Record<string, string> = {

 // ── PL ──────────────────────────────────────────────────────────────────
 // ── PL ──────────────────────────────────────────────────────────────────
 pl: `Jestes doswiadczonym komentarorem meczow siatkarskich w Polsce — jak Tomasz Swędrowski lub Wojciech Drzyzga na zywo w radiu lub TV.

STYL PL — RADIO NA ZYWO:
- Prowadz narracje z EMOCJA proporcjonalna do sytuacji. Serve error = krotko i zwiezle. Koniec seta = wybuch emocji!
- UNIKAJ mechanicznych zwrotow: zamiast "zwieksza przewage" uzyj "odskoczyc", "dokrecil srube", "nie odpuszcza". Zamiast "zmniejsza strate" uzyj "odpowiada!", "iskra nadziei!", "zapala iskre!", "rośnie w sile!".
- UNIKAJ "gra trwa" — uzyj "akcja trwa!", "wymiana!", "pilka zyje!", "walczy dalej!".
- Przeplataj krotkie zdania uderzajace z dluzszymi opisowymi. Czasem zacznij od akcji: "Mocna zagrywka!", "Kapitalny blok!".
- Przynajmniej JEDNO zdanie z wykrzyknikiem na komentarz (chyba ze to blad serwisowy — wtedy wystarczy jedno krotkie).

OBOWIAZKOWE SLOWNICTWO PL:
- Wystawienie: "wystawia do [nazwisko]" LUB "wystawia na lewe/prawe skrzydlo" LUB "szybka pilka do srodka" — NIGDY "wystawia w prawo/lewo", NIGDY "ustawia do ataku", NIGDY "przygotowuje akcje"
- Blok punkt: "BLOK!", "zatrzymany blokiem!", "mur przy siatce!" — NIGDY "broni blokiem" (blok to NIE obrona!)
- Wyblok (blok niekonczacy rally): "pilka po bloku", "wyblok — pilka zyje!", "zablokowany ale akcja trwa!"
- Obrona/dig: "kapitalnie obroniony!", "wyciagnal z podlogi!", "fenomenalna obrona!" — NIGDY angielskie "dig"
- Float serve: "zagrywka szybujaca", "float" — ZAWSZE lekka/szybujaca, NIGDY "mocna zagrywka" przy float
- Przyjecie perfekcyjne: "kapitalnie przyjal!", "perfekcyjne przyjecie!", "bezbladne przyjecie [nazwisko]!"
- WYBLOK (F76) — uzywaj TYLKO gdy atakujacy dotknal pilki po bloku i pilka wraca na strone blokujacej druzyny.
  NIGDY przy block point (blok zdobywa punkt) ani attack point (atakujacy przebil blok).
  5 scenariuszy:
  A) Attack error → punkt dla PRZECIWNEJ druzyny
  B) Atak bez bloku → punkt dla ATAKUJACEJ
  C) Pilka po bloku wpada w boisko BLOKUJACEJ → BLOCK POINT dla BLOKUJACEJ ("zamyka blokiem!")
  D) Pilka po bloku wpada w boisko ATAKUJACEJ → ATTACK POINT dla ATAKUJACEJ ("przebija blok!")
  D2) BLOK-OUT: pilka dotknela bloku i od razu wylatuje na aut → ATTACK POINT dla ATAKUJACEJ
      ("blok-out — punkt dla [druzyna atakujaca]!", "blok wypycha pilke na aut!")
  E) Atakujacy dotyka pilki po bloku → WYBLOK, akcja trwa ("wyblok — akcja trwa!")
- PODWOJNE CREDITOWANIE (F73): "Louati wbija pilke i Louati zdobywa punkt" = ZAKAZ.
  Jeden scoring verb na akcje. Nie powtarzaj scorer + verb dwa razy z rzedu.
- KONTEKST OBRONY (M11): gdy obronca probowal zatrzymac pilke po ataku ale nie zdolal,
  wspomnij OBYDWU. POPRAWNIE: "Tavares probuje obrony po ataku Sasaka, ale pilka wychodzi!"
  POPRAWNIE: "Leon wbija mimo desperackiej obrony Tavaresa!"
  ZLE: "Tavares probuje obrony, ale pilka wychodzi" (brak atakujacego)
- Przyjecie zle: "trudne przyjecie", "pilka daleko od siatki", "nieidealne przyjecie" — NIGDY "nieporadnie"
- NIGDY nie pisz "recepcja", "recepcji", "recepcję" — zawsze "przyjęcie", "przyjęcia".
     // "piłka zyje" → "piłka żyje"
     t = t.replace(/piłka zyje/gi, 'piłka żyje');
     t = t.replace(/pilka zyje/gi, 'piłka żyje');
     t = t.replace(/zyje!/g, 'żyje!');
     // szybujaco bez ą
     t = t.replace(/szybujaco/gi, 'szybująco');
     // prowadza nadal
     t = t.replace(/prowadza nadal/gi, 'prowadzą nadal');
     // Ta drużyna prowadzą → prowadzi
     t = t.replace(/[Tt]a drużyna prowadzą/g, 'Ta drużyna prowadzi');

ABSOLUTNY ZAKAZ — te slowa/zwroty sa ZABRONIONE w PL:
- "nieporadnie" — ZASTAP: "nieprecyzyjnie", "daleko od siatki", "z trudem"
- "dig" (angielskie) — ZASTAP: "obrona", "wybroniony", "wyciagnal"
- "ustawia do ataku" — ZASTAP: "wystawia do [nazwisko]"
- "przygotowuje akcje" / "przygotowuje pilke" — za ogolne, opisz konkretnie
- "broni poteznym blokiem" — ZASTAP: "potezny blok [nazwisko]!" (blok to blok, nie obrona)
- "znowu" / "ponownie" — TYLKO jesli dotychczasowy touch chain pokazuje TEN SAM ZAWODNIK dzialal juz wczesniej w tej samej akcji
- "Hoss" — TEN ZAWODNIK NIE ISTNIEJE. To jest Thales. Uzywaj: "Thales"
- "potezna zagrywka floatowa" — float jest ZAWSZE lekka/szybujaca, NIGDY potezna
- "SERVICE ACE" — ZAKAZANE po angielsku! ZASTAP: "as serwisowy!", "bezposredni punkt!", "prosto w boisko!"
- "SET OVER" — ZAKAZANE! Dla PL: "Koniec seta!", "SET dla [druzyna]!", "[wynik] — seta!"
- "recepcja" / "recepcji" / "recepcję" — KALKA Z ANGIELSKIEGO! Zawsze: "przyjęcie", "przyjęcia", "przyjęcie".
  NIGDY nie pisz "błąd w recepcji", "perfekcyjna recepcja" — tylko "błąd w przyjęciu", "perfekcyjne przyjęcie".
- BLEDY SERWISOWE — semantyka (F68, F72):
  PO BLEDZIE SERWISOWYM rywal dostaje punkt ZA DARMO. Dlatego ZAKAZ: 'odpowiada', 'nie odpuszcza',
  'dokrecal srube', 'rosnie w sile', 'buduje przewage' — te zwroty sa dla punktow zdobytych WYSILKIEM.
  POPRAWNIE: '[Druzyna] zdobywa punkt!', 'korzysta z prezentu i zdobywa punkt', 'latwy punkt dla X'.
  'odpowiada' jest OK tylko po normalnej wymianie.
- "momentum" — ANGIELSKI! ZASTAP: "impet", "seria punktow", "dynamika", "nie do zatrzymania"
- "float serve" — ANGIELSKI! ZASTAP: "zagrywka szybujaca", "float"
- "nie daje się" / "nie dają się" — ZAKAZANE! To brzmienie jest nieprofesjonalne. ZASTAP: "walczy dalej!", "odpowiada!", "nie odpuszcza!", "rośnie w siłę!"
- "wraca do gry" — TYLKO gdy druzyna odrabia strate 5+ punktow (np. po przegrywaniu 10:16 odbija sie). Przy zwyklym zdobyciu punktu NIE uzywa sie "wraca do gry"! ZASTAP: "odpowiada!", "zdobywa punkt!", "nie odpuszcza!", "zmniejsza strate!"
- "kończy akcję" — ZA OGOLNE! Napisz KONKRETNIE co sie stalo: "kończy atakiem!", "zamyka blokiem!", "wbija w boisko!"

ROZNORODNOSC SLOWNICTWA — OBOWIAZKOWE:
- Nie uzywaj tego samego superlatywu wiecej niz RAZ w jednym komentarzu!
- Zamiast "kapitalnie" mozesz uzyc: znakomicie, wzorowo, pewnie, bez zarzutu, czysto, idealnie
- Zamiast "perfekcyjnie" mozesz uzyc: bezbladnie, czysto, idealnie, wzorowo, znakomicie
- Zamiast "fenomenalnie" mozesz uzyc: imponujaco, rewelacyjnie, znakomicie, kapitalnie
- Zamiast "potezny atak" mozesz uzyc: mocny atak, precyzyjny atak, celny cios, pewne uderzenie
- "Punkt dla [druzyna]" — MECHANICZNE i NUDNE. ZASTAP kreatywnymi zakonczeniami:
  DOBRE: "[Nazwisko] konczy!", "Punkt!", "[Druzyna] bierze!", "Niesamowite!", 
         "Wbija w boisko!", "Zdobywa!", "Zamkniety!", "I to jest punkt!"
  ZLE: "Punkt dla JSW Jastrzebski Wegiel!" — brzmi jak automat, nie komentator!
- Wynik liczbowy w tekście (np. "prowadza 14:11") — ZAKAZANE poza koncem seta!
  Wynik jest widoczny w UI. Uzyj: "prowadza", "remis", "odskoczyc", "wyrownuja".

LOGIKA BLOK vs OBRONA — KRYTYCZNE dla poprawnosci:
- BLOK KONCZACY rally = "[Nazwisko] blokuje! Punkt dla [Druzyna]!"
- WYBLOK (blok niekonczacy, akcja trwa) = "pilka po bloku wraca w pole!" / "wyblok, pilka zyje!"
- OBRONA (dig, nie blok) = "kapitalnie obroniony!", "wyciagnal z podlogi!"
- Jesli po bloku akcja TRWA → to byl WYBLOK, nie blok punkt. Nie mow "blokuje" jezeli akcja trwa dalej.`,


 // ── EN ──────────────────────────────────────────────────────────────────
 en: `You are a professional volleyball commentator for Sky Sports / NBC Sports / ESPN. Comment in ENGLISH.

STYLE: Authoritative, energetic, builds narrative. Think live radio broadcast — PAINT THE PICTURE with words. Every big point deserves excitement. Sky Sports energy — not a dry recap.
- EVERY commentary needs at least ONE exclamation mark. Short rallies = punchy. Long rallies = crescendo.
- Use varied exclamations: "What a kill!", "Clean ace!", "Stuffed at the net!", "He finds the floor!"
- Do NOT start every sentence with "[Name] serves..." — vary the opener.

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

文構造：感嘆 + 動作 + 結果：「決まったー！シェルシェニがブロックを打ち抜きました！」
- 短い動作：「サービスエース！ザヴィエルチェに点が入ります。」
- 長いラリー：「一本目…二本目…三本目！まだ続きます！決まったー！」

感嘆詞バリエーション（素晴らしい以外も使うこと！）：
- 強打時：「強烈！」「一撃！」「決まったー！」
- ブロック時：「止めた！」「シャットアウト！」
- 守備時：「拾ったー！」「粘る！」「上がった！」
- エース時：「直接点！」「ノータッチエース！」
- 失点時：「惜しい！」「わずかに外れた！」
「素晴らしい」は1セットに最大2回まで。毎回使わないこと。

パイプ攻撃 = 「パイプ攻撃」または「バックアタック」（ピッペ・ピップは使わない！）
セッターのダンプ = 「ダンプ」または「フェイクセット」（ファーストテンポではない）

絶対禁止：
- コメントを「」で囲むこと — 絶対に使わない
- 「選択肢が限られ」を3回以上繰り返すこと
- 「素晴らしい」を連続使用すること
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
- "potężny/potężna/potężni/potężnym/potężnego/potężnymi/potężli" → IT:"potente" / ES:"potente" / TR:"güçlü" / DE:"kraftvoll" / JP:"強力な"
- "mocna/mocny" → IT:"potente" / ES:"potente" / TR:"güçlü" / DE:"kraftvoll" / JP:"強力な"
- "Huknięcie/huknięcie" → IT:"Gran botta" / ES:"Gran golpe" / TR:"Güçlü servis" / DE:"Kraftvoller Aufschlag" / JP:"強烈な一打"
- "Blad/błąd serwisowy" → IT:"errore al servizio" / ES:"error en el saque" / TR:"servis hatası" / DE:"Aufschlagfehler" / JP:"サービスミス"
- "świetny/świetnie" → IT:"ottimo" / ES:"excelente" / TR:"harika" / DE:"hervorragend" / JP:"素晴らしい"
- "punkt dla" → IT:"punto per" / ES:"punto para" / TR:"sayı" / DE:"Punkt für" / JP:"ポイント"
Player surnames stay as-is. NEVER copy Polish words verbatim.

${language === 'pl' ? SHORT_RULES_PL : ''}

Your task is to generate professional, factual volleyball match commentary in RADIO STYLE.

RADIO STYLE MEANS:
- You receive a TOUCH CHAIN - describe EXACTLY what happened step by step
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
 let scoringAction = finalTouch?.action || '';
 let playerTeam = finalTouch?.team || '';

 // ── POPRAWNE określenie scorera ─────────────────────────────────────────
 // Dwa przypadki:
 // A) Normalny punkt (atak, blok): scorer = ostatni gracz WYGRYWAJĄCEGO teamu
 //    (nie bierzemy finalTouch bo może to być obrońca przegrywającego teamu)
 // B) Błąd (attack_error, serve_error): scorer = gracz który popełnił błąd
 //    (finalTouch.player = Butryn który się pomylił — o nim ma być komentarz)
 const _finalAction = (finalTouch?.action || '').toLowerCase();
 const _isErrorTouch = _finalAction.includes('error') || _finalAction.includes('fault')
   || _finalAction.includes('blad') || _finalAction.includes('błąd');
 let scoringPlayer: string;
 if (_isErrorTouch) {
   // Błąd — scoringPlayer = gracz który popełnił błąd (do opisu błędu)
   // ALE: postProcess musi wiedzieć żeby NIE pisać '[błąd-gracz] zdobywa punkt'
   scoringPlayer = finalTouch?.player || '';
 } else {
   // Normalny punkt — scorer = ostatni gracz wygrywającego teamu
   const winningTeamId = rally.team_scored;
   const winningTouches = rally.touches.filter((t: any) => t.team === winningTeamId);
   const lastWinningTouch = winningTouches[winningTouches.length - 1];
   scoringPlayer = lastWinningTouch?.player || finalTouch?.player || '';
 }
    const displayScoringPlayer = scoringPlayer;

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
     momentumContext = `MOMENTUM: Gospodarz dominuje - ${homePoints}:${awayPoints} w ostatnich 6 akcjach!`;
   } else if (awayPoints >= 5) {
     momentumContext = `MOMENTUM: Gość dominuje - ${awayPoints}:${homePoints} w ostatnich 6 akcjach!`;
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
   scoreSituation = `REMIS ${scoreDisplay}! ${scoringTeamName} wyrównuje.`;
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
 const leadInfo = isTied ? 'REMIS'
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
 
 const hintsResults = await index.namespace('commentary-examples').query({
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
      // Special cases hardcoded (not in Pinecone or ignored)
      if (player === 'Hoss' || player === 'Thales') {
        return 'NAMING: Ten zawodnik to Thales (pelne nazwisko: Thales). Odmiana: Thales/Thalesa/Thalesowi/Thalesa/Thalesem/Thalesie. NIGDY nie pisz "Hoss"!';
      }
      return `NAMING: Odmien nazwisko "${player}" wg zasad jezyka polskiego (mianownik, dopelniacz, biernik).`;
    };

 try {
 // Query with all player name variants
 // Query naming for ALL players in touch chain, not just scorer
 const touchPlayers = rally.touches 
   ? [...new Set(rally.touches.map((t: any) => t.player).filter(Boolean))].slice(0, 4).join(' ')
   : '';
 const namingQuery = `${scoringPlayer} ${touchPlayers} naming rule odmiana`.trim();
 
 console.log('Naming rules query:', namingQuery);
 
 const namingEmbedding = await openai.embeddings.create({
 model: 'text-embedding-3-small',
 input: namingQuery,
 dimensions: 768,
 });
 
 const namingResults = await index.namespace('player-profiles').query({
 vector: namingEmbedding.data[0].embedding,
 topK: 6, // More results - we want all relevant names
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
 
 const phrasesResults = await index.namespace('commentary-examples').query({
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
 commentaryPhrasesContext = `VARIACJE ZWROTOW — OBOWIAZKOWE! Zamiast mechanicznego "Punkt dla X" uzyj JEDNEGO z tych zwrotow:\n${phrases.join(' / ')}\nJezeli masz te warianty — MUSISZ uzyc jednego zamiast "Punkt dla"!`;
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

 // RAG OPT: skip set-summaries for serve errors and short rallies
 if ((rally.touches?.length || 0) > 2) {
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
 } // end RAG OPT set-summaries

 // ========================================================================
 // TONE RULES (kiedy dramatycznie, kiedy spokojnie)
 // ========================================================================

 let toneRulesContext = '';

 if ((rally.touches?.length || 0) > 2) { // RAG OPT: skip tone-rules for short rallies
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
 
 const toneResults = await index.namespace('commentary-examples').query({
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
    } // end RAG OPT tone-rules

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
   const expertResults = await index.namespace('player-profiles').query({
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
 
 const winnerTeamLabel = rally.team_scored === 'home' ? homeTeamFull : awayTeamFull;
 rally.touches.forEach((touch, idx) => {
   const action = touch.action || '';
   const player = touch.player || '?';
   const actionLower = action.toLowerCase();
   const teamLabel = touch.team === 'home' ? `[${homeTeamFull}]` : `[${awayTeamFull}]`;
   
   let desc = `${idx + 1}. ${teamLabel} ${player}`;
   
   // SERVE
   if (actionLower.includes('zagrywka') || actionLower.includes('serwis') || actionLower.includes('serve')) {
     const sType = touch.serveType || '';
     const serveDesc = sType.includes('Float') ? 'zagrywka szybujaca/float (lekka, szybujaca — NIGDY mocna! PL: "szybujaca", IT: "flottante", DE: "Floater", TR: "float servis", ES: "flotante", PT: "flutuante", JP: "フローター")' : sType.includes('Spin') ? 'jump serve (PL: z wyskoku, IT: in salto, DE: Sprungaufschlag, TR: sıçrama, ES: en salto, PT: em salto, JP: ジャンプ)' : 'serve';
     const isLastTouch = idx === rally.touches!.length - 1;
     
     if (actionLower.includes('as ') || actionLower.includes('ace')) {
       desc += ` - ${serveDesc} >>> SERVICE ACE! Direct point!`;
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
     if (loc.includes('Left')) setDesc = 'sets to left wing';
     else if (loc.includes('Right')) setDesc = 'sets to right wing';
     else if (loc.includes('Middle') || combo.includes('K1') || combo.includes('K2') || combo.includes('K7')) setDesc = 'quick set to middle';
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
       if (isLastTouch) {
         // KRYTYCZNE: blok przebity jako ostatni dotyk.
         // touch.player = bloker który PRZEGRAŁ. Nie wspominaj o nim aktywnie.
         // Opisz TYLKO że scoringPlayer zdobył punkt atakiem.
         desc += ` >>> RALLY ENDS. ${scoringPlayer} [${winnerTeamLabel}] WINS with an attack.`
           + ` ${touch.player} failed to stop the ball — this is NOT ${touch.player}'s point.`
           + ` WRITE IN PL: '${scoringPlayer} wbija piłkę w boisko!' or '${scoringPlayer} kończy atak!'`
           + ` DO NOT write '${touch.player} przebija' — ${touch.player} is the LOSER here, not the scorer.`;
       } else {
         const blockSynonyms = [
           ' - attacker beat the block (wyblok — attacker scores)',
           ' - found a gap in the block (wyblok)',
           ' - block touched but attacker wins',
           ' - late block, attacker scores through',
         ];
         desc += blockSynonyms[Math.floor(Math.random() * blockSynonyms.length)];
       }
     } else if (isLastTouch) {
       desc += ' - BLOCK POINT! (blok kończący — bloker zdobywa punkt)';
     } else {
       // KEY FIX: WYBLOK — bloker nie zdobywa punktu. Sprawdz czy bloker wygral rally czy nie.
       const blockTeamWon = touch.team === rally.team_scored;
       if (blockTeamWon) {
         desc += ' - WYBLOK: block touch, ball rebounds into play - this blocking team eventually WINS rally. Say: wyblok, akcja trwa!';
       } else {
         desc += ' - WYBLOK: block touch, ball rebounds into play - WARNING: this blocking team LOSES rally. Do NOT say this player scored!';
       }
     }
   // DIG / DEFENSE
   } else if (actionLower.includes('obrona') || actionLower.includes('dig')) {
     const isLastTouch = idx === rally.touches!.length - 1;
     if (isLastTouch) {
       // KRYTYCZNE: ostatni dotyk to obrona która nie zatrzymała piłki.
       // touch.player (np. Tavares) STRACIŁ piłkę — NIE zdobył punktu!
       // Punkt idzie do scoringPlayer (np. Leon) bo to JEGO atak spowodował ten błąd.
       desc += ` - FAILED DEFENSE — ball goes out. ${touch.player} could NOT keep ball in play.`
         + ` POINT GOES TO: ${scoringPlayer} [${winnerTeamLabel}].`
         + ` DO NOT say ${touch.player} scored. DO NOT say ${touch.player} wbija piłkę.`
         + ` CORRECT: '${scoringPlayer} wbija piłkę w boisko!' or '${scoringPlayer} zdobywa punkt!'`;
     } else {
       // KEY FIX: tell GPT whether digging team won or lost the rally
       // Prevents GPT from praising a dig + adding Fantastyczny punkt! when team lost
       const digTeamWon = touch.team === rally.team_scored;
       if (digTeamWon) {
         desc += ' - dig/obrona (ball kept in play - this team eventually WINS rally)';
       } else {
         desc += ' - dig/obrona (ball kept in play) - WARNING: this team LOSES rally. Do NOT celebrate this as scoring.';
       }
     }
   // FREE
   } else if (numTouches > 10 && (actionLower.includes('blok') || actionLower.includes('wyblok')) && !isLastTouch) {
     // Long rally (12+ dotknięć): nie opisuj szczegółów wybloku — tylko krótki znacznik
     desc += ' - blok/wyblok (skipped detail — too many touches)';
   } else if (actionLower.includes('serve_error') || (actionLower.includes('error') && actionLower.includes('serw'))) {
     // Błąd serwisowy — punkt TRAFIA DO RYWALA, nie do serwującego
     desc += ` - SERVE ERROR by ${touch.player}. Point goes FREE to ${winnerTeamLabel}. `
       + `Write: '${touch.player} popełnia błąd serwisowy. ${winnerTeamLabel} zdobywa punkt!' `
       + `NEVER write '${touch.player} zdobywa punkt' — ${touch.player} LOST this point.`;
   } else if (actionLower.includes('wolna') || actionLower.includes('free')) {
     desc += ' - free ball';
   } else {
     desc += ` - ${action}`;
   }
   
   // ── FIX: ostatni dotyk przez przegrywający team → opisz anonimowo (bez nazwiska obrońcy)
   // Nie pomijamy — GPT musi wiedzieć jak akcja się skończyła.
   // Ale NIE podajemy nazwiska obrońcy żeby go nie skredytował.
   const isLastTouch_final = idx === rally.touches!.length - 1;
   const lastTouchTeamLoses = isLastTouch_final && touch.team !== rally.team_scored;
   const isFailedLastAction = actionLower.includes('obrona') || actionLower.includes('dig') ||
     actionLower.includes('przebity') || actionLower.includes('wolna') || actionLower.includes('free');
   if (lastTouchTeamLoses && isFailedLastAction) {
     // Ostatni dotyk = nieudana obrona/blok przegrywającego teamu.
     // Opisujemy: obrona miała miejsce ALE nie zatrzymała piłki → punkt dla scorera.
     // Zawodnik obrońcy może być wymieniony jako kontekst, ale SCORER zdobył punkt.
     const defenderName = touch.player || 'obrońca';
     // ZERO przykładów zdań — GPT kopiuje strukturę i odwraca podmiot.
     // Podajemy tylko fakty: kto bronił (kontekst), kto jest SCORER (wynik).
     touchChainLines.push(
       `[CONTEXT] ${defenderName} attempted defense after attack by ${scoringPlayer} — ball out of play.`
       + ` [SCORER] ${scoringPlayer} / [TEAM] ${winnerTeamLabel} / [ACTION] attack won`
       + ` [RULE] Subject of scoring sentence = ${scoringPlayer}. ${defenderName} = context only.`
       + ` REQUIRED (rule M11): name BOTH players — attacker AND defender.`
       + ` '${defenderName} próbuje obrony po ataku ${scoringPlayer}, ale piłka wychodzi!'`
     );
   } else {
     touchChainLines.push(desc);
   }
 });


 
 touchContext = `
TOUCH CHAIN (${numTouches} touches${isLongRally ? ' — long rally!' : ''}):
${touchChainLines.join('\n')}
=> SERVED BY: ${rally.touches[0]?.player || '?'} — this player SERVED. Do NOT say they scored!
=> FINAL SCORER: ${scoringPlayer} [${winnerTeamLabel}] — ONLY this player/team scored the point!
=> POINT FOR: ${winnerTeamLabel}

CRITICAL COMMENTARY RULES:
1. "SERVED BY" ≠ scorer! If "SERVED BY" shows X and scorer is Y — X served, Y finished. NEVER say Y served!
1b. "POINT FOR: ${winnerTeamLabel}" = ONLY this team scored. NEVER say the other team scored!
2. Describe ONLY what is in the touch chain above. Nothing invented!
3. LENGTH LIMIT (MANDATORY): 2-3 touches = MAX 2 sentences. 4-6 touches = MAX 3 sentences. 7+ touches = MAX 3 sentences. NEVER more than 3 sentences!
   3b. ${numTouches > 14 ? 'MASSIVE RALLY (15+ touches)! Write EXACTLY 1 sentence: who scored and how. Do NOT describe every touch — just the final moment. Example: "Borkowski wbija piłkę w boisko po długiej wymianie!"' : ''}
4. NO SCORE IN TEXT: NEVER write "14:11" or "prowadza 14:11" — score is in UI! Say: "prowadza", "remis", "odskoczyc".
5. NO "PUNKT DLA X": Banned! Use: "[Nazwisko] konczy!", "Punkt!", "I to punkt!", "[Druzyna] bierze!" or emotional equivalent.
6. SERVE: Error only when ">>> SERVE ERROR". Otherwise serve was good.
7. BLOCK POINT vs WYBLOK: "BLOCK POINT!" = blocker scores. "block touch, ball rebounds" = wyblok — say "wyblok" in PL, NEVER "blokuje" if play continued.
8. DIG ≠ BLOCK: "defensive dig" = obrona (not blok).
9. PL: "sets to left/right wing" → "wystawia na lewe/prawe skrzydlo".
10. NEVER "znowu/ponownie" — only if same player appears TWICE in this touch chain.
11. PL: "Thales" not "Hoss". "as serwisowy" not "SERVICE ACE". "Koniec seta!" not "SET OVER".
12. ALWAYS COMPLETE YOUR LAST SENTENCE — never cut off mid-sentence. If you are running out of space, end the current sentence with a period or exclamation mark. A complete 2-sentence commentary is better than 3 incomplete sentences.`;
 }
 
 let situationContext = '';
 if (setEndInfo.isSetEnd) {
 situationContext += `\nSET END! Score: ${score}. Winner: ${setEndInfo.winner}. ANNOUNCE THE SET IS OVER IN YOUR LANGUAGE!`;
 }
 if (currentStreak >= 5) {
 situationContext += `\nMOMENTUM: ${streakTeam === 'home' ? homeTeamFull : awayTeamFull} on a ${currentStreak}-point run! Turning point!`;
 } else if (currentStreak >= 3) {
 situationContext += `\nSTREAK: ${streakTeam === 'home' ? homeTeamFull : awayTeamFull} scores ${currentStreak} in a row. Pressure building.`;
 }
 if (brokenStreak >= 3) {
 situationContext += `\nSTREAK BROKEN! ${brokenStreakTeam === 'home' ? homeTeamFull : awayTeamFull} ${brokenStreak}-point run ended. Momentum shift!`;
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
${language === 'pl' ? 'PL: Odmieniaj nazwiska! Kaczmarek→Kaczmareka, itp.' : 'Surnames invariable — base form only.'}`;
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
${rally.phase ? `PHASE: ${rally.phase === 'First Ball' ? 'SIDE-OUT (first ball) - first attack after reception. Reception quality and attack combination are key.' : rally.phase === 'Transition' ? 'TRANSITION - attack after defensive dig. Often chaotic, requires improvisation. Setter has fewer options.' : rally.phase}` : ''}
${rally.homeRotation || rally.awayRotation ? `ROTATION: ${homeTeamFull} R${rally.homeRotation || '?'} | ${awayTeamFull} R${rally.awayRotation || '?'}${rally.homeRotation === 1 || rally.awayRotation === 1 ? ' (R1 = setter at net, full attack options)' : ''}${rally.homeRotation === 4 || rally.awayRotation === 4 ? ' (R4 = setter in back row, limited options)' : ''}` : ''}
SCORE SITUATION: ${scoreSituation}
WHO LEADS: ${leadInfo}${situationContext}${errorContext}${substitutionContext}

${tacticsContext ? `TACTICAL CONTEXT:\n${tacticsContext}\n\n` : ''}${commentaryExamplesContext ? `GOOD COMMENTARY EXAMPLES:\n${commentaryExamplesContext}\n\n` : ''}${commentaryHintsContext ? `[!!] USER CORRECTIONS & HINTS (PRIORITY!):\n${commentaryHintsContext}\n\n` : ''}${namingRulesContext ? `NAMING RULES (PRIORITY!):\n${namingRulesContext}\n\n` : ''}${commentaryPhrasesContext ? `PHRASE VARIATIONS:\n${commentaryPhrasesContext}\n\n` : ''}${setSummariesContext ? `SET-LEVEL STRATEGIC INSIGHTS:\n${setSummariesContext}\n\n` : ''}${toneRulesContext ? `TONE GUIDANCE:\n${toneRulesContext}\n\n` : ''}${playerContext ? `PLAYER PROFILE:\n${playerContext}` : ''}

INSTRUCTIONS:
- Describe ONLY the touch chain above. Each touch in order. Do not add anything!
- SCORE: Use EXACTLY the score from SCORE SITUATION and WHO LEADS above. NEVER invent a different score! If it says ${otherTeamName || 'opponent'} STILL LEADS — do not say ${scoringTeamName || 'team'} is ahead!
- NAMES: Use surnames from touch chain. You may add a first name only if PLAYER PROFILE confirms it — NEVER invent names! If unsure — surname only.
- ${setEndInfo.isSetEnd ? `SET OVER! ANNOUNCE IT! Final score: ${score}. Winner: ${setEndInfo.winner}.` : isFirstPoint ? 'FIRST POINT — brief and calm.' : isHotSituation ? 'SET ENDGAME — build tension!' : currentStreak >= 3 ? 'STREAK — highlight momentum!' : milestone ? 'MILESTONE — mention the number!' : isBigLead ? 'Big lead — note the dominance.' : isEarlySet ? 'Early set — calm.' : 'Mid-set — factual.'}
- ${attackingPlayer ? `This is ${attackingPlayer}'s ATTACK — praise the ATTACKER, not the block error! Use: "${attackingPlayer} beats ${scoringPlayer}'s block!"` : ''}
- ${milestone ? `IMPORTANT: Mention this is ${milestone}!` : ''}${passInstructions}
- ${commentaryHintsContext ? 'APPLY USER HINTS - they have PRIORITY over other context!' : ''}
- ${isFirstPoint ? 'Do NOT use "increases/reduces lead" — this is the FIRST point!' : ''}
- ${language === 'pl' ? 'ODMIANA PL: Odmieniaj nazwiska przez przypadki — Kaczmarek→Kaczmareka, Szalpuk→Szalpuka, Butryn→Butryna, Toniutti→Toniuttiego, Shoji→Shojiego. Dopasuj przypadek do kontekstu zdania!' : 'NAMES: Surnames invariable — use BASE FORM only. NOT Kaczmarka but Kaczmarek.'}
- DO NOT REPEAT INFORMATION! Score, who scored, who leads — mention ONCE. Do not add another sentence saying the same thing.
- AVOID MECHANICAL PHRASES: Do NOT use literal score-report language. Use emotional equivalents from tone-rules context.
- ${attackCombo ? `TACTICAL DATA: Attack type ${attackCombo}${attackLocation ? `, zone: ${attackLocation}` : ''}${attackStyle ? `, style: ${attackStyle}` : ''}. Use this to describe SPECIFICALLY what happened (e.g. diagonal attack, pipe, quick middle) instead of vague terms!` : serveType ? `TACTICAL DATA: Serve type ${serveType}. Describe it specifically!` : ''}
- ${rally.substitutions?.length ? 'SUBSTITUTION! Weave naturally into commentary using tactical hints.' : ''}
- ${rally.phase === 'Transition' ? 'TRANSITION ATTACK! Highlight quick reaction, improvisation, less time to set up.' : rally.phase === 'First Ball' ? 'SIDE-OUT — mention reception quality only if it affected the attack (perfect = full combination, poor = forced ball).' : ''}
- ${(rally.homeRotation || rally.awayRotation) ? 'ROTATION: Mention ONLY when tactically relevant (e.g. setter in back row = fewer options). Do NOT mention rotation number in every commentary!' : ''}

🔴 FINAL REMINDER: Your response must be 100% in ${language === 'pl' ? 'Polish' : language === 'it' ? 'Italian' : language === 'de' ? 'German' : language === 'tr' ? 'Turkish' : language === 'es' ? 'Spanish' : language === 'pt' ? 'Portuguese' : language === 'jp' ? 'Japanese' : 'English'}. Zero Polish words allowed. If context data contains Polish — translate it. Do NOT write a single Polish word.`;

 
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

 // ── HYBRYDA NARRACJI — dystrybucja (Tomek 2026-05-13) ──────────────────────
 // Zmiana: więcej chronologicznych (70% przy dramaLevel 0-1)
 // >12 dotknięć = zawsze climax-first ale MAX 1 zdanie (skrócony)
 const isVeryLongRally = numTouches > 12;
 const isMassiveRally = numTouches > 14; // 15+ dotknięć = absolutne minimum, tylko scorer
 const narrativeStyle: 'climax-first' | 'chronological' = 
   isServeError ? 'chronological'
   : isVeryLongRally ? 'climax-first'   // >12 dotknięć = tylko kto/jak, 1 zdanie
   : isHotSituation ? 'climax-first'   // końcówka/tie-break = climax first
   : maxScore >= 18 ? (Math.random() < 0.5 ? 'climax-first' : 'chronological')   // po 18 = 50/50
   : (Math.random() < 0.3 ? 'climax-first' : 'chronological');  // spokojny = 70% chronologiczny
 console.log('[NARRATIVE]', narrativeStyle, 'touches:', numTouches, 'veryLong:', isVeryLongRally);
 
 let dynamicMaxTokens = 150; // default: normal rally
 if (setEndInfo.isSetEnd) {
   dynamicMaxTokens = 220; // set end: celebratory but concise
 } else if (isServeError || isAcePoint) {
   dynamicMaxTokens = 60;  // 1-2 touch: 1 punchy sentence MAX
 } else if (numTouches <= 3) {
   dynamicMaxTokens = 80;  // short: 1-2 sentences MAX
 } else if (numTouches >= 8) {
   dynamicMaxTokens = 160; // long rally: 3 sentences MAX
 } else if (numTouches >= 5) {
   dynamicMaxTokens = 120; // medium: 2-3 sentences MAX
 }
 // Modifiers
 if (hasSubstitution) dynamicMaxTokens += 40;
 if (isHotSituation) dynamicMaxTokens += 30;
 if (narrativeStyle === 'chronological' && !isVeryLongRally) dynamicMaxTokens += 30;
 if (isMassiveRally) dynamicMaxTokens = 90;  // 15+ dotknięć = MAX 1 zdanie, nie opisuj każdego dotyku!
 else if (isVeryLongRally) dynamicMaxTokens = Math.min(dynamicMaxTokens, 150); // 13-14 dotknięć = max 150
 if (milestone) dynamicMaxTokens += 30;
 
 console.log(`[TOKENS] touches=${numTouches}, maxTokens=${dynamicMaxTokens}, serveErr=${isServeError}, ace=${isAcePoint}, setEnd=${setEndInfo.isSetEnd}`);

 const completion = await openai.chat.completions.create({
 model: 'gpt-4.1-mini',
 messages: [
 { role: 'system', content: systemPrompt },
 { role: 'user', content: commentaryPrompt },
 ],
 temperature: setEndInfo.isSetEnd ? 0.95 : isHotSituation ? 0.9 : currentStreak >= 3 ? 0.85 : isBigLead ? 0.8 : 0.7,
 max_tokens: dynamicMaxTokens,
 });

 const rawCommentary = completion.choices[0].message.content || '';

 // ========================================================================
 // POST-PROCESSING FILTER — deterministic cleanup, runs after every GPT call
 // These fixes are 100% reliable regardless of what GPT does
 // ========================================================================
 const postProcess = (text: string, lang: string): string => {
   let t = text;

   // ── UNIVERSAL: Polish leaks that can appear in ANY language ────────────
   // These are input data words that GPT sometimes copies verbatim
   const polishLeaks: [RegExp, string][] = [
     [/\bzagrywka\b/gi, lang === 'it' ? 'battuta' : lang === 'de' ? 'Aufschlag' : lang === 'tr' ? 'servis' : lang === 'es' ? 'saque' : lang === 'pt' ? 'saque' : lang === 'jp' ? 'サーブ' : 'serve'],
     [/\bprzyjęcie\b/gi, lang === 'it' ? 'ricezione' : lang === 'de' ? 'Annahme' : lang === 'tr' ? 'kabul' : lang === 'es' ? 'recepción' : lang === 'pt' ? 'recepção' : lang === 'jp' ? 'レセプション' : 'reception'],
     [/\bpotężn\w*/gi, lang === 'it' ? 'potente' : lang === 'de' ? 'kraftvoll' : lang === 'tr' ? 'güçlü' : lang === 'es' ? 'potente' : lang === 'pt' ? 'poderoso' : lang === 'jp' ? '強力な' : 'powerful'],
     [/\bHuknięcie\b/gi, lang === 'it' ? 'Gran botta' : lang === 'de' ? 'Knaller' : lang === 'tr' ? 'Güçlü servis' : lang === 'es' ? 'Gran golpe' : lang === 'pt' ? 'Grande tacada' : lang === 'jp' ? '強烈な一打' : 'Big shot'],
     [/\bHoss\b/g, 'Thales'],
   ];

   if (lang !== 'pl') {
     polishLeaks.forEach(([pattern, replacement]) => {
       t = t.replace(pattern, replacement);
     });
     // "Punkt dla X" in non-PL (Turkish had this leak)
     t = t.replace(/Punkt dla [^!.]+[!.]/g, '');
   }

   if (lang === 'pl') {
     // ── English leaks → Polish ──────────────────────────────────────────
     t = t.replace(/\bSERVICE ACE\b/g, 'as serwisowy');
     // "SET para X" — hiszpański artifact w PL
     t = t.replace(/SET para /g, 'SET dla ');
     // Hiszpański wykrzyknik ¡ nigdy nie powinien być w PL
     t = t.replace(/¡SET!/g, 'SET!');
     t = t.replace(/¡/g, '');
     // Angielskie/błędne formy serwisu w wielkich literach
     t = t.replace(/SERVISIE/gi, 'serwisie');
     t = t.replace(/SERVIS\b/gi, 'serwis');
     t = t.replace(/BŁĄD W SERV[A-Z]*/gi, 'błąd serwisowy');
     t = t.replace(/\bSET OVER\b/g, 'Koniec seta!');
     t = t.replace(/\bfloat serve\b/gi, 'zagrywka szybująca');
     t = t.replace(/\bjump serve\b/gi, 'zagrywka z wyskoku');
     t = t.replace(/\bmomentum\b/gi, 'impet');
     t = t.replace(/\bdig\b/gi, 'obrona');
     t = t.replace(/\bHoss\b/g, 'Thales');
     t = t.replace(/Hossa/g, 'Thalesa');
     t = t.replace(/Hossi/g, 'Thalesa');
     t = t.replace(/Hoss /g, 'Thales ');
     t = t.replace(/Hoss,/g, 'Thales,');
     t = t.replace(/Hoss!/g, 'Thales!');
     t = t.replace(/Hoss\./g, 'Thales.');

     // Japońskie znaki wyciekające do PL — zamień na nazwisko
     t = t.replace(/レオン/g, 'Leon');
     t = t.replace(/タレス/g, 'Thales');
     t = t.replace(/ボワンジ/g, 'Bołądź');
     t = t.replace(/コメンダ/g, 'Komenda');
     t = t.replace(/タバレス/g, 'Tavares');
     t = t.replace(/グロズダノフ/g, 'Grozdanov');

     // ── "Punkt dla X" / "I to jest punkt dla X" → neutral ending ──────────
     const punktDlaVariants = [
       'Punkt!', 'I to jest punkt!', 'Zdobyte!', 'Biorą to!',
       'Niesamowite!', 'I to wystarczy!', 'I punkt wędruje do nich!', 'Wbija piłkę w boisko!'
     ];
     const _rdx = () => punktDlaVariants[Math.floor(Math.random() * punktDlaVariants.length)];
     // "I to jest punkt dla X!" / "i to jest punkt dla X!"
     t = t.replace(/[Ii] to jest punkt dla [^!.]+[!.]/g, _rdx);
     // "I to punkt dla X!"
     t = t.replace(/[Ii] to punkt dla [^!.]+[!.]/g, _rdx);
     // "punkt dla X!" (lowercase p, after clause) 
     t = t.replace(/[,—–]\s*punkt dla [^!.]+[!.]/gi, () => ' ' + _rdx());
     // "Punkt dla X!" (sentence start)
     t = t.replace(/Punkt dla [^!.]+[!.]/g, _rdx);
     // "zdobywa punkt dla X" — scorer OK ale suffix niepotrzebny
     t = t.replace(/zdobywa punkt dla [A-ZŁŚŹĆĘÓĄŃ][^.!?,]{0,40}/gi, 'zdobywa punkt');
     // Fallback: any remaining "punkt dla X" without punctuation
     t = t.replace(/punkt dla [A-ZŁŚŹĆĘÓĄŃ][^.!?,]{0,40}/gi, 'punkt');
     // Cleanup: wiszący zaimek względny po usunięciu "punkt dla X"
     // "Łatwy punkt, która prowadzi w pierwszym secie!" → "Łatwy punkt!"
     t = t.replace(/,\s*(który|która|które|którzy)\s+prowadzi[^!.]*[!.]?/gi, '!');
     // Wiszący zaimek przy kontekście drużynowym (nie przy piłce)
     t = t.replace(/,\s*(który|która|które|którzy)\s+(prowadzi|wychodzi na|zmniejsza|odrabia|wyrównuje|odskakuje|powiększa|buduje|rośnie|zdobywa)[^!.]{0,60}[!.]/gi, '!');

     // ── Score in text → remove explicit numbers ─────────────────────────
     if (!setEndInfo.isSetEnd) {
       t = t.replace(/prowadz[ąią]\s+\d{1,2}:\d{1,2}/g, 'prowadzą');
       t = t.replace(/prowadzi\s+\d{1,2}:\d{1,2}/g, 'prowadzi');
       t = t.replace(/remis\s+\d{1,2}:\d{1,2}/g, 'remis');
       t = t.replace(/wyrównu[ją]+\s+\d{1,2}:\d{1,2}/g, 'wyrównują');
       t = t.replace(/\b(\d{1,2}:\d{1,2})\b(?!\s*[!.]?\s*$)/g, '');
     }

     // ── Forbidden words ─────────────────────────────────────────────────
     t = t.replace(/\bnieporadnie\b/gi, 'nieprecyzyjnie');
     // "wbija w boisko" → "wbija piłkę w boisko" (feedback użytkownika)
     t = t.replace(/wbija w boisko/gi, 'wbija piłkę w boisko');
     t = t.replace(/wbił w boisko/gi, 'wbił piłkę w boisko');
     // "wyciąga z podłogi obronę — piłka ląduje poza boiskiem"
     // = gracz stracił rally po swojej obronie → nie chwalimy fenomenalnie, skracamy
     t = t.replace(/fenomenalnie wyciąga z podłogi obronę[^!.]*piłka ląduje poza boiskiem/gi,
       'niestety piłka ląduje poza boiskiem');
     t = t.replace(/wyciąga z podłogi obronę[^!.]*piłka ląduje poza boiskiem/gi,
       'niestety piłka ląduje poza boiskiem');
     t = t.replace(/kapitalnie wyciąga z podłogi[^!.]*piłka ląduje poza boiskiem/gi,
       'niestety piłka ląduje poza boiskiem');
     t = t.replace(/wyciąga z podłogi[^!.]*piłka ląduje poza boiskiem/gi,
       'niestety piłka ląduje poza boiskiem');
     // Błąd ataku vs błąd przyjęcia — kontekstowe naprawienie błędnej klasyfikacji
     if (scoringAction.toLowerCase().includes('przyjęci') ||
         scoringAction.toLowerCase().includes('odbior') ||
         scoringAction.toLowerCase().includes('receive') ||
         scoringAction.toLowerCase().includes('pass')) {
       const spEscBl = scoringPlayer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
       t = t.replace(new RegExp(`(B|b)łąd w ataku\\s+${spEscBl}`, 'g'),
         `Błąd w przyjęciu ${scoringPlayer}`);
       t = t.replace(/błąd w ataku (przyjmującego|przyjmuje)/gi, 'błąd w przyjęciu');
     }

     // ── Brakujące polskie znaki w outputcie GPT ────────────────────────────
     // GPT czasem nie stawia diakrytyków — normalizujemy deterministycznie
     t = t.replace(/\bdruzyna\b/gi, 'drużyna');
     t = t.replace(/\bDruzyna\b/g, 'Drużyna');
     t = t.replace(/\bprowadza\b(?!\w)/g, 'prowadzą');
     t = t.replace(/\bprowadza!/g, 'prowadzą!');
     t = t.replace(/\bpilka\b/gi, 'piłka');
     t = t.replace(/pilka /g, 'piłka ');
     t = t.replace(/pilka!/g, 'piłka!');
     t = t.replace(/pilka,/g, 'piłka,');
     t = t.replace(/pilke /g, 'piłkę ');
     t = t.replace(/ pilke/g, ' piłkę');
     t = t.replace(/\bpilke\b/gi, 'piłkę');
     t = t.replace(/\bpilki\b/gi, 'piłki');
     t = t.replace(/\bsiatkówke\b/gi, 'siatkówkę');
     t = t.replace(/\bserwis szybujacy\b/gi, 'serwis szybujący');
     t = t.replace(/\bzagrywka szybujaca\b/gi, 'zagrywka szybująca');
     t = t.replace(/\bszybujacym\b/gi, 'szybującym');
     t = t.replace(/\bszybujacy\b/gi, 'szybujący');
     t = t.replace(/\blekka szybujaca\b/gi, 'lekka szybująca');
     t = t.replace(/\bszybujaca\b/gi, 'szybująca'); // standalone: "piłka szybujaca" itp.
     // Brakujące diakrytyki — rozszerzone (GPT czasem generuje bez polskich znaków)
     t = t.replace(/\bskrzydlo\b/gi, 'skrzydło');
     t = t.replace(/\bskrzydla\b/gi, 'skrzydła');
     t = t.replace(/\bwyciaga\b/gi, 'wyciąga');
     t = t.replace(/\bwyciagnal\b/gi, 'wyciągnął');
     t = t.replace(/\bwalcza\b/gi, 'walczą');
     t = t.replace(/\bwalcza dalej\b/gi, 'walczą dalej');
     t = t.replace(/\bktory\b/gi, 'który');
     t = t.replace(/\bktora\b/gi, 'która');
     t = t.replace(/\bktore\b/gi, 'które');
     t = t.replace(/\bprzyjecie\b/gi, 'przyjęcie');
     t = t.replace(/\bprzyjecia\b/gi, 'przyjęcia');

     // "nie daje się" — ABSOLUTNY ZAKAZ (nieprofesjonalne brzmienie, fix v8.0)
     // Specific patterns first (must come before catch-all)
     t = t.replace(/nie daje się i wraca do gry/gi, 'walczy dalej');
     t = t.replace(/nie daja sie i wraca do gry/gi, 'walczy dalej');
     t = t.replace(/nie daje się i odskakuje/gi, 'nie odpuszcza i odskakuje');
     t = t.replace(/nie daje się i ([a-z])/gi, '$1');
     t = t.replace(/i nie daje się([!,.])/gi, '$1');
     t = t.replace(/nie daje się zdominować/gi, 'nie odpuszcza');
     t = t.replace(/nie daje się złamać/gi, 'nie odpuszcza');
     t = t.replace(/([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+) nie daje się,/gi, '$1,');
     t = t.replace(/nie daja sie!/gi, 'walczy dalej!');
     t = t.replace(/nie daja sie/gi, 'nie odpuszcza');
     t = t.replace(/nie daje się!/gi, 'walczy dalej!');
     t = t.replace(/nie daje się/gi, 'nie odpuszcza');
     t = t.replace(/\bustawia do ataku\b/gi, 'wystawia do ataku');
     // "wystawieniu X" → "wystawie X" (poprawna gramatyka)
     t = t.replace(/wystawieniu ([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+)/g, 'wystawie $1');
     // Archaiczny szyk zdania — obie kolejności: "[name] posłał" i "posłał [name]"
     t = t.replace(/[Zz]agrywkę z wyskoku ([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+) posłał/g, '$1 posłał zagrywkę z wyskoku');
     t = t.replace(/[Zz]agrywkę z wyskoku posłał ([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+)/g, '$1 posłał zagrywkę z wyskoku');
     t = t.replace(/[Zz]agrywkę floatową ([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+) posłał/g, '$1 posłał zagrywkę floatową');
     t = t.replace(/[Zz]agrywkę floatową posłał ([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+)/g, '$1 posłał zagrywkę floatową');
     t = t.replace(/[Zz]agrywkę z wyskoku ([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+) wykonał/g, '$1 wykonał zagrywkę z wyskoku');
     // "posyłał zagrywkę" → "posłał zagrywkę" (czas niedokonany brzmi nienaturalnie)
     t = t.replace(/([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+) posyłał zagrywkę/g, '$1 posłał zagrywkę');
     t = t.replace(/posyłał zagrywkę z wyskoku/gi, 'posłał zagrywkę z wyskoku');
     // "kończy akcję" — za ogólne
     // UWAGA: \b nie działa po 'ę' (non-ASCII) w JS — używamy lookahead
     t = t.replace(/i blokiem kończy akcję/gi, 'i blokuje — punkt');
     t = t.replace(/blokiem kończy akcję/gi, 'blokuje — punkt');
     t = t.replace(/kończy akcję(?=[^a-zA-Z]|$)/gi, 'zdobywa punkt');
     // Score suppression artifacts — GPT doklejało kontekst po usuniętym wyniku
     t = t.replace(/zdobywa punkt ten [^!.]+punkt/gi, 'zdobywa punkt');
     t = t.replace(/zdobywa punkt to [^!.]{0,40}[!.]/gi, 'zdobywa punkt!');
     t = t.replace(/prowadzi i zdobywa punkt ten/gi, 'prowadzi');
     // "akcja nie zostaje zakończona" → "akcja trwa"
     t = t.replace(/akcja nie zostaje zakończona/gi, 'akcja trwa');
     // Bieniekk — duplikat k, wszystkie odmiany (od najdłuższej do najkrótszej!)
     t = t.replace(/Bieniekkowi/g, 'Bieńkowi');   // celownik
     t = t.replace(/Bieniekkiem/g, 'Bieńkiem');   // narzędnik
     t = t.replace(/Bieniekka/g,  'Bieńka');      // dopełniacz
     t = t.replace(/Bieniekki/g,  'Bieńki');
     t = t.replace(/Bieniekek/g,  'Bieniek');     // GPT typo z wstawionym 'e'
     t = t.replace(/Bieniekk/g,   'Bieniek');     // mianownik + reszta
     t = t.replace(/\bBieńkka\b/gi, 'Bieńka');
     t = t.replace(/\bBieńkk\b/gi, 'Bieniek');

     // ── NUCLEAR SCORER FIX v2 ──────────────────────────────────────────────
     // Deterministyczna podmiana złego gracza na scoringPlayer.
     // Pattern nazwy: wielka litera + min 3 znaki (obsługuje McCarthy, Grozdanov itp.)
     if (scoringPlayer) {
       const spParts = scoringPlayer.split(' ');
       const spFirst = spParts[0];
       const spLast  = spParts[spParts.length - 1];
       // Imię uważamy za "scorera" jeśli którykolwiek człon nazwiska pasuje
       const isScorer = (name: string): boolean =>
         name === spFirst || name === spLast ||
         scoringPlayer.includes(name) || name.includes(spFirst) ||
         (spParts.length > 1 && name.includes(spLast));

       // Pełna lista: "[Gracz] [verb scoring]" → "[scoringPlayer] [verb]"
       // Pattern [A-Z][A-Za-z...]{3,} łapie McCarthy, Grozdanov, Bieniek, Bołądź itp.
       // min 4 znaki total = nie łapie "Mc" ani innych skrótów
       const NAME = '([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})';
       const fixes: Array<[string, string]> = [
         [`${NAME} wbija piłkę w boisko`,   'wbija piłkę w boisko'],
         [`${NAME} wbija piłkę`,            'wbija piłkę'],
         [`${NAME} wbija w boisko`,         'wbija w boisko'],
         [`${NAME} wbija punkt`,            'wbija punkt'],
         [`${NAME} zamyka (?:tę |tą )?wymianę`, 'zamyka akcję'],
         [`${NAME} zamyka akcję`,           'zamyka akcję'],
         [`${NAME} zamyka (?:tę |ten )?punkt`, 'zamyka akcję'],
         [`${NAME} przebija (?:jego |jej |ich )?blok`, 'przebija blok'],
         [`${NAME} muruje siatkę`,          'blokuje'],
         [`${NAME} zdobywa punkt`,           'zdobywa punkt'],
         [`${NAME} punktuje`,                'zdobywa punkt'],
         [`${NAME} kończy akcję`,            'zdobywa punkt'],
       ];

       fixes.forEach(([pattern, replacement]) => {
         const re = new RegExp(pattern, 'g');
         t = t.replace(re, (match: string, name: string) =>
           isScorer(name) ? match : `${scoringPlayer} ${replacement}`
         );
       });
     }

     // "[Nazwa drużyny lub prefiks] [Gracz] zdobywa" → "[Gracz] zdobywa"
     // GPT czasem pisze 'PGE Projekt Kochanowski' zamiast 'PGE Projekt Warszawa Kochanowski'
     // Sprawdzamy każdy prefiks nazwy drużyny (od najdłuższego)
     // "[Prefix nazwy drużyny] [Gracz] zdobywa" — GPT wkleja prefiks przed nazwiskiem
     // Statyczne wzorce dla PlusLigi (bezpieczne dla SWC — tylko t.replace())
     t = t.replace(/\bPGE Projekt\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bAluron CMC Warta Zawiercie\s+(?!Zawiercie\s)([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bAluron CMC Warta\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bAluron CMC\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bAluron\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bPGE Projekt Warszawa\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bPGE Projekt\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bJSW Jastrzębski Węgiel\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bJSW Jastrzębski\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bSteam Hemarpol Politechnika Częstochowa\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bSteam Hemarpol Politechnika\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bSteam Hemarpol\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bŚlepsk Malow Suwałki\s+(?!Suwałki\s)([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bŚlepsk Malow\s+(?!Suwałki\s|Malow\s)([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bZAKSA Kędzierzyn-Koźle\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bZAKSA Kędzierzyn-([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bZAKSA\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bEnerga Trefl Gdańsk\s+(?!Gdańsk\s)([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bEnerga Trefl\s+(?!Gdańsk\s|Gdansk\s)([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bAsseco Resovia Rzeszów\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bAsseco Resovia\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bIndykpol AZS Olsztyn\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bIndykpol AZS\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bPGE GiEK SKRA Bełchatów\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bPGE GiEK SKRA\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bBOGDANKA LUK Lublin\s+(?!Lublin\s)([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bBOGDANKA LUK\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bBogdanka LUK Lublin\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bBogdanka LUK\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bBOGDANKA\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bBarkom Każany Lwów\s+(?!Lwów\s)([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bInPost ChKS Chełm\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bInPost CHKS Chełm\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bInPost ChKS\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bCuprum Stilon Gorzów\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bCuprum Stilon\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bŚlepsk Malow Suwałki\s+(?!Suwałki\s)([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bŚlepsk Malow\s+(?!Suwałki\s|Malow\s)([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bPGE GiEK SKRA Bełchatów\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bPGE GiEK SKRA\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bPGE GiEK\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bSteam Hemarpol Politechnika Częstochowa\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bSteam Hemarpol Politechnika\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bSteam Hemarpol\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bEnerga Trefl Gdańsk\s+(?!Gdańsk\s)([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bEnerga Trefl\s+(?!Gdańsk\s|Gdansk\s)([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');
     t = t.replace(/\bZAKSA Kędzierzyn-Koźle\s+([A-Z\u0104-\u017E][A-Za-z\u00C0-\u017E]{3,})\s+(zdobywa|wbija|zamyka|blokuje)/g, '$1 $2');

     // "X popełnia błąd [desc]. X zdobywa punkt." — NONSENS (ten sam gracz popełnia błąd i zdobywa)
     // Dotyczy: błąd serwisowy, błąd w przyjęciu, błąd ataku
     // Pattern A: "X popełnia błąd w przyjęciu [i/,] X zdobywa punkt"
     t = t.replace(/([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E]{3,}) popełnia błąd w przyjęciu[^.!,]*[i,] \1 zdobywa punkt[^.!]*/gi, '$1 popełnia błąd w przyjęciu!');
     t = t.replace(/([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E]{3,}) popełnia błąd w przyjęciu[^.!]*[.!,]\s*\1 zdobywa punkt[^.!]*/gi, '$1 popełnia błąd w przyjęciu!');
     t = t.replace(/błąd w przyjęciu ([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E]{3,})[^.!]*i \1 zdobywa punkt[^.!]*/gi, 'błąd w przyjęciu $1!');
     // Pattern B: X popełnia błąd. X zdobywa punkt. (dokładnie ten sam gracz)
     t = t.replace(
       /([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E]{3,}) popełnia błąd[^.!]*[.!]\s*\1 zdobywa punkt[^.!]*[!.]?/gi,
       (m: string, p: string) => `${p} popełnia błąd!`
     );
     // Pattern C: "X myli się w ataku! X zdobywa punkt" — ten sam wzorzec co błąd
     // myli się + zdobywa — separator może być . ! lub — (em dash)
     t = t.replace(/([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E]{3,}) myli się w ataku[^.!—]*[.!—]\s*\1 zdobywa punkt[^.!]*/gi, '$1 myli się w ataku!');
     t = t.replace(/([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E]{3,}) myli się w przyjęciu[^.!—]*[.!—]\s*\1 zdobywa punkt[^.!]*/gi, '$1 myli się w przyjęciu!');
     t = t.replace(/([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E]{3,}) myli się[^.!—]{0,30}[.!—]\s*\1 zdobywa punkt[^.!]*/gi, '$1 myli się!');
     // myli się w ataku i [Team Prefix] [Gracz] zdobywa — team prefix wklejony przed scorer
     t = t.replace(/([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E]{3,}) myli się w ataku[^.!]*[.!]?\s*(?:[A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E\s]{3,20})\1 zdobywa punkt[^.!]*/gi, '$1 myli się w ataku!');
     // Pattern D: "Błąd X i X zdobywa punkt" (F74) — ten sam gracz błądzi i 'zdobywa'
     t = t.replace(/[Bb]łąd ([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E]{3,}) i \1 zdobywa punkt[^.!]*/gi, 'Błąd $1!');
     // Pattern E: "[Team prefix] X zdobywa punkt" po błędzie ataku (team ucięty)
     // np. 'Asseco Szerszeń zdobywa punkt' gdy Szerszeń właśnie popełnił błąd
     // → złapane przez istniejące nuclear + team prefix fix
     // Pattern 2: X popełnia błąd serwisowy. [Team] X zdobywa punkt. (gracz po nazwie drużyny)
     t = t.replace(
       /([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E]{3,}) popełnia błąd serwisowy[^.!]*[.!]([\s\S]{1,120}?)\1 zdobywa punkt[^.!]*[!.]?/gi,
       (m: string, p: string) => `${p} popełnia błąd serwisowy!`
     );
     // Pattern 3: popełnia błąd serwisowy. [Drużyna] odpowiada, zdobywając punkt
     t = t.replace(
       /(popełnia błąd serwisowy[^.!]*[.!])\s*([A-ZŁŚŹĆĘÓĄŃ][^,]{5,50}),\s*zdobywając punkt/gi,
       '$1 $2 zdobywa punkt'
     );
     // "Obrona [X] nie wystarczyła" — usuń nazwisko obrońcy (i tak błędne creditowanie)
     // Zostaje samo "Obrona nie wystarczyła" jako neutralny kontekst
     t = t.replace(/[Oo]brona [A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń']+ nie wystarczyła/g, 'Obrona nie wystarczyła');
     // "serwis w salto" → "serwis z wyskoku" (błędna forma)
     t = t.replace(/serwis(?:em)? w salto/gi, 'serwis z wyskoku');
     t = t.replace(/zagrywka w salto/gi, 'zagrywka z wyskoku');
     // "znowu" / "znów" / "ponownie" — GPT nadużywa, usuń bezwarunkowo
     t = t.replace(/\bznowu\b/gi, '');
     t = t.replace(/\bznów\b/gi, '');    // wariant z ó — też zakazany
     t = t.replace(/\bpownie\b/gi, '');   // literówka GPT
     t = t.replace(/\bponownie\b/gi, '');
     t = t.replace(/  +/g, ' '); // cleanup podwójnych spacji po usunięciu
     // Średnik po zdobyciu punktu → wykrzyknik
     t = t.replace(/(zdobywa punkt);/gi, '$1!');
     t = t.replace(/(wbija piłkę w boisko);/gi, '$1!');
     t = t.replace(/(blokuje — punkt);/gi, '$1!');
     // Brakujące "punkt" przed "dla X"
     t = t.replace(/serwisowy i dla ([A-ZŁŚŹĆĘÓĄŃ])/gi, 'serwisowy — punkt dla $1');
     t = t.replace(/serwisowy — dla ([A-ZŁŚŹĆĘÓĄŃ])/gi, 'serwisowy — punkt dla $1');
     t = t.replace(/w boisko, dla ([A-ZŁŚŹĆĘÓĄŃ])/gi, 'w boisko — punkt dla $1');
     // "Zdobyte!" bez kontekstu
     t = t.replace(/[!.] Zdobyte[!.]\s*$/gi, '!');
     t = t.replace(/ Zdobyte[!.]\s*$/gi, '!');
     // "wraca do gry" — TYLKO przy comeback 5+ punktów straty (scoreDiff dostępny przez closure)
     if (scoreDiff < 5) {
       t = t.replace(/\bwraca do gry i odskakuje/gi, 'odskakuje');
       t = t.replace(/\bwraca do gry i prowadzi/gi, 'prowadzi');
       t = t.replace(/\bwraca do gry!$/gim, 'odpowiada!');
       t = t.replace(/\bwraca do gry!/gi, 'odpowiada!');
       t = t.replace(/\bwraca do gry,\s*/gi, '');
       t = t.replace(/\bwraca do gry\b/gi, 'odpowiada');
     }
     t = t.replace(/ i wraca do gry/gi, '');
     // Deduplikacja po replace wraca do gry → odpowiada
     t = t.replace(/odpowiada i odpowiada/gi, 'odpowiada');

     // ── Błąd serwisowy: podmiana scorera + odpowiada ────────────────────────
     // '[X] błąd serwisowy. [X] zdobywa punkt' = NONSENS — X STRACIŁ punkt!
     // Bezpieczna forma: kasujemy '[X] zdobywa punkt' po 'błąd serwisowy X'
     t = t.replace(/([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń']{3,}) popełnia błąd serwisowy[^.!,—]*[,.!—]\s*\1 zdobywa punkt[^.!]*[.!]?/gi, '$1 popełnia błąd serwisowy!');
     t = t.replace(/Błąd serwisowy ([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń']{3,})[^.!]*[.!]\s*\1 zdobywa punkt[^.!]*/gi, 'Błąd serwisowy $1');
     // '[X] błąd serwisowy X. [drużyna] X zdobywa punkt' (team+imię wklejone)
     t = t.replace(/błąd serwisowy ([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń']{3,})[^.!]*[.!][^.!]{0,80}\1 zdobywa punkt[^.!]*/gi, 'błąd serwisowy $1!');
     // Wariant: 'błąd serwisowy. [Team prefix] [X] zdobywa' — team prefix wklejony
     t = t.replace(/(popełnia błąd serwisowy)[^.!]*[.!]\s*(?:[A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E]{2,}\s+){1,4}(zdobywa punkt[^.!]*)/gi, '$1!');
     if (/błąd serwisow/i.test(t)) {
       // 'dokręca śrubę / rośnie w siłę / buduje przewagę' po błędzie serwisowym
       // = drużyna dostaje punkt za darmo, nie dzięki własnemu wysiłkowi
       t = t.replace(/i dokręca śrubę!?$/gim, 'i wychodzi na prowadzenie!');
       t = t.replace(/i dokręca śrubę/gi, '');
       t = t.replace(/i rośnie w siłę!?$/gim, '!');
       t = t.replace(/prowadzi i rośnie w siłę!/gi, 'prowadzi!');
       t = t.replace(/wychodzi na prowadzenie i rośnie w siłę!/gi, 'wychodzi na prowadzenie!');
       t = t.replace(/i rośnie w siłę/gi, '');
       t = t.replace(/i buduje przewagę!?$/gim, '!');
       t = t.replace(/i buduje przewagę/gi, '');
       t = t.replace(/i nie odpuszcza!?$/gim, '!');
       t = t.replace(/ i nie odpuszcza!/gi, '!');
       t = t.replace(/ nie odpuszcza i zdobywa punkt/gi, ' zdobywa punkt');
       // '[Drużyna] odpowiada, nie odpuszcza' → '[Drużyna] zdobywa punkt i nie odpuszcza'
       t = t.replace(
         /([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E\s]{4,40}) odpowiada, nie odpuszcza/g,
         '$1 zdobywa punkt i nie odpuszcza'
       );
       t = t.replace(
         /([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E\s]{4,40}) odpowiada i nie odpuszcza/g,
         '$1 zdobywa punkt i nie odpuszcza'
       );
       t = t.replace(
         /([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E\s]{4,40}) odpowiada i powiększa przewagę/g,
         '$1 powiększa przewagę'
       );
       // '[Drużyna] odpowiada!' na końcu zdania → '[Drużyna] zdobywa punkt!'
       t = t.replace(
         /([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E\s]{4,40}) odpowiada!/g,
         '$1 zdobywa punkt!'
       );
       // '[Drużyna] odpowiada i zmniejsza stratę' → bez 'odpowiada'
       t = t.replace(
         /([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E\s]{4,40}) odpowiada i (zmniejsza|wyrównuje|odskakuje)/g,
         '$1 $2'
       );
     }
     t = t.replace(/i odpowiada i odpowiada/gi, 'i odpowiada');
     // "ale I to punkt" — artifact po score suppression (ale [wynik usunięty] I to punkt)
     // Pattern: "..., ale I to jest punkt dla X!" → "... — punkt!"
     t = t.replace(/,?\s*ale [Ii] to jest punkt dla [^!.]+[!.]/g, ' — punkt!');
     t = t.replace(/,?\s*ale [Ii] to punkt dla [^!.]+[!.]/g, ' — punkt!');
          t = t.replace(/\bgra trwa\b/gi, 'akcja trwa');
     // podwójny scoring: 'wpada w boisko! Wbija piłkę w boisko'
     t = t.replace(/wpada w boisko[!.]\s*Wbija piłkę w boisko[!.]?/gi, 'wpada w boisko!');
     t = t.replace(/wpada w boisko[!.]\s*([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+) wbija piłkę[^!]*/gi, 'wpada w boisko!');
     // 'tipem' / 'tipa' — angielski! ZAKAZ (F-tip). Użyj: kiwką, delikatnym atakiem
     t = t.replace(/precyzyjnym tipem/gi, 'precyzyjną kiwką');
     t = t.replace(/delikatnym tipem/gi, 'delikatną kiwką');
     t = t.replace(/zaskakuje tipem/gi, 'zaskakuje kiwką');
     t = t.replace(/kończy tipem/gi, 'kończy kiwką');
     t = t.replace(/atakuje tipem/gi, 'atakuje kiwką');
     t = t.replace(/atak tipem/gi, 'atak kiwką');
     t = t.replace(/z tipem/gi, 'kiwką');
     t = t.replace(/tipem/gi, 'kiwką');
     t = t.replace(/z tipa/gi, 'kiwką');
     t = t.replace(/tipa/gi, 'kiwki');
     t = t.replace(/pipe'a/gi, 'pipe');
     t = t.replace(/z pipe'a/gi, 'z pipe');
     t = t.replace(/pipe'em/gi, 'pipe');
     // F4: 'wyciąga z podłogi' → zakaz
     t = t.replace(/wyciąga z podłogi/gi, 'ratuje piłkę w obronie');
     t = t.replace(/wyciągnął z podłogi/gi, 'obronił piłkę');
     t = t.replace(/wyciągając z podłogi/gi, 'ratując piłkę');
     // 'wyblok — wyblok' / 'wyblok, wyblok' — masło maślane
     t = t.replace(/wyblok[,—–\-\s]+wyblok/gi, 'wyblok');  // em/en-dash/myślnik
     t = t.replace(/wyblok [—–\-] wyblok/gi, 'wyblok');  // z spacjami
     t = t.replace(/wyblok, wyblok/gi, 'wyblok');
     t = t.replace(/wyblok–wyblok/g, 'wyblok');
     t = t.replace(/wyblok—wyblok/g, 'wyblok');
     t = t.replace(/wyblok-wyblok/gi, 'wyblok');
     t = t.replace(/jest wyblokowany[,—–\s]+wyblok/gi, 'wyblok');
     t = t.replace(/wyblokowany[,—–\s]+wyblok/gi, 'wyblok');
     t = t.replace(/jest wyblokowany, akcja trwa/gi, 'wyblok — akcja trwa');
     t = t.replace(/wyblokował piłkę[,—–\s]+wyblok/gi, 'wyblok');
     t = t.replace(/wyblok piłkę i wyblok/gi, 'wyblok');
     t = t.replace(/dotyka bloku[,—–\s]+wyblok piłkę/gi, 'napotyka blok — wyblok');
     t = t.replace(/wyblok — akcja trwa! wyblok/gi, 'wyblok — akcja trwa!');
     // 'ČČ' / 'Čč' — podwójny znak diakrytyczny (GPT/encoding bug)
     t = t.replace(/ČČ/g, 'Č');
     t = t.replace(/Čč/g, 'Č');
     t = t.replace(/čč/g, 'č');
     // "ale piłka wychodzi" bez dopełnienia — zawsze dodaj kontekst (F78)
     // Deterministyczna rotacja oparta na długości tekstu (bez Math.random)
     // 'ale piłka wychodzi!' bez dopełnienia → dodaj (F78)
     // Tylko gdy po 'wychodzi' nie ma już słów (unikamy podwójnego dopełnienia)
     t = t.replace(/ale piłka wychodzi!/gim, 'ale piłka wychodzi poza boisko!');
     t = t.replace(/— piłka wychodzi!/gim, '— piłka wychodzi poza boisko!');
     t = t.replace(/jednak piłka wychodzi!/gim, 'jednak piłka wychodzi poza boisko!');
     t = t.replace(/lecz piłka wychodzi!/gim, 'lecz piłka wychodzi poza boisko!');
     t = t.replace(/a piłka wychodzi!/gim, 'a piłka wychodzi poza boisko!');
     t = t.replace(/(?<!poza |na aut|za linię|\w )piłka wychodzi!$/gim, 'piłka wychodzi poza boisko!');
     // Cleanup podwójnego dopełnienia: 'poza X poza boisko' → 'poza X'
     t = t.replace(/poza (pole gry|boisko|autem?) poza boisko/gi, 'poza $1');
     t = t.replace(/na aut poza boisko/gi, 'na aut');
     t = t.replace(/za linię poza boisko/gi, 'za linię');
     // 'powiększa impet' — nie jest frazą siatkówkową, zbyt mechaniczne
     t = t.replace(/powiększa impet!/gi, 'rośnie w siłę!');
     t = t.replace(/powiększa impet/gi, 'rośnie w siłę');
     // 'Seria trzech punktów' urwane — dodaj wykrzyknik
     t = t.replace(/Seria (\w+ )?punktów$/gim, 'Seria $1punktów!');
     // "piłka odpowiada" — bez sensu, nic nie znaczy
     t = t.replace(/piłka odpowiada!/gi, 'akcja trwa!');
     t = t.replace(/wyblok i piłka odpowiada/gi, 'wyblok — akcja trwa');
     t = t.replace(/piłka odpowiada/gi, 'akcja trwa');
     // "trafia w blok, ale X dotyka bloku" — masło maślane (trafia + dotyka w tym samym zdaniu)
     t = t.replace(/trafia w blok, ale ([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+ [A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+) dotyka bloku[,—–]?\s*wyblok/gi,
       'napotyka blok $1 — wyblok');
     t = t.replace(/trafia w blok, ale ([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+) dotyka bloku[,—–]?\s*wyblok/gi,
       'napotyka blok $1 — wyblok');
     // "dotyka blok," (bez poprzedniego trafia) — zostaw, może być poprawne
     // "Wilfredo [Drużyna]" — imię bez nazwiska + team name (GPT obciął Leon)
     t = t.replace(/\bWilfredo BOGDANKA\b/g, 'Wilfredo Leon');
     t = t.replace(/\bWilfredo Aluron\b/gi, 'Wilfredo Leon');
     t = t.replace(/\bWilfredo CMC\b/gi, 'Wilfredo Leon');
     // "McCarthy'ego McCarthy" — podwójne imię (dopełniacz + mianownik)
     t = t.replace(/McCarthy'ego McCarthy/gi, 'McCarthy');
     t = t.replace(/Bołądzia Bołądź/gi, 'Bołądź');
     t = t.replace(/Kwolka Kwolek/gi, 'Kwolek');
     t = t.replace(/Bieńka Bieniek/gi, 'Bieniek');
     t = t.replace(/Leona Leon\b/gi, 'Leon');
     t = t.replace(/Russella Russell\b/gi, 'Russell');
     // "poza systemem" — anglicyzm techniczny, zbyt specjalistyczny
     t = t.replace(/przyjmuje daleko od siatki i poza systemem/gi, 'przyjmuje daleko od siatki, zmuszając rozgrywającego do trudnego wystawienia');
     t = t.replace(/przyjmuje poza systemem i daleko od siatki/gi, 'przyjmuje daleko od siatki');
     t = t.replace(/przyjmuje poza systemem/gi, 'przyjmuje daleko od siatki');
     t = t.replace(/poza systemem/gi, 'daleko od siatki');
     // Pleonazmy
     t = t.replace(/po znakomicie przyjętym przyjęciu/gi, 'po znakomitym przyjęciu');
     t = t.replace(/po perfekcyjnie przyjętym przyjęciu/gi, 'po perfekcyjnym przyjęciu');
     t = t.replace(/po (?:\w+ )?przyjętym przyjęciu/gi, 'po przyjęciu');
     t = t.replace(/przyjęte przyjęcie/gi, 'przyjęcie');
     // duplikat 'zdobywa ... zdobywa punkt'
     t = t.replace(/zdobywa (\w+ )?zdobywa punkt/gi, 'zdobywa punkt');
     // "kolejny punkt" = ukryte 'znowu' (F75) — usuń przymiotnik
     t = t.replace(/zdobywa kolejny punkt/gi, 'zdobywa punkt');
     t = t.replace(/zdobywa kolejne punkty/gi, 'zdobywa punkty');
     t = t.replace(/kolejny punkt dla/gi, 'punkt dla');
     // Podwójne creditowanie: 'X wbija piłkę i X zdobywa punkt' → 'X wbija piłkę'
     t = t.replace(
       /([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E]{3,}) wbija piłkę[^.!]*[.!]?\s*\1 zdobywa punkt[^.!]*/gi,
       '$1 wbija piłkę w boisko!'
     );
     // 'X wbija piłkę i X zdobywa' (w jednym zdaniu)
     t = t.replace(
       /([A-ZŁŚŹĆĘÓĄŃ][A-Za-z\u00C0-\u017E]{3,}) wbija piłkę w boisko i \1 zdobywa punkt/gi,
       '$1 wbija piłkę w boisko'
     );
     t = t.replace(/zdobywa punkt i zdobywa punkt/gi, 'zdobywa punkt');
     // "Wilfredo punkt w secie" — imię bez czasownika (urwane przez GPT)
     t = t.replace(/([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+) punkt w secie!/gi, '$1 zdobywa punkt w secie!');
     t = t.replace(/([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+) punkt w meczu!/gi, '$1 zdobywa punkt w meczu!');
     // "Pilkę" → "Piłkę" (brak diakrytyku)
     t = t.replace(/\bPilkę\b/g, 'Piłkę');
     t = t.replace(/\bpilkę\b/g, 'piłkę');
     t = t.replace(/\bPilka\b/g, 'Piłka');
     // "Henir Henno" → "Henno" (błędne imię GPT — profil mówi samo Henno)
     t = t.replace(/Henir Henno/gi, 'Henno');
     t = t.replace(/Henir/gi, 'Henno');
     // Odmiana po 'po ataku X' — deterministyczna dla najczęstszych zawodników
     t = t.replace(/po ataku Esfandiar([^a-zA-Z])/g, 'po ataku Esfandiarze$1');
     t = t.replace(/po ataku Bołądź([^a-zA-Z])/g, 'po ataku Bołądzia$1');
     t = t.replace(/po ataku Kwolek([^a-zA-Z])/g, 'po ataku Kwolka$1');
     t = t.replace(/po ataku Sasak([^a-zA-Z])/g, 'po ataku Sasaka$1');
     t = t.replace(/po ataku Russell([^a-zA-Z])/g, 'po ataku Russella$1');
     t = t.replace(/po ataku Leon([^a-zA-Z])/g, 'po ataku Leona$1');
     t = t.replace(/po ataku Schulz([^a-zA-Z])/g, 'po ataku Schulza$1');
     t = t.replace(/po ataku Brand([^a-zA-Z])/g, 'po ataku Branda$1');
     t = t.replace(/po ataku Orczyk([^a-zA-Z])/g, 'po ataku Orczyka$1');
     t = t.replace(/po ataku Souza([^a-zA-Z])/g, 'po ataku Souzy$1');
     t = t.replace(/po ataku Nowak([^a-zA-Z])/g, 'po ataku Nowaka$1');
     t = t.replace(/po ataku Grozdanov([^a-zA-Z])/g, 'po ataku Grozdanova$1');
     t = t.replace(/po ataku Fornal([^a-zA-Z])/g, 'po ataku Fornala$1');
     t = t.replace(/po ataku Semeniuk([^a-zA-Z])/g, 'po ataku Semeniuka$1');
     t = t.replace(/po ataku Szalpuk([^a-zA-Z])/g, 'po ataku Szalpuka$1');
     t = t.replace(/po ataku Gierżot([^a-zA-Z])/g, 'po ataku Gierżota$1');
     t = t.replace(/po ataku Koppers([^a-zA-Z])/g, 'po ataku Koppersa$1');
     t = t.replace(/po ataku Rychlicki([^a-zA-Z])/g, 'po ataku Rychlickiego$1');
     t = t.replace(/po ataku Lipiński([^a-zA-Z])/g, 'po ataku Lipińskiego$1');
     t = t.replace(/po ataku McCarthy([^a-zA-Z])/g, "po ataku McCarthy'ego$1");
     t = t.replace(/po ataku Tillie([^a-zA-Z])/g, 'po ataku Tilliego$1');
     t = t.replace(/po ataku Toniutti([^a-zA-Z])/g, 'po ataku Toniuttiego$1');
     t = t.replace(/po ataku Hadrava([^a-zA-Z])/g, 'po ataku Hadravy$1');
     t = t.replace(/po ataku Nowakowski([^a-zA-Z])/g, 'po ataku Nowakowskiego$1');
     t = t.replace(/po ataku Kochanowski([^a-zA-Z])/g, 'po ataku Kochanowskiego$1');
     t = t.replace(/po ataku Majchrzak([^a-zA-Z])/g, 'po ataku Majchrzaka$1');
     t = t.replace(/po ataku Halaba([^a-zA-Z])/g, 'po ataku Halaby$1');
     t = t.replace(/po ataku Indra([^a-zA-Z])/g, 'po ataku Indry$1');
     t = t.replace(/po ataku Adamczyk([^a-zA-Z])/g, 'po ataku Adamczyka$1');
     t = t.replace(/po ataku Ciunajtis([^a-zA-Z])/g, 'po ataku Ciunajtisa$1');
     t = t.replace(/po ataku Popiela([^a-zA-Z])/g, 'po ataku Popieli$1');
     t = t.replace(/po ataku Siwczyk([^a-zA-Z])/g, 'po ataku Siwczyka$1');
     t = t.replace(/po ataku Gierżot([^a-zA-Z])/g, 'po ataku Gierżota$1');
     t = t.replace(/po ataku Stępień([^a-zA-Z])/g, 'po ataku Stępnia$1');
     t = t.replace(/po ataku Butryn([^a-zA-Z])/g, 'po ataku Butryna$1');
     t = t.replace(/po ataku Pietras([^a-zA-Z])/g, 'po ataku Pietrasa$1');
     t = t.replace(/po ataku Amirhosseina Esfandiar([^a-z])/g, 'po ataku Esfandiarze$1');
     // 'serwuje w salto' — nie istnieje w polskiej siatkówce
     t = t.replace(/serwuje w salto/gi, 'serwuje z wyskoku');
     t = t.replace(/zagrywka w salto/gi, 'zagrywka z wyskoku');
     t = t.replace(/zagrywkę w salto/gi, 'zagrywkę z wyskoku');
     t = t.replace(/serwisem w salto/gi, 'zagrywką z wyskoku');
     // Urwany komentarz — 'muruje siatkę i!' / 'blokuje i!' itp.
     // GPT zaczął zdanie ale token limit uciął. Czyścimy wisielcze 'i!'
     t = t.replace(/ i!$/gm, '!');
     t = t.replace(/ i! /g, '! ');
     t = t.replace(/ ale!$/gm, '!');
     t = t.replace(/ ale$/gm, ' ale nie zatrzymuje piłki!');
     t = t.replace(/ lecz$/gm, ' lecz piłka wychodzi!');
     t = t.replace(/ lecz!$/gm, '!');
     // "piłka żyje" — absolutny zakaz F52 (wszystkie warianty)
     t = t.replace(/piłka wciąż żyje!/gi, 'akcja trwa!');
     t = t.replace(/piłka wciąż żyje/gi, 'akcja trwa');
     t = t.replace(/piłka nadal żyje!/gi, 'akcja trwa!');
     t = t.replace(/piłka nadal żyje/gi, 'akcja trwa');
     t = t.replace(/piłka żyje!/gi, 'akcja trwa!');
     t = t.replace(/piłka żyje/gi, 'akcja trwa');
     // 'piłka wraca do gry' przy wybloku → akcja trwa
     t = t.replace(/wyblok, piłka wraca do gry/gi, 'wyblok — akcja trwa');
     t = t.replace(/piłka wraca do gry/gi, 'akcja trwa');
     t = t.replace(/pilka zyje!/gi, 'akcja trwa!');
     t = t.replace(/pilka zyje/gi, 'akcja trwa');
     // Bezsensowne frazy GPT w długich wymianach
     t = t.replace(/,? ale nie wyobraża sobie już obrony[^.!]*/gi, '');
     t = t.replace(/piłka utrzymana,? ale nie wyobraża[^.!]*/gi, 'piłka utrzymana!');
     // "mimo wszystkiego" — dziwna forma
     t = t.replace(/mimo wszystkiego/gi, 'mimo to');
     // "staje na wysokości zadania" — klisze, zastępujemy rotacją
     t = t.replace(/staje na wysokości zadania/gi, () => {
       const v = ['odpowiada na wyzwanie', 'nie zawodzi', 'jest niesamowity', 'robi co do niego należy'];
       return v[Math.floor(Math.random() * v.length)];
     });
     // "powiększa przewagę" — zbyt mechaniczne, rotacja
     t = t.replace(/i powiększa przewagę!$/gim, 'i rośnie w siłę!');
     t = t.replace(/i powiększa przewagę!/gi, 'i dokręca śrubę!');
     t = t.replace(/powiększa przewagę i prowadzi/gi, 'prowadzi i dokręca śrubę');
     t = t.replace(/powiększa przewagę, prowadz/gi, 'prowadz');
     t = t.replace(/powiększa przewagę\.$/gim, 'prowadzi pewnie.');
     t = t.replace(/powiększa przewagę!/gi, 'rośnie w siłę!');
     t = t.replace(/powiększa przewagę/gi, 'buduje przewagę');
     t = t.replace(/\bżywa zagrywka\b/gi, 'zagrywka szybująca');
     t = t.replace(/\bżywą zagrywką\b/gi, 'zagrywką szybującą');
     t = t.replace(/\bżywej zagrywki\b/gi, 'zagrywki szybującej');
     t = t.replace(/\bbroni potężnym blokiem\b/gi, 'potężny blok');
     t = t.replace(/\bbroni mocnym blokiem\b/gi, 'mocny blok');
     t = t.replace(/\bwyblokowuje\b/gi, 'dotyka bloku, wyblok');
     // GPT tworzy nieprawidłowe skróty/nicknames zawodników
     t = t.replace(/\bGroza\b/g, 'Grozdanov');
     // Błędne odmiany nazwisk obcojęzycznych
     t = t.replace(/\bKarliczek\b/gi, 'Karlitzek');
     t = t.replace(/\bKarliczka\b/gi, 'Karlitzka');
     t = t.replace(/\bKarliczkiem\b/gi, 'Karlitzkiem');
     t = t.replace(/\bKarllitzek\b/gi, 'Karlitzek');   // podwójne l
     t = t.replace(/\bKarllitzka\b/gi, 'Karlitzka');
     t = t.replace(/\bBienioka\b/gi, 'Bieńka');        // błędna germanizacja
     t = t.replace(/\bBienoka\b/gi, 'Bieńka');
     // Zduplikowane litery w nazwiskach (GPT typos)
     // "bleduje" nie istnieje po polsku
     t = t.replace(/\bleduje\b/gi, 'popełnia błąd');
     t = t.replace(/\bledowania\b/gi, 'błędów');
     // "blad" bez ł
     t = t.replace(/\bblad\b/gi, 'błąd');
     t = t.replace(/\bBLAD\b/g, 'BŁĄD');
     t = t.replace(/\bBieńkk\b/gi, 'Bieniek');
     t = t.replace(/\bGrozy\b/g, 'Grozdanova');
     t = t.replace(/\bBień\b/g, 'Bieniek');
     t = t.replace(/\bBieńk\b/g, 'Bieniek');
     t = t.replace(/\bBienk\b/g, 'Bieniek');
     t = t.replace(/\bwyblokowują\b/gi, 'dotykają bloku, wyblok');
     t = t.replace(/\bwyblokowuję\b/gi, 'dotykam bloku, wyblok');

     // ── SŁOWNIK KOREKT PL ────────────────────────────────────────────────
     if (lang === 'pl') {
       // Gramatyka ataku
       t = t.replace(/atakuje na pierwszym tempie/gi, 'atakuje z pierwszego tempa');
       t = t.replace(/pierwszotempowym atakiem/gi, 'atakiem z pierwszego tempa');
       t = t.replace(/pierwszotempowy atak/gi, 'atak z pierwszego tempa');
       // Duplikat frazy ataku (GPT powtarza)
       t = t.replace(/z linii drugiej z drugiej linii/gi, 'z drugiej linii');
       // Duplikat z przerwą: "z linii drugiej [słowa] z drugiej linii"
       t = t.replace(/z linii drugiej\b([^.!?]{0,30}?)\bz drugiej linii/gi, 'z drugiej linii$1');
       // "atakuje z linii drugiej z linii"
       t = t.replace(/z linii drugiej z linii/gi, 'z drugiej linii');
       t = t.replace(/z lewego skrzydła z lewej strony/gi, 'z lewego skrzydła');
       t = t.replace(/z prawego skrzydła z prawej strony/gi, 'z prawego skrzydła');
       t = t.replace(/atakuje na pierwszym tempo/gi, 'atakuje z pierwszego tempa');
       t = t.replace(/atakuje pierwszym tempem/gi, 'atakuje z pierwszego tempa');
       t = t.replace(/atakuje pierwszym tempo/gi, 'atakuje z pierwszego tempa');
       t = t.replace(/atak na pierwszym temp/gi, 'atak z pierwszego tempa');
       t = t.replace(/kończy pierwszym tempem/gi, 'kończy z pierwszego tempa');
       t = t.replace(/\bpierwszym tempem\b/gi, 'z pierwszego tempa');

       // Gramatyka wystawy
       t = t.replace(/wystawia dla /gi, 'wystawia do ');
       t = t.replace(/wystawia piłkę dla /gi, 'wystawia piłkę do ');
       t = t.replace(/ustawia piłkę dla /gi, 'ustawia piłkę do ');
       t = t.replace(/ustawia dla /gi, 'wystawia do ');
       t = t.replace(/podaje dla /gi, 'podaje do ');

       // Gramatyka przyjęcia
       t = t.replace(/\breceptura\b/gi, 'przyjęcie');
       t = t.replace(/piłka odbija się daleko od siatki/gi, 'piłka przyjęta daleko od siatki');
       // konczy/konczac bez polskich znakow
       t = t.replace(/konczy /g, 'kończy ');
       t = t.replace(/konczy!/g, 'kończy!');
       t = t.replace(/zagrwal/g, 'zagrał');
       t = t.replace(/zagrywal/g, 'zagrywał');

       // Okrzyki w złym kontekście
       t = t.replace(/Genialne! /g, '');
       t = t.replace(/Genialne!$/g, '');
       t = t.replace(/Kapitalnie! /g, '');
       t = t.replace(/Kapitalnie!$/g, '');

       // "bierze" bez podmiotu → zdobywa punkt
       t = t.replace(/ bierze!/g, ' zdobywa punkt!');
       // "Resovia bierze" (urwane zdanie) → "Resovia zdobywa punkt"
       t = t.replace(/\bbierze$/gm, 'zdobywa punkt');
       t = t.replace(/\bbierze\.$/gm, 'zdobywa punkt.');
       t = t.replace(/ bierze\./g, ' zdobywa punkt.');
       t = t.replace(/ bierze /g, ' zdobywa punkt ');

       // Hoss → Thales (failsafe — wszystkie formy)
       t = t.replace(/\bHoss\b/g, 'Thales');
       t = t.replace(/\bHossa\b/g, 'Thalesa');
       t = t.replace(/\bHossowi\b/g, 'Thalesowi');

       // Deduplikacja 'Thales Thales' (efekt podwojnego replace Hoss->Thales)
       t = t.replace(/Thales Thales/g, 'Thales');
       t = t.replace(/Thalesa Thalesa/g, 'Thalesa');

       // "piłka broni się" → sensowny odpowiednik
       t = t.replace(/piłka broni się/gi, 'piłka mija blok');

       // ── Odmiana nazwisk ───────────────────────────────────────────────────
       t = t.replace(/\bKwoleka\b/g, 'Kwolka');
       t = t.replace(/\bKwoleku\b/g, 'Kwolkowi');
       t = t.replace(/\bKwolekowi\b/g, 'Kwolkowi');

       // ── Urwane frazy po score suppression ────────────────────────────────
       // Problem: score suppression usuwa liczbe z "odskakuje na 3:1!" → "odskakuje na!"
       // Fix: przywracamy sensowne zakonczenie zdania
       t = t.replace(/\bodskakuje na!/g, 'odskakuje na prowadzenie!');
       t = t.replace(/\bodskakują na!/g, 'odskakują na prowadzenie!');
       t = t.replace(/\bodskoczyli na!/g, 'odskoczyli na prowadzenie!');
       t = t.replace(/\bodskaczają na!/g, 'odskakują na prowadzenie!');
       t = t.replace(/\bodskoczyło na!/g, 'odskoczyło na prowadzenie!');
       t = t.replace(/\bwyrównując do!/g, 'wyrównując wynik!');
       t = t.replace(/\bwyrównują do!/g, 'wyrównują wynik!');
       t = t.replace(/\bwyrównuje do!/g, 'wyrównuje wynik!');
       t = t.replace(/\bzmniejsza stratę do!/g, 'zmniejsza stratę!');
       t = t.replace(/\bzmniejszają stratę do!/g, 'zmniejszają stratę!');
       // Score suppression artifacts — urwane zdania z "na" + rzeczownik bez liczby
       // np. "zdobywa punkt na siebie ciężar" ← score suppression ucięło "10." lub "XV"
       t = t.replace(/\bzdobywa punkt na siebie\b[^.!?]*/gi, 'zdobywa punkt');
       t = t.replace(/\bpunkt na siebie\b[^.!?]*/gi, 'punkt');
       // Score suppression artifacts — urwane słowa przed nazwą drużyny
       // np. "Wiesza Projekt Warszawa" ← ucięło "PGE" lub inne słowo
       t = t.replace(/\bWiesza\b/g, 'PGE Projekt');
       // Generyczny fix: słowo "zdobywa" lub "prowad" po urwanym słowie przed nazwą drużyny
       t = t.replace(/([A-ZŁŚŹŻ][a-złśźżąęóćń]+)\s+(Projekt\s+Warszawa)/g, (m, w1, w2) => {
         const knownPrefixes = ['PGE', 'Aluron', 'JSW', 'Asseco', 'Indykpol', 'Bogdanka', 'BOGDANKA'];
         if (!knownPrefixes.includes(w1)) return `PGE ${w2}`;
         return m;
       });

       // "prowadzą na" bez liczby (score suppression ucięło np. "prowadzą na 3")
       t = t.replace(/\bprowadzą na\b(?!\s+\w)/g, 'prowadzą');
       t = t.replace(/\bprowadzi na\b(?!\s+\w)/g, 'prowadzi');
       // "wychodzi na prowadzenie, prowadzą" — prowadzą jest redundantne po prowadzenie
       t = t.replace(/wychodzi na prowadzenie,\s*prowadzą[^!.]*[!.]/gi, 'wychodzi na prowadzenie!');
       t = t.replace(/obejmuje prowadzenie,\s*prowadzą[^!.]*[!.]/gi, 'obejmuje prowadzenie!');
       // "zdobywa punkt i wychodzi na prowadzenie, prowadzą!"
       t = t.replace(/,\s*prowadzą!/g, '!');

       // Okrzyki w złym kontekście — usuwamy zawsze
       t = t.replace(/\bZdobyte!\s*/g, '');
       t = t.replace(/\bPiękny punkt!\s*/g, '');
       t = t.replace(/\bNiesamowite!\s*/g, '');
       t = t.replace(/\bFantastyczne!\s*/g, '');
       t = t.replace(/\bWspaniale!\s*/g, '');
       t = t.replace(/\bGenialne!\s*/g, '');

       // ── "kończy!" przypisane do gracza który NIE zdobył punktu ─────────────
       // Warunek: team-mismatch — ostatni touch jest z drużyny która PRZEGRAŁA rally
       // Łapie: dig out, attack error, block error — każdy przypadek błędu ostatniego dotyknięcia
       const lastTouchTeam = finalTouch?.team || '';
       const lastTouchIsLoser = lastTouchTeam !== '' && lastTouchTeam !== rally.team_scored;
       if (lastTouchIsLoser ||
           scoringAction.toLowerCase().includes('error') ||
           scoringAction.toLowerCase().includes('błąd') ||
           scoringAction.toLowerCase().includes('blad')) {
         // Usuń "[loserPlayer] kończy/zamyka" — ten gracz NIE zdobył punktu
         const errorPlayerEsc = scoringPlayer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
         // Łapiemy: "kończy!", "kończy akcję", "konczy" (bez ń), "zamyka akcję"
         // Nowa szeroka wersja: usuwa "[player] kończy [cokolwiek]" do końca zdania
         t = t.replace(new RegExp(`\\b${errorPlayerEsc}\\s+ko[nń]czy[^!.\\n]*[!.]`, 'gi'), '');
         t = t.replace(new RegExp(`\\b${errorPlayerEsc}\\s+zamyka\\s+akcj[eę][^!.\\n]*[!.]`, 'gi'), '');
         // Wersja bez terminatora (gdy zdanie urywa się lub kończy myślnikiem)
         t = t.replace(new RegExp(`\\b${errorPlayerEsc}\\s+ko[n\u0144]czy[^!.\\n]*[!.]`, 'gi'), '');
         t = t.replace(new RegExp(`\\b${errorPlayerEsc}\\s+zamyka\\s+akcj[e\u0119][^!.\\n]*[!.]`, 'gi'), '');
         t = t.replace(new RegExp(`\\b${errorPlayerEsc}\\s+zamyka\\s+akcj[e\u0119](?![!.])`, 'gi'), '');
       }

       // ── "[ZłyGracz] przebija blok i kończy" gdy scoring player jest inny ─────
       // np. "Tavares przebija blok i kończy akcję! BOGDANKA wyrównuje!" gdy Leon strzelił
       // Przechwytujemy: "[Gracz] przebija blok i kończy [akcję]"
       // i jeśli Gracz ≠ scoringPlayer → zastępujemy scoringPlayer
              // Prosta wersja bez Unicode w regex (bezpieczna dla buildu)
       if (scoringPlayer) {  // sprawdzamy zawsze — GPT może błędnie przypisać kończy do dowolnego gracza
         const _sp = scoringPlayer;
         t = t.replace(/(\w+)\s+przebija\s+blok\s+i\s+ko.czy\s+akcj.[!.]?/gi, (m, p) => p.toLowerCase() !== _sp.toLowerCase() ? `${_sp} przebija blok i kończy!` : m);
         t = t.replace(/(\w+)\s+zamyka\s+akcj.[!.]?/gi, (m, p) => p.toLowerCase() !== _sp.toLowerCase() ? `${_sp} zamyka akcję!` : m);
         t = t.replace(/(\w+)\s+wyci[aą]ga\s+si[eę]\s+i\s+ko[nń]czy[^!.]*[!.]/gi, (m, p) => p.toLowerCase() !== _sp.toLowerCase() ? `${_sp} kończy akcję!` : m);
         t = t.replace(/(\w+)\s+przebija\s+blok\s+i\s+ko.czy!/gi, (m, p) => p.toLowerCase() !== _sp.toLowerCase() ? `${_sp} przebija blok i kończy!` : m);
         t = t.replace(/(\w+)\s+przebija\s+blok\s+i\s+wbija[^!]*!/gi, (m, p) => p.toLowerCase() !== _sp.toLowerCase() ? `${_sp} przebija blok i wbija piłkę w boisko!` : m);
       }
       // Podwójne "punkt punkt"
       t = t.replace(/punkt punkt/gi, 'punkt');
       t = t.replace(/zdobywa punkt punkt/gi, 'zdobywa punkt');
       t = t.replace(/zdobywa punkt pierwszy punkt/gi, 'zdobywa pierwszy punkt');
       // "punkt zdobywa punkt X" — nowa forma z nazwą gracza/drużyny
       t = t.replace(/punkt zdobywa punkt/gi, 'punkt zdobywa');
       t = t.replace(/zdobywa punkt punkt/gi, 'zdobywa punkt');
       // "zdobywa punkt kolejny punkt" — nowy duplikat
       t = t.replace(/zdobywa punkt kolejny punkt/gi, 'zdobywa kolejny punkt');
       t = t.replace(/zdobywa punkt ostatni punkt/gi, 'zdobywa ostatni punkt');
       t = t.replace(/to jego zespół zdobywa punkt ostatni punkt/gi, 'to jego zespół zdobywa ostatni punkt');
       t = t.replace(/punkt kolejny punkt/gi, 'kolejny punkt');
       // "zdobywa punkt ten punkt" — nowy duplikat
       t = t.replace(/zdobywa punkt ten punkt/gi, 'zdobywa punkt');
       t = t.replace(/\bten punkt\b/gi, 'punkt');

       // "zdobywa punkt prowadzenie" — score suppression ucięło "i obejmuje"
       t = t.replace(/zdobywa punkt prowadzenie/gi, 'zdobywa punkt i wychodzi na prowadzenie');
       t = t.replace(/zdobywa punkt i prowadzenie/gi, 'zdobywa punkt i wychodzi na prowadzenie');
       t = t.replace(/zgarnia punkt prowadzenie/gi, 'zgarnia punkt i prowadzi');
       // Samotne "prowadzenie" jako urwany fragment zdania
       t = t.replace(/([!.])\s+prowadzenie([!.])/g, '$1');
       t = t.replace(/\s+prowadzenie$/gm, '!');
     }
   }

   if (lang === 'it') {
     t = t.replace(/\bSERVICE ACE\b/gi, 'ace');
     t = t.replace(/\bSET OVER\b/gi, 'SET!');
     t = t.replace(/\bHoss\b/g, 'Thales');
     t = t.replace(/Hossa/g, 'Thalesa');
     t = t.replace(/Hossi/g, 'Thalesa');
     t = t.replace(/Hoss /g, 'Thales ');
     t = t.replace(/Hoss,/g, 'Thales,');
     t = t.replace(/Hoss!/g, 'Thales!');
     t = t.replace(/Hoss\./g, 'Thales.');
   }

   if (lang === 'de') {
     t = t.replace(/\bSERVICE ACE\b/gi, 'Aufschlag-Ass');
     t = t.replace(/\bSET OVER\b/gi, 'SATZGEWINN!');
     t = t.replace(/\bHoss\b/g, 'Thales');
     t = t.replace(/Hossa/g, 'Thalesa');
     t = t.replace(/Hossi/g, 'Thalesa');
     t = t.replace(/Hoss /g, 'Thales ');
     t = t.replace(/Hoss,/g, 'Thales,');
     t = t.replace(/Hoss!/g, 'Thales!');
     t = t.replace(/Hoss\./g, 'Thales.');
   }

   if (lang === 'tr') {
     t = t.replace(/\bSERVICE ACE\b/gi, 'servis ace');
     t = t.replace(/\bSET OVER\b/gi, 'SET BİTTİ!');
     t = t.replace(/\bHoss\b/g, 'Thales');
     t = t.replace(/Hossa/g, 'Thalesa');
     t = t.replace(/Hossi/g, 'Thalesa');
     t = t.replace(/Hoss /g, 'Thales ');
     t = t.replace(/Hoss,/g, 'Thales,');
     t = t.replace(/Hoss!/g, 'Thales!');
     t = t.replace(/Hoss\./g, 'Thales.');
     t = t.replace(/\bPunkt dla [^!.]+[!.]/g, 'Sayı!');
   }

   if (lang === 'es') {
     t = t.replace(/\bSERVICE ACE\b/gi, 'ace de saque');
     t = t.replace(/\bSET OVER\b/gi, '¡SET!');
     t = t.replace(/\bHoss\b/g, 'Thales');
     t = t.replace(/Hossa/g, 'Thalesa');
     t = t.replace(/Hossi/g, 'Thalesa');
     t = t.replace(/Hoss /g, 'Thales ');
     t = t.replace(/Hoss,/g, 'Thales,');
     t = t.replace(/Hoss!/g, 'Thales!');
     t = t.replace(/Hoss\./g, 'Thales.');
   }

   if (lang === 'pt') {
     t = t.replace(/\bSERVICE ACE\b/gi, 'ace no saque');
     t = t.replace(/\bSET OVER\b/gi, 'SET!');
     t = t.replace(/\bHoss\b/g, 'Thales');
     t = t.replace(/Hossa/g, 'Thalesa');
     t = t.replace(/Hossi/g, 'Thalesa');
     t = t.replace(/Hoss /g, 'Thales ');
     t = t.replace(/Hoss,/g, 'Thales,');
     t = t.replace(/Hoss!/g, 'Thales!');
     t = t.replace(/Hoss\./g, 'Thales.');
   }

   if (lang === 'jp') {
     t = t.replace(/SERVICE ACE/gi, 'サービスエース');
     t = t.replace(/SET OVER/gi, 'セット終了！');
     t = t.replace(/Hoss/g, 'タレス');
   }

   // ── recepcja → przyjęcie (universal) ──────────────────────────────────────
   // F61: recepcja = ABSOLUTNY ZAKAZ (kalka z ang. 'reception')
   // Obsługujemy wszystkie formy odmiany przez przypadki:
   t = t.replace(/wymusi[łl][ao]? dobr[aą] recepcj[ęą]/gi, 'wymusiła trudne przyjęcie');
   t = t.replace(/wymusza dobr[aą] recepcj[ęą]/gi, 'wymusza trudne przyjęcie');
   t = t.replace(/dobr[aą] recepcj[ęą]/gi, 'dobre przyjęcie');
   t = t.replace(/perfekcyjn[aą] recepcj[ęą]/gi, 'perfekcyjne przyjęcie');
   t = t.replace(/trudną recepcj[ęą]/gi, 'trudne przyjęcie');
   t = t.replace(/daleko[^.]{0,20}recepcj[ąę]/gi, 'daleko od siatki');
   t = t.replace(/błąd w recepcji/gi, 'błąd w przyjęciu');
   t = t.replace(/recepcj[ąę]/gi, 'przyjęcie');   // recepcją, recepcję
   t = t.replace(/recepcji/gi, 'przyjęcia');      // dopełniacz
   t = t.replace(/recepcje/gi, 'przyjęcia');      // liczba mnoga
   t = t.replace(/recepcja/gi, 'przyjęcie');      // mianownik (fallback)

   // Bieniekk — duplikat k (universal, niezależnie od języka — nazwisko zawodnika)
   t = t.replace(/Bieniekkowi/g, 'Bieńkowi');
   t = t.replace(/Bieniekkiem/g, 'Bieńkiem');
   t = t.replace(/Bieniekka/g,  'Bieńka');
   t = t.replace(/Bieniekki/g,  'Bieńki');
   t = t.replace(/Bieniekk/g,   'Bieniek');

   // ── All languages: remove score from text ────────────────────────────────
   // Score is shown in UI — never in commentary (except SET end)
   if (!setEndInfo.isSetEnd) {
     // "leads 14:11", "14:11", "14-11" patterns across all languages
     t = t.replace(/\b(leads?|führt|mène|lidera|lidera|führen|mène|portant)\s+\d{1,2}[:\-]\d{1,2}/gi, (m) => m.split(/\s+/)[0]);
     t = t.replace(/\b(prowadz[ąią\w]*|remis|wyrównu\w*|führt|lidera|vantaggio|avance|öne geçiyor)\s+\d{1,2}[:\-]\d{1,2}/gi,
       (m) => m.split(/\s+/)[0]);
          // Remove ALL X:Y scores from rally commentary — score is in UI
     // "Remis 11:11" → "Remis!" / "remis" (keep word, remove number)
     t = t.replace(/\b(Remis|remis)\s+\d{1,2}:\d{1,2}[!.]?/g, '$1!');
     // "prowadzą 14:11" → "prowadzą"
     t = t.replace(/\b(prowadz[ąiąę\w]*)\s+\d{1,2}:\d{1,2}/g, '$1');
     // "leads 14:11", "führt 14:11", etc
     t = t.replace(/\b(leads?|führt|führen|lidera|vantaggio|öne geçiyor)\s+\d{1,2}[:\-]\d{1,2}/gi, '$1');
     // "now X:Y" / "score X:Y"
     t = t.replace(/\b(now|jetzt|ahora|ora|şimdi|maintenant|agora|aktuell)\s+\d{1,2}[:\-]\d{1,2}/gi, '');
     t = t.replace(/\b(score|Spielstand|marcador|punteggio|skor|wynik)[^\d]*\d{1,2}[:\-]\d{1,2}/gi, '');
     // Standalone X:Y after comma or space in middle of sentence
     t = t.replace(/,\s*\d{1,2}:\d{1,2}[!,.]?/g, ',');
     // X:Y followed by space/punctuation (not at very end which could be set score)
     t = t.replace(/\s\d{1,2}:\d{1,2}(?=[\s,!])/g, '');
     // "1:0!" at end of sentence mid-commentary (not set final)
     t = t.replace(/\s+\d{1,2}:\d{1,2}!(?!\s*(SET|set|seta|Satz|セット|FIN|END))/g, '!');
   }

   // ── All languages: clean up ─────────────────────────────────────────────
   t = t.replace(/  +/g, ' ').replace(/!!/g, '!').replace(/\s+([.,!?])/g, '$1').trim();

   return t;
 };

 const commentary = postProcess(rawCommentary, language);

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
     // 'punkt wędruje do nich' — wiszący zaimek
     t = t.replace(/[Ii] punkt wędruje do nich[!.]?/gi, '!');
     t = t.replace(/[Pp]unkt wędruje do nich[!.]?/gi, 'Punkt zdobyty!');
}
