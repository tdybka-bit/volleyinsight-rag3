import { NextRequest } from 'next/server';

// ============================================================================
// E1: TEXT-TO-SPEECH via Google Cloud TTS REST API + SSML Emotions
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
// SSML CONVERSION — add emotion, rhythm, drama to plain text
// Works with ALL languages (SSML prosody is language-agnostic)
// ============================================================================
function textToSSML(text: string): string {
  // Split into sentences
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  
  const processedSentences = sentences.map((sentence) => {
    const trimmed = sentence.trim();
    if (!trimmed) return '';
    
    // Count exclamation marks for intensity
    const exclamations = (trimmed.match(/!/g) || []).length;
    
    // Escape XML special chars (but preserve our SSML tags added below)
    let processed = trimmed
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // HIGH EXCITEMENT: multiple ! or short exclamatory sentence
    if (exclamations >= 2 || (exclamations >= 1 && trimmed.length < 40)) {
      return `<prosody rate="115%" pitch="+15%" volume="+3dB">${processed}</prosody>`;
    }
    
    // MODERATE EXCITEMENT: single ! in longer sentence
    if (exclamations === 1) {
      return `<prosody rate="108%" pitch="+8%" volume="+2dB">${processed}</prosody>`;
    }
    
    // DRAMATIC PAUSE: sentence ending with "..."
    if (trimmed.endsWith('...')) {
      return `<prosody rate="90%" pitch="-5%">${processed}</prosody><break time="400ms"/>`;
    }
    
    // NORMAL: neutral delivery with natural pacing
    return processed;
  });
  
  // Join with small breaks between sentences for natural rhythm
  const joined = processedSentences
    .filter(Boolean)
    .join(' <break time="200ms"/> ');
  
  return `<speak>${joined}</speak>`;
}

export async function POST(request: NextRequest) {
  try {
    const { text, language = 'pl' } = await request.json();

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
    
    // Convert plain text to emotional SSML
    const ssml = textToSSML(text);

    console.log(`[TTS] ${language} (${voice.name}): "${text.substring(0, 60)}..."`);
    console.log(`[TTS-SSML] ${ssml.substring(0, 120)}...`);

    // ========================================================================
    // Google Cloud TTS REST API — with SSML input
    // ========================================================================
    const ttsResponse = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { ssml },  // SSML instead of plain text!
          voice: {
            languageCode: voice.languageCode,
            name: voice.name,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.05,  // Base rate (SSML prosody adds on top)
            pitch: 0.5,         // Slightly deeper for authority
            volumeGainDb: 2.0,  // Slightly louder
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

    console.log(`[TTS] ✅ Audio generated (${Math.round(audioBase64.length * 0.75 / 1024)}KB)`);

    return new Response(JSON.stringify({ 
      audioBase64,
      voice: voice.name,
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