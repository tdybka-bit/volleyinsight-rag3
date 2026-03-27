'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Instance {
  id: number;
  code: string;
  labels: Record<string, string | number>;
}

// Zone data: { zone_id: { total, ace, positive, negative, error } }
interface ZoneData {
  total: number;
  ace: number;
  positive: number;
  negative: number;
  error: number;
}

interface SetStats {
  home: Record<string, Record<string, number>>;
  away: Record<string, Record<string, number>>;
  homeZones: Record<string, ZoneData>;  // serve zone heatmap
  awayZones: Record<string, ZoneData>;
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

const MATCH_META: Record<string, { label: string; homePrefix: string; awayPrefix: string; homeName: string; awayName: string }> = {
  '2025-11-12_ZAW-LBN.json': { label: 'Zawiercie vs Lublin · 12.11', homePrefix: 'ZAW', awayPrefix: 'LBN', homeName: 'Aluron Zawiercie', awayName: 'Bogdanka Lublin' },
  '2025-11-26_PGE-Ind.json':  { label: 'Projekt vs Olsztyn · 26.11',  homePrefix: 'PGE', awayPrefix: 'IND', homeName: 'Projekt Warszawa', awayName: 'Indykpol Olsztyn' },
  '2025-12-06_JSW-Ass.json':  { label: 'Jastrzębski vs Asseco · 06.12', homePrefix: 'JSW', awayPrefix: 'ASS', homeName: 'Jastrzębski Węgiel', awayName: 'Asseco Rzeszów' },
};

// ─── TABS ─────────────────────────────────────────────────────────────────────

type TabKey = 'serve_type' | 'serve_grade' | 'attack_loc' | 'attack_grade' | 'receive' | 'block' | 'dig' | 'serve_zone';

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
        attack_grade: 'Atak · Jakość', receive: 'Przyjęcie', block: 'Blok', dig: 'Obrona (Dig)', serve_zone: 'Zagrywka · Boisko' },
  en: { serve_type: 'Serve · Type', serve_grade: 'Serve · Efficiency', attack_loc: 'Attack · Zone',
        attack_grade: 'Attack · Quality', receive: 'Reception', block: 'Block', dig: 'Defense (Dig)', serve_zone: 'Serve · Court Map' },
  it: { serve_type: 'Battuta · Tipo', serve_grade: 'Battuta · Efficacia', attack_loc: 'Attacco · Zona',
        attack_grade: 'Attacco · Qualità', receive: 'Ricezione', block: 'Muro', dig: 'Difesa (Dig)', serve_zone: 'Battuta · Campo' },
  de: { serve_type: 'Aufschlag · Typ', serve_grade: 'Aufschlag · Effizienz', attack_loc: 'Angriff · Zone',
        attack_grade: 'Angriff · Qualität', receive: 'Annahme', block: 'Block', dig: 'Abwehr (Dig)', serve_zone: 'Aufschlag · Feld' },
  tr: { serve_type: 'Servis · Tip', serve_grade: 'Servis · Etkinlik', attack_loc: 'Atak · Bölge',
        attack_grade: 'Atak · Kalite', receive: 'Kabul', block: 'Blok', dig: 'Savunma (Dig)', serve_zone: 'Servis · Saha' },
  es: { serve_type: 'Saque · Tipo', serve_grade: 'Saque · Eficacia', attack_loc: 'Ataque · Zona',
        attack_grade: 'Ataque · Calidad', receive: 'Recepción', block: 'Bloqueo', dig: 'Defensa (Dig)', serve_zone: 'Saque · Cancha' },
  pt: { serve_type: 'Saque · Tipo', serve_grade: 'Saque · Eficácia', attack_loc: 'Ataque · Zona',
        attack_grade: 'Ataque · Qualidade', receive: 'Recepção', block: 'Bloqueio', dig: 'Defesa (Dig)', serve_zone: 'Saque · Quadra' },
  jp: { serve_type: 'サーブ · タイプ', serve_grade: 'サーブ · 効果', attack_loc: 'アタック · ゾーン',
        attack_grade: 'アタック · 質', receive: 'レセプション', block: 'ブロック', dig: 'ディグ', serve_zone: 'サーブ · コート' },
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
  // serve_zone uses CourtZoneMap component — not SvgDonut, stub for type safety
  serve_zone: {
    label: 'Zagrywka · Boisko',
    key: 'serve_types', // unused — zone tab renders differently
    cats: [],
    colors: [],
    unit: '',
  },
};

const TAB_ORDER: TabKey[] = ['serve_type', 'serve_grade', 'attack_loc', 'attack_grade', 'receive', 'block', 'dig', 'serve_zone'];

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

// ─── VOLLEYBALL COURT ZONE MAP ───────────────────────────────────────────────
//
//  VolleyStation zones on receiving side (opponent's court):
//
//   Net ────────────────────────
//   │  4  │  3  │  2  │  front row
//   │  5  │  6  │  1  │  back row
//   ────────────────────────────
//
// Zone 1 = back right, 5 = back left, 6 = back center (libero!)
// Sub-zones A/B/C/D = quadrants inside each zone

