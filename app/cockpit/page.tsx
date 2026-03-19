'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Instance {
  id: number;
  code: string;
  labels: Record<string, string | number>;
}

interface SetStats {
  home: Record<string, Record<string, number>>;
  away: Record<string, Record<string, number>>;
  scoreHome: number;
  scoreAway: number;
  homeWon: boolean;
}

interface MatchStats {
  sets: Record<string, SetStats | null>;
  teamHome: string;
  teamAway: string;
  shortHome: string;
  shortAway: string;
  matchScore: { home: number; away: number };
}

// ─── MATCH METADATA ──────────────────────────────────────────────────────────

const MATCH_META: Record<string, { label: string; homePrefix: string; awayPrefix: string }> = {
  '2025-11-12_ZAW-LBN.json': { label: 'Zawiercie vs Lublin · 12.11', homePrefix: 'ZAW', awayPrefix: 'LBN' },
  '2025-11-26_PGE-Ind.json':  { label: 'Projekt vs Olsztyn · 26.11',  homePrefix: 'PGE', awayPrefix: 'IND' },
  '2025-12-06_JSW-Ass.json':  { label: 'Jastrzębski vs Asseco · 06.12', homePrefix: 'JSW', awayPrefix: 'ASS' },
};

// ─── TABS ─────────────────────────────────────────────────────────────────────

type TabKey = 'serve_type' | 'serve_grade' | 'attack_loc' | 'attack_grade' | 'receive' | 'block' | 'dig';

interface TabConfig {
  label: string;
  key: string;
  cats: string[];
  colors: string[];
  unit: string;
  descriptions?: Record<string, string>;
}

// ─── I18N ─────────────────────────────────────────────────────────────────────

const COCKPIT_I18N: Record<string, Record<string, string>> = {
  pl: { matchKpis: 'Match KPIs', loading: 'Ładowanie danych meczu...', match: 'MECZ', back: '← Komentarz',
        set: 'SET', legend: 'Legenda' },
  en: { matchKpis: 'Match KPIs', loading: 'Loading match data...', match: 'MATCH', back: '← Commentary',
        set: 'SET', legend: 'Legend' },
  it: { matchKpis: 'KPI Partita', loading: 'Caricamento dati...', match: 'TOTALE', back: '← Telecronaca',
        set: 'SET', legend: 'Legenda' },
  de: { matchKpis: 'Match KPIs', loading: 'Spieldaten laden...', match: 'SPIEL', back: '← Kommentar',
        set: 'SATZ', legend: 'Legende' },
  tr: { matchKpis: 'Maç KPIs', loading: 'Veriler yükleniyor...', match: 'MAÇ', back: '← Yorum',
        set: 'SET', legend: 'Açıklama' },
  es: { matchKpis: 'KPIs Partido', loading: 'Cargando datos...', match: 'TOTAL', back: '← Comentario',
        set: 'SET', legend: 'Leyenda' },
  pt: { matchKpis: 'KPIs do Jogo', loading: 'Carregando dados...', match: 'TOTAL', back: '← Comentário',
        set: 'SET', legend: 'Legenda' },
  jp: { matchKpis: 'マッチKPI', loading: 'データ読込中...', match: '合計', back: '← 実況',
        set: 'セット', legend: '凡例' },
};

