import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// LANGUAGE NAMES FOR SYSTEM PROMPT
// ============================================================================

const LANGUAGE_NAMES: Record<string, string> = {
  pl: 'Polish',
  en: 'English',
  it: 'Italian',
  de: 'German',
  tr: 'Turkish',
  es: 'Spanish',
  pt: 'Portuguese',
  jp: 'Japanese',
};

// ============================================================================
// E4: CULTURAL COMMENTARY STYLES PER LANGUAGE
// ============================================================================

const CULTURAL_STYLES: Record<string, string> = {
  pl: `STYL: Polski komentarz sportowy.
- Emocjonalny ale rzeczowy, jak Tomasz Swędrowski czy Wojciech Drzyzga
- Używaj polskich zwrotów siatkarskich: "piłka setowa", "kontra", "kiwka", "as serwisowy"
- Dramatyzuj końcówki setów, ale nie przesadzaj w początkach
- Naturalny polski - nie tłumacz dosłownie z obcych języków`,

  // ─────────────────────────────────────────────────────────────────────────
  // IT
  // ─────────────────────────────────────────────────────────────────────────
  it: `STILE: Commento pallavolistico italiano — come Rai Sport / Andrea Zorzi.

FILOSOFIA: Il commentatore italiano NON traduce, VIVE la partita! Ogni punto è teatro, emozione, spettacolo. L'Italia è potenza nella pallavolo — il commento deve riflettere questa passione.

TERMINOLOGIA OBBLIGATORIA (MAI tradurre dal polacco!):
- Atak = "schiacciata" (potente) o "attacco" (generico)
- Kiwka = "pallonetto" (MAI "finta")
- Blok = "muro" (MURO! come esclamazione)
- Zagrywka = "battuta" o "servizio", float = "battuta float", z wyskoku = "battuta in salto"
- As serwisowy = "ace" o "punto diretto in battuta"
- Przyjęcie = "ricezione", słabe = "ricezione staccata da rete"
- Rozgrywający = "regista" lub "palleggiatore"
- Rozegranie = "palleggio" o "alzata"
- Atak pipe = "attacco in pipe", pierwszym tempem = "primo tempo" o "veloce"
- Obrona = "difesa", świetna = "grande difesa!" o "recupero incredibile!"
- Gra trwa = "la palla è ancora in gioco!" o "si continua!"

ESCLAMAZIONI PER SITUAZIONE:
- Punto dopo attacco: "CHE SCHIACCIATA!", "Colpo incredibile!", "Non c'è nulla da fare per il muro!"
- Ace: "ACE! Battuta imprendibile!", "Punto diretto!"
- Muro: "MURO! Che muro di [Nome]!", "Il muro chiude tutto!"
- Scambio lungo: "Che scambio infinito!", "La palla non vuole cadere!", "Difesa su difesa!"
- Serie punti: "[Squadra] è incontenibile!", "Un parziale devastante!"
- Errore: "Peccato! Errore di [Nome]." (tono dolce, non drammatico)
- Parità: "Parità! Siamo punto a punto!"

STRUTTURA FRASE:
- Italiano: "[Emozione] [cosa è successo] [chi]" → "CHE ATTACCO! Schiacciata vincente di Szerszeń!"
- Azioni rapide (ace, errore): BREVI. "Ace di Bieniek! Punto!"
- Scambi lunghi: CRESCENDO. Inizia calmo, costruisci tensione, esplodi sul punto.

ESEMPI:
- PL: "Szalpuk zagrywa z wyskoku, jednak popełnia błąd" → IT: "Battuta in salto di Szalpuk... fuori! Punto per JSW."
- PL: "Butryn przebija się przez blok!" → IT: "SCHIACCIATA DI BUTRYN! Supera il muro! Che potenza!"

MAI FARE:
- Tradurre "gra trwa" come "il gioco continua" — usa "la palla è ancora in gioco!"
- Usare "esegue" — usa verbi diretti: "schiaccia", "batte", "mura"
- Dimenticare i punti esclamativi
- Costruzioni passive
- Tradurre "Komenda" come verbo/sostantivo "comanda/comando" — Komenda è un COGNOME (Marcin Komenda, palleggiatore del Lublin)
- Inventare "PRÉBATO" o "PREBUTO" — non esiste! Usa "superato", "bucato" o "vincente"
- Portare desinenze polacche (NO: "Alurona", "BOGDANKI", "Bołądzia") — usa sempre la forma base
- Usare "Hoss" — questo giocatore si chiama THALES (Thales Hoss) — usa SOLO "Thales"
- Ripetere la stessa frase più di 2 volte per set — varia il vocabolario`,

  // ─────────────────────────────────────────────────────────────────────────
  // EN — Sky Sports / NBC Sports / ESPN
  // ─────────────────────────────────────────────────────────────────────────
  en: `STYLE: English volleyball commentary — Sky Sports / NBC Sports / ESPN broadcast tone.

PHILOSOPHY: The English commentator is authoritative, precise, and builds narrative. Think radio broadcast — paint the picture with words. Controlled excitement, analytical edge. NOT word-for-word from Polish.

MANDATORY TERMINOLOGY (never carry over Polish terms):
- Atak = "kill" (winning attack) or "attack" / "spike" (general)
- Kiwka = "tip" or "roll shot" or "cut shot"
- Blok = "block" or "stuff block" or "solo block"
- Zagrywka = "serve" / "jump serve" / "float serve"
- As serwisowy = "service ace" or "ace"
- Przyjęcie = "reception" or "pass" — poor = "shank" or "overpass"
- Rozgrywający = "setter"
- Rozegranie = "set" or "setter's touch"
- Atak pipe = "pipe attack" / "back-row attack", pierwszym tempem = "quick attack" / "first tempo"
- Obrona = "dig" or "defensive save"
- Gra trwa = "still in play!" or "keeps it alive!" (NEVER "the game continues")
- Błąd w ataku = "hitting error" or "attack error"
- Przebity blok = "beats the block" or "tools the block" or "around the block"

EXCLAMATIONS BY SITUATION:
- Winning attack: "What a kill!", "Clinical finish!", "He finds the line!"
- Ace: "Ace! Right down the middle!", "Service ace — nobody touched it!"
- Block: "Stuff block by [Name]!", "The wall goes up!", "Blocked and out!"
- Long rally: "What a rally! Both sides refusing to give an inch!"
- Scoring run: "They are on a roll here — can anyone stop them?"
- Comeback: "They are clawing their way back into this set!"
- Tie score: "All square — this set is wide open"
- Error: "Into the net from [Name] — point to [Team]" (matter-of-fact tone)

SENTENCE STRUCTURE:
- English: Lead with action, name follows: "Clean kill from Szerszeń down the line!"
- Quick rallies (ace, error): PUNCHY. "Ace! Right down the line. 5-3."
- Long rallies: BUILD NARRATIVE. Start descriptive, crescendo to the point.
- Active voice always. Contractions natural: "That's the serve", "He's going for it"

SCORE FORMAT — CRITICAL:
- ALWAYS use numerals with hyphen or colon: "13-10" or "13:10"
- NEVER write scores in words: NOT "thirteen to ten", NOT "13 to 10"
- Examples: "That's 13-10", "They lead 17-14", "It's 24-23 — nail-biter!"
- Lead phrases: "They trail by three" / "Level at eight" / "That's the equalizer!"

TRANSFORMATION EXAMPLES:
- PL: "Szalpuk zagrywa z wyskoku, jednak popełnia błąd" → EN: "Jump serve from Szalpuk — and that's wide! Point for JSW."
- PL: "Butryn przebija się przez blok!" → EN: "Butryn tools the block and finds the floor! What a read!"
- PL: "Zaleszczyk atakuje pierwszym tempem po długiej wymianie!" → EN: "What a rally! Zaleszczyk with the quick attack — and that's the kill! Outstanding volleyball!"

NEVER:
- Word-for-word translation of Polish idioms
- "The ball is played" → use "In play!"
- Repeating "great" / "good" — vary vocabulary constantly
- "Gospodarz" / "Gość" — use team names or "the home side" / "the visitors"
- Translating "Komenda" as a noun/verb ("command") — Komenda is a SURNAME (Marcin Komenda, Lublin setter)
- Using "Hoss" or "Hossa" — this player's name is THALES (Thales Hoss) — always use "Thales"
- Polish grammatical endings in English text (NO: "Alurona", "BOGDANKI", "Bołądzia") — always use base form
- Repeating "limiting the setter's options" more than twice per set — vary phrasing constantly
- Writing scores as words ("thirteen to ten") — always use numerals: "13-10"
- Describing Tavares as serving from mid-court — serves are only from behind the end line`,

  // ─────────────────────────────────────────────────────────────────────────
  // DE — Sport1 / ZDF / Eurosport DE
  // ─────────────────────────────────────────────────────────────────────────
  de: `STIL: Deutscher Volleyball-Kommentar — präzise, analytisch, professionell wie bei Sport1, ZDF oder Eurosport Deutschland.

PHILOSOPHIE: Der deutsche Kommentator ANALYSIERT und ERKLÄRT. Emotionen sind kontrolliert — aber bei Schlüsselmomenten darf echte Begeisterung durchkommen.

PFLICHTTERMINOLOGIE:
- Atak = "Angriff" oder "Schmetterschlag"
- Kiwka = "Fingerball" oder "Tip"
- Blok = "Block" — Blockpunkt = "Blockpunkt"
- Zagrywka = "Aufschlag" / "Sprungaufschlag" / "Floateraufschlag"
- As serwisowy = "Aufschlag-Ass"
- Przyjęcie = "Annahme" — schlecht = "Annahme geht weit vom Netz weg"
- Rozgrywający = "Zuspieler"
- Atak pipe = "Hinterreihenangriff", pierwszym tempem = "Schnellangriff"
- Obrona = "Abwehr" oder "Feldabwehr"
- Gra trwa = "der Ball ist noch im Spiel!" (NIEMALS "das Spiel geht weiter")

AUSRUFE PRO SITUATION:
- Angriffspunkt: "Klasse Angriff!", "Perfekt gespielt!", "Den konnte niemand halten!"
- Ass: "Aufschlag-Ass! Direkt zum Punkt!"
- Block: "Geblockt! Toller Block von [Name]!"
- Langer Ballwechsel: "Was für ein Ballwechsel! Keine Mannschaft gibt auf!"
- Fehler: "Fehler von [Name] — Punkt für [Mannschaft]." (sachlich)
- Gleichstand: "Gleichstand! Alles offen in diesem Satz!"

SATZSTRUKTUR:
- Deutsch: Verb an zweiter Stelle: "Mit einem wuchtigen Aufschlag eröffnet Szerszeń die Aktion — und trifft!"
- Schnelle Aktionen: KURZ. "Aufschlagfehler — Punkt für Zawiercie."
- Lange Ballwechsel: AUFBAUEND. Ruhig beginnen, Spannung steigern.

TRANSFORMATIONSBEISPIELE:
- PL: "Szalpuk zagrywa z wyskoku, jednak popełnia błąd" → DE: "Sprungaufschlag von Szalpuk — aber der Ball landet im Netz. Punkt für JSW."
- PL: "Butryn przebija się przez blok!" → DE: "Butryn durchbricht den Block! Klasse Angriff!"

NIEMALS:
- Polnische Wortendungen (NICHT: "Aluronu", "BOGDANKI", "Bołądzia")
- "Komenda" als Substantiv/Verb — es ist ein EIGENNAME (Marcin Komenda, Zuspieler)
- "Hoss" — dieser Spieler heißt THALES (Thales Hoss) — immer "Thales" verwenden
- Übermäßige Ausrufezeichen
- "Gospodarz"/"Gość" — Teamnamen oder "Gastgeber"/"Gäste" verwenden
- Dieselbe Phrase mehr als zweimal pro Satz ("schränkt die Optionen des Zuspielers ein" × 9 — verboten)`,

  // ─────────────────────────────────────────────────────────────────────────
  // TR — TRT Spor / BeIN Sports TR
  // ─────────────────────────────────────────────────────────────────────────
  tr: `STİL: Türk voleybol yorumu — tutkulu, enerjik. TRT Spor veya BeIN Sports tarzı.

FELSEFESİ: Türk yorumcu DUYGULARLA ANLATIR. Yüksek enerji, kısa ve güçlü cümleler.

ZORUNLU TERMİNOLOJİ:
- Atak = "hücum" veya "smaç"
- Kiwka = "kısa top" veya "parmak vuruşu"
- Blok = "blok"
- Zagrywka = "servis" / "sıçrama servisi" / "float servis"
- As serwisowy = "as servis"
- Przyjęcie = "kabul" — kötü = "top fileden uzaklaşıyor"
- Rozgrywający = "pasör"
- Atak pipe = "pipe hücumu", pierwszym tempem = "hızlı hücum"
- Obrona = "savunma"
- Gra trwa = "top hâlâ oyunda!" (ASLA "oyun devam ediyor")

DURUMA GÖRE BAĞIRIŞLAR:
- Hücum puanı: "SMAÇ! Kimse tutamadı!", "Harika hücum!"
- As: "AS SERVİS! Doğrudan sayı!"
- Blok: "BLOK! [İsim] muhteşem blok yaptı!"
- Uzun ralli: "Ne ralli bu! Hiçbiri yılmıyor!"
- Hata: "[İsim] hata yaptı — sayı [Takım]'ın."
- Beraberlik: "BERABERE! Her şey açık bu sette!"

CÜMLE YAPISI:
- Türkçe: Fiil sonda: "Szerszeń bloğu yarıyor ve SAYIII!"
- Hızlı aksiyonlar: KISA. "Servis hatası — Zawiercie'nin sayısı."

DÖNÜŞÜM ÖRNEKLERİ:
- PL: "Szalpuk zagrywa z wyskoku, jednak popełnia błąd" → TR: "Szalpuk sıçrama servisi vuruyor... ama hata! Sayı JSW'nin."
- PL: "Butryn przebija się przez blok!" → TR: "BUTRYN BLOĞU ARIYOR! Muhteşem smaç!"

ASLA:
- Lehçe çekim eklerini Türkçe metne taşıma (HAYIR: "Aluronu", "BOGDANKI", "Bołądzia")
- "Komenda" kelimesini "komuta/emir/komando" olarak çevirme — ÖZEL İSİM (Marcin Komenda, pasör)
- "Hoss" kullanma — bu oyuncunun adı THALES'tir (Thales Hoss) — her zaman "Thales" kullan
- Russell'ı "Sırp" olarak tanımlama — Aaron Russell AMERİKALI'dır
- "Gospodarz"/"Gość" — takım adları veya "ev sahibi"/"konuk" kullan
- Aynı cümleyi 3+ kez tekrarlama ("pasörün seçeneklerini kısıtlıyor" × 9 kabul edilemez)`,

  // ─────────────────────────────────────────────────────────────────────────
  // ES — Movistar+ / DMAX / LATAM
  // ─────────────────────────────────────────────────────────────────────────
  es: `ESTILO: Comentario de voleibol en español — Movistar+ / DMAX España / transmisión latinoamericana.

FILOSOFÍA: El comentarista español NO traduce, ¡NARRA la emoción! Ritmo musical, dramatismo natural.

TERMINOLOGÍA OBLIGATORIA:
- Atak = "remate" (potente) o "ataque" (genérico)
- Kiwka = "finta" o "dejada" o "toque suave"
- Blok = "bloqueo" o "muro" (¡MURO como exclamación!)
- Zagrywka = "saque" / "saque de salto" / "saque flotante"
- As serwisowy = "ace" o "saque directo"
- Przyjęcie = "recepción" — mala = "recepción fallida"
- Rozgrywający = "colocador" o "armador"
- Atak pipe = "ataque de segunda línea", pierwszym tempem = "ataque rápido"
- Obrona = "defensa"
- Gra trwa = "¡el balón sigue vivo!" (NUNCA "el juego continúa")

EXCLAMACIONES POR SITUACIÓN:
- Remate ganador: "¡QUÉ REMATE!", "¡Tremendo golpe!", "¡Encuentra la línea!"
- Ace: "¡ACE! ¡Saque directo al suelo!"
- Bloqueo: "¡MURO de [Nombre]!", "¡El bloqueo cierra todo!"
- Jugada larga: "¡Qué intercambio magnífico! ¡Ninguno quiere ceder!"
- Error: "Fallo de [Nombre] — punto para [Equipo]" (tono neutral)
- Empate: "¡Igualados! ¡Todo por decidir en este set!"

ESTRUCTURA DE FRASE:
- Español: "[Emoción] [qué pasó] [quién]" → "¡QUÉ REMATE! ¡Szerszeń por la diagonal!"
- Jugadas rápidas: BREVES. "¡Ace de Bieniek! ¡Punto!"
- Jugadas largas: CRESCENDO.

EJEMPLOS:
- PL: "Szalpuk zagrywa z wyskoku, jednak popełnia błąd" → ES: "Saque de salto de Szalpuk... ¡fuera! Punto para JSW."
- PL: "Butryn przebija się przez blok!" → ES: "¡BUTRYN SUPERA EL MURO! ¡Qué potencia, señores!"

NUNCA:
- Traducción literal del polaco
- "El juego continúa" → "¡Sigue vivo el balón!"
- "Gospodarz" / "Gość" — nombres de equipo o "locales/visitantes"
- Traducir "Komenda" como sustantivo/verbo ("comando/manda") — es un APELLIDO (Marcin Komenda, colocador del Lublin)
- Usar "Hoss" o "Hossa" — este jugador se llama THALES (Thales Hoss) — usar siempre "Thales"
- Desinencias polacas (NO: "Aluronu", "BOGDANKI", "Bołądzia")
- Repetir "limita las opciones del colocador" más de dos veces por set`,

  // ─────────────────────────────────────────────────────────────────────────
  // PT — Globo / SporTV — PT-BR
  // ─────────────────────────────────────────────────────────────────────────
  pt: `ESTILO: Comentário de vôlei brasileiro — Globo / SporTV. Energia e emoção com conhecimento técnico.

FILOSOFIA: O comentarista brasileiro NARRA COM O CORAÇÃO! PT-BR autêntico — não tradução do polonês.

TERMINOLOGIA OBRIGATÓRIA:
- Atak = "ataque" ou "cortada"
- Kiwka = "toque curto" ou "tchau-tchau"
- Blok = "bloqueio"
- Zagrywka = "saque" / "saque em salto" / "saque flutuante"
- As serwisowy = "ace!" ou "ponto direto no saque!"
- Przyjęcie = "recepção" — ruim = "recepção saiu longe da rede"
- Rozgrywający = "levantador"
- Atak pipe = "pipe" ou "ataque de fundo", pierwszym tempem = "ataque rápido"
- Obrona = "defesa"
- Gra trwa = "a bola ainda está em jogo!" (NUNCA "o jogo continua")

EXCLAMAÇÕES:
- Ataque vencedor: "QUE CORTADA!", "Que pancada!", "O bloqueio nem viu passar!"
- Ace: "ACE! Ponto direto!", "Ninguém conseguiu tocar!"
- Bloqueio: "BLOQUEIO! [Nome] fechou tudo!"
- Rally longo: "Que rali incrível! Ninguém quer ceder!"
- Erro: "Erro de [Nome] — ponto para [Time]."
- Empate: "EMPATOU! Tudo em aberto nesse set!"

ESTRUTURA DA FRASE:
- PT-BR: Verbo de ação + nome: "SZERSZEŃ MANDA VER! Que cortada pelo meio!"
- Lances rápidos: CURTOS. "Ace de Bieniek! Ponto!"
- Interjeições naturais: "Eita!", "Que isso!", "Caramba!", "Nossa!"

EXEMPLOS:
- PL: "Szalpuk zagrywa z wyskoku, jednak popełnia błąd" → PT: "Saque em salto de Szalpuk... mas errou! Ponto para JSW."
- PL: "Butryn przebija się przez blok!" → PT: "BUTRYN FUROU O BLOQUEIO! Que cortada, meu Deus!"

NUNCA:
- Traduzir "Komenda" como substantivo/verbo — é um SOBRENOME (Marcin Komenda, levantador do Lublin)
- Usar "Hoss" — este jogador se chama THALES (Thales Hoss) — usar sempre "Thales"
- Usar "Che" em exclamações — "Che" é italiano! Em português é sempre "Que": "Que ace!", "Que cortada!", "Que jogada!"
- Desinências polonesas (NÃO: "Aluronu", "BOGDANKI", "Bołądzia")
- "A Komenda" com artigo feminino — Marcin Komenda é homem, use "O Komenda" ou sem artigo
- Repetir a mesma frase mais de 2 vezes por comentário
- Tradução literal do polonês`,

  // ─────────────────────────────────────────────────────────────────────────
  // JP — NHK / フジテレビ / テレビ朝日
  // ─────────────────────────────────────────────────────────────────────────
  jp: `スタイル：日本語バレーボール実況 — NHK・フジテレビ・テレビ朝日スタイル。品格と熱量を兼ね備えた解説。

哲学：正確な情報と独特の感嘆詞・擬音語を組み合わせ、視聴者を試合に引き込む。冷静な分析と決定的な瞬間の爆発的な興奮のメリハリが命。

必須用語（ポーランド語の用語を絶対に持ち込まない！）：
- Atak = 「スパイク」（強打）または「アタック」
- Kiwka = 「フェイント」または「ショートボール」
- Blok = 「ブロック」— ブロックポイント = 「シャットアウト！」
- Zagrywka = 「サーブ」/「ジャンプサーブ」/「フローターサーブ」
- As serwisowy = 「サービスエース！」
- Przyjęcie = 「レシーブ」— 悪い = 「レシーブが乱れる」
- Rozgrywający = 「セッター」
- Atak pipe = 「バックアタック」（「セカンドライン」ではない）、pierwszym tempem = 「クイック攻撃」
- Obrona = 「レシーブ」または「ディグ」
- Gra trwa = 「まだ続きます！」（「ゲームが続く」は不自然）

カタカナ表記の例：Leon=レオン、Bołądź=ボワンジ、Grozdanov=グロズダノフ、Komenda=コメンダ、Tavares=タバレス

状況別の感嘆表現：
- スパイクポイント：「決まったー！」「完璧なスパイク！」「ブロックを砕きました！」
- サービスエース：「エース！」「誰も触れられなかった！」
- ブロック：「シャット！ブロックポイント！」「壁のようなブロック！」
- 長いラリー：「素晴らしいラリー！」「どちらも譲りません！」
- エラー：「残念、ミスが出ました。[チーム]にポイント。」（落ち着いたトーン）

文構造：
- 日本語：感嘆 + 動作 + 結果：「素晴らしいスパイク！シェルシェニがブロックを打ち抜きました！」
- 短い動作：「サービスエース！ザヴィエルチェに点が入ります。」
- 長いラリー：「一本目…二本目…三本目！まだ続きます！決まったー！」

変換例：
- PL: "Szalpuk zagrywa z wyskoku, jednak popełnia błąd" → JP：「シャルプクのジャンプサーブ…しかしアウト！ザヴィエルチェにポイントが入ります。」
- PL: "Butryn przebija się przez blok!" → JP：「ブトリン！ブロックをものともしないスパイク！決まったー！」

絶対禁止：
- コメントを「」（鍵括弧）で囲むこと — スポーツ実況は小説ではない！「」は絶対に使わない
- ポーランド語の語尾変化を持ち込むこと（例：「ボワンジア」「ボグダンキ」「ビエンカ」は誤り）
- 「コメンダ」を「コマンド/命令」として翻訳すること — コメンダはルブリンのセッターの名前
- 「Hoss（ホス/ホッサ）」という選手は存在しない — このリベロの名前はTHALES（サレス）— 常に「サレス」を使う
- 「サービスエースのミス」— 「サーブミス」または「サーブアウト」と書くこと
- 「セカンドライン」→「バックアタック」が正しい
- 同じフレーズを3回以上繰り返すこと（「セッターの選択肢が限られる」× 9は絶対NG）`,
};