// Layout positions (cx, cy) inside a 300x200 court SVG (net at top)
const ZONE_POSITIONS: Record<string, { cx: number; cy: number; label: string }> = {
  '1': { cx: 240, cy: 140, label: 'Z1' },  // back right
  '2': { cx: 240, cy:  55, label: 'Z2' },  // front right
  '3': { cx: 150, cy:  55, label: 'Z3' },  // front center
  '4': { cx:  60, cy:  55, label: 'Z4' },  // front left
  '5': { cx:  60, cy: 140, label: 'Z5' },  // back left
  '6': { cx: 150, cy: 140, label: 'Z6' },  // back center
  '7': { cx: 240, cy:  95, label: 'Z7' },  // mid right
  '8': { cx: 150, cy:  95, label: 'Z8' },  // mid center
  '9': { cx:  60, cy:  95, label: 'Z9' },  // mid left
};

function CourtZoneMap({ zones, teamColor, teamLabel, maxTotal }: {
  zones: Record<string, ZoneData>;
  teamColor: string;
  teamLabel: string;
  maxTotal: number;
}) {
  const W = 300; const H = 200;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: teamColor, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.1em', textTransform: 'uppercase' }}>
        {teamLabel}
      </span>
      <svg width={W} height={H} style={{ borderRadius: 8, overflow: 'visible' }}>
        {/* Court background */}
        <rect x={0} y={0} width={W} height={H} fill="#0a1628" rx={6} />
        {/* Court lines */}
        <rect x={20} y={15} width={260} height={170} fill="none" stroke="#1e3a5f" strokeWidth={1.5} />
        {/* Net */}
        <line x1={20} y1={95} x2={280} y2={95} stroke="#3b82f6" strokeWidth={2} strokeDasharray="4,3" />
        {/* Vertical dividers */}
        <line x1={107} y1={15} x2={107} y2={185} stroke="#0f2040" strokeWidth={1} />
        <line x1={193} y1={15} x2={193} y2={185} stroke="#0f2040" strokeWidth={1} />
        {/* Horizontal dividers */}
        <line x1={20} y1={100} x2={280} y2={100} stroke="#0f2040" strokeWidth={1} />

        {/* Zone labels (subtle background) */}
        {Object.entries(ZONE_POSITIONS).map(([z, pos]) => (
          <text key={z} x={pos.cx} y={pos.cy + 28} textAnchor="middle"
            style={{ fontSize: 9, fill: '#1e3a5f', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
            {pos.label}
          </text>
        ))}

        {/* Serve dots per zone */}
        {Object.entries(ZONE_POSITIONS).map(([z, pos]) => {
          const zd = zones[z];
          if (!zd || zd.total === 0) return null;

          // Circle size proportional to total (min 8, max 38)
          const r = Math.max(8, Math.min(38, 8 + (zd.total / Math.max(maxTotal, 1)) * 30));

          // Color: blend based on ace% vs error%
          const aceRate  = zd.ace   / zd.total;
          const errRate  = zd.error / zd.total;
          const posRate  = zd.positive / zd.total;

          // Pick dominant color
          let fillColor: string;
          let glowColor: string;
          if (aceRate >= 0.12) {
            fillColor = `rgba(16,185,129,${0.3 + aceRate * 0.5})`;
            glowColor = '#10b981';
          } else if (errRate >= 0.25) {
            fillColor = `rgba(239,68,68,${0.3 + errRate * 0.4})`;
            glowColor = '#ef4444';
          } else if (posRate >= 0.20) {
            fillColor = `rgba(59,130,246,${0.3 + posRate * 0.4})`;
            glowColor = '#3b82f6';
          } else {
            fillColor = 'rgba(148,163,184,0.2)';
            glowColor = '#64748b';
          }

          return (
            <g key={z}>
              {/* Glow */}
              <circle cx={pos.cx} cy={pos.cy} r={r + 3} fill={glowColor} opacity={0.15} />
              {/* Main circle */}
              <circle cx={pos.cx} cy={pos.cy} r={r} fill={fillColor} stroke={glowColor} strokeWidth={1.5} />
              {/* Count */}
              <text x={pos.cx} y={pos.cy + 1} textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: Math.max(9, Math.min(13, r * 0.6)), fontWeight: 800, fill: '#f1f5f9', fontFamily: 'JetBrains Mono, monospace' }}>
                {zd.total}
              </text>
              {/* Ace% if notable */}
              {aceRate >= 0.08 && (
                <text x={pos.cx} y={pos.cy + r + 10} textAnchor="middle"
                  style={{ fontSize: 8, fill: '#10b981', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                  {Math.round(aceRate * 100)}% ace
                </text>
              )}
            </g>
          );
        })}

        {/* NET label */}
        <text x={150} y={91} textAnchor="middle"
          style={{ fontSize: 8, fill: '#3b82f6', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.2em' }}>
          NET
        </text>
      </svg>

      {/* Mini legend */}
      <div style={{ display: 'flex', gap: 10, fontSize: 9, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
        <span style={{ color: '#10b981' }}>● ace ≥12%</span>
        <span style={{ color: '#3b82f6' }}>● pos ≥20%</span>
        <span style={{ color: '#ef4444' }}>● err ≥25%</span>
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
  homeName?: string,
  awayName?: string,
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

    // Zone heatmap data
    const initZones = (): Record<string, ZoneData> => {
      const z: Record<string, ZoneData> = {};
      ['1','2','3','4','5','6','7','8','9'].forEach(k => { z[k] = { total: 0, ace: 0, positive: 0, negative: 0, error: 0 }; });
      return z;
    };
    const homeZones = initZones();
    const awayZones = initZones();

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
        // Zone heatmap
        const toZone = String(lbl['To Zone'] || '').replace(/[ABCD]$/, ''); // strip sub-zone
        const grade  = String(lbl['Serve Grade'] || '');
        const zMap   = isH ? homeZones : awayZones;
        if (toZone && zMap[toZone]) {
          zMap[toZone].total++;
          if (grade === 'Perfect')  zMap[toZone].ace++;
          else if (grade === 'Positive') zMap[toZone].positive++;
          else if (grade === 'Average' || grade === 'Poor') zMap[toZone].negative++;
          else if (grade === 'Fail') zMap[toZone].error++;
        }
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

    setStats[s] = { home, away, homeZones, awayZones, scoreHome, scoreAway, homeWon };
  }

  return {
    sets: setStats,
    teamHome: homeName || teamHomeFull,
    teamAway: awayName || teamAwayFull,
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

function mergeZones(stats: MatchStats): { home: Record<string, ZoneData>; away: Record<string, ZoneData> } {
  const init = (): Record<string, ZoneData> => {
    const z: Record<string, ZoneData> = {};
    ['1','2','3','4','5','6','7','8','9'].forEach(k => { z[k] = { total: 0, ace: 0, positive: 0, negative: 0, error: 0 }; });
    return z;
  };
  const r = { home: init(), away: init() };
  for (const s of ['1','2','3','4','5']) {
    const d = stats.sets[s];
    if (!d) continue;
    for (const t of ['home','away'] as const) {
      const src = t === 'home' ? d.homeZones : d.awayZones;
      for (const z of Object.keys(src)) {
        r[t][z].total    += src[z].total;
        r[t][z].ace      += src[z].ace;
        r[t][z].positive += src[z].positive;
        r[t][z].negative += src[z].negative;
        r[t][z].error    += src[z].error;
      }
    }
  }
  return r;
}

// ─── WAFFLE CHART ────────────────────────────────────────────────────────────
function WaffleChart({ data, cats, colors, label, labelColor }: {
  data: Record<string, number>; cats: string[]; colors: string[];
  label: string; labelColor: string;
}) {
  const total = cats.reduce((s, c) => s + (data[c] || 0), 0);
  if (total === 0) return <div style={{ width: 120, height: 120, background: '#0a1020', borderRadius: 6, opacity: .3 }} />;
  const cells: number[] = [];
  cats.forEach((c, i) => {
    const count = Math.round((data[c] || 0) / total * 100);
    for (let j = 0; j < count; j++) cells.push(i);
  });
  while (cells.length < 100) cells.push(cats.length - 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: labelColor, letterSpacing: '.1em', fontFamily: 'JetBrains Mono, monospace' }}>{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 11px)', gridTemplateRows: 'repeat(10, 11px)', gap: 1 }}>
          {cells.slice(0, 100).map((ci, idx) => (
            <div key={idx} style={{ width: 11, height: 11, borderRadius: 2, background: colors[ci] || '#1e293b' }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
          {cats.map((cat, i) => {
            const pct = total > 0 ? Math.round((data[cat] || 0) / total * 100) : 0;
            if (pct === 0) return null;
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[i], flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: colors[i], fontFamily: 'JetBrains Mono, monospace' }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── RADIAL BAR → Donut chart ────────────────────────────────────────────────
function RadialBar({ data, cats, colors, label, labelColor }: {
  data: Record<string, number>; cats: string[]; colors: string[];
  label: string; labelColor: string;
}) {
  const total = cats.reduce((s, c) => s + (data[c] || 0), 0);
  if (total === 0) return <div style={{ width: 140, height: 140, background: '#0a1020', borderRadius: '50%', opacity: .3 }} />;
  const cx = 70; const cy = 70; const r = 52; const strokeW = 16;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const slices = cats.map((cat, i) => {
    const pct = (data[cat] || 0) / total;
    const len = pct * circumference;
    const slice = { cat, color: colors[i], pct, len, offset };
    offset += len;
    return slice;
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: labelColor, letterSpacing: '.1em', fontFamily: 'JetBrains Mono, monospace' }}>{label}</span>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <svg width={140} height={140} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0f172a" strokeWidth={strokeW} />
          {slices.map(s => s.pct > 0 && (
            <circle key={s.cat} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color} strokeWidth={strokeW}
              strokeDasharray={`${s.len} ${circumference - s.len}`}
              strokeDashoffset={-s.offset}
              strokeLinecap="butt" />
          ))}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {slices.map(s => s.pct > 0 && (
            <div key={s.cat} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: s.color }}>{Math.round(s.pct * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TREEMAP → ATTACK COURT MAP ──────────────────────────────────────────────
//
//  Attack zones on attack court (from attacker's perspective):
//
//   Net ──────────────────────────
//   │  Left Side │ Middle │ Right │  front row (Z4/Z3/Z2)
//   │  Pipe/Back │        │ RS Bk │  back row  (Z5/Z6/Z1)
//   ──────────────────────────────
//
function Treemap({ data, cats, colors, label, labelColor }: {
  data: Record<string, number>; cats: string[]; colors: string[];
  label: string; labelColor: string;
}) {
  const total = cats.reduce((s, c) => s + (data[c] || 0), 0);
  if (total === 0) return <div style={{ width: '100%', height: 120, background: '#0a1020', borderRadius: 6, opacity: .3 }} />;

  // Map attack location names to court zones
  const ATTACK_ZONES: Record<string, { x: number; y: number; w: number; h: number; label: string }> = {
    'Left Side':        { x: 2,  y: 2,  w: 38, h: 96,  label: 'Left' },
    'Middle':           { x: 42, y: 2,  w: 36, h: 96,  label: 'Mid' },
    'Right Side':       { x: 80, y: 2,  w: 38, h: 48,  label: 'Right' },
    'Right Side Back':  { x: 80, y: 52, w: 38, h: 46,  label: 'RS Bk' },
    'Pipe':             { x: 2,  y: 52, w: 76, h: 46,  label: 'Pipe' },
  };

  const maxVal = Math.max(...cats.map(c => data[c] || 0), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: labelColor, letterSpacing: '.1em', fontFamily: 'JetBrains Mono, monospace' }}>{label}</span>
      <svg width={120} height={100} style={{ borderRadius: 6, overflow: 'visible' }}>
        {/* Court background */}
        <rect x={0} y={0} width={120} height={100} fill="#0a1628" rx={4} />
        {/* Net line */}
        <line x1={0} y1={2} x2={120} y2={2} stroke="#3b82f6" strokeWidth={2} />

        {cats.map((cat, i) => {
          const zone = ATTACK_ZONES[cat];
          if (!zone) return null;
          const val = data[cat] || 0;
          const pct = total > 0 ? Math.round(val / total * 100) : 0;
          if (pct === 0) return null;
          const intensity = val / maxVal;
          const color = colors[i] || '#64748b';
          return (
            <g key={cat}>
              <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx={3}
                fill={color} fillOpacity={0.15 + intensity * 0.55}
                stroke={color} strokeOpacity={0.4} strokeWidth={1} />
              <text x={zone.x + zone.w / 2} y={zone.y + zone.h / 2 - 6} textAnchor="middle"
                style={{ fontSize: 9, fill: '#fff', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                {zone.label}
              </text>
              <text x={zone.x + zone.w / 2} y={zone.y + zone.h / 2 + 8} textAnchor="middle"
                style={{ fontSize: 11, fill: '#fff', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>
                {pct}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── STACKED BAR ─────────────────────────────────────────────────────────────
function StackedBar({ homeData, awayData, cats, colors, homeLabel, awayLabel, homeColor, awayColor }: {
  homeData: Record<string, number>; awayData: Record<string, number>;
  cats: string[]; colors: string[];
  homeLabel: string; awayLabel: string; homeColor: string; awayColor: string;
}) {
  const hTotal = cats.reduce((s, c) => s + (homeData[c] || 0), 0);
  const aTotal = cats.reduce((s, c) => s + (awayData[c] || 0), 0);
  if (hTotal === 0 && aTotal === 0) return <div style={{ height: 60, background: '#0a1020', borderRadius: 6, opacity: .3 }} />;
  const Bar = ({ data, total, label, color }: { data: Record<string,number>; total: number; label: string; color: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.08em' }}>{label}</span>
      <div style={{ display: 'flex', height: 28, borderRadius: 4, overflow: 'hidden', width: '100%' }}>
        {total === 0 ? <div style={{ flex: 1, background: '#0f172a' }} /> :
          cats.map((cat, i) => {
            const pct = (data[cat] || 0) / total;
            if (pct === 0) return null;
            return <div key={cat} style={{ flex: pct, background: colors[i], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {pct >= 0.10 && <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>{Math.round(pct*100)}%</span>}
            </div>;
          })
        }
      </div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <Bar data={homeData} total={hTotal} label={homeLabel} color={homeColor} />
      <Bar data={awayData} total={aTotal} label={awayLabel} color={awayColor} />
    </div>
  );
}

// ─── LOLLIPOP ────────────────────────────────────────────────────────────────
function Lollipop({ homeData, awayData, cats, homeLabel, awayLabel, homeColor, awayColor }: {
  homeData: Record<string, number>; awayData: Record<string, number>;
  cats: string[]; homeLabel: string; awayLabel: string; homeColor: string; awayColor: string;
}) {
  const allVals = cats.flatMap(c => [homeData[c] || 0, awayData[c] || 0]);
  const maxVal = Math.max(...allVals, 1);
  const W = 200;
  return (
    <div style={{ width: '100%' }}>
      {cats.map((cat, i) => {
        const hv = homeData[cat] || 0;
        const av = awayData[cat] || 0;
        const hPct = hv / maxVal;
        const aPct = av / maxVal;
        return (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, marginBottom: 4 }}>{cat}</div>
            {/* Home */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: homeColor, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', width: 32 }}>{homeLabel}</span>
              <div style={{ flex: 1, position: 'relative', height: 16 }}>
                <div style={{ position: 'absolute', top: 7, left: 0, width: `${hPct * 100}%`, height: 2, background: `${homeColor}40`, borderRadius: 1 }} />
                <div style={{ position: 'absolute', top: 0, left: `calc(${hPct * 100}% - 8px)`, width: 16, height: 16, borderRadius: '50%', background: homeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#0a0e17', fontFamily: 'JetBrains Mono, monospace' }}>{hv}</span>
                </div>
              </div>
            </div>
            {/* Away */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: awayColor, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', width: 32 }}>{awayLabel}</span>
              <div style={{ flex: 1, position: 'relative', height: 16 }}>
                <div style={{ position: 'absolute', top: 7, left: 0, width: `${aPct * 100}%`, height: 2, background: `${awayColor}40`, borderRadius: 1 }} />
                <div style={{ position: 'absolute', top: 0, left: `calc(${aPct * 100}% - 8px)`, width: 16, height: 16, borderRadius: '50%', background: awayColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#0a0e17', fontFamily: 'JetBrains Mono, monospace' }}>{av}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
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

  // Split view state
  const [splitMode, setSplitMode]     = useState(false);
  const [panelATab, setPanelATab]     = useState<TabKey>('serve_type');
  const [panelBTab, setPanelBTab]     = useState<TabKey>('receive');

  // Cockpit Insights
  const [insights, setInsights]         = useState<Record<string, string>>({});
  const [insightLoading, setInsightLoading] = useState<Record<string, boolean>>({});

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
    const fileMeta = MATCH_META[matchFile];
    setStats(parseInstances(instances, hp, ap, currentSet, liveScoreHome, liveScoreAway, fileMeta?.homeName, fileMeta?.awayName));
  }, [rawInstances, currentSet, liveScoreHome, liveScoreAway]);

  const tab  = TABS[activeTab];
  const tabA = TABS[panelATab];
  const tabB = TABS[panelBTab];
  const SETS = ['1', '2', '3', '4', '5'];
  const allData  = stats ? mergeAll(stats, tab.key)  : null;
  const allDataA = stats ? mergeAll(stats, tabA.key) : null;
  const allDataB = stats ? mergeAll(stats, tabB.key) : null;
  const allZones = stats ? mergeZones(stats) : null;
  const maxZoneTotal = allZones
    ? Math.max(...Object.values(allZones.home).map(z => z.total), ...Object.values(allZones.away).map(z => z.total), 1)
    : 1;
  const meta = MATCH_META[matchFile];
  const isLive = currentSet < 99 && currentSet > 0;

  // ── COCKPIT INSIGHTS ─────────────────────────────────────────────────────
  // Rally count = home + away score in current set (refreshes every 15 points)
  const rallyCount = liveScoreHome + liveScoreAway;
  const refreshMilestone = Math.floor(rallyCount / 15);

  const fetchInsight = useCallback(async (tabKey: TabKey, data: { home: Record<string, number>; away: Record<string, number> } | null, force = false) => {
    if (!data || !stats) return;
    // Cache key includes refresh milestone — auto-refreshes every 15 rallies
    const cacheKey = `${matchFile}-${tabKey}-${refreshMilestone}`;
    if (!force && (insights[cacheKey] || insightLoading[cacheKey])) return;
    setInsightLoading(prev => ({ ...prev, [cacheKey]: true }));
    try {
      const res = await fetch('/api/cockpit-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabKey,
          homeTeam: stats.teamHome,
          awayTeam: stats.teamAway,
          homeData: data.home,
          awayData: data.away,
          language,
          rallyCount,
        }),
      });
      const d = await res.json();
      if (d.insight) setInsights(prev => ({ ...prev, [cacheKey]: d.insight }));
    } catch (e) {
      console.error('[INSIGHT]', e);
    } finally {
      setInsightLoading(prev => ({ ...prev, [cacheKey]: false }));
    }
  }, [stats, matchFile, language, insights, insightLoading, refreshMilestone, rallyCount]);

  // Auto-fetch insight when tab changes, data loads, or every 15 rallies
  useEffect(() => {
    if (allData && isLive) fetchInsight(activeTab, allData);
  }, [activeTab, allData, isLive, refreshMilestone]);

  // ── HELPER: render grid content for a given tab key ──────────────────────
  const renderPanelContent = (tabKey: TabKey, mergedData: { home: Record<string, number>; away: Record<string, number> } | null) => {
    const t = TABS[tabKey];
    const sHome = stats?.shortHome.substring(0, 5) || 'H';
    const sAway = stats?.shortAway.substring(0, 5) || 'A';

    // Serve zone — court heatmap (unchanged)
    if (tabKey === 'serve_zone' && allZones) {
      return (
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
            {SETS.map(s => {
              const d = stats?.sets[s]; const empty = !d;
              const isCurrent = Number(s) === currentSet && isLive;
              const setMax = d ? Math.max(...Object.values(d.homeZones).map(z => z.total), ...Object.values(d.awayZones).map(z => z.total), 1) : 1;
              return (
                <div key={s} style={{ background: '#0c1828', borderRadius: 10, border: `1px solid ${empty ? '#0f172a' : isCurrent ? 'rgba(59,130,246,.35)' : '#1e293b'}`, padding: '8px 4px', opacity: empty ? 0.2 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: isCurrent ? '#60a5fa' : '#64748b', textTransform: 'uppercase', letterSpacing: '.2em' }}>{(COCKPIT_I18N[language] || COCKPIT_I18N.pl).set} {s}{isCurrent ? ' ●' : ''}</div>
                  {!empty && d && <><CourtZoneMap zones={d.homeZones} teamColor="#60a5fa" teamLabel={sHome} maxTotal={setMax} /><CourtZoneMap zones={d.awayZones} teamColor="#fbbf24" teamLabel={sAway} maxTotal={setMax} /></>}
                  {empty && <div style={{ width: 200, height: 80, borderRadius: 5, background: '#0a1020', opacity: 0.3 }} />}
                </div>
              );
            })}
            <div style={{ background: '#0a1000', borderRadius: 10, border: '2px solid #1a2200', padding: '8px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '.12em' }}>{(COCKPIT_I18N[language] || COCKPIT_I18N.pl).match}</div>
              {stats && <><CourtZoneMap zones={allZones.home} teamColor="#60a5fa" teamLabel={sHome} maxTotal={maxZoneTotal} /><CourtZoneMap zones={allZones.away} teamColor="#fbbf24" teamLabel={sAway} maxTotal={maxZoneTotal} /></>}
            </div>
          </div>
        </div>
      );
    }

    // Determine chart type per tab
    const useWaffle     = tabKey === 'serve_type' || tabKey === 'receive';
    const useRadial     = tabKey === 'serve_grade';
    const useTreemap    = tabKey === 'attack_loc';
    const useStacked    = tabKey === 'attack_grade';
    const useLollipop   = tabKey === 'block' || tabKey === 'dig';

    return (
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          {SETS.map(s => {
            const d = stats?.sets[s]; const empty = !d;
            const isCurrent = Number(s) === currentSet && isLive;
            const hData = (!empty && d) ? (d.home as any)[t.key] || {} : {};
            const aData = (!empty && d) ? (d.away as any)[t.key] || {} : {};
            return (
              <div key={s} style={{ background: '#0c1828', borderRadius: 10, border: `1px solid ${empty ? '#0f172a' : isCurrent ? 'rgba(59,130,246,.35)' : '#1e293b'}`, padding: '10px 8px', opacity: empty ? 0.2 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.2em', color: isCurrent ? '#60a5fa' : '#64748b', textTransform: 'uppercase' }}>{(COCKPIT_I18N[language] || COCKPIT_I18N.pl).set} {s}{isCurrent ? ' ●' : ''}</div>
                  {!empty && d && <div style={{ marginTop: 3, fontSize: 15, fontWeight: 800 }}><span style={{ color: d.homeWon ? '#60a5fa' : '#64748b' }}>{d.scoreHome}</span><span style={{ color: '#1e293b', margin: '0 3px' }}>:</span><span style={{ color: !d.homeWon ? '#fbbf24' : '#64748b' }}>{d.scoreAway}</span></div>}
                </div>
                {empty && <div style={{ width: 120, height: 80, borderRadius: 6, background: '#111827', opacity: .1 }} />}
                {!empty && d && (
                  <>
                    {useWaffle  && <><WaffleChart data={hData} cats={t.cats} colors={t.colors} label={sHome} labelColor="#60a5fa" /><WaffleChart data={aData} cats={t.cats} colors={t.colors} label={sAway} labelColor="#fbbf24" /></>}
                    {useRadial  && <><RadialBar   data={hData} cats={t.cats} colors={t.colors} label={sHome} labelColor="#60a5fa" /><RadialBar   data={aData} cats={t.cats} colors={t.colors} label={sAway} labelColor="#fbbf24" /></>}
                    {useTreemap && <><Treemap data={hData} cats={t.cats} colors={t.colors} label={sHome} labelColor="#60a5fa" /><Treemap data={aData} cats={t.cats} colors={t.colors} label={sAway} labelColor="#fbbf24" /></>}
                    {useStacked && <StackedBar homeData={hData} awayData={aData} cats={t.cats} colors={t.colors} homeLabel={sHome} awayLabel={sAway} homeColor="#60a5fa" awayColor="#fbbf24" />}
                    {useLollipop && <Lollipop homeData={hData} awayData={aData} cats={t.cats} homeLabel={sHome} awayLabel={sAway} homeColor="#60a5fa" awayColor="#fbbf24" />}
                  </>
                )}
              </div>
            );
          })}
          {/* TOTAL column */}
          {mergedData && (
            <div style={{ background: '#0a1000', borderRadius: 10, border: '2px solid #1a2200', padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '.15em' }}>{(COCKPIT_I18N[language] || COCKPIT_I18N.pl).match}</div>
              {useWaffle  && <><WaffleChart data={mergedData.home} cats={t.cats} colors={t.colors} label={sHome} labelColor="#60a5fa" /><WaffleChart data={mergedData.away} cats={t.cats} colors={t.colors} label={sAway} labelColor="#fbbf24" /></>}
              {useRadial  && <><RadialBar   data={mergedData.home} cats={t.cats} colors={t.colors} label={sHome} labelColor="#60a5fa" /><RadialBar   data={mergedData.away} cats={t.cats} colors={t.colors} label={sAway} labelColor="#fbbf24" /></>}
              {useTreemap && <><Treemap data={mergedData.home} cats={t.cats} colors={t.colors} label={sHome} labelColor="#60a5fa" /><Treemap data={mergedData.away} cats={t.cats} colors={t.colors} label={sAway} labelColor="#fbbf24" /></>}
              {useStacked && <StackedBar homeData={mergedData.home} awayData={mergedData.away} cats={t.cats} colors={t.colors} homeLabel={sHome} awayLabel={sAway} homeColor="#60a5fa" awayColor="#fbbf24" />}
              {useLollipop && <Lollipop homeData={mergedData.home} awayData={mergedData.away} cats={t.cats} homeLabel={sHome} awayLabel={sAway} homeColor="#60a5fa" awayColor="#fbbf24" />}
            </div>
          )}
        </div>
        {/* Legend */}
        {t.cats.length > 0 && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#0c1422', borderRadius: 8, border: '1px solid #1e293b', display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em', marginRight: 3 }}>{(TAB_I18N[language] || TAB_I18N.pl)[tabKey]}</span>
            <div style={{ width: 1, height: 14, background: '#1e293b' }} />
            {t.cats.map((c, i) => {
              const tH = t.cats.reduce((s, cc) => s + (mergedData?.home?.[cc] || 0), 0);
              const tA = t.cats.reduce((s, cc) => s + (mergedData?.away?.[cc] || 0), 0);
              const pH = tH > 0 ? Math.round(((mergedData?.home?.[c] || 0) / tH) * 100) : 0;
              const pA = tA > 0 ? Math.round(((mergedData?.away?.[c] || 0) / tA) * 100) : 0;
              return (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,.03)', borderRadius: 4, padding: '2px 7px' }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: t.colors[i], flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#cbd5e1' }}>{c}</span>
                  <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>{pH}%</span>
                  <span style={{ fontSize: 9, color: '#334155' }}>/</span>
                  <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700 }}>{pA}%</span>
                </div>
              );
            })}
          </div>
        )}
        {/* ── INSIGHTS PANEL ── */}
        {tabKey !== 'serve_zone_disabled' && (
          <div style={{ marginTop: 10, padding: '12px 16px', background: 'rgba(6,78,59,.1)', borderRadius: 8, border: '1px solid rgba(16,185,129,.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '.15em' }}>⚡ Insights</span>
              {insightLoading[`${matchFile}-${tabKey}`] && (
                <span style={{ fontSize: 8, color: '#34d399', animation: 'pulse 1.5s infinite' }}>Analizuję...</span>
              )}
              {(() => {
                const cKey = `${matchFile}-${tabKey}-${refreshMilestone}`;
                const hasInsight = insights[cKey];
                const isLoading = insightLoading[cKey];
                return !hasInsight && !isLoading && isLive ? (
                  <button onClick={() => fetchInsight(tabKey, mergedData, true)}
                    style={{ fontSize: 8, padding: '2px 8px', borderRadius: 4, background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.3)', color: '#34d399', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                    ↻ Generuj
                  </button>
                ) : null;
              })()}
            </div>
            {(() => {
              const cKey = `${matchFile}-${tabKey}-${refreshMilestone}`;
              const txt = insights[cKey];
              const loading = insightLoading[cKey];
              return txt ? (
              <p style={{ fontSize: 13, color: '#a7f3d0', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {txt}
              </p>
              ) : !loading ? (
              <p style={{ fontSize: 11, color: '#065f46', margin: 0, fontStyle: 'italic' }}>
                {isLive ? 'Kliknij "↻ Generuj" aby uzyskać interpretację' : 'Uruchom komentarz aby aktywować Insights'}
              </p>
            ) : null; })()}
          </div>
        )}
      </div>
    );
  };

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
          {/* Split view toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#0a1120', borderRadius: 6, padding: '2px', border: '1px solid #1e293b' }}>
            <button onClick={() => setSplitMode(false)}
              style={{ padding: '3px 10px', borderRadius: 5, fontSize: 9, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.06em',
                background: !splitMode ? 'rgba(59,130,246,.2)' : 'transparent',
                color: !splitMode ? '#93c5fd' : '#475569',
                outline: !splitMode ? '1px solid rgba(59,130,246,.3)' : 'none' }}>
              ▣ Jeden
            </button>
            <button onClick={() => setSplitMode(true)}
              style={{ padding: '3px 10px', borderRadius: 5, fontSize: 9, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.06em',
                background: splitMode ? 'rgba(16,185,129,.15)' : 'transparent',
                color: splitMode ? '#34d399' : '#475569',
                outline: splitMode ? '1px solid rgba(16,185,129,.3)' : 'none' }}>
              ⊞ Podzielony
            </button>
          </div>
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

      {stats && !loading && isLive && !splitMode && (
        <>
          {/* Single mode tab bar */}
          <div style={{ background: '#0a1120', borderBottom: '1px solid #0f172a', padding: '0 16px', display: 'flex', gap: 4, overflowX: 'auto' }}>
            {TAB_ORDER.map(t => {
              const isActive = activeTab === t;
              return (
                <button key={t} onClick={() => setActiveTab(t)} style={{
                  padding: '8px 14px', borderRadius: 0, fontSize: 10, fontWeight: 800, letterSpacing: '.07em',
                  cursor: 'pointer', border: 'none', textTransform: 'uppercase', fontFamily: 'inherit',
                  borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  color: isActive ? '#93c5fd' : '#64748b',
                  background: isActive ? 'rgba(59,130,246,.05)' : 'transparent',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {(TAB_I18N[language] || TAB_I18N.pl)[t]}
                </button>
              );
            })}
          </div>
          {renderPanelContent(activeTab, allData)}
        </>
      )}

      {stats && !loading && isLive && splitMode && (
        <>
          {/* Split mode — dwa panele GÓRA-DÓŁ */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>

            {/* Panel A — górny */}
            <div style={{ borderBottom: '3px solid #0f172a' }}>
              <div style={{ background: '#080e1a', borderBottom: '1px solid #0f172a', padding: '0 16px', display: 'flex', gap: 2, overflowX: 'auto', flexShrink: 0, alignItems: 'center' }}>
                <span style={{ fontSize: 8, fontWeight: 800, color: '#3b82f6', letterSpacing: '.15em', marginRight: 6, flexShrink: 0 }}>▲ GÓRA</span>
                {TAB_ORDER.map(t => (
                  <button key={t} onClick={() => setPanelATab(t)} style={{
                    padding: '6px 12px', borderRadius: 0, fontSize: 9, fontWeight: 800, letterSpacing: '.07em',
                    cursor: 'pointer', border: 'none', textTransform: 'uppercase', fontFamily: 'inherit',
                    borderBottom: panelATab === t ? '2px solid #3b82f6' : '2px solid transparent',
                    color: panelATab === t ? '#93c5fd' : '#475569',
                    background: panelATab === t ? 'rgba(59,130,246,.05)' : 'transparent',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {(TAB_I18N[language] || TAB_I18N.pl)[t]}
                  </button>
                ))}
              </div>
              {renderPanelContent(panelATab, allDataA)}
            </div>

            {/* Panel B — dolny */}
            <div>
              <div style={{ background: '#080e1a', borderBottom: '1px solid #0f172a', padding: '0 16px', display: 'flex', gap: 2, overflowX: 'auto', flexShrink: 0, alignItems: 'center' }}>
                <span style={{ fontSize: 8, fontWeight: 800, color: '#f59e0b', letterSpacing: '.15em', marginRight: 6, flexShrink: 0 }}>▼ DÓŁ</span>
                {TAB_ORDER.map(t => (
                  <button key={t} onClick={() => setPanelBTab(t)} style={{
                    padding: '6px 12px', borderRadius: 0, fontSize: 9, fontWeight: 800, letterSpacing: '.07em',
                    cursor: 'pointer', border: 'none', textTransform: 'uppercase', fontFamily: 'inherit',
                    borderBottom: panelBTab === t ? '2px solid #f59e0b' : '2px solid transparent',
                    color: panelBTab === t ? '#fbbf24' : '#475569',
                    background: panelBTab === t ? 'rgba(245,158,11,.05)' : 'transparent',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {(TAB_I18N[language] || TAB_I18N.pl)[t]}
                  </button>
                ))}
              </div>
              {renderPanelContent(panelBTab, allDataB)}
            </div>
          </div>
          {/* Info bar */}
          <div style={{ padding: '6px 16px', background: '#0a1120', borderTop: '1px solid #0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 9, color: '#34d399', fontWeight: 700 }}>⊞ SPLIT</span>
            <span style={{ fontSize: 9, color: '#334155' }}>|</span>
            <span style={{ fontSize: 9, color: '#475569' }}>
              <span style={{ color: '#60a5fa' }}>▲ {(TAB_I18N[language] || TAB_I18N.pl)[panelATab]}</span>
              <span style={{ color: '#334155' }}> + </span>
              <span style={{ color: '#fbbf24' }}>▼ {(TAB_I18N[language] || TAB_I18N.pl)[panelBTab]}</span>
            </span>
            <span style={{ fontSize: 9, color: '#334155' }}>|</span>
            <span style={{ fontSize: 9, color: '#475569' }}>Set {currentSet} · {liveScoreHome}:{liveScoreAway}</span>
          </div>
        </>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>
    </div>
  );
}