const TAB_I18N: Record<string, Record<TabKey, string>> = {
  pl: { serve_type: 'Zagrywka · Typ', serve_grade: 'Zagrywka · Skuteczność', attack_loc: 'Atak · Strefa',
        attack_grade: 'Atak · Jakość', receive: 'Przyjęcie', block: 'Blok', dig: 'Obrona (Dig)' },
  en: { serve_type: 'Serve · Type', serve_grade: 'Serve · Efficiency', attack_loc: 'Attack · Zone',
        attack_grade: 'Attack · Quality', receive: 'Reception', block: 'Block', dig: 'Defense (Dig)' },
  it: { serve_type: 'Battuta · Tipo', serve_grade: 'Battuta · Efficacia', attack_loc: 'Attacco · Zona',
        attack_grade: 'Attacco · Qualità', receive: 'Ricezione', block: 'Muro', dig: 'Difesa (Dig)' },
  de: { serve_type: 'Aufschlag · Typ', serve_grade: 'Aufschlag · Effizienz', attack_loc: 'Angriff · Zone',
        attack_grade: 'Angriff · Qualität', receive: 'Annahme', block: 'Block', dig: 'Abwehr (Dig)' },
  tr: { serve_type: 'Servis · Tip', serve_grade: 'Servis · Etkinlik', attack_loc: 'Atak · Bölge',
        attack_grade: 'Atak · Kalite', receive: 'Kabul', block: 'Blok', dig: 'Savunma (Dig)' },
  es: { serve_type: 'Saque · Tipo', serve_grade: 'Saque · Eficacia', attack_loc: 'Ataque · Zona',
        attack_grade: 'Ataque · Calidad', receive: 'Recepción', block: 'Bloqueo', dig: 'Defensa (Dig)' },
  pt: { serve_type: 'Saque · Tipo', serve_grade: 'Saque · Eficácia', attack_loc: 'Ataque · Zona',
        attack_grade: 'Ataque · Qualidade', receive: 'Recepção', block: 'Bloqueio', dig: 'Defesa (Dig)' },
  jp: { serve_type: 'サーブ · タイプ', serve_grade: 'サーブ · 効果', attack_loc: 'アタック · ゾーン',
        attack_grade: 'アタック · 質', receive: 'レセプション', block: 'ブロック', dig: 'ディグ' },
};

const TABS: Record<TabKey, TabConfig> = {
  serve_type: {
    label: 'Zagrywka · Typ',
    key: 'serve_types',
    cats: ['Jump Spin', 'Jump Float', 'Hydrid Jump', 'Other'],
    colors: ['#2563eb', '#60a5fa', '#93c5fd', '#475569'],
    unit: 'zagrywek',
  },
  serve_grade: {
    label: 'Zagrywka · Skuteczność',
    key: 'serve_grades',
    cats: ['Ace (As)', 'Pozytywna', 'Neutralna', 'Słaba', 'Błąd'],
    colors: ['#16a34a', '#4ade80', '#3b82f6', '#f59e0b', '#dc2626'],
    unit: 'zagrywek',
    descriptions: {
      'Ace (As)': 'Bezpośredni punkt z zagrywki',
      'Pozytywna': 'Trudna dla przyjęcia — ogranicza opcje rywala',
      'Neutralna': 'Przyjęta swobodnie — gra toczy się dalej',
      'Słaba': 'Łatwa do przyjęcia — rywal ma pełne opcje ataku',
      'Błąd': 'Zagrywka w siatkę lub za linię',
    },
  },
  attack_loc: {
    label: 'Atak · Strefa',
    key: 'atk_loc',
    cats: ['Left Side', 'Right Side', 'Middle', 'Pipe', 'Right Side Back'],
    colors: ['#1d4ed8', '#3b82f6', '#60a5fa', '#34d399', '#93c5fd'],
    unit: 'ataków',
    descriptions: {
      'Left Side': 'Skrzydło lewe (OH z lewej)',
      'Right Side': 'Skrzydło prawe (OP/OH z prawej)',
      'Middle': 'Środek (szybki atak 1. tempo)',
      'Pipe': 'Pipe (atak z 2. linii środkiem)',
      'Right Side Back': 'Atak z tyłu z prawej strony',
    },
  },
  attack_grade: {
    label: 'Atak · Jakość',
    key: 'atk_grades',
    cats: ['Punkt', 'Kontynuacja', 'Błąd'],
    colors: ['#16a34a', '#3b82f6', '#dc2626'],
    unit: 'ataków',
    descriptions: {
      'Punkt': 'Atak nie do obrony — bezpośredni punkt',
      'Kontynuacja': 'Atak odbity lub zablokowany — akcja trwa dalej',
      'Błąd': 'Atak w siatkę lub za linię (punkt dla rywala)',
    },
  },
  receive: {
    label: 'Przyjęcie',
    key: 'rec_grades',
    cats: ['Idealne', 'Pozytywne', 'Negatywne', 'Błąd'],
    colors: ['#16a34a', '#4ade80', '#f59e0b', '#dc2626'],
    unit: 'przyjęć',
    descriptions: {
      'Idealne': 'Przyjęcie idealne — pełne opcje ataku dla rozgrywającego',
      'Pozytywne': 'Przyjęcie dobre — rozgrywający ma ograniczone opcje',
      'Negatywne': 'Trudne przyjęcie — wymuszone rozegranie lub kontra',
      'Błąd': 'As serwisowy rywala lub bezpośredni błąd przyjęcia',
    },
  },
  block: {
    label: 'Blok',
    key: 'blk_grades',
    cats: ['Punkt', 'Wyblok', 'Dotknięcie', 'Błąd'],
    colors: ['#16a34a', '#3b82f6', '#60a5fa', '#dc2626'],
    unit: 'bloków',
    descriptions: {
      'Punkt': 'Blok punktowy — bezpośredni punkt',
      'Wyblok': 'Blok spowalniający — obrona może wyprowadzić kontrę',
      'Dotknięcie': 'Lekkie dotknięcie piłki — akcja trwa dalej',
      'Błąd': 'Błąd bloku (dotknięcie anteny, wejście w siatkę)',
    },
  },
  dig: {
    label: 'Obrona (Dig)',
    key: 'dig_grades',
    cats: ['Skuteczna', 'Nieskuteczna'],
    colors: ['#16a34a', '#dc2626'],
    unit: 'obron',
    descriptions: {
      'Skuteczna': 'Obrona utrzymana — akcja trwa dalej (kontra możliwa)',
      'Nieskuteczna': 'Piłka dotknięta, ale punkt dla rywala',
    },
  },
};

