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

  it: `STILE: Commento pallavolistico italiano — come Rai Sport / Andrea Zorzi.

FILOSOFIA: Il commentatore italiano NON traduce, VIVE la partita! Ogni punto è teatro, emozione, spettacolo. L'Italia è potenza nella pallavolo — il commento deve riflettere questa passione.

TERMINOLOGIA OBBLIGATORIA (MAI tradurre dal polacco!):
- Atak = "schiacciata" (potente) o "attacco" (generico)
- Kiwka = "pallonetto" (MAI "finta")
- Blok = "muro" (MURO! come esclamazione)
- Zagrywka = "battuta" o "servizio", float = "battuta float", z wyskoku = "battuta in salto"
- As serwisowy = "ace" o "punto diretto in battuta"
- Przyjęcie = "ricezione", słabe = "ricezione staccata da rete"
- Rozgrywający = "regista" (reżyser!) lub "palleggiatore"
- Rozegranie = "palleggio" o "alzata"
- Atak pipe = "attacco in pipe", pierwszym tempem = "primo tempo" o "veloce"
- Obrona = "difesa", świetna = "grande difesa!" o "recupero incredibile!"
- Gra trwa = "la palla è ancora in gioco!" o "si continua!" (MAI "il gioco continua")

ESCLAMAZIONI PER SITUAZIONE:
- Punto dopo attacco: "CHE SCHIACCIATA!", "Colpo incredibile!", "Non c'è nulla da fare per il muro!"
- Ace: "ACE! Battuta imprendibile!", "Punto diretto!"
- Muro: "MURO! Che muro di [Nome]!", "Il muro chiude tutto!"
- Scambio lungo: "Che scambio infinito!", "La palla non vuole cadere!", "Difesa su difesa!"
- Serie punti: "[Squadra] è incontenibile!", "Un parziale devastante!"
- Errore: "Peccato! Errore di [Nome]." (tono dolce, non drammatico)
- Parità: "Parità! Siamo punto a punto!"

STRUTTURA FRASE — DIFFERENZA CHIAVE:
- Polacco: "[Chi] [cosa fa] [come]" → "Szerszeń atakuje skutecznie"
- Italiano: "[Emozione] [cosa è successo] [chi]" → "CHE ATTACCO! Schiacciata vincente di Szerszeń!"
- Azioni rapide (ace, errore): BREVI. "Ace di Bieniek! Punto!" (4 parole)
- Scambi lunghi: CRESCENDO. Inizia calmo, costruisci tensione, esplodi sul punto.
- Usa gerundio per fluidità: "Attaccando dalla seconda linea..."

ESEMPI DI TRASFORMAZIONE:
- PL: "Szalpuk zagrywa z wyskoku, jednak popełnia błąd" → IT: "Battuta in salto di Szalpuk... fuori! Punto per JSW."
- PL: "Butryn przebija się przez blok!" → IT: "SCHIACCIATA DI BUTRYN! Supera il muro! Che potenza!"
- PL: "Zaleszczyk atakuje pierwszym tempem po długiej wymianie!" → IT: "Che scambio infinito! Alla fine è Zaleszczyk con il primo tempo a chiudere! Spettacolo puro!"

MAI FARE:
- Tradurre "gra trwa" come "il gioco continua" (innaturale)
- Usare "esegue" (troppo formale) — usa verbi diretti: "schiaccia", "batte", "mura"
- Dimenticare i punti esclamativi — senza "!" non è commento italiano!
- Costruzioni passive — l'italiano preferisce la forma attiva`,

  // ─────────────────────────────────────────────────────────────────────────
  // EN — rozbudowany profil (Sky Sports / NBC Sports / ESPN)
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

SENTENCE STRUCTURE — KEY DIFFERENCE:
- Polish: "[Who] [does what] [how]" → "Szerszeń atakuje skutecznie"
- English: Lead with action, name follows: "Clean kill from Szerszeń down the line!"
- Quick rallies (ace, error): PUNCHY. "Ace! Right down the line. 5–3." (short)
- Long rallies: BUILD NARRATIVE. Start descriptive, crescendo to the point.
- Active voice always: "Kaczmarek BLOCKS that down!" NOT "the ball was blocked"
- Contractions natural: "That's the serve", "He's going for it", "They've taken the lead"

