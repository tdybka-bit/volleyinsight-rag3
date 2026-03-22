import { NextRequest } from 'next/server';

// ============================================================================
// E1: TEXT-TO-SPEECH via Google Cloud TTS REST API + SSML Emotions
// v2.0 — situation-aware SSML + language-specific prosody profiles
// ============================================================================

// Voice config per language — male voices, sports commentary tone
const VOICE_CONFIG: Record<string, { languageCode: string; name: string }> = {
  pl: { languageCode: 'pl-PL', name: 'pl-PL-Wavenet-B' },
  en: { languageCode: 'en-GB', name: 'en-GB-Wavenet-B' },
  it: { languageCode: 'it-IT', name: 'it-IT-Wavenet-C' },
  de: { languageCode: 'de-DE', name: 'de-DE-Wavenet-B' },
  tr: { languageCode: 'tr-TR', name: 'tr-TR-Wavenet-B' },
  es: { languageCode: 'es-ES', name: 'es-ES-Wavenet-B' },
  pt: { languageCode: 'pt-BR', name: 'pt-BR-Wavenet-B' },
  jp: { languageCode: 'ja-JP', name: 'ja-JP-Wavenet-C' },
};

// ============================================================================
// LANGUAGE BASE PROFILES — cultural rhythm & energy baseline
// Applied as audioConfig (not SSML) — affects the whole clip
// ============================================================================
interface LangProfile {
  speakingRate: number;  // base speed (1.0 = normal)
  pitch: number;         // base pitch semitones
  volumeGainDb: number;  // base volume
}

const LANG_PROFILES: Record<string, LangProfile> = {
  pl: { speakingRate: 1.05, pitch: 0.5,  volumeGainDb: 2.0 },  // standard energetic
  en: { speakingRate: 1.08, pitch: 0.0,  volumeGainDb: 1.5 },  // crisp, authoritative
  it: { speakingRate: 1.10, pitch: 1.5,  volumeGainDb: 2.5 },  // theatrical, passionate
  de: { speakingRate: 1.00, pitch: -0.5, volumeGainDb: 1.5 },  // precise, controlled
  tr: { speakingRate: 1.12, pitch: 1.0,  volumeGainDb: 3.0 },  // high energy, explosive
  es: { speakingRate: 1.10, pitch: 1.0,  volumeGainDb: 2.5 },  // musical, dramatic
  pt: { speakingRate: 1.08, pitch: 0.5,  volumeGainDb: 2.0 },  // warm, crescendo
  jp: { speakingRate: 0.98, pitch: 0.0,  volumeGainDb: 1.0 },  // dignified, measured
};

// ============================================================================
// SITUATION SSML PROFILES
// Mapped from commentary tags: #as, #koniec_seta, #seria, #dluga_wymiana, etc.
// ============================================================================
type Situation =
  | 'ace'        // #as — direct point from serve
  | 'set_end'    // #koniec_seta — set over
  | 'streak'     // #seria — scoring run
  | 'comeback'   // #comeback — clawing back
  | 'long_rally' // #dluga_wymiana — epic exchange
  | 'drama'      // #drama — clutch moment
  | 'error'      // błąd serwisowy — short and punchy
  | 'normal';    // standard rally

interface SituationProfile {
  // Per-sentence modifiers (applied on top of base)
  climaxRate: string;    // rate for climax sentences (with !)
  climaxPitch: string;   // pitch boost for excitement
  climaxVolume: string;  // volume for key moments
  normalRate: string;    // rate for neutral sentences
  pauseBetween: string;  // break between sentences (ms)
  preBreak: string;      // pause before first word (for drama)
}

const SITUATION_PROFILES: Record<Situation, SituationProfile> = {
  ace: {
    climaxRate: '120%', climaxPitch: '+20%', climaxVolume: '+4dB',
    normalRate: '110%', pauseBetween: '150ms', preBreak: '0ms',
  },
  set_end: {
    climaxRate: '105%', climaxPitch: '+18%', climaxVolume: '+5dB',
    normalRate: '95%',  pauseBetween: '350ms', preBreak: '200ms',
  },
  streak: {
    climaxRate: '118%', climaxPitch: '+15%', climaxVolume: '+4dB',
    normalRate: '108%', pauseBetween: '150ms', preBreak: '0ms',
  },
  comeback: {
    climaxRate: '115%', climaxPitch: '+12%', climaxVolume: '+4dB',
    normalRate: '105%', pauseBetween: '200ms', preBreak: '100ms',
  },
  long_rally: {
    climaxRate: '112%', climaxPitch: '+10%', climaxVolume: '+3dB',
    normalRate: '100%', pauseBetween: '250ms', preBreak: '0ms',
  },
  drama: {
    climaxRate: '108%', climaxPitch: '+15%', climaxVolume: '+4dB',
    normalRate: '92%',  pauseBetween: '300ms', preBreak: '150ms',
  },
  error: {
    climaxRate: '110%', climaxPitch: '+5%',  climaxVolume: '+2dB',
    normalRate: '105%', pauseBetween: '100ms', preBreak: '0ms',
  },
  normal: {
    climaxRate: '108%', climaxPitch: '+8%',  climaxVolume: '+2dB',
    normalRate: '100%', pauseBetween: '200ms', preBreak: '0ms',
  },
};