const TAB_ORDER: TabKey[] = ['serve_type', 'serve_grade', 'attack_loc', 'attack_grade', 'receive', 'block', 'dig'];

// ─── GRADE MAPPING ────────────────────────────────────────────────────────────

function mapServeGrade(g: string): string {
  if (!g) return '';
  const gl = g.toLowerCase();
  if (gl === 'perfect') return 'Ace (As)';
  if (gl === 'positive') return 'Pozytywna';
  if (gl === 'average') return 'Neutralna';
  if (gl === 'poor') return 'Słaba';
  if (gl === 'fail') return 'Błąd';
  return g;
}

function mapAttackGrade(g: string): string {
  if (!g) return '';
  const gl = g.toLowerCase();
  if (gl === 'perfect') return 'Punkt';
  if (gl === 'positive' || gl === 'average' || gl === 'poor' || gl === 'incomplete') return 'Kontynuacja';
  if (gl === 'fail') return 'Błąd';
  return g;
}

function mapReceiveGrade(g: string): string {
  if (!g) return '';
  const gl = g.toLowerCase();
  if (gl === 'perfect') return 'Idealne';
  if (gl === 'positive') return 'Pozytywne';
  if (gl === 'average' || gl === 'poor' || gl === 'incomplete') return 'Negatywne';
  if (gl === 'fail') return 'Błąd';
  return g;
}

function mapBlockGrade(g: string): string {
  if (!g) return '';
  const gl = g.toLowerCase();
  if (gl === 'perfect') return 'Punkt';
  if (gl === 'positive') return 'Wyblok';
  if (gl === 'average') return 'Dotknięcie';
  if (gl === 'fail') return 'Błąd';
  return g;
}

function mapDigGrade(g: string): string {
  if (!g) return '';
  const gl = g.toLowerCase();
  if (gl === 'perfect' || gl === 'positive') return 'Skuteczna';
  return 'Nieskuteczna';
}

// ─── SVG DONUT ───────────────────────────────────────────────────────────────

