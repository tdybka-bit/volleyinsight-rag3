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
- Przeplataj krotkie zdania uderzajace z dluzszymi opisowymi. Czasem zacznij od akcji: "Mocna zagrywka!", "Blok punktowy!".
- Przynajmniej JEDNO zdanie z wykrzyknikiem na komentarz (chyba ze to blad serwisowy — wtedy wystarczy jedno krotkie).

OBOWIAZKOWE SLOWNICTWO PL:
- Wystawienie: "wystawia do [nazwisko]" LUB "wystawia na lewe/prawe skrzydlo" LUB "szybka pilka do srodka" — NIGDY "wystawia w prawo/lewo", NIGDY "ustawia do ataku", NIGDY "przygotowuje akcje"
- Blok punkt: "BLOK!", "zatrzymany blokiem!", "mur przy siatce!" — NIGDY "broni blokiem" (blok to NIE obrona!)
- Wyblok (blok niekonczacy rally): "pilka po bloku", "wyblok — pilka zyje!", "zablokowany ale akcja trwa!"
- Obrona/dig: "wybroniony!", "świetna obrona!", "ratuje akcję!" — NIGDY angielskie "dig", NIGDY "wyciąga z podłogi", NIGDY "kapitalnie"
- Blok: "muruje siatkę" NIE "muruje atakującego rywala" — blok jest na siatce, nie na zawodniku
- Blok: "zdobywa punkt blokiem", "zamyka blokiem" — NIGDY "wbija blok"
- Kiwka: "kiwa", "zagrywa kiwką", "próbuje zaskoczyć kiwką" — NIGDY "atakuje kiwką"
- Przyjęcie słabe: "niedokładne", "dalekie od ideału", "nienajlepsze", "z problemami" — NIGDY "trudne przyjęcie"
- Wyblok — piłka wraca: "wraca na stronę [drużyny/gospodarzy/gości]" — NIGDY "wraca w pole"
- "oczko" — max 1x na komentarz, preferuj "punkt"
- "kolejny/kolejne" — TYLKO gdy wiesz że to nie jest pierwsza akcja (wynik > 1:0). Przy wyniku 1:0 lub 0:1 NIGDY nie pisz "kolejny punkt"
- "punkt trafia na konto X" — ZAKAZANE! Użyj: "Punkt dla X!", "[Nazwisko] zdobywa punkt!", "I to punkt!"
- "wbija" bez doprecyzowania co — zawsze "wbija piłkę w boisko"
- "ratuje obronę" to nie po polsku — użyj "ratuje piłkę w obronie" / "próbuje ratować piłkę"
- "nie zdąża z obroną" → "próbuje bronić, ale piłka..."
- "piłka żyje" max 1x — potem "akcja trwa" lub pomiń
- Błąd logiczny wyblok: jeśli blok dotknął piłkę ale akcja trwa → NIGDY "muruje siatkę" → "dotyka blokiem, piłka wraca na stronę [drużyny]"
- Float serve: "zagrywka szybujaca", "float" — ZAWSZE lekka/szybujaca, NIGDY "mocna zagrywka" przy float
- Przyjecie perfekcyjne: "w punkt przyjal!", "perfekcyjne przyjecie!", "bezbladne przyjecie [nazwisko]!", "doskonale przyjal!"
- Przyjecie zle: "trudne przyjecie", "pilka daleko od siatki", "nieidealne przyjecie" — NIGDY "nieporadnie"

