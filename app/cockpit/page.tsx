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
}

const TABS: Record<TabKey, TabConfig> = {
  serve_type:   { label: 'Zagrywka · Typ',         key: 'serve_types',  cats: ['Jump Spin','Jump Float','Hydrid Jump','Other'],                          colors: ['#2563eb','#60a5fa','#93c5fd','#334155'],             unit: 'zagrywek' },
  serve_grade:  { label: 'Zagrywka · Skuteczność', key: 'serve_grades', cats: ['Perfect','Positive','Average','Poor','Fail'],                            colors: ['#16a34a','#4ade80','#3b82f6','#f59e0b','#dc2626'],   unit: 'zagrywek' },
  attack_loc:   { label: 'Atak · Kierunki',        key: 'atk_loc',      cats: ['Left Side','Right Side','Middle','Pipe','Right Side Back'],              colors: ['#1d4ed8','#3b82f6','#60a5fa','#34d399','#93c5fd'],   unit: 'ataków'   },
  attack_grade: { label: 'Atak · Jakość',          key: 'atk_grades',   cats: ['Perfect','Positive','Average','Poor','Fail','Incomplete'],               colors: ['#16a34a','#4ade80','#3b82f6','#f59e0b','#dc2626','#475569'], unit: 'ataków' },
  receive:      { label: 'Przyjęcie',              key: 'rec_grades',   cats: ['Perfect','Positive','Average','Poor','Fail','Incomplete'],               colors: ['#16a34a','#4ade80','#3b82f6','#f59e0b','#dc2626','#475569'], unit: 'przyjęć' },
  block:        { label: 'Blok',                   key: 'blk_grades',   cats: ['Perfect','Positive','Average','Fail'],                                   colors: ['#16a34a','#4ade80','#3b82f6','#dc2626'],             unit: 'bloków'   },
  dig:          { label: 'Obrona (Dig)',            key: 'dig_grades',   cats: ['Perfect','Positive','Average','Fail'],                                   colors: ['#16a34a','#4ade80','#3b82f6','#dc2626'],             unit: 'obron'    },
};

const TAB_ORDER: TabKey[] = ['serve_type','serve_grade','attack_loc','attack_grade','receive','block','dig'];

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: labelColor, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
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
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', lineHeight: 1, fontFamily: 'JetBrains Mono, monospace' }}>
            {total}
          </div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 2, letterSpacing: '.05em' }}>{unit}</div>
        </div>
      </div>
    </div>
  );
}

// ─── PARSE ───────────────────────────────────────────────────────────────────

