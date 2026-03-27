import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// COCKPIT INSIGHTS — punchy, concrete, 3-sentence max
// ============================================================================

const SYSTEM_PROMPT = `Jesteś analitykiem taktycznym siatkówki. Piszesz komentarz jak ekspert przy tablicy.

ZASADY (BEZWZGLĘDNE):
- Maksymalnie 3 zdania. Nie więcej.
- Każde zdanie MUSI zawierać liczbę z danych
- Zdanie 1: kto lepszy i o ile (np. "JSW serwuje 2x skuteczniej — 11% asów vs 4% ASS")
- Zdanie 2: jeden konkretny problem lub przewaga (konkret, nie teoria)
- Zdanie 3: konkluzja — co to znaczy dla meczu teraz

ZAKAZ (natychmiast dyskwalifikuje odpowiedź):
"kluczowym aspektem", "można zauważyć", "co może sugerować", "w związku z tym",
"warto zauważyć", "istotnym elementem", "analizując dane", "wskazuje na"

Pisz jak człowiek, nie jak raport. Jeśli różnica < 5% — napisz "wyrównane".`;

const TAB_QUESTIONS: Record<string, string> = {
  serve_type:   'Kto ma ciekawszy mix typów zagrywek? Czy ktoś jest zbyt przewidywalny?',
  serve_grade:  'Kto serwuje skuteczniej? Asy vs błędy — kto ryzykuje, kto gra bezpiecznie?',
  serve_zone:   'W jakie strefy celuje każda drużyna? Kto jest bardziej przewidywalny strefowo?',
  attack_loc:   'Gdzie atakuje każda drużyna? Kto jest przewidywalny? Co powinien zrobić trener?',
  attack_grade: 'Kto kończy skuteczniej? Porównaj punkty i błędy — kto marnuje szanse?',
  receive:      'Kto lepiej przyjmuje? Co procent negatywnych mówi o presji zagrywki rywala?',
  block:        'Kto blokuje skuteczniej — punkty blokowe vs błędy blokowe?',
  dig:          'Kto lepiej broni? Co procent skutecznych mówi o defensywie drużyny?',
};

interface InsightRequest {
  tabKey: string;
  homeTeam: string;
  awayTeam: string;
  homeData: Record<string, number>;
  awayData: Record<string, number>;
  language: string;
  rallyCount?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { tabKey, homeTeam, awayTeam, homeData, awayData, language = 'pl', rallyCount = 0 }: InsightRequest = await request.json();

    const total = (data: Record<string, number>) => Object.values(data).reduce((s, v) => s + v, 0);
    const fmt = (data: Record<string, number>, team: string) => {
      const t = total(data);
      if (t === 0) return `${team}: brak danych`;
      return `${team}: ` + Object.entries(data)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([k, v]) => `${k} ${Math.round(v / t * 100)}% (${v}x)`)
        .join(', ');
    };

    const statsSummary = `${fmt(homeData, homeTeam)}\n${fmt(awayData, awayTeam)}`;
    const question = TAB_QUESTIONS[tabKey] || 'Co wynika z tych danych?';

    const langNote = language !== 'pl'
      ? `\nWrite in: ${language === 'en' ? 'English' : language === 'it' ? 'Italian' : language === 'de' ? 'German' : language === 'tr' ? 'Turkish' : language === 'es' ? 'Spanish' : language === 'pt' ? 'Portuguese' : language === 'jp' ? 'Japanese' : 'Polish'}.`
      : '';

    const userPrompt = `DANE (${rallyCount} akcji do tej pory):\n${statsSummary}\n\n${question}${langNote}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 180,
    });

    const insight = completion.choices[0].message.content?.trim() || '';
    console.log(`[INSIGHTS] ${tabKey} | ${rallyCount} rallies | "${insight.substring(0, 80)}..."`);

    return new Response(JSON.stringify({ insight }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[COCKPIT-INSIGHTS] Error:', error);
    return new Response(JSON.stringify({ error: 'Insights failed', insight: '' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
