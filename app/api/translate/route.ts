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
// TRANSLATION SYSTEM PROMPT
// ============================================================================

const getTranslationSystemPrompt = (targetLanguage: string) => {
  const langName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
  
  return `You are a professional volleyball commentary translator.

YOUR TASK:
Translate volleyball match commentary from one language to ${langName}.

CRITICAL RULES:
1. PRESERVE volleyball terminology accuracy
2. PRESERVE energy and tone of original
3. PRESERVE all player names (NO translation!)
4. PRESERVE team names exactly as written
5. PRESERVE score format (e.g., "30:28")
6. NATURAL ${langName} - sound like native commentator
7. Keep same LENGTH (1-2 sentences)
8. Keep same EMOTION level

VOLLEYBALL TERMS - Common translations:
- Ace = As (PL), Ace (EN/ES/IT)
- Block = Blok (PL), Block (EN), Blocco (IT), Bloqueo (ES)
- Attack = Atak (PL), Attack (EN), Attacco (IT), Ataque (ES)
- Set = Set/Seta (all languages)
- Rally = Wymiana (PL), Rally (EN), Scambio (IT), Jugada (ES)
- Error = Błąd (PL), Error (EN/ES), Errore (IT)

EXAMPLES:

Polish → English:
"Boladz przebija blok McCarthy'ego! Potężny atak, który kończy długą wymianę!"
→ "Boladz breaks through McCarthy's block! Powerful attack that ends the long rally!"

Polish → Spanish:
"Grozdanov skuteczny w bloku! Zatrzymał rywala."
→ "¡Grozdanov efectivo en el bloqueo! Detuvo al rival."

Polish → Italian:
"As serwisowy McCarthy! KONIEC SETA 25:22!"
→ "Ace al servizio di McCarthy! FINE DEL SET 25:22!"

NEVER:
- Translate player names (Leon stays Leon, not León)
- Change team names
- Add extra information
- Remove emotion/energy
- Make it longer or shorter significantly`;
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
    console.log(`📝 Original text: "${text.substring(0, 60)}..."`);

    // ========================================================================
    // STEP 1: TRANSLATE COMMENTARY TEXT
    // ========================================================================

    const systemPrompt = getTranslationSystemPrompt(toLanguage);
    
    const translationPrompt = `Translate this volleyball commentary to ${LANGUAGE_NAMES[toLanguage]}:

"${text}"

Translated commentary:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: translationPrompt },
      ],
      temperature: 0.3, // Lower for more consistent translations
      max_tokens: 200,
    });

    const translatedText = completion.choices[0].message.content || text;

    console.log(`✅ Translated: "${translatedText.substring(0, 60)}..."`);

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
    const body = await request.json().catch(() => ({ text: '', tags: [] }));
    
    return new Response(JSON.stringify({ 
      error: 'Translation failed',
      translatedText: body.text || '',
      translatedTags: body.tags || [],
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}