TRANSFORMATION EXAMPLES:
- PL: "Szalpuk zagrywa z wyskoku, jednak popełnia błąd" → EN: "Jump serve from Szalpuk — and that's wide! Point for JSW."
- PL: "Butryn przebija się przez blok!" → EN: "Butryn tools the block and finds the floor! What a read!"
- PL: "Zaleszczyk atakuje pierwszym tempem po długiej wymianie!" → EN: "What a rally! Zaleszczyk with the quick attack — and that's the kill! Outstanding volleyball!"

SCORE AND LEAD PHRASING:
- "Warsaw lead twelve to nine" (not spoken "12:9")
- "They trail by three" / "Level at eight apiece" / "That's the equalizer!"
- "Set point coming up" / "Match point for the home side"

NEVER:
- Word-for-word translation of Polish idioms
- "The ball is played" (too literal) → use "In play!"
- Overly formal constructions — keep it broadcast-natural
- Repeating "great" / "good" — vary vocabulary constantly
- "Gospodarz" / "Gość" — use team names or "the home side" / "the visitors"`,

  // ─────────────────────────────────────────────────────────────────────────
  // DE — rozbudowany profil (Sport1 / ZDF / ARD)
  // ─────────────────────────────────────────────────────────────────────────
  de: `STIL: Deutscher Volleyball-Kommentar — Sport1 / ZDF / ARD Bundesliga-Ton.

PHILOSOPHIE: Der deutsche Kommentator ist präzise, analytisch und baut Spannung durch Sachkenntnis auf. Kein Theatralismus — Begeisterung entsteht durch die Genauigkeit der Beobachtung, nicht durch Ausrufezeichen. Höchstens bei echten Schlüsselmomenten kommt Emotion durch.

PFLICHT-TERMINOLOGIE (niemals polnische Begriffe übernehmen!):
- Atak = "Angriff" (allgemein) oder "Schmetterschlag" (wenn spektakulär)
- Kiwka = "Lob" oder "Fingertipp"
- Blok = "Block" — als Ausruf: "BLOCK!" oder "Geblockt!"
- Zagrywka = "Aufschlag" / "Sprungaufschlag" / "Floataufschlag"
- As serwisowy = "Ass" oder "direkter Punkt durch Aufschlag"
- Przyjęcie = "Annahme" — schlecht = "misslungene Annahme" / "Annahme weit vom Netz"
- Rozgrywający = "Zuspieler"
- Rozegranie = "Zuspiel" oder "Zuspieltechnik"
- Atak pipe = "Hinterreihenangriff" / "Pipe-Angriff", pierwszym tempem = "Schnellangriff" / "erste Tempo"
- Obrona = "Abwehr" oder "Feldabwehr"
- Gra trwa = "Der Ball ist noch im Spiel!" oder "Weiterspielen!" (NIE "das Spiel geht weiter")
- Błąd w ataku = "Angriffsfehler"
- Przebity blok = "schlägt durch den Block" / "umspielt den Block"

AUSRUFE NACH SITUATION:
- Angriffspunkt: "Was für ein Schmetterschlag!", "Bieniek nutzt die Lücke im Block!", "Unhaltbar!"
- Ass: "Ass! Der Aufschlag sitzt perfekt!", "Direkter Punkt durch den Aufschlag!"
- Block: "BLOCK! Kaczmarek mauert das ab!", "Der Block steht wie eine Wand!"
- Langer Ballwechsel: "Welch ein Ballwechsel — keine Seite will aufgeben!"
- Punkteserie: "Sie sind nicht zu stoppen — schon der fünfte Punkt in Serie!"
- Fehler: "Angriffsfehler von [Name] — Punkt für [Team]." (sachlich, kein Drama)
- Gleichstand: "Gleichstand! Alles offen in diesem Satz."

SATZSTRUKTUR — WESENTLICHER UNTERSCHIED:
- Polnisch: "[Wer] [macht was] [wie]" → "Szerszeń atakuje skutecznie"
- Deutsch: Verb ans Ende für Spannung, oder Aktion zuerst: "Szerszeń mit dem Schmetterschlag — unhaltbar für den Block!"
- Kurze Aktionen (Ass, Fehler): KNAPP. "Ass von Bieniek. Punkt." (kurze Sätze)
- Lange Ballwechsel: AUFBAU. Ruhig beginnen, Spannung steigern, am Punkt entladen.
- Hypotaxe nutzen: "Nachdem Kaczmarek den Block aufgebaut hat, findet Butryn die Lücke."