ABSOLUTNY ZAKAZ — te slowa/zwroty sa ZABRONIONE w PL:
- "nieporadnie" — ZASTAP: "nieprecyzyjnie", "daleko od siatki", "z trudem"
- "kapitalnie" — BARDZO RZADKO! Tylko przy dramaLevel 3-4 (końcówka, remis). Max 1x na komentarz. Normalnie użyj: "świetnie", "doskonale", "znakomicie"
- "niesamowite" — RZADKO! Tylko dramaLevel 3-4. Max 1x na komentarz.
- "wyciąga z podłogi" — ZAKAZANE! ZASTAP: "ratuje", "wybroniony", "świetna obrona"
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
- OBRONA (dig, nie blok) = "wybroniony!", "świetnie obronił!", "ratuje akcję!"
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
 dramaLevel: number = 0,
 rallyCategory: string = '',
 momentSeta: string = ''
) => {
 const langPrompt = getLanguagePrompt(language);

 // ── FEW-SHOT EXAMPLES per kategoria — Twój styl ──────────────────────────
 const getFewShotExamples = (cat: string, drama: number): string => {
   const examples: Record<string, string[]> = {
     'BŁĄD SERWISU': [
       'START: "Sasak rowniez z bledem w polu serwisowym."',
       'ŚRODEK: "Ponownie Boladz ale blad. Alez zmienny ten poczatek seta."',
       'KOŃCÓWKA dramat: "Oj myli sie w waznym momencie — juz jestesmy po 20-tym punkcie!"',
       'KOŃCÓWKA zmiana: "Zmiana zadaniowa Malinowski za Sasaka zeby wzmocnic zagrywke. Ale nieskutecznie."',
     ],
     'AS SERWISOWY': [
       'START: "Swietny serwis Bienka - Hilir Henno nie utrzymal pilki w grze!"',
       'ŚRODEK po raz kolejny: "I jeszcze Russell postanawia dolozyc sie asem! Alez popisy Zawiercian w polu zagrywki!"',
       'KOŃCÓWKA: "Bartlomiej Boladz zza linii 9 metrow — po prostej i mamy punkt!"',
     ],
     'BŁĄD PRZYJĘCIA': [
       '"McCarthy! dobra zagrywka i punkt na koncie Lublina po zlym przyjeciu Popiwczaka! No i mamy remis!"',
       '"Popiwczak trafiony juz drugi raz w przyjeciu - alez skuteczny serwis Grozdanova w koncowce seta!"',
       '"Fynnian McCarthy i kolejny as serwisowy - nie wstrzymal reki po przerwie Zawiercian!"',
     ],
     'BŁĄD ATAKU': [
       'prosty: "Aaron Russell wyrzucajaca zagrywka. Zniszczol z bledem w ataku."',
       'po trudnej: "Z takiej pilki ciezko cokolwiek zrobic — i blad Kwolek."',
       'KOŃCÓWKA: "Kosztowny blad w koncowce! Sasak myli sie w ataku."',
     ],
     'BLOK PUNKTOWY': [
       '"Grozdanov zagrywa i Russell nie konczy! szybka kontra Lublina i Henno zdobywa kolejny punkt!"',
       '"Kwolek nie konczy ataku — Henno broni po wybloku Grozdanova i Leon powieksza przewage do 3 punktow."',
       '"Alez akcja! Pilka raz po raz przebijana — ostatecznie Gallego konczy atakiem ze srodka!"',
     ],
     'ATAK LEWE SKRZYDŁO': [
       '"Kwolek przyjmuje zagrywke Komendy i od razu dostaje pilke do ataku! Swietnie sobie radzi z blokiem Sasaka."',
       '"Szybka akcja Lublina — po swietnym przyjeciu pilka poslana na lewa strone i Henno konczy!"',
       '"Komenda na Russella, Tavares w nagrode posyla mu pilke na lewa strone a ten konczy kapitalnym atakiem po skosie."',
     ],
     'ATAK PRAWE SKRZYDŁO': [
       '"Hilir Henno. Russell, druga linia i Boladz po prostej konczy."',
       '"Krotka akcja: Honorato na Orczyka, Worsley do Nasevicha i punkt dla Trefla."',
       '"Na zagrywce Grozdanov — lekko na Popiwczaka ktory bardzo dobrze przyjmuje. Wystawa do Boladzia i mamy koniec meczu!"',
     ],
     'ATAK ŚRODEK / PIPE': [
       '"Swietnie! Milosz ze srodka z doskonalym atakiem i mamy remis 8:8."',
       '"Float przyjety bezblednie, Kozub z Siwczykiem przez srodek i jest punkt dla gospodarzy."',
       '"Swietne przyjecie zagrywki Boladzia przez Leona i rozpedzony Henno na pipe konczy te akcje!"',
     ],
     'DŁUGA WYMIANA': [
       '"Pierwsza dluzsza wymiana w tym meczu! Russell w przyjeciu, Lublin wyprowadza kontre. Ostatecznie Sasak z prawej strony."',
       '"McCarthy mocno, Russell z problemami — Kwolek dostaje pilke do ataku, po bloku wraca, i tym razem konczy swietnym atakiem po bloku! Zrobil swoje na lewej."',
       '"Lublin na dwa razy — najpierw Leon wyblokowany, ale Komenda gra na srodek do Grozdanova i tym razem konczacy atak."',
     ],
     'KONTRA → ATAK LEWE SKRZYDŁO': [
       '"Wracamy po przerwie i od razu skuteczna kontra! Russell po swietnym przyjeciu Popiwczaka."',
       '"Asparuhov na libero, Worsley na lewa strone do Orczyka i ten po bloku konczy."',
     ],
     'KONTRA → ATAK PRAWE SKRZYDŁO': [
       '"Milosz na Henno. Pilka daleko od siatki i Komenda sle pilke do Sasaka na druga linie — swietnie konczy!"',
       '"Grozdanov przyjety i konczy Boladz z drugiej linii! Dobre, pewne uderzenie po prostej."',
     ],
     'KONTRA → ATAK ŚRODEK / PIPE': [
       '"Wracamy po przerwie i mamy pierwszy atak pipem. Od razu skutecznie — Russella po swietnym przyjeciu Popiwczaka."',
       '"Mamy pipe za pipe — Jankiewicz uruchamia Asparuhova a ten konczy mimo prob obrony."',
     ],
   };

   const catExamples = examples[cat] || examples['ATAK LEWE SKRZYDŁO'];
   // Wybierz przykłady proporcjonalne do dramy
   const selected = drama >= 3
     ? catExamples.filter(e => e.includes('KOŃCÓWKA') || !e.includes(':'))
     : drama === 0
     ? catExamples.filter(e => e.includes('START') || !e.includes(':'))
     : catExamples;
   return selected.slice(0, 3).join('\n');
 };

 const fewShotBlock = rallyCategory
   ? `\n\nPRZYKŁADY TWOJEGO STYLU dla "${rallyCategory}" (naśladuj DOKŁADNIE ten styl):\n${getFewShotExamples(rallyCategory, dramaLevel)}\n`
   : '';

   const plRules = language === 'pl' ? `
╔══════════════════════════════════════════════════════════════════╗
║  COMMENTARY RULES — ZASADY BEZWZGLĘDNE (aktualizacja 2026-05-07) ║
╚══════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MUST HAVE — OBOWIĄZKOWE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[M1] NAZWY DRUŻYN: Używaj DOKŁADNIE nazw z HOME/AWAY. NIGDY nie tłumacz, nie odmieniaj, nie skracaj.
     "LUK" ≠ "Łuk". "PGE" ≠ "Polskie Górnictwo". Kopiuj DOSŁOWNIE.

[M2] ZACZNIJ OD KULMINACJI: Pierwsze zdanie = kto i jak zdobył punkt (lub błąd).
     Kontekst (zagrywka, przyjęcie) — dopiero w zdaniu 2-3 jeśli starczy miejsca.

[M3] ZAWSZE zakończ informacją kto i jak zdobył/stracił punkt. NIGDY nie urywaj komentarza.
     Jeśli musisz skrócić — skróć ŚRODEK, NIGDY koniec.

[M4] MAX 3 zdania na komentarz. Błąd serwisu = 1 zdanie. Długa wymiana = max 3 zdania.

[M5] WYNIK: Używaj DOKŁADNIE "SCORE SITUATION" i "WHO LEADS" z danych. NIGDY nie wymyślaj.

[M6] NAZWISKA: Tylko z touch chain. Imię — tylko jeśli PLAYER PROFILE potwierdza. 
     W razie wątpliwości: samo nazwisko.

[M7] ODMIANA PL: Odmieniaj nazwiska przez przypadki.
     Kaczmarek→Kaczmareka, Szalpuk→Szalpuka, Butryn→Butryna, Toniutti→Toniuttiego.

[M8] BLOK — 4 przypadki (KRYTYCZNE):
     - BLOK PUNKTOWY: piłka spada w pole atakujących → "muruje siatkę!", "blok punktowy!"
     - WYBLOK: piłka po bloku po stronie blokujących → "wyblok — piłka wraca na stronę [blokujący]!"
     - BLOK piłka do atakujących: akcja trwa po ich stronie → "blok ale piłka wraca — [drużyna] ponawia!"
     - BLOK-OUT: piłka wychodzi za boisko → "blok-out! Punkt dla [atakujący]!"
     NIGDY: "kończy po wybloku X" gdy X jest blokerem — wyblok X = piłka wróciła DO X, nie OD X.

[M9] RATOWAĆ + PIŁKA WYCHODZI — zawsze doprecyzuj:
     "próbuje ratować PIŁKĘ, ale ta wychodzi NA AUT" — nie "ratować" i nie "wychodzi" bez doprecyzowania.

[M10] PIERWSZA AKCJA meczu (wynik 0:0→1:0 lub 0:1): NIGDY "kolejny punkt".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORBIDDEN — ABSOLUTNY ZAKAZ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[F1]  "kapitalnie" — max 1x, tylko dramaLevel 3-4 (końcówka remis/na styku)
[F2]  "niesamowite" — max 1x, tylko dramaLevel 3-4
[F3]  "fenomenalnie" — max 1x, tylko dramaLevel 4 (tie-break remis)
[F4]  "wyciąga z podłogi" — NIGDY. Użyj: "ratuje piłkę", "wybroniony"
[F5]  "trudne przyjęcie" — NIGDY. Użyj: "niedokładne", "dalekie od ideału", "z problemami"
[F6]  "atakuje kiwką" — NIGDY. Użyj: "kiwa", "próbuje zaskoczyć kiwką"
[F7]  "muruje atakującego rywala" — NIGDY. Użyj: "muruje siatkę"
[F8]  "wbija blok" — NIGDY. Użyj: "zdobywa punkt blokiem", "zamyka blokiem"
[F9]  "wraca w pole" — NIGDY. Użyj: "wraca na stronę [drużyny]"
[F10] "wyblokowuje" — NIGDY. Użyj: "dotyka blokiem"
[F11] "szybko przyjął/przyjęty" — NIGDY. Użyj: "dobrze przyjął", "sprawnie przyjął"
[F12] "bierze prowadzenie" — NIGDY. Użyj: "wychodzi na prowadzenie"
[F13] "puszcza/posyła swobodną piłkę" — NIGDY. Użyj: "oddaje piłkę za darmo"
[F14] "swobodna piłka" — NIGDY. Użyj: "free ball" lub "darmowa piłka"
[F15] "błąd serwisu" — NIGDY. Zawsze: "błąd serwisowy"
[F16] "pierwszym tempem" — NIGDY. Zawsze: "z pierwszego tempa"
[F17] "ratuje obronę" — NIGDY (nie po polsku). Użyj: "ratuje piłkę w obronie"
[F18] "piłka wychodzi" bez doprecyzowania — NIGDY. Zawsze: "wychodzi NA AUT" lub "poza boisko"
[F19] "zdobywa" bez doprecyzowania — NIGDY. Zawsze: "zdobywa PUNKT"
[F20] "punkt trafia na konto X" — NIGDY. Użyj: "Punkt dla X!", "[Nazwisko] kończy!"
[F21] "Kolejny/kolejne punkt" przy pierwszej akcji — NIGDY
[F22] "oddane rywalom" — NIGDY (zła gramatyka). Użyj: "dla rywali", "błąd serwisowy"
[F23] "wystawia do środka" — NIGDY. Użyj: "wystawia na środek"
[F24] "z pierwszej piłki" — NIGDY. Użyj: "ze środka" (gdy atak środkowego)
[F25] "piłka żyje" — max 1x. Potem: "akcja trwa"
[F26] "oczko" — max 1x na komentarz. Preferuj "punkt"
[F27] Wynik liczbowy (np. "prowadzą 14:11") — NIGDY poza końcem seta
[F28] "momentum" (ang.) — NIGDY. Użyj: "impet", "seria punktów", "dynamika"
[F29] "dig" (ang.) — NIGDY. Użyj: "obrona", "wybroniony"
[F30] "SERVICE ACE" (ang.) — NIGDY. Użyj: "as serwisowy"
[F31] Tłumaczenie nazw drużyn — NIGDY. "LUK" nie staje się "Łuk". "PGE" zostaje "PGE".
[F32] Imiona wymyślone przez GPT — NIGDY. Tylko z PLAYER PROFILE.
[F33] "zagrywa kiwką" (non-serwis) — NIGDY. Użyj: "kiwa"
[F34] "wbija" bez doprecyzowania — NIGDY. Zawsze: "wbija piłkę w boisko"
[F35] "muruje siatkę" przy wybloku (niepontowym) — NIGDY. Tylko przy bloku kończącym akcję.
` : '';

 const basePrompt = `${langPrompt}${plRules ? '\n\n' + plRules : ''}

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

Twoje zadanie: wygeneruj komentarz siatkarskie w stylu radia — jak Swędrowski na żywo.
${fewShotBlock}
JEDNA ZASADA NARRACJI:
- Akcje 1-4 dotknięcia: chronologicznie, zwięźle
- Akcje 5+ dotknięć: ZACZNIJ od kto zdobył i jak (★ CLIMAX w danych poniżej), POTEM krótki kontekst
- MAX 3 zdania. MAX 50 słów. NIGDY nie urywaj przed zakończeniem.
- ZAWSZE ostatnie zdanie: kto zdobył punkt i jak.

FAKTY PONAD WSZYSTKO:
- Opisuj TYLKO to co jest w touch chain. Zero inwencji.
- Zagrywka bez "BŁĄD" = dobra zagrywka
- BLOCK POINT = bloker zdobywa punkt | wyblok = akcja trwa
- Wynik: używaj "prowadzą/remis/zmniejszają stratę" — NIGDY liczb (widoczne w UI)
- Imiona: tylko z touch chain lub NAMING RULES — NIGDY nie wymyślaj

RAG (jeśli dostarczone poniżej):
- NAMING RULES → stosuj odmianę DOKŁADNIE jak tam podano
- PRZYKŁADY KOMENTARZY → naśladuj styl i energię
- FRAZY → inspiracja, nie obowiązek`;

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

 // Drama-based zone prompt
 const dramaZone = dramaLevel >= 4
   ? `\n- 🔥 MAKSYMALNY DRAMAT (remis w końcówce/tie-break)! Każde słowo musi uderzać. Kulminacja!\n- Krotkie mocne zdania. Zero wstępów. Prosto do sedna.`
   : dramaLevel === 3
   ? `\n- ⚡ NAPIĘCIE (końcówka na styku)! Wyraźna emocja. Fakty + jeden silny akcent.`
   : dramaLevel === 2
   ? `\n- 📈 ENERGIA (końcówka)! Każdy punkt ważny. Energiczne ale kontrolowane.`
   : dramaLevel === 1
   ? `\n- 📊 UMIARKOWANIE (środek wyrównany). Fakty z energią. Wzmianka o kontekście walki.`
   : `\n- 📝 SPOKOJNIE (start/duża przewaga). Zero dramy. Sucho i rzeczowo.
- Przy błędzie serwisu w KOŃCÓWCE (dramaLevel 3-4): dodaj emocję zawodu/krytyki:
  "w takim momencie!", "zaryzykował i nie wyszło", "postawił wszystko na jedną kartę",
  "droga pomyłka w tak kluczowym momencie"`;

 if (hasStreak) {
   return basePrompt + dramaZone + `\n- SERIA PUNKTÓW! Wspomnij momentum.`;
 } else if (hasMilestone) {
   return basePrompt + dramaZone + `\n- MILESTONE! Wspomnij numer osiągnięcia.`;
 }
 return basePrompt + dramaZone;
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

 // ── PHRASE TRACKER — skanuj ostatnie komentarze seta ────────────────────────
 const TRACKED_PHRASES_CONFIG = [
   { phrase: 'muruje siatkę', limit: 2, alt: 'zamyka blokiem / zdobywa punkt blokiem' },
   { phrase: 'muruje siatke', limit: 2, alt: 'zamyka blokiem / zdobywa punkt blokiem' },
   { phrase: 'blok punktowy', limit: 3, alt: 'zamyka blokiem / czapa! / ręce przy siatce' },
   { phrase: 'piłka żyje',   limit: 1, alt: 'akcja trwa / wymiana trwa' },
   { phrase: 'pilka zyje',   limit: 1, alt: 'akcja trwa / wymiana trwa' },
   { phrase: 'świetna obrona', limit: 2, alt: 'twarda obrona / kapitalnie wybroniony' },
   { phrase: 'perfekcyjne przyjęcie', limit: 3, alt: 'w punkt przyjął / doskonale przyjął' },
   { phrase: 'dłuższa wymiana', limit: 2, alt: 'zacięta walka / nie dają wbijać' },
   { phrase: 'długa wymiana', limit: 2, alt: 'zacięta walka / nie dają wbijać' },
   { phrase: 'alez emocje', limit: 1, alt: 'niesamowite widowisko / co za mecz' },
   { phrase: 'z pierwszego tempa', limit: 3, alt: 'ze srodka / blyskawiczny atak / szybka pilka na srodek' },
   { phrase: 'ze srodka z pierwszego', limit: 2, alt: 'ze srodka / szybka pilka / blyskawicznie' },
   { phrase: 'konczy atak ze srodka', limit: 3, alt: 'wbija pilke ze srodka / przebija blok ze srodka' },
 ];

 // Zbierz komentarze z bieżącego seta (z recentRallies)
 const currentSetCommentaries = (recentRallies || [])
   .filter((r: any) => r.set_number === setNumber)
   .map((r: any) => (r.commentary || r.generated_commentary || '').toLowerCase()
     .replace(/ą/g,'a').replace(/ę/g,'e').replace(/ó/g,'o').replace(/ś/g,'s')
     .replace(/ź/g,'z').replace(/ż/g,'z').replace(/ć/g,'c').replace(/ń/g,'n').replace(/ł/g,'l'));

 const phraseWarnings: string[] = [];
 for (const tracked of TRACKED_PHRASES_CONFIG) {
   const count = currentSetCommentaries.filter((c: string) => c.includes(tracked.phrase)).length;
   if (count >= tracked.limit) {
     phraseWarnings.push(`"${tracked.phrase}" użyte już ${count}x → użyj: ${tracked.alt}`);
   }
 }

 const phraseWarningBlock = phraseWarnings.length > 0
   ? '\nFRAZY WYCZERPANE W TYM SECIE — NIE używaj:\n' + phraseWarnings.map(w => '⚠️ ' + w).join('\n') + '\n'
   : '';

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
     momentumContext = `MOMENTUM: Gospodarz dominuje - ${homePoints}:${awayPoints} w ostatnich 6 akcjach!`;
   } else if (awayPoints >= 5) {
     momentumContext = `MOMENTUM: Gość dominuje - ${awayPoints}:${homePoints} w ostatnich 6 akcjach!`;
   }
 }
 }
 
 const scoreDiff = Math.abs(finalScore.home - finalScore.away);
 const isBigLead = scoreDiff >= 10;

 // ── DRAMA LEVEL 0-4 (replaces boolean flags in prompt) ─────────────────
 const maxScoreD = Math.max(finalScore.home, finalScore.away);
 let dramaLevel = 0;
 if (maxScoreD >= 20) {
   if (scoreDiff === 0) dramaLevel = 4;        // KOŃCÓWKA remis
   else if (scoreDiff <= 2) dramaLevel = 3;    // KOŃCÓWKA na styku
   else dramaLevel = 2;                         // KOŃCÓWKA
 } else if (maxScoreD >= 11) {
   if (scoreDiff <= 2) dramaLevel = 1;         // ŚRODEK wyrównana
   else dramaLevel = 0;                         // ŚRODEK spokojny
 }
 if (rally.set_number === 5) dramaLevel = Math.min(4, dramaLevel + 1); // tie-break +1

 // ── RALLY CATEGORY (dla RAG query + few-shot) ────────────────────────────
 const numDigs = rally.touches?.filter((t: any) => t.action?.toLowerCase().includes('dig') || t.action?.toLowerCase().includes('obron')).length || 0;
 const numBlocksTouches = rally.touches?.filter((t: any) => t.action?.toLowerCase().includes('block') || t.action?.toLowerCase().includes('blok')).length || 0;
 const numTouchesTotal = rally.touches?.length || 0;
 const isTransition = rally.touches?.some((t: any) => t.phase === 'Transition') || false;

 let rallyCategory = 'INNE';
 const aLower = scoringAction.toLowerCase();
 if (aLower.includes('blad serw') || aLower.includes('serve error') || aLower.includes('error serv')) {
   rallyCategory = 'BŁĄD SERWISU';
 } else if (aLower.includes('ace') || aLower.includes('as serw') || (numTouchesTotal <= 2 && !aLower.includes('error'))) {
   rallyCategory = 'AS SERWISOWY';
 } else if ((aLower.includes('blad przyjec') || aLower.includes('receive error')) && numTouchesTotal <= 2) {
   rallyCategory = 'BŁĄD PRZYJĘCIA';
 } else if (aLower.includes('blad ataku') || aLower.includes('attack error')) {
   rallyCategory = 'BŁĄD ATAKU';
 } else if (aLower.includes('block') || aLower.includes('blok punkt')) {
   rallyCategory = 'BLOK PUNKTOWY';
 } else if (numDigs >= 2 || (numDigs >= 1 && numBlocksTouches >= 1)) {
   rallyCategory = 'DŁUGA WYMIANA';
 } else {
   const lastTouch = rally.touches?.[rally.touches.length - 1];
   const attackLoc = lastTouch?.attackLocation || '';
   const prefix = isTransition ? 'KONTRA → ' : '';
   if (attackLoc.includes('Left')) rallyCategory = prefix + 'ATAK LEWE SKRZYDŁO';
   else if (attackLoc.includes('Right')) rallyCategory = prefix + 'ATAK PRAWE SKRZYDŁO';
   else if (attackLoc.includes('Middle') || attackLoc.includes('Pipe')) rallyCategory = prefix + 'ATAK ŚRODEK / PIPE';
   else rallyCategory = prefix + 'ATAK WYGRANY';
 }

 // ── MOMENT SETA (dla RAG query) ──────────────────────────────────────────
 let momentSeta = '';
 if (maxScoreD <= 10) momentSeta = scoreDiff >= 5 ? 'START duża przewaga' : 'START';
 else if (maxScoreD <= 19) {
   if (scoreDiff === 0) momentSeta = 'ŚRODEK remis';
   else if (scoreDiff <= 2) momentSeta = 'ŚRODEK wyrównana';
   else momentSeta = 'ŚRODEK';
 } else {
   if (scoreDiff === 0) momentSeta = 'KOŃCÓWKA remis';
   else if (scoreDiff <= 2) momentSeta = 'KOŃCÓWKA na styku';
   else momentSeta = 'KOŃCÓWKA';
 }

 console.log('[DRAMA]', { dramaLevel, rallyCategory, momentSeta, isTransition });


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
 topK: 2,
 includeMetadata: true,
 });
 
 if (tacticsResults.matches && tacticsResults.matches.length > 0) {
 const relevantTactics = tacticsResults.matches
 .filter(match => (match.score || 0) > 0.50); // wyższy próg — tylko naprawdę trafne
 tacticsContext = relevantTactics
 .filter(m => {
   // Odfiltruj akademickie pliki — zostaw tylko Wytyczne i Zasady
   const txt = (m.metadata?.content || m.metadata?.text || '').toLowerCase();
   const name = (m.metadata?.filename || m.metadata?.source || '').toLowerCase();
   return name.includes('wytyczn') || name.includes('zasad') || name.includes('taktyk') || 
          txt.includes('komentarz') || txt.includes('blad') || txt.includes('wytyczn');
 })
 .map((match) => match.metadata?.content || match.metadata?.text || '')
 .join('\n\n')
 .substring(0, 500);
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
 // Używamy kategorii + momentu seta dla precyzyjnego retrievalu
 const commentaryQuery = rallyCategory && momentSeta
   ? `${rallyCategory} ${momentSeta} przykład komentarz PlusLiga styl`
   : `${scoringAction} komentarz przykład styl PlusLiga`;

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
 // Query używa kategorii + momentu seta + fazy dla precyzyjniejszego retrievalu
 let phrasesQuery = '';
 if (rallyCategory && momentSeta) {
   phrasesQuery = `${rallyCategory} ${momentSeta} komentarz fraza PlusLiga`;
 } else {
   const actionType = scoringAction.toLowerCase();
   if (actionType.includes('ace') || actionType.includes('as serw')) {
     phrasesQuery = 'as serwisowy zagrywka punkt bezposredni';
   } else if (actionType.includes('blad serw') || actionType.includes('serve error')) {
     phrasesQuery = 'blad serwisowy zepsuta zagrywka punkt dla rywali';
   } else if (actionType.includes('block') || actionType.includes('blok')) {
     phrasesQuery = 'blok punktowy zatrzymuje muruje mur przy siatce';
   } else if (actionType.includes('attack') || actionType.includes('atak')) {
     phrasesQuery = 'atak konczy przebija skuteczny punkt skrzydlo';
   } else {
     phrasesQuery = 'punkt akcja komentarz siatkówka PlusLiga';
   }
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
 commentaryPhrasesContext = `INSPIRACJA — naturalne frazy z PlusLigi (naśladuj styl, nie kopiuj dosłownie):\n${phrases.join(' / ')}`;
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
 const summaryQuery = rallyCategory && momentSeta
   ? `${momentSeta} ${rallyCategory} komentarz styl narracja PlusLiga`
   : `komentarz styl ton narracja PlusLiga ${momentSeta}`;
 
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
     const serveDesc = sType.includes('Float') ? 'zagrywka szybująca (float)' : sType.includes('Spin') ? 'zagrywka z wyskoku (jump spin)' : 'zagrywka';
     const isLastTouch = idx === rally.touches!.length - 1;
     
     if (actionLower.includes('as ') || actionLower.includes('ace')) {
       desc += ` - ${serveDesc} >>> AS SERWISOWY — punkt bezpośredni!`;
     } else if ((actionLower.includes('blad') || actionLower.includes('error')) && isLastTouch) {
       desc += ` - ${serveDesc} >>> BŁĄD SERWISOWY — punkt dla rywali`;
     } else {
       desc += ` - ${serveDesc}`;
     }
   // RECEIVE
   } else if (actionLower.includes('przyjecie') || actionLower.includes('pass') || actionLower.includes('receive')) {
     if (actionLower.includes('perfect')) desc += ' - perfect reception';
     else if (actionLower.includes('positive')) desc += ' - dobre przyjęcie';
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
     else desc += ' - przyjęcie';
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
     if (loc.toLowerCase() === 'pipe') atkDesc = 'atak pipe z drugiej linii';
     else if (loc.includes('Left') && loc.includes('Back')) atkDesc = 'atak z lewej strony (z drugiej linii)';
     else if (loc.includes('Left')) atkDesc = 'atak z lewego skrzydła';
     else if (loc.includes('Right') && loc.includes('Back')) atkDesc = 'atak z prawej strony (z drugiej linii)';
     else if (loc.includes('Right')) atkDesc = 'atak z prawego skrzydła';
     else if (loc.includes('Middle')) atkDesc = 'atak ze środka (z pierwszego tempa)';
     else if (combo.toLowerCase().includes('pipe')) atkDesc = 'atak pipe z drugiej linii';
     else if (isBackRow) atkDesc = 'atak z drugiej linii';
     else atkDesc = 'atak';
     
     if (style === 'Tip') atkDesc += ' (kiwka)';
     else if (style === 'Tool') atkDesc += ' (atak w blok — blok-out)';
     
     const isLastTouch = idx === rally.touches!.length - 1;
     
     if (actionLower.includes('blad') || actionLower.includes('error')) {
       if (isLastTouch) {
         desc += ` - ${atkDesc} >>> BŁĄD ATAKU — punkt dla rywali`;
       } else {
         desc += ` - ${atkDesc} (nieudany, akcja trwa)`;
       }
     } else if (actionLower.includes('zablok') || actionLower.includes('block')) {
       if (isLastTouch) {
         desc += ` - ${atkDesc} >>> ZABLOKOWANY — blok punktowy rywali`;
       } else {
         desc += ` - ${atkDesc} (wyblok — piłka wraca, akcja TRWA)`;
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
       // wyblok: blocker touched ball but SCORING PLAYER wins
       // Make crystal clear who is the blocker vs who scored
       desc += ` - WYBLOK! ${player} jest BLOKEREM który dotknął piłki, ale atak przebił blok. ${player} NIE zdobył punktu — punkt zdobył atakujący (SCORING PLAYER)!`;
     } else if (isLastTouch) {
       desc += ' - BLOCK POINT! (blok kończący — bloker zdobywa punkt)';
     } else {
       desc += ` - WYBLOK przez ${player}: ${player} dotknął piłki ale jej NIE zablokował — piłka żyje, akcja TRWA! ${player} to BLOKER, nie atakujący!`;
     }
   // DIG / DEFENSE
   } else if (actionLower.includes('obrona') || actionLower.includes('dig')) {
     const isLastTouch = idx === rally.touches!.length - 1;
     if (isLastTouch) {
       desc += ' - obrona/dig (piłka wyszła na aut — punkt dla rywali)';
     } else {
       desc += ' - obrona/dig (piłka utrzymana w grze)';
     }
   // FREE
   } else if (actionLower.includes('wolna') || actionLower.includes('free')) {
     desc += ' - darmowa piłka (free ball — oddana przez rywali)';
   } else {
     desc += ` - ${action}`;
   }
   
   touchChainLines.push(desc);
 });

 const winnerTeamLabel = rally.team_scored === 'home' ? homeTeamFull : awayTeamFull;

 
 // Buduj touch chain: SCORER na górze (nie ostatnie dotknięcie!)
 // Problem: ostatnie dotknięcie to często obrona rywala (dig → aut) — nie atakujący
 // Scorer = scoringPlayer z touch chain. Znajdź jego ostatnią akcję ofensywną.
 const scorerLastAttackIdx = (() => {
   for (let k = touchChainLines.length - 1; k >= 0; k--) {
     const line = touchChainLines[k];
     // Szukaj ataku scoringPlayer lub błędu który dał punkt (serve error, attack error)
     if (line.includes(scoringPlayer) && (
       line.includes('ATK') || line.includes('BLK') || line.includes('SRW') ||
       line.includes('✅') || line.includes('❌') || line.includes('POINT')
     )) return k;
   }
   return touchChainLines.length - 1; // fallback: ostatnia linia
 })();

 const climaxLine = touchChainLines[scorerLastAttackIdx] || touchChainLines[touchChainLines.length - 1];
 const contextLines = touchChainLines.filter((_, k) => k !== scorerLastAttackIdx);

 const chainFormatted = numTouches <= 4
   ? touchChainLines.join('\n')
   : `★ CLIMAX — SCORER: ${scoringPlayer} — ${climaxLine}\n★ POINT FOR: ${winnerTeamLabel}\n\nKONTEKST (wcześniejsze akcje):\n${contextLines.join('\n')}`;

 touchContext = `
TOUCH CHAIN (${numTouches} touches${isLongRally ? ' — long rally!' : ''}):
${chainFormatted}
=> SERVED BY: ${rally.touches[0]?.player || '?'} — this player SERVED, scorer is ${scoringPlayer}. NEVER confuse them!
=> POINT FOR: ${winnerTeamLabel} ← UŻYJ TEJ NAZWY DOSŁOWNIE, nie tłumacz!

CRITICAL COMMENTARY RULES:
1. "SERVED BY" ≠ scorer! If "SERVED BY" shows X and scorer is Y — X served, Y finished. NEVER say Y served!
1b. "POINT FOR: ${winnerTeamLabel}" = ONLY this team scored. NEVER say the other team scored!
2. CLIMAX-FIRST: ★ CLIMAX pokazuje kto zdobył punkt (SCORER) i jak. To jest PIERWSZE zdanie.
   NIGDY nie przypisuj punktu osobie z ostatniego dotknięcia jeśli to była obrona/dig!
   "SCORER: Weber" = Weber zdobywa punkt, nawet jeśli po nim było dotknięcie Karlitzka (dig → aut).
3. LENGTH LIMIT (ABSOLUTE HARD LIMIT): 1-3 touches = MAX 1 sentence. 4-6 touches = MAX 2 sentences. 7+ touches = MAX 3 SHORT sentences. TOTAL MAX 50 words. NEVER more — cut the context, NEVER cut the ending!
4. START WITH CLIMAX: For 5+ touches — your FIRST sentence must say who scored and how. Context (serve, reception) goes in sentence 2-3 only if space allows.
5. NO SCORE IN TEXT: NEVER write "14:11" or "prowadza 14:11" — score is in UI! Say: "prowadza", "remis", "odskoczyc".
6. NO "PUNKT DLA X": Banned! Use: "[Nazwisko] konczy!", "Punkt!", "I to punkt!", "[Druzyna] bierze!" or emotional equivalent.
7. SERVE: Error only when ">>> SERVE ERROR". Otherwise serve was good.
8. BLOCK — 4 przypadki:
   - "BLOCK POINT" / "blok punktowy" = piłka spada w pole atakujących → "muruje siatkę!", "blok punktowy!"
   - "wyblok" / "ball stays blocker side" = piłka po bloku PO STRONIE BLOKUJĄCYCH → "wyblok — piłka wraca na stronę [blokujący]!"
   - "block, ball back to attacker" / "piłka wraca do atakujących" = akcja trwa po stronie atakujących → "blok ale piłka wraca — [atakujący] ponawia!"
   - "blok-out" = piłka po bloku wychodzi za boisko → "blok-out! Punkt dla [atakujący]!"
   NIE używaj "kończy po wybloku X" — wyblok X oznacza piłka poszła do X, nie od X.
9. DIG ≠ BLOCK: "defensive dig" = obrona (not blok).
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
HOME: ${homeTeamFull} | AWAY: ${awayTeamFull} ← NAZWY DOSŁOWNE, NIGDY nie tłumacz ani nie modyfikuj!
Rally #${rally.rally_number} | Set ${setNumber} | Score: ${score} | Point scored by: ${rally.team_scored === 'home' ? homeTeamFull + ' (home)' : awayTeamFull + ' (away)'}
${rally.phase ? `PHASE: ${rally.phase === 'First Ball' ? 'SIDE-OUT (first ball) - first attack after reception. Reception quality and attack combination are key.' : rally.phase === 'Transition' ? 'TRANSITION - attack after defensive dig. Often chaotic, requires improvisation. Setter has fewer options.' : rally.phase}` : ''}
${rally.homeRotation || rally.awayRotation ? `ROTATION: ${homeTeamFull} R${rally.homeRotation || '?'} | ${awayTeamFull} R${rally.awayRotation || '?'}${rally.homeRotation === 1 || rally.awayRotation === 1 ? ' (R1 = setter at net, full attack options)' : ''}${rally.homeRotation === 4 || rally.awayRotation === 4 ? ' (R4 = setter in back row, limited options)' : ''}` : ''}
SCORE SITUATION: ${scoreSituation}
WHO LEADS: ${leadInfo}${situationContext}${errorContext}${substitutionContext}

${namingRulesContext ? `ZASADY ODMIANY NAZWISK (PRIORYTET!):\n${namingRulesContext}\n\n` : ''}${commentaryPhrasesContext ? `SUGESTIE STYLISTYCZNE (inspiracja):\n${commentaryPhrasesContext}\n\n` : ''}${commentaryHintsContext ? `KOREKTY UZYTKOWNIKA (PRIORYTET!):\n${commentaryHintsContext}\n\n` : ''}${commentaryExamplesContext ? `WZORZEC STYLU:\n${commentaryExamplesContext}\n\n` : ''}${playerContext ? `PROFIL ZAWODNIKA:\n${playerContext}` : ''}

ZASADY (10 regul — zamiast 15+ sprzecznych):
⚠️ NAZWY DRUŻYN: Używaj DOKŁADNIE nazw z "HOME:" i "AWAY:" powyżej. NIGDY nie tłumacz, nie skracaj, nie modyfikuj. "LUK" to NIE jest "Łuk". "PGE" to NIE jest "Polskie Górnictwo Energetyczne". Kopiuj DOSŁOWNIE.
1. STYL NARRACJI: \${narrativeStyle === 'climax-first' 
   ? 'CLIMAX-FIRST — zacznij od kto i jak zdobył punkt (★ CLIMAX). Kontekst (zagrywka, przyjęcie) dopiero potem.'
   : 'CHRONOLOGICZNY — PIERWSZE ZDANIE musi zaczynac sie od zagrywki. Buduj akcje: zagrywka → przyjecie → atak → PUNKT! NIE zaczynaj od kulminacji — to bedzie climax-first, nie chronologiczny. Jesli zabraknie miejsca — skroc srodek, nigdy nie urywaj zakonczenia.'
2. TYLKO touch chain — nic nie wymyslaj. Kazda akcja musi byc w danych powyzej.
2b. PODMIOT ZAWSZE: "piłka kończy atak" jest BŁĘDEM — piłka nie kończy ataku, zawodnik kończy. Zawsze: "[Nazwisko] kończy atak" lub "[Nazwisko] zdobywa punkt".
3. WYNIK: Uzywaj DOKLADNIE "SCORE SITUATION" i "WHO LEADS". NIGDY nie twórz innego!
4. NAZWISKA: Z touch chain. Imie tylko jesli PROFIL ZAWODNIKA potwierdza. W razine watpliwosci — samo nazwisko.
5. ${language === 'pl' ? 'ODMIANA PL: Kaczmarek→Kaczmareka, Szalpuk→Szalpuka, Butryn→Butryna, Toniutti→Toniuttiego.' : 'NAMES: Base form only — Kaczmarek not Kaczmarka.'}
6. ${setEndInfo.isSetEnd ? `KONIEC SETA! Oglos to! Wynik: ${score}. Zwyciezca: ${setEndInfo.winner}.` : isFirstPoint ? 'PIERWSZA AKCJA meczu — krotko, zadnego "kolejny"!' : isHotSituation ? 'KONCOWKA — buduj napiecie!' : currentStreak >= 3 ? 'SERIA PUNKTOW — wspomnij!' : 'Rzeczowo i energicznie.'}
7. ${attackingPlayer ? `ATAK: Chwál ${attackingPlayer} za przelamanie bloku. NIE wspominaj bledow obrony!` : ''}
8. ${attackCombo ? `TYP: ${attackCombo}${attackLocation ? ` z ${attackLocation}` : ''}${attackStyle ? ` styl: ${attackStyle}` : ''} — opisz konkretnie.` : serveType ? `TYP ZAGRYWKI: ${serveType}` : ''}
9. ${rally.phase === 'Transition' ? 'KONTRA — improwizacja, szybka reakcja.' : rally.phase === 'First Ball' ? 'PIERWSZA PILKA — przyjecie tylko jesli wazne.' : ''}
10. ${commentaryHintsContext ? 'KOREKTY UZYTKOWNIKA maja ABSOLUTNY PRIORYTET!' : 'Nie powtarzaj informacji. Wynik, zdobywca — wspomnij RAZ.'}

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
 rallyCategory,
 momentSeta
 );
 
 console.log('[PRE-GPT] touchContext length:', touchContext.length);
 console.log('[PRE-GPT] prompt first 400 chars:', commentaryPrompt.substring(0, 400));
 
 // B1: Dynamic token limits based on rally complexity
 const isServeError = numTouches <= 2 && scoringAction.toLowerCase().includes('blad serw');

 // ── HYBRYDA NARRACJI ──────────────────────────────────────────────────────
 const narrativeStyle: 'climax-first' | 'chronological' = 
   isServeError ? 'chronological'
   : dramaLevel >= 3 ? 'climax-first'
   : dramaLevel === 2 ? (Math.random() < 0.7 ? 'climax-first' : 'chronological')
   : (Math.random() < 0.5 ? 'climax-first' : 'chronological');
 console.log('[NARRATIVE]', narrativeStyle);
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
   dynamicMaxTokens = 200; // long rally: raised to prevent cutoff — max 4 sentences
 } else if (numTouches >= 5) {
   dynamicMaxTokens = 150; // medium: 2-3 sentences
 }
 // Modifiers
 if (hasSubstitution) dynamicMaxTokens += 40;
 if (isHotSituation) dynamicMaxTokens += 40;
 if (milestone) dynamicMaxTokens += 30;
 // Chronologiczny styl potrzebuje więcej tokenów — buduje od zagrywki do końca
 if (narrativeStyle === 'chronological') dynamicMaxTokens += 30;
 
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
     t = t.replace(/\bSET OVER\b/g, 'Koniec seta!');
     t = t.replace(/\bfloat serve\b/gi, 'zagrywka szybująca');
     t = t.replace(/\bjump serve\b/gi, 'zagrywka z wyskoku');
     t = t.replace(/\bmomentum\b/gi, 'impet');
     t = t.replace(/\bdig\b/gi, 'obrona');
     t = t.replace(/\bHoss\b/g, 'Thales');

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

     // ── Banned phrases — najczęstsze błędy GPT ──────────────────────────
     // kapitalnie/niesamowite/fenomenalnie — max 1x, tylko przy dramaLevel >= 3
     {
       const allowEmphasis = dramaLevel >= 3;
       // kapitalnie — max 1x przy drama>=3, inaczej → świetnie
       let kapCount = 0;
       t = t.replace(/\b(kapitalnie|kapitalna|kapitalny|kapitalnego|kapitalnym|kapitalnej|kapitalnych)\b/gi,
         (m) => {
           if (allowEmphasis && kapCount === 0) { kapCount++; return m; }
           const alt: Record<string,string> = {
             'kapitalnie':'świetnie','kapitalna':'świetna','kapitalny':'świetny',
             'kapitalnego':'świetnego','kapitalnym':'świetnym','kapitalnej':'świetnej','kapitalnych':'świetnych'
           };
           return alt[m.toLowerCase()] || 'świetnie';
         });
       // niesamowite — max 1x przy drama>=3
       let niesamCount = 0;
       t = t.replace(/\bniesamowit\w*/gi, (m) => {
         if (allowEmphasis && niesamCount === 0) { niesamCount++; return m; }
         return 'doskonał' + (m.slice(-1) === 'e' ? 'e' : m.slice(-2) === 'ie' ? 'ie' : 'y');
       });
       // fenomenalnie — max 1x tylko przy drama=4
       let fenomCount = 0;
       t = t.replace(/\b(fenomenalnie|fenomenalna|fenomenalny|fenomenalnego)\b/gi, (m) => {
         if (dramaLevel >= 4 && fenomCount === 0) { fenomCount++; return m; }
         return m.includes('nie') ? 'znakomicie' : m.includes('na') ? 'znakomita' : 'znakomity';
       });
     }
     t = t.replace(/ma trudne przyjęcie/gi, 'z problemami w przyjęciu');
     // Odmiana apostrofowanych nazwisk — McCarthy'm → McCarthy'ego
     t = t.replace(/McCarthy'm/g, "McCarthy'ego");
     t = t.replace(/McCarthy'mu/g, "McCarthy'emu");
     t = t.replace(/O'Connor'm/g, "O'Connora");
     // Ogólna reguła: X'm → X'ego (dopełniacz)
     t = t.replace(/([A-Z][a-z]+)'m/g, "$1'ego");
     t = t.replace(/([A-Z][a-z]+)'mu/g, "$1'emu");
     t = t.replace(/ma trudne przyjecie/gi, 'z problemami w przyjęciu');
     // Słownictwo blok
     t = t.replace(/muruje atakującego rywala/gi, 'muruje siatkę');
     t = t.replace(/muruje atakujacego rywala/gi, 'muruje siatkę');
     t = t.replace(/wbija blok punktowy/gi, 'zdobywa punkt blokiem');
     t = t.replace(/wbija blok/gi, 'zamyka blokiem');
     t = t.replace(/wbija piłkę w boisko/gi, 'wbija piłkę w boisko');
     t = t.replace(/wbija(?! piłkę)/gi, 'wbija piłkę');
     // Przyjęcie — nie "trudne"
     t = t.replace(/trudne przyjęcie/gi, 'niedokładne przyjęcie');
     t = t.replace(/trudne przyjecie/gi, 'niedokładne przyjęcie');
     t = t.replace(/przyjęcie nie jest precyzyjne/gi, 'przyjęcie dalekie od ideału');
     t = t.replace(/przyjecie nie jest precyzyjne/gi, 'przyjęcie dalekie od ideału');
     // Kiwka — naturalna forma
     t = t.replace(/atakuje kiwką/gi, 'kiwa');
     t = t.replace(/atakuje kiwka/gi, 'kiwa');
     t = t.replace(/próbuje kiwką/gi, 'próbuje zaskoczyć kiwką');
     // Wyblok — "wraca w pole" → "wraca na stronę"
     t = t.replace(/wraca w pole/gi, 'wraca na stronę atakujących');
     t = t.replace(/wraca w pole gry/gi, 'wraca na stronę atakujących');
     // "oczko" — max 1x
     {
       let oczkoCount = 0;
       t = t.replace(/„oczko"|"oczko"|oczko/gi, (m) => {
         oczkoCount++;
         return oczkoCount <= 1 ? 'punkt' : 'punkt';
       });
     }
     t = t.replace(/Punkt oddany bez walki[!.]?/gi, 'strata punktu.');
     t = t.replace(/Nieudana próba serwisu[!.]?/gi, 'błąd na zagrywce.');
     t = t.replace(/Zmarnowany serwis[!,.]?/gi, 'Błąd serwisowy.');
     // Hard length limit — max 3 zdania, max 55 słów
     if (lang === 'pl') {
       const sentences = t.split(/(?<=[.!?])\s+/);
       if (sentences.length > 3) {
         t = sentences.slice(0, 3).join(' ');
       }
       const words = t.split(/\s+/);
       if (words.length > 55) {
         // Obetnij do 55 słów na granicy zdania
         const truncated = words.slice(0, 55).join(' ');
         const lastPunct = Math.max(truncated.lastIndexOf('.'), truncated.lastIndexOf('!'), truncated.lastIndexOf('?'));
         t = lastPunct > 30 ? truncated.slice(0, lastPunct + 1) : truncated + '.';
       }
     }
     // Błąd serwisu — max 10 słów, obcinamy nadmiar
     if (/błąd serwis|serw.*błąd|myli się.*serw|blad serw/i.test(t)) {
       const sentences = t.split(/(?<=[.!?])\s+/);
       if (sentences.length > 1 && t.split(/\s+/).length > 12) {
         t = sentences[0]; // zostaw tylko pierwsze zdanie
       }
     }
     t = t.replace(/wystawia do środka/gi, 'wystawia na środek');
     t = t.replace(/wystawiając do środka/gi, 'wystawiając na środek');
     // Gramatyka — "kolejne punkt" i podobne artefakty GPT
     t = t.replace(/[Kk]olejne punkt/g, 'Kolejny punkt');
     t = t.replace(/[Kk]olejny punkt trafia na konto/gi, 'Punkt dla');
     t = t.replace(/[Kk]olejne punkty trafiają na konto/gi, 'Punkt dla');
     t = t.replace(/[Pp]unkt trafia na konto/gi, 'Punkt dla');
     t = t.replace(/trafia na konto ([A-ZŁŚŹĆĘÓĄŃ])/g, 'dla $1');
     // "Kolejny punkt oddane/oddany rywalom"
     t = t.replace(/[Kk]olejny punkt oddane rywalom[^.!]*[.!]?/gi, 'Błąd serwisowy.');
     t = t.replace(/[Kk]olejny punkt oddany rywalom[^.!]*[.!]?/gi, 'Błąd serwisowy.');
     t = t.replace(/[Pp]unkt oddane rywalom[^.!]*/gi, 'Punkt dla rywali.');
     t = t.replace(/[Pp]unkt oddany rywalom[^.!]*/gi, 'Punkt dla rywali.');
     t = t.replace(/oddane rywalom/gi, 'dla rywali');
     // "zdobywa!" bez doprecyzowania
     t = t.replace(/i zdobywa!/gi, 'i zdobywa punkt!');
     t = t.replace(/i zdobywa(?! punkt)/gi, 'i zdobywa punkt');
     // Zdobywa punkt prowadzenie (artefakt score suppression)
     t = t.replace(/zdobywa punkt prowadzenie/gi, 'zdobywa punkt');
     t = t.replace(/zdobywa punkt i prowadzenie/gi, 'zdobywa punkt');
     // Freeball — naturalne formy
     t = t.replace(/puszcza swobodną piłkę/gi, 'oddaje piłkę za darmo');
     t = t.replace(/posyła swobodną piłkę/gi, 'oddaje piłkę za darmo');
     t = t.replace(/zagrywa swobodną piłkę/gi, 'oddaje piłkę za darmo');
     t = t.replace(/swobodna piłka/gi, 'free ball');
     t = t.replace(/swobodną piłkę/gi, 'free balla');
     t = t.replace(/darmowa piłka(?! dla)/gi, 'free ball');

     // ── Nowe reguły z feedbacku Ziomków 2026-05-04 ─────────────────────
     // Błąd serwisu → błąd serwisowy
     t = t.replace(/\bBłąd serwisu\b/g, 'Błąd serwisowy');
     t = t.replace(/\bbląd serwisu\b/gi, 'błąd serwisowy');
     t = t.replace(/\bbłąd serwisu\b/g, 'błąd serwisowy');
     // Pierwsze tempo — prawidłowa forma
     t = t.replace(/atakuje pierwszym tempem/gi, 'atakuje z pierwszego tempa');
     t = t.replace(/atakuje pierwszego tempa/gi, 'atakuje z pierwszego tempa');
     t = t.replace(/konczy pierwszym tempem/gi, 'kończy z pierwszego tempa');
     t = t.replace(/kończy pierwszym tempem/gi, 'kończy z pierwszego tempa');
     t = t.replace(/uderza pierwszym tempem/gi, 'uderza z pierwszego tempa');
     t = t.replace(/atakuje pierwsza tempo/gi, 'atakuje z pierwszego tempa');
     t = t.replace(/atakuje pierwszego tempa/gi, 'atakuje z pierwszego tempa');
     t = t.replace(/atak pierwszym tempem/gi, 'atak z pierwszego tempa');
     t = t.replace(/szybkim atakiem z pierwszej piłki/gi, 'szybkim atakiem ze środka');
     t = t.replace(/atakiem z pierwszej piłki/gi, 'atakiem ze środka');
     t = t.replace(/kończy z pierwszej piłki środkiem/gi, 'kończy ze środka');
     t = t.replace(/z pierwszej piłki środkiem/gi, 'ze środka');
     t = t.replace(/z pierwszej piłki na środku/gi, 'ze środka');
     t = t.replace(/z pierwszej piłki/gi, 'ze środka');
     t = t.replace(/atakiem pierwszego tempa/gi, 'atakiem z pierwszego tempa');
     t = t.replace(/szybkim atakiem pierwszego tempa/gi, 'szybkim atakiem ze środka');
     t = t.replace(/blyskawicznym atakiem pierwszego tempa/gi, 'błyskawicznym atakiem ze środka');
     t = t.replace(/błyskawicznym atakiem pierwszego tempa/gi, 'błyskawicznym atakiem ze środka');
     // Pierwsza piłka — tylko przy złym przyjęciu
     t = t.replace(/szybkim atakiem pierwszej piłki/gi, 'szybkim atakiem');
     t = t.replace(/po pierwszym tempem/gi, 'z pierwszego tempa');
     t = t.replace(/mimo pierwszym tempem/gi, 'mimo ataku z pierwszego tempa');
     t = t.replace(/z szybkim pierwszym tempem/gi, 'z pierwszego tempa');
     t = t.replace(/przez pierwsze tempo/gi, 'z pierwszego tempa');
     t = t.replace(/atak pierwszym tempem/gi, 'atak z pierwszego tempa');
     t = t.replace(/szybkim atakiem z pierwszej piłki/gi, 'szybkim atakiem ze środka');
     t = t.replace(/atakiem z pierwszej piłki/gi, 'atakiem ze środka');
     t = t.replace(/kończy z pierwszej piłki środkiem/gi, 'kończy ze środka');
     t = t.replace(/z pierwszej piłki środkiem/gi, 'ze środka');
     t = t.replace(/z pierwszej piłki na środku/gi, 'ze środka');
     t = t.replace(/z pierwszej piłki/gi, 'ze środka');
     t = t.replace(/atakiem pierwszej piłki/gi, 'atakiem');
     t = t.replace(/kończy pierwszą piłkę/gi, 'kończy akcję');
     // Szybko przyjęty → dobrze przyjęty
     t = t.replace(/szybko przyjęty/gi, 'dobrze przyjęty');
     t = t.replace(/szybko przyjął/gi, 'dobrze przyjął');
     t = t.replace(/szybko przyjęła/gi, 'dobrze przyjęła');
     t = t.replace(/szybko przyjęte/gi, 'dobrze przyjęte');
     // Bierze prowadzenie
     t = t.replace(/bierze prowadzenie/gi, 'wychodzi na prowadzenie');
     t = t.replace(/biorą prowadzenie/gi, 'wychodzą na prowadzenie');
     t = t.replace(/Punkt bierze/gi, 'Punkt dla');
     t = t.replace(/punkt bierze/gi, 'punkt dla');
     // Wyblokowuje → dotyka blokiem
     t = t.replace(/wyblokowuje/gi, 'dotyka blokiem');
     t = t.replace(/dotyka blok(?!u|iem)/gi, 'dotyka bloku');
     t = t.replace(/dotykacie blok(?!u|iem)/gi, 'dotyka bloku');
     // Explicit string fallback — regex nie łapie gdy po 'blok' jest interpunkcja
     t = t.split('dotyka blok, ').join('dotyka bloku, ');
     t = t.split('dotyka blok ale ').join('dotyka bloku, ale ');
     t = t.split('dotyka blok i ').join('dotyka bloku i ');
     t = t.split('Dotyka blok, ').join('Dotyka bloku, ');
     // Artefakty ocen technicznych na końcu komentarza
     if (t.trimEnd().endsWith('doskonłe!')) t = t.trimEnd().slice(0, -10).trimEnd() + '.';
     if (t.trimEnd().endsWith('doskonły!')) t = t.trimEnd().slice(0, -10).trimEnd() + '.';
     // 'Piękny punkt!' po błędzie serwisu — absurd
     t = t.split('. Piękny punkt!').join('.');
     t = t.split('! Piękny punkt!').join('!');
     t = t.split(' Piękny punkt!').join('.');
     t = t.split('. Piękny punkt.').join('.');
     // Pochwały po błędzie serwisu
     t = t.split('serwisowy! świetnie!').join('serwisowy!');
     t = t.split('serwisowy. świetnie!').join('serwisowy!');
     t = t.replace(/ świetnie!\s*$/g, '.');
     t = t.replace(/ Świetnie!\s*$/g, '.');
     // 'Prowadzą od pierwszej piłki' bez podmiotu
     t = t.replace(/Prowadzą od pierwszej piłki[!.]/gi, '');
     t = t.replace(/Wyrównują od pierwszej piłki[!.]/gi, '');
     // Wymyślone metafory
     t = t.replace(/przebija się przez mur/gi, 'przebija blok');
     t = t.replace(/przebija się przez ścianę/gi, 'przebija blok');
     t = t.replace(/przebija zasłonę/gi, 'przebija blok');
     t = t.replace(/przełamuje mur rywali/gi, 'przebija blok rywali');
     t = t.replace(/przebija mur/gi, 'przebija blok');
     // Podwójne słowo (GPT się zaciął) — "piłka, piłka" itp.
     t = t.replace(/(\w{3,}) (?:.*?)/g, '$1');
     t = t.replace(/, piłka wychodzi na aut! piłka/gi, ', piłka wychodzi na aut!');
     t = t.replace(/piłka, piłka/gi, 'piłka');
     t = t.replace(/atak, atak/gi, 'atak');
     // "kończy po wybloku X" — semantycznie mylące, zamień na naturalne
     t = t.replace(/kończy atakiem (.{3,30}) po wybloku ([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+)/gi,
       'kończy atakiem $1 po odbiciu od bloku $2');
     t = t.replace(/kończy (.{0,20}) po wybloku ([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+)/gi,
       'kończy $1 po odbiciu od bloku $2');
     t = t.replace(/wyblokowują/gi, 'dotykają blokiem');
     // Ratuje obronę → ratuje piłkę w obronie
     t = t.replace(/ratuje obronę/gi, 'ratuje piłkę w obronie');
     // Nie zdąża z obroną → próbuje bronić
     t = t.replace(/nie zdąża z obroną/gi, 'próbuje bronić, ale piłka');
     t = t.replace(/nie zdążył z obroną/gi, 'próbował bronić, ale piłka');
     // Semantyka — "ratować" i "piłka wychodzi" bez doprecyzowania
     t = t.replace(/próbuje ratować, ale piłka wychodzi/gi, 'próbuje ratować piłkę, ale ta wychodzi na aut');
     t = t.replace(/probuje ratowac, ale pilka wychodzi/gi, 'próbuje ratować piłkę, ale ta wychodzi na aut');
     t = t.replace(/próbuje ratować ale piłka wychodzi/gi, 'próbuje ratować piłkę, ale ta wychodzi na aut');
     t = t.replace(/próbuje ratować, jednak piłka wychodzi/gi, 'próbuje ratować piłkę, ale ta wychodzi na aut');
     t = t.replace(/stara się ratować, ale piłka wychodzi/gi, 'stara się ratować piłkę, ale ta wychodzi na aut');
     // "piłka wychodzi" bez doprecyzowania gdzie
     t = t.replace(/piłka wychodzi — /gi, 'piłka wychodzi na aut — ');
     t = t.replace(/piłka wychodzi poza(?! boisko)/gi, 'piłka wychodzi poza boisko');
     t = t.replace(/ale piłka wychodzi(?! (na|poza|za))/gi, 'ale piłka wychodzi na aut');
     t = t.replace(/a piłka wychodzi(?! (na|poza|za))/gi, 'a piłka wychodzi na aut');
     t = t.replace(/i piłka wychodzi(?! (na|poza|za))/gi, 'i piłka wychodzi na aut');
     t = t.replace(/piłka wychodzi\./gi, 'piłka wychodzi na aut.');
     t = t.replace(/piłka wychodzi!/gi, 'piłka wychodzi na aut!');
     // Zagrywa kiwką (non-serwis) — zawodnik nie serwuje
     t = t.replace(/([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+) zagrywa kiwką/g, '$1 kiwa');
     t = t.replace(/([A-ZŁŚŹĆĘÓĄŃ][a-złśźćęóąń]+) zagrywa lekko/g, '$1 kiwa');
     // Muruje siatkę — TYLKO przy bloku punktowym. Przy wybloku usuń
     // (nie możemy tego zrobić bez kontekstu — robimy w prompcie)
     // piłka żyje — max 1x
     {
       let zyjeCount = 0;
       t = t.replace(/piłka żyje/gi, (m) => {
         zyjeCount++;
         return zyjeCount <= 1 ? m : 'akcja trwa';
       });
     }
     t = t.replace(/\bbierze!$/gi, 'zdobywa punkt!');
     t = t.replace(/\s+bierze!/g, ' zdobywa punkt!');
     t = t.replace(/\s+bierze\./g, ' zdobywa punkt.');
     t = t.replace(/\bustawia do ataku\b/gi, 'wystawia do ataku');
     t = t.replace(/\bgra trwa\b/gi, 'akcja trwa');
     t = t.replace(/\bżywa zagrywka\b/gi, 'zagrywka szybująca');
     t = t.replace(/\bżywą zagrywką\b/gi, 'zagrywką szybującą');
     t = t.replace(/\bżywej zagrywki\b/gi, 'zagrywki szybującej');
     t = t.replace(/\bbroni potężnym blokiem\b/gi, 'potężny blok');
     t = t.replace(/\bbroni mocnym blokiem\b/gi, 'mocny blok');
   }

   if (lang === 'it') {
     t = t.replace(/\bSERVICE ACE\b/gi, 'ace');
     t = t.replace(/\bSET OVER\b/gi, 'SET!');
     t = t.replace(/\bHoss\b/g, 'Thales');
   }

   if (lang === 'de') {
     t = t.replace(/\bSERVICE ACE\b/gi, 'Aufschlag-Ass');
     t = t.replace(/\bSET OVER\b/gi, 'SATZGEWINN!');
     t = t.replace(/\bHoss\b/g, 'Thales');
   }

   if (lang === 'tr') {
     t = t.replace(/\bSERVICE ACE\b/gi, 'servis ace');
     t = t.replace(/\bSET OVER\b/gi, 'SET BİTTİ!');
     t = t.replace(/\bHoss\b/g, 'Thales');
     t = t.replace(/\bPunkt dla [^!.]+[!.]/g, 'Sayı!');
   }

   if (lang === 'es') {
     t = t.replace(/\bSERVICE ACE\b/gi, 'ace de saque');
     t = t.replace(/\bSET OVER\b/gi, '¡SET!');
     t = t.replace(/\bHoss\b/g, 'Thales');
   }

   if (lang === 'pt') {
     t = t.replace(/\bSERVICE ACE\b/gi, 'ace no saque');
     t = t.replace(/\bSET OVER\b/gi, 'SET!');
     t = t.replace(/\bHoss\b/g, 'Thales');
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