function parseInstances(instances: Instance[], hp: string, ap: string): MatchStats {
  const SETS = ['1','2','3','4','5'];
  const setStats: Record<string, SetStats | null> = {};
  let matchHome = 0, matchAway = 0;

  // Detect full team names
  const teamHomeFull = instances.find(i => i.code.startsWith(hp + ' '))?.labels['Team Name'] as string || hp;
  const teamAwayFull = instances.find(i => i.code.startsWith(ap + ' '))?.labels['Team Name'] as string || ap;
  const shortName = (s: string) => s.split(' ')[0];

  for (const s of SETS) {
    const si = instances.filter(i => String(i.labels?.Set) === s);
    if (!si.length) { setStats[s] = null; continue; }

    const home: Record<string, Record<string, number>> = {
      serve_types: {}, serve_grades: {}, atk_loc: {}, atk_grades: {}, rec_grades: {}, blk_grades: {}, dig_grades: {},
    };
    const away: Record<string, Record<string, number>> = {
      serve_types: {}, serve_grades: {}, atk_loc: {}, atk_grades: {}, rec_grades: {}, blk_grades: {}, dig_grades: {},
    };

    const inc = (obj: Record<string, number>, k: string) => { obj[k] = (obj[k] || 0) + 1; };

    let homeServes = 0, awayServes = 0;

    for (const inst of si) {
      const isH = inst.code.startsWith(hp + ' ');
      const isA = inst.code.startsWith(ap + ' ');
      if (!isH && !isA) continue;

      const t = isH ? home : away;
      const action = inst.code.slice((isH ? hp : ap).length + 1);
      const lbl = inst.labels;

      if (action === 'Serve') {
        if (isH) homeServes++; else awayServes++;
        if (lbl['Serve Type']) inc(t.serve_types, lbl['Serve Type'] as string);
        if (lbl['Serve Grade']) inc(t.serve_grades, lbl['Serve Grade'] as string);
      } else if (action === 'Attack') {
        if (lbl['Attack Location']) inc(t.atk_loc, lbl['Attack Location'] as string);
        if (lbl['Attack Grade']) inc(t.atk_grades, lbl['Attack Grade'] as string);
      } else if (action === 'Receive') {
        if (lbl['Receive Grade']) inc(t.rec_grades, lbl['Receive Grade'] as string);
      } else if (action === 'Block') {
        if (lbl['Block Grade']) inc(t.blk_grades, lbl['Block Grade'] as string);
      } else if (action === 'Dig') {
        if (lbl['Dig Grade']) inc(t.dig_grades, lbl['Dig Grade'] as string);
      }
    }

    // Score ≈ serve count + 1 for winner (last point doesn't require a serve)
    const homeWon = homeServes >= awayServes;
    const scoreHome = homeWon ? homeServes + 1 : homeServes;
    const scoreAway = homeWon ? awayServes : awayServes + 1;

    if (homeWon) matchHome++; else matchAway++;

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
  for (const s of ['1','2','3','4','5']) {
    const d = stats.sets[s];
    if (!d) continue;
    for (const t of ['home','away'] as const) {
      const src = (d[t] as any)[key] || {};
      for (const [k, v] of Object.entries(src)) r[t][k] = (r[t][k] || 0) + (v as number);
    }
  }
  return r;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

export default function CockpitPage() {
  const [matchFile, setMatchFile] = useState('2025-11-12_ZAW-LBN.json');
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('serve_type');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── Sync z LiveMatchCommentary przez localStorage ──
  useEffect(() => {
    const stored = localStorage.getItem('vi_selected_match');
    if (stored && MATCH_META[stored]) setMatchFile(stored);

    // Nasłuchuj zmian gdy użytkownik zmieni mecz w LiveMatchCommentary
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'vi_selected_match' && e.newValue && MATCH_META[e.newValue]) {
        setMatchFile(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);

    // Polling co 3s jako fallback (storage event nie działa w tym samym oknie)
    const poll = setInterval(() => {
      const current = localStorage.getItem('vi_selected_match');
      if (current && MATCH_META[current]) setMatchFile(prev => current !== prev ? current : prev);
    }, 3000);

    return () => { window.removeEventListener('storage', onStorage); clearInterval(poll); };
  }, []);

  const load = useCallback(async (file: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/data/matches/rallies/${file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      if (!raw.instances) throw new Error('Brak instances');
      const meta = MATCH_META[file];
      setStats(parseInstances(raw.instances, meta.homePrefix, meta.awayPrefix));
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(matchFile); }, [matchFile, load]);

  // Auto-refresh co 30s
  useEffect(() => {
    const iv = setInterval(() => load(matchFile), 30000);
    return () => clearInterval(iv);
  }, [matchFile, load]);

  const tab = TABS[activeTab];
  const SETS = ['1','2','3','4','5'];
  const allData = stats ? mergeAll(stats, tab.key) : null;
  const meta = MATCH_META[matchFile];

  return (
    <div style={{ minHeight: '100vh', background: '#060c18', color: '#cbd5e1', fontFamily: 'JetBrains Mono, monospace' }}>

      {/* ── HEADER ── */}
      <div style={{ background: '#0c1422', borderBottom: '1px solid #1e293b', padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#475569', letterSpacing: '-.3px' }}>⚡ VolleyInsight</span>
          <div style={{ width: 1, height: 18, background: '#1e293b' }} />
          <span style={{ fontSize: 10, color: '#1e3a5f', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.15em' }}>Match KPIs</span>
          <div style={{ width: 1, height: 18, background: '#1e293b' }} />
          {/* Match label - tylko read-only, sync z LiveMatchCommentary */}
          <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: '.02em' }}>
            {meta.label}
          </span>
          <span style={{ fontSize: 9, color: '#334155', fontStyle: 'italic' }}>
            (sync z LiveMatchCommentary)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 9, color: '#334155' }}>
              ↻ {lastUpdated.toLocaleTimeString('pl-PL')}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 9, color: '#f87171', fontWeight: 800, letterSpacing: '.12em' }}>LIVE</span>
          </div>
          <a href="/" style={{ fontSize: 10, color: '#475569', textDecoration: 'none', padding: '4px 10px', border: '1px solid #1e293b', borderRadius: 5, fontWeight: 600 }}>
            ← Komentarz
          </a>
        </div>
      </div>

      {/* ── TEAMS BAR ── */}
      {stats && (
        <div style={{ background: '#0a1120', borderBottom: '1px solid #0f172a', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 6px #3b82f6' }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', letterSpacing: '.04em' }}>{stats.shortHome}</span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>vs</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fbbf24', letterSpacing: '.04em' }}>{stats.shortAway}</span>
            </div>
            <div style={{ width: 1, height: 20, background: '#1e293b', margin: '0 4px' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
              <span style={{ color: stats.matchScore.home >= stats.matchScore.away ? '#60a5fa' : '#334155' }}>{stats.matchScore.home}</span>
              <span style={{ color: '#1e293b', margin: '0 4px' }}>:</span>
              <span style={{ color: stats.matchScore.away > stats.matchScore.home ? '#fbbf24' : '#334155' }}>{stats.matchScore.away}</span>
            </span>
          </div>

          {/* ── TABS — duże i czytelne ── */}
          <div style={{ display: 'flex', gap: 5 }}>
            {TAB_ORDER.map(t => {
              const isActive = activeTab === t;
              return (
                <button key={t} onClick={() => setActiveTab(t)} style={{
                  padding: '8px 16px',
                  borderRadius: 7,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '.08em',
                  cursor: 'pointer',
                  border: 'none',
                  textTransform: 'uppercase',
                  transition: 'all .15s',
                  background: isActive ? '#1d4ed8' : '#111827',
                  color: isActive ? '#ffffff' : '#4b5563',
                  boxShadow: isActive ? '0 0 12px rgba(29,78,216,.5)' : 'none',
                  transform: isActive ? 'translateY(-1px)' : 'none',
                }}>
                  {TABS[t].label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LOADING ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 80, color: '#334155', fontSize: 12 }}>
          Ładowanie danych meczu...
        </div>
      )}

      {/* ── 6-COLUMN GRID ── */}
      {stats && !loading && (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>

            {/* SET COLUMNS */}
            {SETS.map(s => {
              const d = stats.sets[s];
              const empty = !d;

              return (
                <div key={s} style={{
                  background: empty ? '#080d18' : '#0c1828',
                  borderRadius: 14,
                  border: `1px solid ${empty ? '#0f172a' : '#1e293b'}`,
                  padding: '16px 10px',
                  opacity: empty ? 0.25 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                }}>
                  {/* Set header */}
                  <div style={{ textAlign: 'center', width: '100%' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.25em', color: '#334155', textTransform: 'uppercase' }}>
                      SET {s}
                    </div>
                    {!empty && d && (
                      <div style={{ marginTop: 5, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>
                        <span style={{ color: d.homeWon ? '#60a5fa' : '#374151' }}>{d.scoreHome}</span>
                        <span style={{ color: '#1e293b', margin: '0 5px' }}>:</span>
                        <span style={{ color: !d.homeWon ? '#fbbf24' : '#374151' }}>{d.scoreAway}</span>
                      </div>
                    )}
                  </div>

                  {/* Donuts */}
                  {empty && (
                    <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#111827', opacity: .15 }} />
                  )}
                  {!empty && d && (
                    <SvgDonut
                      data={(d.home as any)[tab.key] || {}}
                      cats={tab.cats} colors={tab.colors}
                      size={120} thickness={22}
                      label={stats.shortHome.substring(0, 6)}
                      labelColor="#60a5fa"
                      unit={tab.unit}
                    />
                  )}
                  {!empty && d && (
                    <SvgDonut
                      data={(d.away as any)[tab.key] || {}}
                      cats={tab.cats} colors={tab.colors}
                      size={120} thickness={22}
                      label={stats.shortAway.substring(0, 6)}
                      labelColor="#fbbf24"
                      unit={tab.unit}
                    />
                  )}
                </div>
              );
            })}

            {/* TOTAL COLUMN */}
            {allData && (
              <div style={{
                background: '#0c1000',
                borderRadius: 14,
                border: '2px solid #1a2200',
                padding: '16px 10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.2em', color: '#fbbf24', textTransform: 'uppercase' }}>
                    MECZ
                  </div>
                  <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>
                    <span style={{ color: stats.matchScore.home >= stats.matchScore.away ? '#60a5fa' : '#374151' }}>{stats.matchScore.home}</span>
                    <span style={{ color: '#2a1f00', margin: '0 4px' }}>:</span>
                    <span style={{ color: stats.matchScore.away > stats.matchScore.home ? '#fbbf24' : '#374151' }}>{stats.matchScore.away}</span>
                  </div>
                </div>
                <SvgDonut
                  data={allData.home}
                  cats={tab.cats} colors={tab.colors}
                  size={120} thickness={22}
                  label={stats.shortHome.substring(0, 6)}
                  labelColor="#60a5fa"
                  unit={tab.unit}
                />
                <SvgDonut
                  data={allData.away}
                  cats={tab.cats} colors={tab.colors}
                  size={120} thickness={22}
                  label={stats.shortAway.substring(0, 6)}
                  labelColor="#fbbf24"
                  unit={tab.unit}
                />
              </div>
            )}
          </div>

          {/* ── LEGENDA — duże i czytelne ── */}
          <div style={{
            marginTop: 20,
            padding: '14px 20px',
            background: '#0c1422',
            borderRadius: 10,
            border: '1px solid #1e293b',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '.15em', marginRight: 4 }}>
              {tab.label}
            </span>
            <div style={{ width: 1, height: 18, background: '#1e293b' }} />
            {tab.cats.map((c, i) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: tab.colors[i], flexShrink: 0, boxShadow: `0 0 6px ${tab.colors[i]}40` }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>
    </div>
  );
}