function SvgDonut({ data, cats, colors, size = 120, thickness = 22, label, labelColor, unit }: {
  data: Record<string, number>;
  cats: string[];
  colors: string[];
  size?: number;
  thickness?: number;
  label: string;
  labelColor: string;
  unit: string;
}) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = cats.reduce((s, c) => s + (data[c] || 0), 0);

  let cum = 0;
  const segs = cats
    .map((cat, i) => ({ cat, val: data[cat] || 0, color: colors[i] }))
    .filter(s => s.val > 0)
    .map(s => {
      const pct = s.val / total;
      const seg = { offset: circ - cum * circ, dash: pct * circ - 1, ...s, pct };
      cum += pct;
      return seg;
    });

  // Extra padding around the SVG so outside labels don't clip
  const pad = 28;
  const outerR = r + thickness / 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: labelColor, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
        {label}
      </span>
      {/* wrapper is bigger than SVG to accommodate outside labels */}
      <div style={{ position: 'relative', width: size + pad * 2, height: size + pad * 2 }}>

        {/* Donut ring — rotated, centered in padded canvas */}
        <svg width={size + pad * 2} height={size + pad * 2} style={{ position: 'absolute', top: 0, left: 0 }}>
          <g transform={`translate(${pad}, ${pad}) rotate(-90, ${cx}, ${cy})`}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={thickness} />
            {total > 0 && segs.map((seg, i) => (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                stroke={seg.color} strokeWidth={thickness}
                strokeDasharray={`${Math.max(0, seg.dash)} ${circ - Math.max(0, seg.dash)}`}
                strokeDashoffset={seg.offset}
              >
                <title>{seg.cat}: {seg.val} ({Math.round(seg.pct * 100)}%)</title>
              </circle>
            ))}
          </g>
        </svg>

        {/* % labels outside — same SVG, no rotation */}
        <svg width={size + pad * 2} height={size + pad * 2} style={{ position: 'absolute', top: 0, left: 0 }}>
          {total > 0 && segs
            .filter(seg => seg.pct >= 0.08)
            .map((seg, i) => {
              const startAngle = segs.slice(0, segs.indexOf(seg)).reduce((a, s) => a + s.pct * 2 * Math.PI, 0);
              const midAngle = startAngle + seg.pct * Math.PI - Math.PI / 2;
              // center of padded canvas
              const ocx = cx + pad;
              const ocy = cy + pad;
              const tickInner = outerR + 4;
              const tickOuter = outerR + 11;
              const textDist  = outerR + 21;
              return (
                <g key={i}>
                  <line
                    x1={ocx + tickInner * Math.cos(midAngle)} y1={ocy + tickInner * Math.sin(midAngle)}
                    x2={ocx + tickOuter * Math.cos(midAngle)} y2={ocy + tickOuter * Math.sin(midAngle)}
                    stroke={seg.color} strokeWidth={1.5}
                  />
                  <text
                    x={ocx + textDist * Math.cos(midAngle)}
                    y={ocy + textDist * Math.sin(midAngle)}
                    textAnchor="middle" dominantBaseline="central"
                    style={{ fontSize: 11, fontWeight: 800, fill: '#f1f5f9', fontFamily: 'JetBrains Mono, monospace' }}>
                    {Math.round(seg.pct * 100)}%
                  </text>
                </g>
              );
            })}
        </svg>

        {/* Center total */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', lineHeight: 1, fontFamily: 'JetBrains Mono, monospace' }}>
            {total}
          </div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 2, letterSpacing: '.05em' }}>{unit}</div>
        </div>
      </div>
    </div>
  );
}

// ─── PARSE ───────────────────────────────────────────────────────────────────