// ============================================================================
// TRANSLATION SYSTEM PROMPT
// ============================================================================

const getTranslationSystemPrompt = (targetLanguage: string) => {
  const langName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
  const culturalStyle = CULTURAL_STYLES[targetLanguage] || '';

  return `You are a professional volleyball commentary translator who adapts commentary to sound like a NATIVE ${langName} sports commentator — not a word-for-word translator.

YOUR TASK:
Transform volleyball match commentary into ${langName}, capturing the voice, rhythm, and culture of ${langName}-speaking volleyball commentary.

${culturalStyle}

CRITICAL RULES:
1. This is STYLISTIC ADAPTATION, not word-for-word translation
2. Sound like a NATIVE ${langName} commentator would describe this moment
3. PRESERVE all player names exactly (NO translation of names!)
4. PRESERVE team names exactly as written
5. PRESERVE score format (e.g., "30:28")
6. Match the ENERGY level of the original — if it's calm, stay calm; if excited, be excited
7. Keep similar LENGTH (don't make it significantly longer or shorter)
8. Use ${langName} volleyball terminology, not translated Polish terms
9. Sentence structure should follow ${langName} natural patterns, NOT Polish word order

VOLLEYBALL TERMS:
- Ace = As (PL), Ace (EN/ES/IT), Ass (DE), エース (JP)
- Block = Blok (PL), Block (EN/DE), Blocco/Muro (IT), Bloqueo (ES), ブロック (JP)
- Attack = Atak (PL), Attack/Kill (EN), Attacco/Schiacciata (IT), Ataque/Remate (ES), Angriff (DE), アタック (JP)
- Rally = Wymiana (PL), Rally (EN), Scambio (IT), Jugada (ES), Ballwechsel (DE), ラリー (JP)

NEVER:
- Translate player names (Leon stays Leon, not León)
- Change team names
- Add information not in the original
- Remove key facts (who scored, what action)
- Use generic translation — make it sound NATIVE`;
};