// ============================================================================
// MAP TAGS → SITUATION
// ============================================================================
function tagsToSituation(tags: string[]): Situation {
  if (!tags || tags.length === 0) return 'normal';
  const t = tags.map(x => x.toLowerCase());
  if (t.some(x => x.includes('koniec_seta') || x.includes('set_end')))   return 'set_end';
  if (t.some(x => x.includes('#as') || x.includes('#ace')))               return 'ace';
  if (t.some(x => x.includes('seria') || x.includes('streak')))          return 'streak';
  if (t.some(x => x.includes('comeback') || x.includes('remontada')))    return 'comeback';
  if (t.some(x => x.includes('dluga_wymiana') || x.includes('long_rally'))) return 'long_rally';
  if (t.some(x => x.includes('drama') || x.includes('clutch')))          return 'drama';
  return 'normal';
}

// ============================================================================
// SSML CONVERSION — situation-aware + language-tuned
// ============================================================================
function textToSSML(text: string, situation: Situation, language: string): string {
  const profile = SITUATION_PROFILES[situation];

  // XML-escape helper (preserve structure)
  const escXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Split into sentences on . ! ? — keep delimiter attached
  const sentences = text.split(/(?<=[.!?…])\s+/).filter(s => s.trim().length > 0);

  const processedSentences = sentences.map((sentence, idx) => {
    const trimmed = sentence.trim();
    const exclamations = (trimmed.match(/!/g) || []).length;
    const escaped = escXml(trimmed);

    // SET END: first sentence calm/solemn, last sentence EXPLOSION
    if (situation === 'set_end') {
      if (idx === sentences.length - 1) {
        return `<prosody rate="${profile.climaxRate}" pitch="${profile.climaxPitch}" volume="${profile.climaxVolume}">${escaped}</prosody>`;
      }
      if (idx === 0) {
        return `<prosody rate="95%" pitch="-3%">${escaped}</prosody>`;
      }
    }

    // DRAMA: pause before, slow build
    if (situation === 'drama' && idx === 0 && profile.preBreak !== '0ms') {
      return `<break time="${profile.preBreak}"/><prosody rate="${profile.normalRate}" pitch="-5%">${escaped}</prosody>`;
    }

    // LONG RALLY: gradual crescendo
    if (situation === 'long_rally') {
      const crescendoRate = `${100 + idx * 3}%`;
      const crescendoPitch = idx === sentences.length - 1 ? profile.climaxPitch : '+0%';
      if (idx === sentences.length - 1) {
        return `<prosody rate="${profile.climaxRate}" pitch="${profile.climaxPitch}" volume="${profile.climaxVolume}">${escaped}</prosody>`;
      }
      return `<prosody rate="${crescendoRate}" pitch="${crescendoPitch}">${escaped}</prosody>`;
    }

    // HIGH EXCITEMENT: multiple ! or short explosive sentence
    if (exclamations >= 2 || (exclamations >= 1 && trimmed.length < 35)) {
      return `<prosody rate="${profile.climaxRate}" pitch="${profile.climaxPitch}" volume="${profile.climaxVolume}">${escaped}</prosody>`;
    }

    // MODERATE EXCITEMENT: single !
    if (exclamations === 1) {
      // Slightly less intense than climax
      return `<prosody rate="${profile.climaxRate}" pitch="+5%">${escaped}</prosody>`;
    }

    // DRAMATIC PAUSE: "..."
    if (trimmed.endsWith('...') || trimmed.endsWith('…')) {
      return `<prosody rate="88%" pitch="-8%">${escaped}</prosody><break time="450ms"/>`;
    }

    // NEUTRAL
    return `<prosody rate="${profile.normalRate}">${escaped}</prosody>`;
  });

  // Language-specific inter-sentence breaks
  const breakTime = language === 'jp' ? '280ms' : language === 'de' ? '220ms' : profile.pauseBetween;

  const joined = processedSentences
    .filter(Boolean)
    .join(` <break time="${breakTime}"/> `);

  return `<speak>${joined}</speak>`;
}

// ============================================================================
// API HANDLER
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const {
      text,
      language = 'pl',
      tags = [],           // commentary tags from frontend: ['#as', '#koniec_seta', ...]
      situation: forcedSituation,  // optional override
    } = await request.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
    if (!apiKey) {
      console.error('[TTS] Missing GOOGLE_CLOUD_TTS_API_KEY');
      return new Response(JSON.stringify({ error: 'TTS not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const voice = VOICE_CONFIG[language] || VOICE_CONFIG.pl;
    const langProfile = LANG_PROFILES[language] || LANG_PROFILES.pl;

    // Determine situation from tags or forced override
    const situation: Situation = forcedSituation || tagsToSituation(tags);

    // Convert to emotional SSML
    const ssml = textToSSML(text, situation, language);

    console.log(`[TTS] ${language} (${voice.name}) situation=${situation}: "${text.substring(0, 60)}..."`);
    console.log(`[TTS-SSML] ${ssml.substring(0, 150)}...`);

    // ========================================================================
    // Google Cloud TTS REST API
    // ========================================================================
    const ttsResponse = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { ssml },
          voice: {
            languageCode: voice.languageCode,
            name: voice.name,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: langProfile.speakingRate,
            pitch:        langProfile.pitch,
            volumeGainDb: langProfile.volumeGainDb,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorData = await ttsResponse.json().catch(() => ({}));
      console.error('[TTS] Google API error:', ttsResponse.status, errorData);
      return new Response(JSON.stringify({
        error: 'TTS generation failed',
        details: errorData,
      }), {
        status: ttsResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await ttsResponse.json();
    const audioBase64 = data.audioContent;

    if (!audioBase64) {
      return new Response(JSON.stringify({ error: 'No audio generated' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[TTS] ✅ Audio generated (${Math.round(audioBase64.length * 0.75 / 1024)}KB) situation=${situation}`);

    return new Response(JSON.stringify({
      audioBase64,
      voice: voice.name,
      situation,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TTS] Error:', error);
    return new Response(JSON.stringify({ error: 'TTS failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}