function parseInstances(
  instances: Instance[],
  hp: string,
  ap: string,
  maxSet: number,
  liveScoreHome: number,
  liveScoreAway: number,
): MatchStats {
  const SETS = ['1', '2', '3', '4', '5'];
  const setStats: Record<string, SetStats | null> = {};
  let matchHome = 0, matchAway = 0;

  const teamHomeFull = instances.find(i => i.code.startsWith(hp + ' '))?.labels['Team Name'] as string || hp;
  const teamAwayFull = instances.find(i => i.code.startsWith(ap + ' '))?.labels['Team Name'] as string || ap;
  const shortName = (s: string) => s.split(' ')[0];

  for (const s of SETS) {
    const sn = Number(s);
    if (sn > maxSet) { setStats[s] = null; continue; }

    let si = instances.filter(i => String(i.labels?.Set) === s);
    if (!si.length) { setStats[s] = null; continue; }

    // Current set in progress: trim to live score
    if (sn === maxSet && liveScoreHome + liveScoreAway > 0) {
      const totalPlayed = liveScoreHome + liveScoreAway;
      const rallyInsts = si.filter(i => i.code === 'Rally').sort((a, b) => a.id - b.id);
      const cutoffId = rallyInsts[Math.min(totalPlayed - 1, rallyInsts.length - 1)]?.id ?? Infinity;
      si = si.filter(i => i.id <= cutoffId);
    }

    const home: Record<string, Record<string, number>> = {
      serve_types: {}, serve_grades: {}, atk_loc: {}, atk_grades: {}, rec_grades: {}, blk_grades: {}, dig_grades: {},
    };
    const away: Record<string, Record<string, number>> = {
      serve_types: {}, serve_grades: {}, atk_loc: {}, atk_grades: {}, rec_grades: {}, blk_grades: {}, dig_grades: {},
    };

    const inc = (obj: Record<string, number>, k: string) => { if (k) obj[k] = (obj[k] || 0) + 1; };

    for (const inst of si) {
      const isH = inst.code.startsWith(hp + ' ');
      const isA = inst.code.startsWith(ap + ' ');
      if (!isH && !isA) continue;
      const t = isH ? home : away;
      const action = inst.code.slice((isH ? hp : ap).length + 1);
      const lbl = inst.labels;

      if (action === 'Serve') {
        if (lbl['Serve Type']) inc(t.serve_types, lbl['Serve Type'] as string);
        if (lbl['Serve Grade']) inc(t.serve_grades, mapServeGrade(lbl['Serve Grade'] as string));
      } else if (action === 'Attack') {
        if (lbl['Attack Location']) inc(t.atk_loc, lbl['Attack Location'] as string);
        if (lbl['Attack Grade']) inc(t.atk_grades, mapAttackGrade(lbl['Attack Grade'] as string));
      } else if (action === 'Receive') {
        if (lbl['Receive Grade']) inc(t.rec_grades, mapReceiveGrade(lbl['Receive Grade'] as string));
      } else if (action === 'Block') {
        if (lbl['Block Grade']) inc(t.blk_grades, mapBlockGrade(lbl['Block Grade'] as string));
      } else if (action === 'Dig') {
        if (lbl['Dig Grade']) inc(t.dig_grades, mapDigGrade(lbl['Dig Grade'] as string));
      }
    }

    // Correct score: Rally Won labels
    const hSrv = si.filter(i => i.code === `${hp} Serve`);
    const aSrv = si.filter(i => i.code === `${ap} Serve`);
    const hWon = hSrv.filter(i => i.labels['Rally Won'] === 'Won').length
               + aSrv.filter(i => i.labels['Rally Won'] === 'Lost').length;
    const aWon = aSrv.filter(i => i.labels['Rally Won'] === 'Won').length
               + hSrv.filter(i => i.labels['Rally Won'] === 'Lost').length;

    let scoreHome: number, scoreAway: number;
    if (sn === maxSet && liveScoreHome + liveScoreAway > 0) {
      scoreHome = liveScoreHome;
      scoreAway = liveScoreAway;
    } else {
      scoreHome = hWon;
      scoreAway = aWon;
    }

    const homeWon = scoreHome > scoreAway;
    if (sn < maxSet) { if (homeWon) matchHome++; else matchAway++; }

    setStats[s] = { home, away, scoreHome, scoreAway, homeWon };
  }

  return {
    sets: setStats,
    teamHome: teamHomeFull,
    teamAway: teamAwayFull,
    shortHome: shortName(teamHomeFull),
    shortAway: shortName(teamAwayFull),
    matchScore: { home: matchHome, away: matchAway },
  };
}