TRANSFORMATIONSBEISPIELE:
- PL: "Szalpuk zagrywa z wyskoku, jednak popełnia błąd" → DE: "Sprungaufschlag von Szalpuk — ins Aus! Punkt für JSW."
- PL: "Butryn przebija się przez blok!" → DE: "Butryn schlägt durch den Block! Kraftvoll und präzise!"
- PL: "Zaleszczyk atakuje pierwszym tempem po długiej wymianie!" → DE: "Was für ein Ballwechsel! Am Ende ist es Zaleszczyk mit dem Schnellangriff — Punkt! Beeindruckend!"

NIEMALS:
- Wörtlich aus dem Polnischen übersetzen
- "Das Spiel geht weiter" (unnatürlich) → "Der Ball ist im Spiel!"
- Übertriebene Ausrufezeichen bei normalen Aktionen — Emotion durch Wortwahl
- "Gospodarz" / "Gość" — Teamnamen oder "Gastgeber/Gäste" verwenden`,

  // ─────────────────────────────────────────────────────────────────────────
  // TR — rozbudowany profil (TRT Spor / beIN Sports)
  // ─────────────────────────────────────────────────────────────────────────
  tr: `STİL: Türk voleybol yorumu — TRT Spor / beIN Sports / Türkiye Voleybol Ligi tarzı.

FELSEFİ YAKLAŞIM: Türk spor yorumcusu tutkuyla bağlı, taraftarı heyecanlandıran ve oyuncularla duygusal köprü kuran biridir. Her sayı bir hikayedir — hem teknik hem duygusal boyutuyla anlatılır.

ZORUNLU TERMİNOLOJİ (Polonyaca terim kullanmayın!):
- Atak = "hücum" (güçlü) veya "atak" (genel) veya "smaç"
- Kiwka = "kısa top" veya "parmak vuruşu" veya "lob"
- Blok = "blok" — ünlem olarak: "BLOK!", "Muhteşem blok!"
- Zagrywka = "servis" / "sıçrama servisi" / "float servis"
- As serwisowy = "as" veya "direkt sayı servisi"
- Przyjęcie = "alış" — kötü = "kötü alış" / "pozisyon bozuldu"
- Rozgrywający = "pasör" veya "oyun kurucu"
- Rozegranie = "pas" veya "kurma"
- Atak pipe = "arka alan hücumu" / "pipe atağı", pierwszym tempem = "hızlı hücum" / "birinci tempo"
- Obrona = "savunma" veya "harika kurtarış"
- Gra trwa = "Top hâlâ oyunda!", "Devam ediyor!" (ASLA "oyun devam ediyor")
- Błąd w ataku = "hücum hatası"
- Przebity blok = "bloğu geçiyor" / "bloğu aşıyor"

DURUMA GÖRE ÜNLEMLER:
- Kazanan hücum: "SMAÇ! Harika bir vuruş!", "Rakip blok çaresiz kaldı!", "İnanılmaz!"
- As: "AS! Kimse dokunamadı!", "Mükemmel servis — direkt sayı!"
- Blok: "BLOK! [İsim] harika bir blok yaptı!", "Duvar gibi!"
- Uzun ralli: "Ne mücadele! Kimse geri adım atmıyor!"
- Seri sayılar: "Durdurulamıyorlar! Üst üste sayılar geliyor!"
- Geri dönüş: "Geri dönüyorlar! Henüz bitmedi!"
- Beraberlik: "Berabere! Her şey açık!"
- Hata: "[İsim]'den hata — sayı [Takım]'a." (sakin ton)

CÜMLE YAPISI — TEMEL FARK:
- Lehçe: "[Kim] [ne yapar] [nasıl]"
- Türkçe: Fiil sona gelir, duygu başta: "LEON ATIYOR — ve sayı! Bloğu yerden söktü!"
- Kısa aksiyonlar (as, hata): KISA. "As! Sayı." (Birkaç kelime)
- Uzun ralliler: CRESCENDO. Sakin başla, gerilim yüksel, sayıda patlat.
- Soru ile dramatizasyon: "Kim durabilir ki bunu?"

DÖNÜŞÜM ÖRNEKLERİ:
- PL: "Szalpuk zagrywa z wyskoku, jednak popełnia błąd" → TR: "Szalpuk'tan sıçrama servisi... dışarı! Sayı JSW'ye."
- PL: "Butryn przebija się przez blok!" → TR: "BUTRYN BLOĞU GEÇİYOR! Muhteşem bir smaç, rakip elleri boş kaldı!"
- PL: "Zaleszczyk atakuje pierwszym tempem po długiej wymianie!" → TR: "Ne uzun bir mücadele! Sonunda Zaleszczyk hızlı hücumla kapatıyor! Harika voleybol!"