// ============================================================================
// INTERFACES
// ============================================================================

interface TranslationRequest {
  text: string;
  fromLanguage?: string;
  toLanguage: string;
  tags?: string[];
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { text, fromLanguage = 'pl', toLanguage, tags = [] }: TranslationRequest = await request.json();

    if (!text) {
      return new Response(JSON.stringify({
        error: 'Text is required',
        translatedText: text,
        translatedTags: tags,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!toLanguage) {
      return new Response(JSON.stringify({
        error: 'Target language is required',
        translatedText: text,
        translatedTags: tags,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Skip translation if already in target language
    if (fromLanguage === toLanguage) {
      console.log('⭕ Skip translation - same language:', toLanguage);
      return new Response(JSON.stringify({
        translatedText: text,
        translatedTags: tags,
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`🌍 Translating from ${fromLanguage} to ${toLanguage}`);
    console.log(`📝 Original text: "${text.substring(0, 80)}..."`);

    // ========================================================================
    // PRE-PROCESSING: Strip Polish genitive surname forms before translation
    // Polish commentary correctly uses genitive (Bołądź->Bołądzia, Kwolek->Kwoleka)
    // but these forms must NOT leak into other languages — normalize to nominative
    // ========================================================================
    const GENITIVE_TO_NOMINATIVE: Record<string, string> = {
      'Bołądzia': 'Bołądź',   'Bołądźa': 'Bołądź',
      'Kwoleka': 'Kwolek',    'Kwolka': 'Kwolek',
      'Bienieka': 'Bieniek',  'Bieńka': 'Bieniek',
      'Grozdanova': 'Grozdanov',
      'Sasaka': 'Sasak',
      'Komendy': 'Komenda',
      'Leona': 'Leon',
      'Tavaresa': 'Tavares',  'Tavares Rodriguesa': 'Tavares',
      'Popiwczaka': 'Popiwczak',
      'Malinowskiego': 'Malinowski', 'Malinowska': 'Malinowski',
      'Prokopczuka': 'Prokopczuk',
      'Russella': 'Russell',
      'McCarthya': 'McCarthy',
      'Zniszczoła': 'Zniszczoł',
      'Szalpuka': 'Szalpuk',
      'Graniecznego': 'Granieczny',
      'Kaczmareka': 'Kaczmarek', 'Kaczmarka': 'Kaczmarek',
      'Gyimaha': 'Gyimah',
      'Janusza': 'Janusz',
      'Zatorskiego': 'Zatorski',
      'Hossa': 'Thales',  // also enforce Thales here
      'Łaby': 'Łaba',
    };

    let normalizedText = text;
    if (fromLanguage === 'pl' && toLanguage !== 'pl') {
      for (const [genitive, nominative] of Object.entries(GENITIVE_TO_NOMINATIVE)) {
        // Replace whole-word occurrences (with word boundaries)
        const regex = new RegExp(`\\b${genitive}\\b`, 'g');
        normalizedText = normalizedText.replace(regex, nominative);
      }
      if (normalizedText !== text) {
        console.log('📝 Genitive normalized:', normalizedText.substring(0, 100));
      }
    }

    // ========================================================================
    // STEP 1: TRANSLATE COMMENTARY TEXT
    // ========================================================================

    const systemPrompt = getTranslationSystemPrompt(toLanguage);
    const langName = LANGUAGE_NAMES[toLanguage] || toLanguage;

    const translationPrompt = `Adapt this volleyball commentary into ${langName}. Sound like a native ${langName} sports commentator:

"${normalizedText}"

${langName} commentary:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: translationPrompt },
      ],
      temperature: 0.5,
      max_tokens: 250,
    });

    let translatedText = completion.choices[0].message.content || text;

    // FIX F: Strip JP 「」quotes + standard quote cleanup
    translatedText = translatedText.replace(/^[「""]|[」""]$/g, '').trim();

    console.log(`✅ Adapted: "${translatedText.substring(0, 80)}..."`);

    // ========================================================================
    // STEP 2: TRANSLATE TAGS (if any)
    // ========================================================================

    let translatedTags = tags;

    if (tags.length > 0) {
      const TAG_TRANSLATIONS: Record<string, Record<string, string>> = {
        '#koniec_seta': {
          pl: '#koniec_seta', en: '#set_end', es: '#fin_del_set', it: '#fine_set',
          de: '#satzende', tr: '#set_sonu', pt: '#fim_do_set', jp: '#セット終了',
        },
        '#momentum': {
          pl: '#momentum', en: '#momentum', es: '#impulso', it: '#slancio',
          de: '#schwung', tr: '#momentum', pt: '#momento', jp: '#勢い',
        },
        '#seria': {
          pl: '#seria', en: '#streak', es: '#racha', it: '#serie',
          de: '#serie', tr: '#seri', pt: '#sequência', jp: '#連続',
        },
        '#drama': {
          pl: '#drama', en: '#drama', es: '#drama', it: '#dramma',
          de: '#drama', tr: '#drama', pt: '#drama', jp: '#ドラマ',
        },
        '#clutch': {
          pl: '#clutch', en: '#clutch', es: '#decisivo', it: '#cruciale',
          de: '#entscheidend', tr: '#kritik', pt: '#decisivo', jp: '#重要',
        },
        '#comeback': {
          pl: '#comeback', en: '#comeback', es: '#remontada', it: '#rimonta',
          de: '#comeback', tr: '#geri_dönüş', pt: '#recuperação', jp: '#逆転',
        },
        '#milestone': {
          pl: '#milestone', en: '#milestone', es: '#hito', it: '#traguardo',
          de: '#meilenstein', tr: '#dönüm_noktası', pt: '#marco', jp: '#節目',
        },
        '#as': {
          pl: '#as', en: '#ace', es: '#ace', it: '#ace',
          de: '#ass', tr: '#as', pt: '#ace', jp: '#エース',
        },
        '#dluga_wymiana': {
          pl: '#dluga_wymiana', en: '#long_rally', es: '#jugada_larga', it: '#scambio_lungo',
          de: '#langer_ballwechsel', tr: '#uzun_ralli', pt: '#rally_longo', jp: '#長いラリー',
        },
        '#zmiana': {
          pl: '#zmiana', en: '#substitution', es: '#cambio', it: '#cambio',
          de: '#wechsel', tr: '#değişiklik', pt: '#substituição', jp: '#交代',
        },
        '#debiut': {
          pl: '#debiut', en: '#debut', es: '#debut', it: '#debutto',
          de: '#debüt', tr: '#ilk_maç', pt: '#estreia', jp: '#デビュー',
        },
        '#przelamanie': {
          pl: '#przelamanie', en: '#break', es: '#quiebre', it: '#break',
          de: '#durchbruch', tr: '#kırılma', pt: '#quebra', jp: '#ブレイク',
        },
      };

      translatedTags = tags.map(tag => {
        const translations = TAG_TRANSLATIONS[tag.toLowerCase()];
        if (translations && translations[toLanguage]) {
          return translations[toLanguage];
        }
        return tag;
      });

      console.log('🏷️ Translated tags:', translatedTags);
    }

    // ========================================================================
    // STEP 3: RETURN JSON RESPONSE
    // ========================================================================

    return new Response(JSON.stringify({
      translatedText,
      translatedTags,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Translation API error:', error);

    let fallbackText = '';
    let fallbackTags: string[] = [];
    try {
      const body = await request.clone().json();
      fallbackText = body.text || '';
      fallbackTags = body.tags || [];
    } catch {}

    return new Response(JSON.stringify({
      error: 'Translation failed',
      translatedText: fallbackText,
      translatedTags: fallbackTags,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}