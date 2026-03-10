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

  de: `STIL: Deutscher Volleyball-Kommentar — präzise und analytisch.
- Sachlich und taktisch orientiert, wie bei Sport1 oder ZDF
- Taktische Einsichten betonen: Blockformation, Angriffswinkel, Aufstellungsvorteil
- Fachbegriffe: "Aufschlag" (zagrywka), "Annahme" (przyjęcie), "Zuspiel" (rozegranie), "Angriff" (atak), "Block", "Abwehr" (obrona)
- Emotionen kontrolliert — Begeisterung zeigen durch Wortwahl, nicht durch Ausrufezeichen
- Bei entscheidenden Momenten darf mehr Emotion kommen
- Beispiel: "Starker Angriff über die Mitte — Bieniek nutzt die Lücke im Block geschickt aus."`,

  tr: `STİL: Türk voleybol yorumu — tutkulu ve enerjik!
- Yüksek enerji, taraftarla konuşur gibi — TRT Spor veya BeIN Sports tarzı
- Heyecanlı anlar: "Harika!", "İnanılmaz!", "Ne sayı!", "Muhteşem!"
- Voleybol terimleri: "servis" (zagrywka), "atak" (atak), "blok", "sayı" (punkt), "set", "ralli"
- Duygusal bağ kur — oyuncuların mücadelesini hisset
- Örnek: "LEON ATIYOR VE SAYIII! Rakip blok çaresiz kaldı, muhteşem bir atak!"`,

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

  pt: `ESTILO: Comentário de vôlei brasileiro — emoção e energia!
- Brasil é potência no vôlei — o comentário reflete orgulho e conhecimento
- Tom de Globo/SporTV: Nalaldo ou Maurício Noriega
- Terminologia: "ataque" (atak), "bloqueio" (blok), "saque" (zagrywka), "recepção" (przyjęcie), "levantamento" (rozegranie), "ace", "ponto"
- Expressões naturais: "Que jogada!", "Ponto espetacular!", "Mandou bem!", "Que defesa!"
- Ritmo brasileiro — frases curtas para pontos rápidos, narração envolvente para rallies longos
- Exemplo: "ATACOU LEON! Que pancada na bola, o bloqueio nem viu passar!"`,

  jp: `スタイル：日本語バレーボール実況 — 正確で敬意を持った解説。
- NHKやフジテレビの実況スタイル
- 丁寧で正確、しかし興奮する場面では感情を表現
- バレーボール用語：「サーブ」「レシーブ」「トス」「アタック/スパイク」「ブロック」「ディグ」「エース」
- 自然な日本語の感嘆表現：「素晴らしい！」「見事！」「決まった！」
- 選手名はカタカナ表記が理想だが、原文のままでも可
- 例：「レオンの強烈なスパイク！ブロックを打ち抜きました！素晴らしいアタックです！」`,
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