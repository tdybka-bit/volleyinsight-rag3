import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// COCKPIT INSIGHTS — tactical interpretation of chart data per tab
// Called from cockpit/page.tsx after data loads
// ============================================================================

// Quick rule-based insights (no GPT needed for obvious patterns)
function getRuleBasedInsights(tabKey: string, homeData: Record<string, number>, awayData: Record<string, number>, homeTeam: string, awayTeam: string): string | null {
  const total = (data: Record<string, number>) => Object.values(data).reduce((s, v) => s + v, 0);
  const pct = (data: Record<string, number>, key: string) => {
    const t = total(data); return t > 0 ? Math.round((data[key] || 0) / t * 100) : 0;
  };

  if (tabKey === 'serve_grade') {
    const hAce = pct(homeData, 'Ace (As)'); const aAce = pct(awayData, 'Ace (As)');
    const hErr = pct(homeData, 'Błąd');     const aErr = pct(awayData, 'Błąd');
    if (hAce >= 12 && hErr <= 20) return `${homeTeam} serwuje agresywnie i skutecznie — ${hAce}% asów przy ${hErr}% błędów.`;
    if (hErr >= 28) return `${homeTeam} popełnia dużo błędów serwisowych (${hErr}%) — zbyt ryzykowna zagrywka.`;
    if (aAce >= 12 && aErr <= 20) return `${awayTeam} dominuje zagrywką — ${aAce}% asów.`;
  }

  if (tabKey === 'attack_loc') {
    const hDiag = pct(homeData, 'Skos'); const aDiag = pct(awayData, 'Skos');
    if (hDiag >= 55) return `${homeTeam} bardzo przewidywalny — aż ${hDiag}% ataków po skosie. Łatwy do zablokowania.`;
    if (hDiag <= 30) return `${homeTeam} atakuje różnorodnie — trudny do zablokowania.`;
  }

  if (tabKey === 'receive') {
    const hPos = pct(homeData, 'Idealne') + pct(homeData, 'Pozytywne');
    const aPos = pct(awayData, 'Idealne') + pct(awayData, 'Pozytywne');
    if (hPos >= 65 && aPos < 55) return `${homeTeam} dominuje w przyjęciu (${hPos}% pozytywnych vs ${aPos}% ${awayTeam}).`;
    if (aPos >= 65 && hPos < 55) return `${awayTeam} ma zdecydowanie lepsze przyjęcie (${aPos}% vs ${hPos}%).`;
  }

  return null;
}

const getInsightPrompt = (language: string) => {
  const prompts: Record<string, string> = {
    pl: 'Jesteś ekspertem taktycznym siatkówki. Napisz krótką, konkretną interpretację danych statystycznych po polsku. 2-3 zdania, styl analityczny.',
    en: 'You are a volleyball tactical expert. Write a brief, specific tactical interpretation in ENGLISH. 2-3 sentences, analytical style.',
    it: 'Sei un esperto tattico di pallavolo. Scrivi una breve interpretazione tattica in ITALIANO. 2-3 frasi, stile analitico.',
    de: 'Du bist ein Volleyball-Taktikexperte. Schreibe eine kurze taktische Interpretation auf DEUTSCH. 2-3 Sätze, analytischer Stil.',
    tr: 'Sen bir voleybol taktik uzmanısın. TÜRKÇE kısa ve somut bir yorum yaz. 2-3 cümle, analitik üslup.',
    es: 'Eres un experto táctico de voleibol. Escribe una interpretación táctica breve en ESPAÑOL. 2-3 frases, estilo analítico.',
    pt: 'Você é um especialista tático de vôlei. Escreva uma interpretação tática breve em PORTUGUÊS. 2-3 frases, estilo analítico.',
    jp: 'あなたはバレーボールの戦術専門家です。日本語で短い戦術的解釈を書いてください。2〜3文、分析的なスタイル。',
  };
  return prompts[language] || prompts.pl;
};

const TAB_CONTEXT: Record<string, string> = {
  serve_type:   'Dane dotyczą typów zagrywki (Jump Spin, Jump Float, Hybrid itp.)',
  serve_grade:  'Dane dotyczą skuteczności zagrywki (Ace, Pozytywna, Negatywna, Błąd)',
  attack_loc:   'Dane dotyczą kierunku ataku (Skos, Linia, Środek)',
  attack_grade: 'Dane dotyczą jakości ataku (Punkt, Kontynuacja, Błąd)',
  receive:      'Dane dotyczą jakości przyjęcia (Idealne, Pozytywne, Negatywne, Błąd)',
  block:        'Dane dotyczą efektywności bloku (Punkt, Wyblok, Dotknięcie, Błąd)',
  dig:          'Dane dotyczą skuteczności obrony/diga (Skuteczna, Nieskuteczna)',
};

interface InsightRequest {
  tabKey: string;
  homeTeam: string;
  awayTeam: string;
  homeData: Record<string, number>;
  awayData: Record<string, number>;
  language: string;
}

export async function POST(request: NextRequest) {
  try {
    const { tabKey, homeTeam, awayTeam, homeData, awayData, language = 'pl' }: InsightRequest = await request.json();

    // Try rule-based first (faster, cheaper)
    const ruleInsight = getRuleBasedInsights(tabKey, homeData, awayData, homeTeam, awayTeam);

    // Build stats summary for GPT
    const total = (data: Record<string, number>) => Object.values(data).reduce((s, v) => s + v, 0);
    const fmt = (data: Record<string, number>, team: string) => {
      const t = total(data);
      if (t === 0) return `${team}: brak danych`;
      return `${team}: ` + Object.entries(data)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([k, v]) => `${k} ${Math.round(v / t * 100)}%`)
        .join(', ');
    };

    const statsSummary = `${TAB_CONTEXT[tabKey] || tabKey}\n${fmt(homeData, homeTeam)}\n${fmt(awayData, awayTeam)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: getInsightPrompt(language) },
        { role: 'user', content: `Zinterpretuj te dane taktycznie:\n\n${statsSummary}\n\nCo wynika z tych liczb dla obu drużyn? Który aspekt jest kluczowy?` },
      ],
      temperature: 0.4,
      max_tokens: 150,
    });

    const insight = completion.choices[0].message.content?.trim() || ruleInsight || '';

    return new Response(JSON.stringify({ insight, ruleInsight }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[COCKPIT-INSIGHTS] Error:', error);
    return new Response(JSON.stringify({ error: 'Insights generation failed', insight: '' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}