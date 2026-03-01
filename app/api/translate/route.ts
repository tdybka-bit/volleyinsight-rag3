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

  en: `STYLE: English-language volleyball commentary, BBC/NBC broadcast tone.
- Smooth, flowing narrative — think of a radio commentator painting a picture
- Use English volleyball idioms: "kills it", "stuff block", "service ace", "digs it out"
- Understated excitement — build tension through word choice, not exclamation marks
- Concise and punchy for quick rallies, more descriptive for long ones
- Example tone: "Leon finds the gap on the left side — and that's a clean kill!"`,

  it: `STILE: Commento sportivo italiano — passione e teatro!
- EMOZIONE è tutto! Come Gianfranco De Laurentiis o Andrea Zorzi
- Esclamazioni naturali: "Che punto!", "Mamma mia!", "Incredibile!", "Che muro!"
- Terminologia italiana: "schiacciata" (atak), "muro" (blok), "battuta" (zagrywka), "palleggio" (rozegranie), "ricezione" (przyjęcie), "punto diretto" (as)
- Ritmo: frasi brevi per momenti veloci, descrizioni poetiche per grandi giocate
- L'Italia vive la pallavolo — il commento deve riflettere questa passione!
- Esempio: "SCHIACCIATA DI LEON! Che potenza, non c'è stato nulla da fare per il muro!"`,

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

  es: `ESTILO: Comentario de voleibol en español — narrativo y apasionado.
- Ritmo latinoamericano/español — como un relato deportivo de radio
- Frases con flow natural: construir tensión, soltar emoción en el punto
- Terminología: "remate" (atak), "bloqueo" (blok), "saque" (zagrywka), "recepción" (przyjęcie), "armado" (rozegranie), "ace"
- Exclamaciones naturales: "¡Golazo!", "¡Qué punto!", "¡Tremendo remate!", "¡Se fue!"
- Narrar como si la audiencia no pudiera ver — describir acción y emoción
- Ejemplo: "¡REMATE DE LEON POR LA DIAGONAL! ¡No hay muro que lo detenga, señores!"`,

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
- Attack = Atak (PL), Attack (EN), Attacco/Schiacciata (IT), Ataque/Remate (ES), Angriff (DE), アタック (JP)
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
      console.log('⏭️ Skip translation - same language:', toLanguage);
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
          pl: '#koniec_seta',
          en: '#set_end',
          es: '#fin_del_set',
          it: '#fine_set',
          de: '#satzende',
          tr: '#set_sonu',
          pt: '#fim_do_set',
          jp: '#セット終了',
        },
        '#momentum': {
          pl: '#momentum',
          en: '#momentum',
          es: '#impulso',
          it: '#slancio',
          de: '#schwung',
          tr: '#momentum',
          pt: '#momento',
          jp: '#勢い',
        },
        '#seria': {
          pl: '#seria',
          en: '#streak',
          es: '#racha',
          it: '#serie',
          de: '#serie',
          tr: '#seri',
          pt: '#sequência',
          jp: '#連続',
        },
        '#drama': {
          pl: '#drama',
          en: '#drama',
          es: '#drama',
          it: '#dramma',
          de: '#drama',
          tr: '#drama',
          pt: '#drama',
          jp: '#ドラマ',
        },
        '#clutch': {
          pl: '#clutch',
          en: '#clutch',
          es: '#decisivo',
          it: '#cruciale',
          de: '#entscheidend',
          tr: '#kritik',
          pt: '#decisivo',
          jp: '#重要',
        },
        '#comeback': {
          pl: '#comeback',
          en: '#comeback',
          es: '#remontada',
          it: '#rimonta',
          de: '#comeback',
          tr: '#geri_dönüş',
          pt: '#recuperação',
          jp: '#逆転',
        },
        '#milestone': {
          pl: '#milestone',
          en: '#milestone',
          es: '#hito',
          it: '#traguardo',
          de: '#meilenstein',
          tr: '#dönüm_noktası',
          pt: '#marco',
          jp: '#節目',
        },
        '#as': {
          pl: '#as',
          en: '#ace',
          es: '#ace',
          it: '#ace',
          de: '#ass',
          tr: '#as',
          pt: '#ace',
          jp: '#エース',
        },
        '#długa_wymiana': {
          pl: '#długa_wymiana',
          en: '#long_rally',
          es: '#jugada_larga',
          it: '#scambio_lungo',
          de: '#langer_ballwechsel',
          tr: '#uzun_ralli',
          pt: '#rally_longo',
          jp: '#長いラリー',
        },
        '#zmiana': {
          pl: '#zmiana',
          en: '#substitution',
          es: '#cambio',
          it: '#cambio',
          de: '#wechsel',
          tr: '#değişiklik',
          pt: '#substituição',
          jp: '#交代',
        },
        '#debiut': {
          pl: '#debiut',
          en: '#debut',
          es: '#debut',
          it: '#debutto',
          de: '#debüt',
          tr: '#ilk_maç',
          pt: '#estreia',
          jp: '#デビュー',
        },
      };

      translatedTags = tags.map(tag => {
        const translations = TAG_TRANSLATIONS[tag.toLowerCase()];
        if (translations && translations[toLanguage]) {
          return translations[toLanguage];
        }
        return tag; // Fallback: keep original if no translation
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
    
    // Fallback: return original text on error
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