function mergeAll(stats: MatchStats, key: string) {
  const r = { home: {} as Record<string, number>, away: {} as Record<string, number> };
  for (const s of ['1', '2', '3', '4', '5']) {
    const d = stats.sets[s];
    if (!d) continue;
    for (const t of ['home', 'away'] as const) {
      const src = (d[t] as any)[key] || {};
      for (const [k, v] of Object.entries(src)) r[t][k] = (r[t][k] || 0) + (v as number);
    }
  }
  return r;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

export default function CockpitPage() {
  const [matchFile, setMatchFile] = useState('2025-11-12_ZAW-LBN.json');
  const [stats, setStats]         = useState<MatchStats | null>(null);
  const [loading, setLoading]     = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('serve_type');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [currentSet, setCurrentSet]       = useState(99);
  const [liveScoreHome, setLiveScoreHome] = useState(0);
  const [liveScoreAway, setLiveScoreAway] = useState(0);
  const [language, setLanguage]           = useState('pl');

  useEffect(() => {
    const readLS = () => {
      const stored = localStorage.getItem('vi_selected_match');
      if (stored && MATCH_META[stored]) setMatchFile(prev => prev !== stored ? stored : prev);
      const cs = Number(localStorage.getItem('vi_current_set') || '99');
      setCurrentSet(cs || 99);
      setLiveScoreHome(Number(localStorage.getItem('vi_current_score_home') || '0'));
      setLiveScoreAway(Number(localStorage.getItem('vi_current_score_away') || '0'));
      const lang = localStorage.getItem('vi_language') || 'pl';
      setLanguage(lang);
    };
    readLS();
    const onStorage = (e: StorageEvent) => {
      if (['vi_selected_match','vi_current_set','vi_current_score_home','vi_current_score_away'].includes(e.key || '')) readLS();
    };
    window.addEventListener('storage', onStorage);
    const poll = setInterval(readLS, 2000);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(poll); };
  }, []);

  const [rawInstances, setRawInstances] = useState<{ instances: Instance[]; hp: string; ap: string } | null>(null);

  const load = useCallback(async (file: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/data/matches/rallies/${file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      if (!raw.instances) throw new Error('Brak instances');
      const meta = MATCH_META[file];
      setRawInstances({ instances: raw.instances, hp: meta.homePrefix, ap: meta.awayPrefix });
      setLastUpdated(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(matchFile); }, [matchFile, load]);
  useEffect(() => {
    const iv = setInterval(() => load(matchFile), 30000);
    return () => clearInterval(iv);
  }, [matchFile, load]);

  useEffect(() => {
    if (!rawInstances) return;
    const { instances, hp, ap } = rawInstances;
    setStats(parseInstances(instances, hp, ap, currentSet, liveScoreHome, liveScoreAway));
  }, [rawInstances, currentSet, liveScoreHome, liveScoreAway]);

  const tab  = TABS[activeTab];
  const SETS = ['1', '2', '3', '4', '5'];
  const allData = stats ? mergeAll(stats, tab.key) : null;
  const meta = MATCH_META[matchFile];
  const isLive = currentSet < 99 && currentSet > 0;

  return (
    <div style={{ minHeight: '100vh', background: '#060c18', color: '#cbd5e1', fontFamily: 'JetBrains Mono, monospace' }}>

      {/* ── HEADER ── */}
      <div style={{ background: '#0c1422', borderBottom: '1px solid #1e293b', padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#94a3b8', letterSpacing: '-.3px' }}>⚡ VolleyInsight</span>
          <div style={{ width: 1, height: 18, background: '#1e293b' }} />
          <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em' }}>{(COCKPIT_I18N[language] || COCKPIT_I18N.pl).matchKpis}</span>
          <div style={{ width: 1, height: 18, background: '#1e293b' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>{meta.label}</span>
          {isLive && (
            <span style={{ fontSize: 9, color: '#34d399', fontStyle: 'italic' }}>
              · Set {currentSet} · {liveScoreHome}:{liveScoreAway}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 9, color: '#64748b' }}>↻ {lastUpdated.toLocaleTimeString('pl-PL')}</span>
          )}
          {isLive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: 9, color: '#f87171', fontWeight: 800, letterSpacing: '.12em' }}>LIVE</span>
            </div>
          )}
          <a href="/" style={{ fontSize: 10, color: '#93c5fd', textDecoration: 'none', padding: '4px 10px', border: '1px solid #1e3a5f', borderRadius: 5, fontWeight: 700 }}>
            {(COCKPIT_I18N[language] || COCKPIT_I18N.pl).back}
          </a>
        </div>
      </div>

      {/* ── TEAMS BAR + TABS ── */}
      {stats && (
        <div style={{ background: '#0a1120', borderBottom: '1px solid #0f172a', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 6px #3b82f6' }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa' }}>{stats.shortHome}</span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>vs</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fbbf24' }}>{stats.shortAway}</span>
            </div>
            <div style={{ width: 1, height: 20, background: '#1e293b', margin: '0 4px' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>
              <span style={{ color: stats.matchScore.home >= stats.matchScore.away ? '#60a5fa' : '#64748b' }}>{stats.matchScore.home}</span>
              <span style={{ color: '#1e293b', margin: '0 4px' }}>:</span>
              <span style={{ color: stats.matchScore.away > stats.matchScore.home ? '#fbbf24' : '#64748b' }}>{stats.matchScore.away}</span>
            </span>
          </div>

          <div style={{ display: 'flex', gap: 5 }}>
            {TAB_ORDER.map(t => {
              const isActive = activeTab === t;
              return (
                <button key={t} onClick={() => setActiveTab(t)} style={{
                  padding: '8px 16px', borderRadius: 7, fontSize: 11, fontWeight: 800, letterSpacing: '.08em',
                  cursor: 'pointer', border: 'none', textTransform: 'uppercase', transition: 'all .15s',
                  background: isActive ? '#1d4ed8' : '#111827',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  boxShadow: isActive ? '0 0 12px rgba(29,78,216,.5)' : 'none',
                  transform: isActive ? 'translateY(-1px)' : 'none',
                }}>
                  {(TAB_I18N[language] || TAB_I18N.pl)[t]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 80, color: '#64748b', fontSize: 12 }}>
          {(COCKPIT_I18N[language] || COCKPIT_I18N.pl).loading}
        </div>
      )}

      {stats && !loading && !isLive && (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#475569' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
            {language === 'pl' ? 'Uruchom komentarz aby zobaczyć dane live' :
             language === 'en' ? 'Start commentary to see live data' :
             language === 'it' ? 'Avvia il commento per vedere i dati live' :
             language === 'de' ? 'Kommentar starten um Live-Daten zu sehen' :
             language === 'tr' ? 'Canlı verileri görmek için yorumu başlatın' :
             language === 'es' ? 'Inicia el comentario para ver datos en vivo' :
             language === 'pt' ? 'Inicie o comentário para ver dados ao vivo' :
             language === 'jp' ? 'ライブデータを見るには実況を開始してください' :
             'Start commentary to see live data'}
          </div>
          <div style={{ fontSize: 11, color: '#334155' }}>
            {language === 'pl' ? 'Naciśnij ▶ w oknie Komentarza' : 'Press ▶ in the Commentary window'}
          </div>
        </div>
      )}

      {stats && !loading && isLive && (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>

            {SETS.map(s => {
              const d = stats.sets[s];
              const empty = !d;
              const isCurrent = Number(s) === currentSet && isLive;

              return (
                <div key={s} style={{
                  background: '#0c1828',
                  borderRadius: 14,
                  border: `1px solid ${empty ? '#0f172a' : isCurrent ? 'rgba(59,130,246,.35)' : '#1e293b'}`,
                  padding: '16px 10px',
                  opacity: empty ? 0.2 : 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                }}>
                  <div style={{ textAlign: 'center', width: '100%' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.25em', color: isCurrent ? '#60a5fa' : '#64748b', textTransform: 'uppercase' }}>
                      {(COCKPIT_I18N[language] || COCKPIT_I18N.pl).set} {s}{isCurrent ? ' ●' : ''}
                    </div>
                    {!empty && d && (
                      <div style={{ marginTop: 5, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>
                        <span style={{ color: d.homeWon ? '#60a5fa' : '#64748b' }}>{d.scoreHome}</span>
                        <span style={{ color: '#1e293b', margin: '0 5px' }}>:</span>
                        <span style={{ color: !d.homeWon ? '#fbbf24' : '#64748b' }}>{d.scoreAway}</span>
                      </div>
                    )}
                  </div>
                  {empty && <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#111827', opacity: .1 }} />}
                  {!empty && d && (
                    <SvgDonut data={(d.home as any)[tab.key] || {}} cats={tab.cats} colors={tab.colors}
                      size={160} thickness={28} label={stats.shortHome.substring(0, 6)} labelColor="#60a5fa" unit={tab.unit} />
                  )}
                  {!empty && d && (
                    <SvgDonut data={(d.away as any)[tab.key] || {}} cats={tab.cats} colors={tab.colors}
                      size={160} thickness={28} label={stats.shortAway.substring(0, 6)} labelColor="#fbbf24" unit={tab.unit} />
                  )}
                </div>
              );
            })}

            {/* TOTAL */}
            {allData && (
              <div style={{
                background: '#0a1000', borderRadius: 14, border: '2px solid #1a2200',
                padding: '16px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.2em', color: '#fbbf24', textTransform: 'uppercase' }}>{(COCKPIT_I18N[language] || COCKPIT_I18N.pl).match}</div>
                  <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>
                    <span style={{ color: stats.matchScore.home >= stats.matchScore.away ? '#60a5fa' : '#64748b' }}>{stats.matchScore.home}</span>
                    <span style={{ color: '#1e293b', margin: '0 4px' }}>:</span>
                    <span style={{ color: stats.matchScore.away > stats.matchScore.home ? '#fbbf24' : '#64748b' }}>{stats.matchScore.away}</span>
                  </div>
                </div>
                <SvgDonut data={allData.home} cats={tab.cats} colors={tab.colors}
                  size={160} thickness={28} label={stats.shortHome.substring(0, 6)} labelColor="#60a5fa" unit={tab.unit} />
                <SvgDonut data={allData.away} cats={tab.cats} colors={tab.colors}
                  size={160} thickness={28} label={stats.shortAway.substring(0, 6)} labelColor="#fbbf24" unit={tab.unit} />
              </div>
            )}
          </div>

          {/* ── LEGENDA z % share ── */}
          <div style={{ marginTop: 20, padding: '14px 20px', background: '#0c1422', borderRadius: 10, border: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: tab.descriptions ? 12 : 0 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.15em', marginRight: 4 }}>
                {(TAB_I18N[language] || TAB_I18N.pl)[activeTab]}
              </span>
              <div style={{ width: 1, height: 18, background: '#1e293b' }} />
              {tab.cats.map((c, i) => {
                const totalH = tab.cats.reduce((s, cc) => s + (allData?.home?.[cc] || 0), 0);
                const totalA = tab.cats.reduce((s, cc) => s + (allData?.away?.[cc] || 0), 0);
                const pctH = totalH > 0 ? Math.round(((allData?.home?.[c] || 0) / totalH) * 100) : 0;
                const pctA = totalA > 0 ? Math.round(((allData?.away?.[c] || 0) / totalA) * 100) : 0;
                return (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.03)', borderRadius: 6, padding: '4px 10px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: tab.colors[i], flexShrink: 0, boxShadow: `0 0 5px ${tab.colors[i]}50` }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1' }}>{c}</span>
                    <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700 }}>{pctH}%</span>
                    <span style={{ fontSize: 9, color: '#334155' }}>/</span>
                    <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>{pctA}%</span>
                  </div>
                );
              })}
            </div>
            {tab.descriptions && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, borderTop: '1px solid #1e293b', paddingTop: 10 }}>
                {tab.cats.map((c, i) => tab.descriptions?.[c] ? (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: tab.colors[i], flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: '#64748b' }}>
                      <span style={{ color: '#94a3b8', fontWeight: 700 }}>{c}:</span> {tab.descriptions[c]}
                    </span>
                  </div>
                ) : null)}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>
    </div>
  );
}