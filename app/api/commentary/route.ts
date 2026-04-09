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
 // ── PL ──────────────────────────────────────────────────────────────────
 pl: `Jestes doswiadczonym komentarorem meczow siatkarskich w Polsce — jak Tomasz Swędrowski lub Wojciech Drzyzga na zywo w radiu lub TV.

STYL PL — RADIO NA ZYWO:
- Prowadz narracje z EMOCJA proporcjonalna do sytuacji. Serve error = krotko i zwiezle. Koniec seta = wybuch emocji!
- UNIKAJ mechanicznych zwrotow: zamiast "zwieksza przewage" uzyj "odskoczyc", "dokrecil srube", "nie odpuszcza". Zamiast "zmniejsza strate" uzyj "wraca do gry!", "nie daje sie!", "zapala iskre!".
- UNIKAJ "gra trwa" — uzyj "akcja trwa!", "wymiana!", "pilka zyje!", "nie daja sie!".
- Przeplataj krotkie zdania uderzajace z dluzszymi opisowymi. Czasem zacznij od akcji: "Mocna zagrywka!", "Kapitalny blok!".
- Przynajmniej JEDNO zdanie z wykrzyknikiem na komentarz (chyba ze to blad serwisowy — wtedy wystarczy jedno krotkie).

OBOWIAZKOWE SLOWNICTWO PL:
- Wystawienie: "wystawia do [nazwisko]" LUB "wystawia na lewe/prawe skrzydlo" LUB "szybka pilka do srodka" — NIGDY "wystawia w prawo/lewo", NIGDY "ustawia do ataku", NIGDY "przygotowuje akcje"
- Blok punkt: "BLOK!", "zatrzymany blokiem!", "mur przy siatce!" — NIGDY "broni blokiem" (blok to NIE obrona!)
- Wyblok (blok niekonczacy rally): "pilka po bloku", "wyblok — pilka zyje!", "zablokowany ale akcja trwa!"
- Obrona/dig: "kapitalnie obroniony!", "wyciagnal z podlogi!", "fenomenalna obrona!" — NIGDY angielskie "dig"
- Float serve: "zagrywka szybujaca", "float" — ZAWSZE lekka/szybujaca, NIGDY "mocna zagrywka" przy float
- Przyjecie perfekcyjne: "kapitalnie przyjal!", "perfekcyjne przyjecie!", "bezbladne przyjecie [nazwisko]!"
- Przyjecie zle: "trudne przyjecie", "pilka daleko od siatki", "nieidealne przyjecie" — NIGDY "nieporadnie"
     // "recepcja" → "przyjęcie" (PL siatka nie używa recepcji)
     t = t.replace(/wymuszona recepcja/gi, 'wymuszone przyjęcie');
     t = t.replace(/perfekcyjna recepcja/gi, 'perfekcyjne przyjęcie');
     t = t.replace(/dobra recepcja/gi, 'dobre przyjęcie');
     t = t.replace(/recepcja/gi, 'przyjęcie');
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
- "momentum" — ANGIELSKI! ZASTAP: "impet", "seria punktow", "dynamika", "nie do zatrzymania"
- "float serve" — ANGIELSKI! ZASTAP: "zagrywka szybujaca", "float"
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
 language: string = 'pl',
 dramaLevel: number = 1,
 numTouches: number = 0,
 currentStreak: number = 0
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

Twoim zadaniem jest generowanie NATURALNEGO komentarza siatkarskiego — jak doświadczony komentator radiowy, nie protokół meczu.

FILOZOFIA RADIA:
Touch chain to KONTEKST, nie scenariusz do opisania słowo w słowo.
Prawdziwy komentator wybiera 1-2 kluczowe momenty i buduje wokół nich narrację.
NIE wyliczaj wszystkich dotknięć. SKUPIAJ się na tym CO zadecydowało o punkcie.

DŁUGOŚĆ — BEZWZGLĘDNE LIMITY:
- 1-2 touch (as/błąd serwisu): DOKŁADNIE 1 krótkie zdanie. NIGDY więcej.
- 3-4 touch (krótka wymiana): MAX 2 zdania. Pierwsze = kontekst, drugie = punkt.
- 5-7 touch (średnia wymiana): MAX 2-3 zdania. Kulminacja na końcu.
- 8+ touch (długa wymiana): MAX 3 zdania. Narracja → napięcie → rozstrzygnięcie.
Przekroczenie limitu = błąd. Krótszy jest lepszy.

STRUKTURA DOBREGO KOMENTARZA:
[Opcjonalny kontekst] → [Kluczowa akcja] → [Rezultat + emocja proporcjonalna do sytuacji]
DOBRY: "Kaczmarek atakuje z prawego skrzydła — Komenda muruje! JSW prowadzi!"
ZŁY: "Janusz serwuje, Shoji przyjmuje, Toniutti wystawia na prawe, Kaczmarek atakuje ale jest zablokowany przez Komendę który stawia mur przy siatce i zdobywa punkt!"

EMOCJA PROPORCJONALNA DO SYTUACJI (KRYTYCZNE!):
- Wynik 3:2, set 1 → SPOKOJNIE. Zero dramatyzmu. "Grozdanov kończy. Prowadzą."
- Wynik 15:14 → NORMALNIE. Fakty z lekką energią.
- Wynik 22:20, set 3 → WYRAŹNA EMOCJA. Napięcie słyszalne.
- Wynik 24:23, set 5 → MAKSIMUM. Każde słowo nabrzmiałe.
NIGDY nie używaj słów "kluczowy", "emocje sięgają zenitu", "niesamowite" przed 20. punktem seta.

SŁOWNICTWO — ZAKAZ POWTÓRZEŃ:
Te słowa są ZAKAZANE jeśli pojawiły się już w tym komentarzu:
- "kapitalnie" → zamień na: "świetnie", "znakomicie", "perfekcyjnie", "bez zarzutu"
- "fenomenalnie" → zamień na: "rewelacyjnie", "znakomicie", "niesamowicie" (tylko przy 20+!)
- "nie odpuszcza" → zamień na: "walczy", "nie daje się", "broni każdej piłki"
- "odskakuje" → zamień na: "powiększa przewagę", "buduje dystans", "ucieka"
- "wraca do gry" → zamień na: "zmniejsza stratę", "nie rezygnuje", "odpowiada"
W jednym komentarzu każde z tych słów może pojawić się MAX RAZ.

ZASADY NIEZMIENNE:
- Touch chain = prawda absolutna. Nie wymyślaj akcji których nie ma.
- "zagrywka" bez "BLAD" = dobry serwis. Nie mów że był błąd.
- "blok PRZEBITY" = atakujący wygrał, bloker przegrał.
- Ostatni touch = punkt. Nie dodawaj akcji po nim.
- NIGDY nie wymyślaj imion. Tylko nazwisko jeśli nie masz imienia z RAG.
- Wynik liczbowy TYLKO przy końcu seta.
- "wyciąga z podłogi" = kapitalna obrona, ALE jeśli piłka po tej obronie wychodzi poza boisko → NIE CHWALIMY tej obrony. Piszemy po prostu "piłka wychodzi poza boisko".

POPRAWNOŚĆ:
- SCORE SITUATION i WHO LEADS = jedyna prawda o wyniku. Nigdy nie wymyślaj.
- Gracz który popełnił błąd NIE "kończy akcji" i NIE "zdobywa punktu".
- Odmiana PL: Kaczmarek→Kaczmareka, Szalpuk→Szalpuka, Toniutti→Toniuttiego.

RAG:
- NAMING RULES → stosuj bezwzględnie.
- COMMENTARY EXAMPLES → dopasuj styl i energię.
- TACTICAL KNOWLEDGE → wzbogać komentarz jeśli pasuje.
- RAG ma PRIORYTET nad tymi zasadami ogólnymi.`;

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