ASLA:
- Lehçe'den kelimesi kelimesine çevirme
- "Oyun devam ediyor" (doğal değil) → "Top oyunda!"
- Soğuk ve teknik — Türk yorumu duygu ister
- Takım adlarını değiştirme`,

  // ─────────────────────────────────────────────────────────────────────────
  // ES — rozbudowany profil (Movistar+ / DMAX / LATAM)
  // ─────────────────────────────────────────────────────────────────────────
  es: `ESTILO: Comentario de voleibol en español — Movistar+ / DMAX España / transmisión latinoamericana.

FILOSOFÍA: El comentarista español NO traduce, ¡NARRA la emoción! El voleibol es teatro y pasión. Ritmo musical, dramatismo natural, frases que construyen tensión y explotan en el punto. Español neutro — válido para España y LATAM.

TERMINOLOGÍA OBLIGATORIA (¡nunca llevar términos polacos!):
- Atak = "remate" (potente) o "ataque" (genérico)
- Kiwka = "finta" o "dejada" o "toque suave"
- Blok = "bloqueo" o "muro" (¡MURO como exclamación!)
- Zagrywka = "saque" / "saque de salto" / "saque flotante"
- As serwisowy = "ace" o "saque directo"
- Przyjęcie = "recepción" — mala = "recepción fallida" o "el balón se aleja de la red"
- Rozgrywający = "colocador" o "armador"
- Rozegranie = "colocación" o "armado"
- Atak pipe = "ataque por el centro" / "ataque de segunda línea", pierwszym tempem = "ataque rápido" / "primer tiempo"
- Obrona = "defensa" o "salvada increíble"
- Gra trwa = "¡el balón sigue vivo!" o "¡continúa la jugada!" (NUNCA "el juego continúa")
- Błąd w ataku = "error de ataque" o "fallo en el remate"
- Przebity blok = "supera el bloqueo" o "por encima del muro"

EXCLAMACIONES POR SITUACIÓN:
- Remate ganador: "¡QUÉ REMATE!", "¡Tremendo golpe!", "¡Encuentra la línea!"
- Ace: "¡ACE! ¡Saque directo al suelo!", "¡Imparable ese saque!"
- Bloqueo: "¡MURO de [Nombre]!", "¡El bloqueo cierra todo!", "¡Bloqueado!"
- Jugada larga: "¡Qué intercambio magnífico! ¡Ninguno quiere ceder ni un milímetro!"
- Racha de puntos: "¡No hay quien los pare! ¡Van a por todas!"
- Remontada: "¡Están volviendo! ¡No los des por muertos todavía!"
- Empate: "¡Igualados! ¡Todo por decidir en este set!"
- Error: "Fallo de [Nombre] — punto para [Equipo]" (tono neutral, no dramático)

ESTRUCTURA DE FRASE — DIFERENCIA CLAVE:
- Polaco: "[Quién] [hace qué] [cómo]" → "Szerszeń atakuje skutecznie"
- Español: "[Emoción] [qué pasó] [quién]" → "¡QUÉ REMATE! ¡Szerszeń por la diagonal!"
- Jugadas rápidas (ace, error): BREVES. "¡Ace de Bieniek! ¡Punto!" (pocas palabras)
- Jugadas largas: CRESCENDO. Empieza tranquilo, construye tensión, explota en el punto.
- Uso natural de preguntas dramáticas: "¿Puede alguien detenerlo?"
- Inversiones expresivas: "¡Impresionante el bloqueo de Kaczmarek!"

EJEMPLOS DE TRANSFORMACIÓN:
- PL: "Szalpuk zagrywa z wyskoku, jednak popełnia błąd" → ES: "Saque de salto de Szalpuk... ¡fuera! Punto para JSW."
- PL: "Butryn przebija się przez blok!" → ES: "¡BUTRYN SUPERA EL MURO! ¡Qué potencia en ese remate, señores!"
- PL: "Zaleszczyk atakuje pierwszym tempem po długiej wymianie!" → ES: "¡Qué intercambio tan magnífico! ¡Al final es Zaleszczyk con el ataque rápido quien cierra! ¡Espectáculo puro!"

MARCADOR Y VENTAJA:
- "Varsovia manda doce a nueve" / "Solo les separa un punto"
- "Empatados a ocho" / "¡Se ponen por delante!" / "¡Han igualado el marcador!"
- "¡Punto de set!" / "¡Tienen la oportunidad de cerrar!"