// Zwróć prompt z dodatkiem proporcjonalnym do dramaLevel
  if (isSetEnd) {
    // isSetEnd handled in base section above
    return basePrompt;
  }
  
  // Buduj dodatek na podstawie drama scale
  let dramaAddition = '';
  
  if (dramaLevel >= 4) {
    dramaAddition = `
TON — POZIOM KRYTYCZNY (końcówka seta/tie-break):
Każdy punkt to oddzielna historia. Krótko i mocno. Bez zbędnych słów.
Jeden celny obraz, jedna silna emocja. Niech drżą ręce.
PRZYKŁADY PL:
- "Butryn! W decydującym momencie bierze to na siebie!"
- "As McCarthy'ego — nerwy ze stali, serwis jak laser!"
- "Blok Grozdanova! Mur nie do przebicia!"
- "Nikt nie ustępuje. Każde dotknięcie piłki to punkt."`;
  } else if (dramaLevel === 3) {
    dramaAddition = `
TON — NAPIĘCIE:
Wyraźna energia, ale kontrolowana. Jeden mocny obraz wystarczy.
Nie opisuj wszystkiego — wybierz to co decyduje.
PRZYKŁADY PL:
- "Kaczmarek z prawego skrzydła — nikt nie dosięga!"
- "Szerszeń pipe — Resovia musi reagować."
- "Grozdanov zatrzymuje atak. Punkty uciekają rywalom."`;
  } else if (dramaLevel === 2) {
    dramaAddition = `
TON — WYRÓWNANA GRA:
Fakty z energią. Podkreśl walkę lub kluczowy element akcji.
Nie dramatyzuj — wynik sam w sobie mówi że jest zacięcie.
PRZYKŁADY PL:
- "Kwolek kontruje — goście wracają do gry."
- "Sasak atakuje po skosie — obrona nie daje rady."
- "Leon ze skrzydła — prowadzą goście."`;
  } else if (currentStreak >= 3) {
    dramaAddition = `
TON — SERIA PUNKTÓW:
Podkreśl impet serii — naturalnie, bez przesady.
PRZYKŁADY PL:
- "Kolejny punkt Tavaresa — seria trwa, presja rośnie."
- "I znów Bołądź! Już trzeci z rzędu."`;
  } else if (hasMilestone) {
    dramaAddition = `
TON — MILESTONE: Wspomnij osiągnięcie, podaj liczbę.
PRZYKŁADY PL:
- "Dziesiąty punkt Sasaka! Dominuje w tym secie."
- "Trzeci as McCarthy'ego — rozkręcił się."`;
  } else if (isBigLead) {
    dramaAddition = `
TON — DUŻA PRZEWAGA: Spokojnie, rzeczowo. Dominacja gospodarzami/gości — fakt.
PRZYKŁADY PL:
- "Grozdanov dołożył kolejny. Przewaga rośnie."
- "Resovia nie może znaleźć odpowiedzi."`;
  } else if (isEarlySet) {
    dramaAddition = `
TON — START SETA (do 8 punktów): ZERO dramy. Sam fakt. Budujemy atmosferę powoli.
PRZYKŁADY PL:
- "Grozdanov skuteczny. Jastrzębski prowadzi."
- "Błąd serwisowy McCarthy'ego. Punkt dla gości."
- "Sasak kończy atak. Goście obejmują prowadzenie."`;
  } else {
    dramaAddition = `
TON — ŚRODEK SETA (9-19): Rzeczowy ale z energią. Akcent na taktykę i walkę.
PRZYKŁADY PL:
- "Grozdanov znów przy siatce — już trzeci blok."
- "McCarthy celny w zagrywce — przewaga rośnie."
- "Sasak przebija blok po przekątnej."
- "Kwolek z kontry — goście nie oddają pola."`;
  }
  
  return basePrompt + dramaAddition;
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

  // TIER 1B: Multi-dimensional drama scale
  // Uwzględnia: numer seta, wynik meczu, odległość od końca, bliskość wyniku
  const homeSetScore = recentRallies.length > 0
    ? (recentRallies.filter(r => r.set_number && r.set_number < setNumber).length > 0 ? 0 : 0)
    : 0; // placeholder — frontend przekazuje przez rallyAnalysis jeśli dostępne
  
  const distanceFromSetEnd = setEndInfo.isTieBreak
    ? Math.max(0, 15 - maxScore)
    : Math.max(0, 25 - maxScore);
  
  // Drama level: 0=spokojny, 1=normalny, 2=podwyższony, 3=wysoki, 4=krytyczny
  let dramaLevel = 0;
  if (setEndInfo.isSetEnd) {
    dramaLevel = 4;
  } else if (maxScore >= 23 || (setEndInfo.isTieBreak && maxScore >= 12)) {
    dramaLevel = 4; // końcówka seta
  } else if (maxScore >= 20) {
    dramaLevel = 3; // hot zone
  } else if (maxScore >= 15 && Math.abs(finalScore.home - finalScore.away) <= 3) {
    dramaLevel = 2; // wyrównana gra w środku seta
  } else if (maxScore >= 10) {
    dramaLevel = 1; // normalna gra
  } else {
    dramaLevel = 0; // wczesny set — spokój
  }
  // Bonus: tie-break seta 5 podnosi dramę o 1
  if (setNumber === 5 && dramaLevel < 4) dramaLevel = Math.min(4, dramaLevel + 1);

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
       const blockSynonyms = [
         ' - attacker beat the block (wyblok — attacker scores)',
         ' - found a gap in the block (wyblok)',
         ' - block touched but attacker wins',
         ' - late block, attacker scores through',
       ];
       desc += blockSynonyms[Math.floor(Math.random() * blockSynonyms.length)];
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
       desc += ' - defensive dig (ball out — point to other team)';
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
   } else if (actionLower.includes('wolna') || actionLower.includes('free')) {
     desc += ' - free ball';
   } else {
     desc += ` - ${action}`;
   }
   
   touchChainLines.push(desc);
 });

 const winnerTeamLabel = rally.team_scored === 'home' ? homeTeamFull : awayTeamFull;

 
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
4. NO SCORE IN TEXT: NEVER write "14:11" or "prowadza 14:11" — score is in UI! Say: "prowadza", "remis", "odskoczyc".
5. NO "PUNKT DLA X": Banned! Use: "[Nazwisko] konczy!", "Punkt!", "I to punkt!", "[Druzyna] bierze!" or emotional equivalent.
6. SERVE: Error only when ">>> SERVE ERROR". Otherwise serve was good.
7. BLOCK POINT vs WYBLOK: "BLOCK POINT!" = blocker scores. "block touch, ball rebounds" = wyblok — say "wyblok" in PL, NEVER "blokuje" if play continued.
8. DIG ≠ BLOCK: "defensive dig" = obrona (not blok).
9. PL: "sets to left/right wing" → "wystawia na lewe/prawe skrzydlo".
10. NEVER "znowu/ponownie" — only if same player appears TWICE in this touch chain.
11. PL: "Thales" not "Hoss". "as serwisowy" not "SERVICE ACE". "Koniec seta!" not "SET OVER".`;
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

INSTRUKCJE:
WYNIK: WHO LEADS = jedyna prawda. Jeśli mówi że ${otherTeamName || 'rywal'} PROWADZI — nie pisz że ${scoringTeamName || 'drużyna'} prowadzi!
NAZWISKA: Tylko z touch chain. Imię tylko jeśli PLAYER PROFILE potwierdza. Nigdy nie wymyślaj.
DŁUGOŚĆ: ${numTouches <= 2 ? 'MAKSIMUM 1 zdanie. To prosta akcja.' : numTouches <= 4 ? 'MAKSIMUM 2 zdania.' : numTouches <= 7 ? 'MAKSIMUM 3 zdania. Kulminacja na końcu.' : 'MAKSIMUM 3 zdania. Narracja → napięcie → punkt.'}
SYTUACJA: ${setEndInfo.isSetEnd ? `KONIEC SETA! Ogłoś wynik: ${score}. Zwycięzca: ${setEndInfo.winner}.` : dramaLevel >= 4 ? 'KRYTYCZNY MOMENT — maksymalna emocja, zwięźle i mocno!' : dramaLevel === 3 ? 'NAPIĘTA KOŃCÓWKA — wyraźna emocja, ale bez przesady.' : dramaLevel === 2 ? 'Wyrównana gra — umiarkowana energia.' : dramaLevel === 1 ? 'Środek seta — faktycznie, bez dramatyzmu.' : 'Wczesny set — spokojnie i rzeczowo. Zero dramy.'}
${attackingPlayer ? `UWAGA: To atak ${attackingPlayer} — chwal ATAKUJĄCEGO, nie błąd blokera!` : ''}
${milestone ? `MILESTONE: To jest ${milestone} — wspomnij liczbę!` : ''}${passInstructions}
${commentaryHintsContext ? 'WSKAZÓWKI UŻYTKOWNIKA mają PRIORYTET — zastosuj je!' : ''}
${language === 'pl' ? 'ODMIANA: Kaczmarek→Kaczmareka, Szalpuk→Szalpuka, Toniutti→Toniuttiego, Shoji→Shojiego.' : 'NAMES: Base form only — NOT Kaczmarka but Kaczmarek.'}
NIE POWTARZAJ: Wynik, kto strzelił, kto prowadzi — każda informacja JEDEN raz.
${attackCombo ? `TAKTYKA: ${attackCombo}${attackLocation ? `, strefa: ${attackLocation}` : ''}${attackStyle ? `, styl: ${attackStyle}` : ''} — użyj tego do konkretnego opisu!` : serveType ? `SERWIS: ${serveType} — opisz konkretnie!` : ''}
${rally.substitutions?.length ? 'ZMIANA: Wpleć naturalnie w komentarz.' : ''}
${rally.phase === 'Transition' ? 'KONTRA: Podkreśl szybką reakcję i improwizację.' : rally.phase === 'First Ball' ? 'PRZYJĘCIE: Wspomnij jakość przyjęcia tylko jeśli wpłynęło na atak.' : ''}

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
 language,
 dramaLevel,
 numTouches,
 currentStreak
 );
 
 console.log('[PRE-GPT] touchContext length:', touchContext.length);
 console.log('[PRE-GPT] prompt first 400 chars:', commentaryPrompt.substring(0, 400));
 
 // B1: Dynamic token limits based on rally complexity
 const isServeError = numTouches <= 2 && scoringAction.toLowerCase().includes('blad serw');
 const isAcePoint = numTouches <= 2 && (scoringAction.toLowerCase().includes('ace') || scoringAction.toLowerCase().includes('as serw'));
 const hasSubstitution = rally.substitutions?.length > 0;
 
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

     // ── "Punkt dla X" → neutral ending ─────────────────────────────────
     const punktDlaVariants = [
       'Punkt!', 'I to jest punkt!', 'Zdobyte!', 'Piękny punkt!',
       'Niesamowite!', 'Kapitalnie!', 'Fantastyczny punkt!', 'Genialne!'
     ];
     t = t.replace(/Punkt dla [^!.]+[!.]/g, () => {
       return punktDlaVariants[Math.floor(Math.random() * punktDlaVariants.length)];
     });

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
     t = t.replace(/druzyna/gi, 'drużyna');
     t = t.replace(/Druzyna/g, 'Drużyna');
     t = t.replace(/prowadza(?!\w)/g, 'prowadzą');
     t = t.replace(/prowadza!/g, 'prowadzą!');
     t = t.replace(/pilka/gi, 'piłka');
     t = t.replace(/pilka /g, 'piłka ');
     t = t.replace(/pilka!/g, 'piłka!');
     t = t.replace(/pilka,/g, 'piłka,');
     t = t.replace(/pilke /g, 'piłkę ');
     t = t.replace(/ pilke/g, ' piłkę');
     t = t.replace(/pilke/gi, 'piłkę');
     t = t.replace(/pilki/gi, 'piłki');
     t = t.replace(/siatkówke/gi, 'siatkówkę');
     t = t.replace(/serwis szybujacy/gi, 'serwis szybujący');
     t = t.replace(/zagrywka szybujaca/gi, 'zagrywka szybująca');
     t = t.replace(/szybujacym/gi, 'szybującym');
     t = t.replace(/szybujacy/gi, 'szybujący');
     t = t.replace(/lekka szybujaca/gi, 'lekka szybująca');
     t = t.replace(/przyjecie/gi, 'przyjęcie');
     t = t.replace(/przyjecia/gi, 'przyjęcia');

     // "nie daje się" — zły styl PL komentarza siatkówki
     t = t.replace(/nie daje się i wraca do gry/gi, 'walczy dalej');
     t = t.replace(/nie daja sie i wraca do gry/gi, 'walczy dalej');
     t = t.replace(/nie daja sie!/gi, 'walczy dalej!');
     t = t.replace(/nie daja sie\b/gi, 'nie odpuszcza');
     t = t.replace(/nie daje się i odskakuje/gi, 'nie odpuszcza i odskakuje');
     t = t.replace(/nie daje się!/gi, 'walczy dalej!');
     t = t.replace(/nie daje się/gi, 'nie odpuszcza');
     t = t.replace(/\bustawia do ataku\b/gi, 'wystawia do ataku');
     t = t.replace(/\bgra trwa\b/gi, 'akcja trwa');
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
     t = t.replace(/\bBieniekk\b/gi, 'Bieniek');
     t = t.replace(/\bBieńkka\b/gi, 'Bieńka');
     t = t.replace(/\bBieńkk\b/gi, 'Bieniek');
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
       t = t.replace(/pierwszym tempem/gi, 'z pierwszego tempa');

       // Gramatyka wystawy
       t = t.replace(/wystawia dla /gi, 'wystawia do ');
       t = t.replace(/wystawia piłkę dla /gi, 'wystawia piłkę do ');
       t = t.replace(/ustawia piłkę dla /gi, 'ustawia piłkę do ');
       t = t.replace(/ustawia dla /gi, 'wystawia do ');
       t = t.replace(/podaje dla /gi, 'podaje do ');

       // Gramatyka przyjęcia
       t = t.replace(/receptura/gi, 'przyjęcie');
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
       t = t.replace(/Hoss/g, 'Thales');
       t = t.replace(/Hossa/g, 'Thalesa');
       t = t.replace(/Hossowi/g, 'Thalesowi');

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
       t = t.replace(/Zdobyte!\s*/g, '');
       t = t.replace(/Piękny punkt!\s*/g, '');
       t = t.replace(/Niesamowite!\s*/g, '');
       t = t.replace(/Fantastyczne!\s*/g, '');
       t = t.replace(/Wspaniale!\s*/g, '');
       t = t.replace(/Genialne!\s*/g, '');

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
       // ── TIER 1C: Anti-repetition — rotacja powtarzających się fraz ──────────
       // "kapitalnie" tylko raz — reszta zamieniana losowo
       {
         const kapCount = (t.match(/kapitalnie/gi) || []).length;
         if (kapCount > 1) {
           const kapAlts = ['świetnie', 'znakomicie', 'perfekcyjnie', 'bez zarzutu', 'rewelacyjnie'];
           let first = true;
           t = t.replace(/kapitalnie/gi, (m) => {
             if (first) { first = false; return m; }
             return kapAlts[Math.floor(Math.random() * kapAlts.length)];
           });
         }
         // "fenomenalnie" — tylko raz, przy drama < 3 zastąp spokojniejszym
         const fenCount = (t.match(/fenomenalnie/gi) || []).length;
         if (fenCount > 1) {
           let first = true;
           t = t.replace(/fenomenalnie/gi, (m) => {
             if (first) { first = false; return m; }
             return 'znakomicie';
           });
         }
         // "nie odpuszcza" — tylko raz
         const odpCount = (t.match(/nie odpuszcza/gi) || []).length;
         if (odpCount > 1) {
           let first = true;
           t = t.replace(/nie odpuszcza/gi, (m) => {
             if (first) { first = false; return m; }
             return 'walczy dalej';
           });
         }
         // "wraca do gry" — tylko raz
         const wracaCount = (t.match(/wraca do gry/gi) || []).length;
         if (wracaCount > 1) {
           let first = true;
           t = t.replace(/wraca do gry/gi, (m) => {
             if (first) { first = false; return m; }
             return 'zmniejsza stratę';
           });
         }
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

   // ── All languages: remove score from text ────────────────────────────────
   // Score is shown in UI — never in commentary (except SET end)
   if (!setEndInfo.isSetEnd) {
     // "leads 14:11", "14:11", "14-11" patterns across all languages
     t = t.replace(/(leads?|führt|mène|lidera|lidera|führen|mène|portant)\s+\d{1,2}[:\-]\d{1,2}/gi, (m) => m.split(/\s+/)[0]);
     t = t.replace(/(prowadz[ąią\w]*|remis|wyrównu\w*|führt|lidera|vantaggio|avance|öne geçiyor)\s+\d{1,2}[:\-]\d{1,2}/gi,
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
}