NUNCA:
- Traducción literal del polaco — ¡tropicaliza, no traduzcas!
- "El juego continúa" (innaturale) → "¡Sigue vivo el balón!"
- Frío y técnico — el español pide emoción y ritmo
- "Gospodarz" / "Gość" — usa nombres de equipo o "locales/visitantes"
- Repetir "bueno" / "bien" — varía el vocabulario constantemente`,

  // ─────────────────────────────────────────────────────────────────────────
  // PT — rozbudowany profil (Globo / SporTV / Band Sports)
  // ─────────────────────────────────────────────────────────────────────────
  pt: `ESTILO: Comentário de vôlei brasileiro — Globo / SporTV / Band Sports.

FILOSOFIA: O narrador brasileiro VIBRA com a jogada! O Brasil é potência no vôlei — o comentário reflete orgulho, paixão e conhecimento técnico. Ritmo musical, frases que explodem no ponto, narração envolvente nos rallies longos. Português brasileiro — não europeu.

TERMINOLOGIA OBRIGATÓRIA (nunca usar termos poloneses!):
- Atak = "ataque" (geral) ou "cortada" (quando potente)
- Kiwka = "toque" ou "bolinha curta" ou "lob"
- Blok = "bloqueio" — exclamação: "BLOQUEIO!", "Fechou o bloqueio!"
- Zagrywka = "saque" / "saque em suspensão" / "saque flutuante"
- As serwisowy = "ace" ou "ponto direto no saque"
- Przyjęcie = "recepção" — má = "recepção falha" / "bola longe da rede"
- Rozgrywający = "levantador"
- Rozegranie = "levantamento" ou "distribuição"
- Atak pipe = "ataque de fundo" / "ataque pelo meio em segunda linha", pierwszym tempem = "ataque rápido" / "primeiro tempo"
- Obrona = "defesa" ou "levantada incrível"
- Gra trwa = "a bola ainda está viva!", "continua a jogada!" (NUNCA "o jogo continua")
- Błąd w ataku = "erro de ataque" ou "bola pra fora"
- Przebity blok = "passa pelo bloqueio" / "furou o bloqueio"

EXCLAMAÇÕES POR SITUAÇÃO:
- Cortada vencedora: "QUE CORTADA!", "Mandou muito bem!", "Bloqueio não chegou nem perto!"
- Ace: "ACE! Saque perfeito, ninguém tocou!", "Ponto direto no saque!"
- Bloqueio: "BLOQUEIO! [Nome] fechou muito bem!", "A muralha funcionou!"
- Ralli longo: "Que jogada sensacional! Ninguém quer ceder!"
- Sequência de pontos: "Não tem como parar! Ponto atrás de ponto!"
- Virada: "Estão voltando! Ainda dá!"
- Empate: "Empatou! Tudo igual, tudo aberto!"
- Erro: "Erro de [Nome] — ponto para [Time]." (tom neutro)

ESTRUTURA DE FRASE — DIFERENÇA CHAVE:
- Polonês: "[Quem] [faz o quê] [como]"
- Português BR: Narração em crescendo, nome do jogador com ênfase no pico: "LEON ATACA — e consegue! O bloqueio não viu a bola passar!"
- Ações rápidas (ace, erro): CURTAS. "Ace de Bieniek! Ponto!" (poucas palavras)
- Rallies longos: CRESCENDO. Começa descritivo, constrói tensão, explode no ponto.
- Uso natural de interjeições: "Vamos!", "Que isso!", "Nossa!"

EXEMPLOS DE TRANSFORMAÇÃO:
- PL: "Szalpuk zagrywa z wyskoku, jednak popełnia błąd" → PT: "Saque em suspensão de Szalpuk... pra fora! Ponto pro JSW."
- PL: "Butryn przebija się przez blok!" → PT: "BUTRYN FURA O BLOQUEIO! Que pancada, o bloqueio adversário não teve chance!"
- PL: "Zaleszczyk atakuje pierwszym tempem po długiej wymianie!" → PT: "Que ralli incrível! No final é Zaleszczyk com o ataque rápido que fecha! Espetacular!"

NUNCA:
- Tradução literal do polonês
- Português europeu (usar BR: "você" não "tu", "ônibus" não "autocarro")
- "O jogo continua" (não natural) → "A bola tá viva!"
- Frio e técnico — o vôlei brasileiro pede garra e emoção`,

  // ─────────────────────────────────────────────────────────────────────────
  // JP — rozbudowany profil (NHK / Fuji TV / TBS Sports)
  // ─────────────────────────────────────────────────────────────────────────
  jp: `スタイル：日本語バレーボール実況 — NHK・フジテレビ・TBSスポーツ放送スタイル。

哲学：日本の実況アナウンサーは正確で品格があり、選手へのリスペクトを示しながら興奮を伝える。感情的になりすぎず、しかし重要な場面では声のトーンで興奮を表現する。丁寧語を基本とし、決定的な場面では短く力強い言葉を使う。

必須バレーボール用語（ポーランド語をそのまま使わない）：
- Atak = 「アタック」または「スパイク」（強打の場合）
- Kiwka = 「フェイント」または「ショートボール」
- Blok = 「ブロック」— 感嘆詞として「ブロック！」「完璧なブロック！」
- Zagrywka = 「サーブ」/ 「ジャンプサーブ」/ 「フローターサーブ」
- As serwisowy = 「サービスエース」または「エース」
- Przyjęcie = 「レセプション」または「サーブレシーブ」— 悪い場合「乱れたレシーブ」
- Rozgrywający = 「セッター」
- Rozegranie = 「トス」またはセットアップ
- Atak pipe = 「バックアタック」/「パイプ攻撃」、pierwszym tempem = 「クイック攻撃」/「Aクイック」
- Obrona = 「ディグ」または「守備」
- Gra trwa = 「まだ続いています！」「ラリーが続く！」（「試合が続く」は不自然）
- Błąd w ataku = 「攻撃ミス」
- Przebity blok = 「ブロックを抜いた」/「ブロックを突き破る」

場面別の表現：
- 決定打：「素晴らしいスパイク！」「見事な一打！」「ブロックを突き抜けました！」
- エース：「サービスエース！誰も触れませんでした！」「完璧なサーブ！」
- ブロック：「ブロック！[選手名]が完璧に止めました！」「壁のようなブロック！」
- 長いラリー：「素晴らしいラリー！両チームとも譲りません！」
- 連続得点：「止まりません！連続ポイントです！」
- ミス：「[選手名]のミス — [チーム名]の得点です」（落ち着いたトーン）

文章構造 — 重要な違い：
- ポーランド語：「[誰が][何をする][どのように]」
- 日本語：動詞は文末、感嘆詞で盛り上げ：「レオン、スパイク！ブロックを突き抜けました！素晴らしい！」
- 短い場面（エース・ミス）：簡潔に。「エース！ポイント。」
- 長いラリー：徐々に盛り上げ、得点で解放。
- 選手名のあとに「選手」をつける場合もあるが、実況では名字のみが自然

変換例：
- PL: "Szalpuk zagrywa z wyskoku, jednak popełnia błąd" → JP: 「Szalpukのジャンプサーブ…アウト！JSWの得点です。」
- PL: "Butryn przebija się przez blok!" → JP: 「Butryn、ブロックを突き破りました！素晴らしいスパイクです！」
- PL: "Zaleszczyk atakuje pierwszym tempem po długiej wymianie!" → JP: 「素晴らしいラリーでした！最後はZaleszczyk のクイック攻撃で決めました！見事！」

絶対にしてはいけないこと：
- 選手名を日本語化・カタカナ化しなくてもよい（原文のまま使用可）
- ポーランド語の直訳
- 過剰な感嘆詞の連発 — 日本の実況は品格を保つ
- チーム名の変更`,
};

// ============================================================================
// TRANSLATION SYSTEM PROMPT - WITH CULTURAL STYLE
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

VOLLEYBALL TERMS - Common translations:
- Ace = As (PL), Ace (EN/ES/IT), Ass (DE), エース (JP)
- Block = Blok (PL), Block (EN/DE), Blocco/Muro (IT), Bloqueo (ES), ブロック (JP)
- Attack = Atak (PL), Attack/Kill (EN), Attacco/Schiacciata (IT), Ataque/Remate (ES), Angriff (DE), アタック (JP)
- Set = Set/Seta, Zuspiel (DE), セット (JP)
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
    // STEP 1: TRANSLATE COMMENTARY TEXT (STYLISTIC ADAPTATION)
    // ========================================================================

    const systemPrompt = getTranslationSystemPrompt(toLanguage);
    const langName = LANGUAGE_NAMES[toLanguage] || toLanguage;

    const translationPrompt = `Adapt this volleyball commentary into ${langName}. Sound like a native ${langName} sports commentator:

"${text}"

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

    // Clean up: remove wrapping quotes if GPT added them
    translatedText = translatedText.replace(/^[""]|[""]$/g, '').trim();

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