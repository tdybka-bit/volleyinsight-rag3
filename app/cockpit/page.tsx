'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Instance {
  id: number;
  code: string;
  labels: Record<string, string | number>;
}

interface RawMatch {
  instances: Instance[];
  teams?: { home?: string; away?: string; homeFullName?: string; awayFullName?: string };
  sets?: Record<string, { home: number; away: number }>;
}

interface SetStats {
  home: Record<string, number>;
  away: Record<string, number>;
}

interface MatchStats {
  sets: Record<string, SetStats | null>;
  teams: { home: string; away: string };
  setScores: Record<string, { home: number; away: number }>;
}

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const MATCHES = [
  { file: '2025-11-12_ZAW-LBN.json', label: 'Aluron Zawiercie vs Bogdanka Lublin (12.11)' },
  { file: '2025-11-26_PGE-Ind.json',  label: 'PGE Projekt Warszawa vs Indykpol AZS Olsztyn (26.11)' },
  { file: '2025-12-06_JSW-Ass.json',  label: 'Jastrzębski Węgiel vs Asseco Resovia Rzeszów (06.12)' },
];

const TEAM_PREFIXES: Record<string, string[]> = {
  '2025-11-12_ZAW-LBN.json': ['ZAW', 'LBN'],
  '2025-11-26_PGE-Ind.json': ['PGE', 'IND'],
  '2025-12-06_JSW-Ass.json': ['JSW', 'ASS'],
};

const TEAM_NAMES: Record<string, string[]> = {
  '2025-11-12_ZAW-LBN.json': ['Zawiercie', 'Lublin'],
  '2025-11-26_PGE-Ind.json': ['Projekt', 'Olsztyn'],
  '2025-12-06_JSW-Ass.json': ['Jastrzębski', 'Asseco'],
};

type TabKey = 'serve_type' | 'serve_grade' | 'attack_loc' | 'attack_grade' | 'receive' | 'block' | 'dig';

interface TabConfig {
  label: string;
  key: string;
  cats: string[];
  colors: string[];
  unit: string;
}

const TABS: Record<TabKey, TabConfig> = {
  serve_type: {
    label: 'Zagrywka · typ',
    key: 'serve_types',
    cats: ['Jump Spin', 'Jump Float', 'Hydrid Jump', 'Other'],
    colors: ['#2563eb', '#3b82f6', '#93c5fd', '#1e3a5f'],
    unit: 'zagrywek',
  },
  serve_grade: {
    label: 'Zagrywka · skuteczność',
    key: 'serve_grades',
    cats: ['Perfect', 'Positive', 'Average', 'Poor', 'Fail'],
    colors: ['#16a34a', '#4ade80', '#3b82f6', '#f59e0b', '#dc2626'],
    unit: 'zagrywek',
  },
  attack_loc: {
    label: 'Atak · kierunki',
    key: 'atk_loc',
    cats: ['Left Side', 'Right Side', 'Middle', 'Pipe', 'Right Side Back'],
    colors: ['#1d4ed8', '#3b82f6', '#60a5fa', '#34d399', '#93c5fd'],
    unit: 'ataków',
  },
  attack_grade: {
    label: 'Atak · jakość',
    key: 'atk_grades',
    cats: ['Perfect', 'Positive', 'Average', 'Poor', 'Fail', 'Incomplete'],
    colors: ['#16a34a', '#4ade80', '#3b82f6', '#f59e0b', '#dc2626', '#475569'],
    unit: 'ataków',
  },
  receive: {
    label: 'Przyjęcie',
    key: 'rec_grades',
    cats: ['Perfect', 'Positive', 'Average', 'Poor', 'Fail', 'Incomplete'],
    colors: ['#16a34a', '#4ade80', '#3b82f6', '#f59e0b', '#dc2626', '#475569'],
    unit: 'przyjęć',
  },
  block: {
    label: 'Blok',
    key: 'blk_grades',
    cats: ['Perfect', 'Positive', 'Average', 'Fail', 'Incomplete'],
    colors: ['#16a34a', '#4ade80', '#3b82f6', '#dc2626', '#475569'],
    unit: 'bloków',
  },
  dig: {
    label: 'Obrona',
    key: 'dig_grades',
    cats: ['Perfect', 'Positive', 'Average', 'Fail', 'Incomplete'],
    colors: ['#16a34a', '#4ade80', '#3b82f6', '#dc2626', '#475569'],
    unit: 'obron',
  },
};

const TAB_ORDER: TabKey[] = ['serve_type', 'serve_grade', 'attack_loc', 'attack_grade', 'receive', 'block', 'dig'];

// ─── SVG DONUT ────────────────────────────────────────────────────────────────

function SvgDonut({
  data,
  cats,
  colors,
  size = 80,
  thickness = 12,
  label,
  unit,
}: {
  data: Record<string, number>;
  cats: string[];
  colors: string[];
  size?: number;
  thickness?: number;
  label: string;
  unit: string;
}) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = cats.reduce((s, c) => s + (data[c] || 0), 0);

  const segments: { offset: number; dash: number; color: string; cat: string; val: number }[] = [];
  let cumulative = 0;
  for (let i = 0; i < cats.length; i++) {
    const val = data[cats[i]] || 0;
    if (val === 0) continue;
    const pct = val / (total || 1);
    const dash = pct * circ;
    const offset = circ - cumulative * circ;
    segments.push({ offset, dash, color: colors[i], cat: cats[i], val });
    cumulative += pct;
  }

  const isHome = label === 'ZAW' || label.length <= 4;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '.1em',
        color: isHome ? '#60a5fa' : '#fbbf24',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {label}
      </span>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* background ring */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="#1e293b"
            strokeWidth={thickness}
          />
          {/* segments */}
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={thickness} />
          ) : (
            segments.map((seg, i) => (
              <circle
                key={i}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={`${seg.dash} ${circ - seg.dash}`}
                strokeDashoffset={seg.offset}
                style={{ transition: 'stroke-dasharray .5s ease' }}
              >
                <title>{seg.cat}: {seg.val} ({total ? Math.round(seg.val / total * 100) : 0}%)</title>
              </circle>
            ))
          )}
        </svg>
        {/* center text */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>
            {total}
          </div>
          <div style={{ fontSize: 7, color: '#475569', marginTop: 1 }}>{unit}</div>
        </div>
      </div>
    </div>
  );
}

// ─── PARSE INSTANCES → STATS ──────────────────────────────────────────────────

function parseInstances(instances: Instance[], homePrefix: string, awayPrefix: string): MatchStats {
  const SETS = ['1', '2', '3', '4', '5'];
  const setStats: Record<string, SetStats | null> = {};
  const setScores: Record<string, { home: number; away: number }> = {};

  // Detect teams from labels
  const homeTeam = instances.find(i => i.code.startsWith(homePrefix + ' '))?.labels['Team Name'] as string || homePrefix;
  const awayTeam = instances.find(i => i.code.startsWith(awayPrefix + ' '))?.labels['Team Name'] as string || awayPrefix;

  for (const s of SETS) {
    const si = instances.filter(i => String(i.labels?.Set) === s);
    if (si.length === 0) { setStats[s] = null; continue; }

    const home: Record<string, number> = {};
    const away: Record<string, number> = {};

    const inc = (obj: Record<string, number>, key: string) => { obj[key] = (obj[key] || 0) + 1; };

    for (const inst of si) {
      const isHome = inst.code.startsWith(homePrefix + ' ');
      const isAway = inst.code.startsWith(awayPrefix + ' ');
      if (!isHome && !isAway) continue;

      const t = isHome ? home : away;
      const lbl = inst.labels;
      const action = inst.code.replace(homePrefix + ' ', '').replace(awayPrefix + ' ', '');

      if (action === 'Serve') {
        const st = lbl['Serve Type'] as string;
        if (st) inc(t, 'serve_types:' + st);
        const sg = lbl['Serve Grade'] as string;
        if (sg) inc(t, 'serve_grades:' + sg);
      } else if (action === 'Attack') {
        const al = lbl['Attack Location'] as string;
        if (al) inc(t, 'atk_loc:' + al);
        const ag = lbl['Attack Grade'] as string;
        if (ag) inc(t, 'atk_grades:' + ag);
      } else if (action === 'Receive') {
        const rg = lbl['Receive Grade'] as string;
        if (rg) inc(t, 'rec_grades:' + rg);
      } else if (action === 'Block') {
        const bg = lbl['Block Grade'] as string;
        if (bg) inc(t, 'blk_grades:' + bg);
      } else if (action === 'Dig') {
        const dg = lbl['Dig Grade'] as string;
        if (dg) inc(t, 'dig_grades:' + dg);
      }

      // Detect set score from last Rally in set
      if (inst.code === 'Rally' && lbl['Game Score']) {
        const score = String(lbl['Game Score']).split('-');
        if (score.length === 2) {
          setScores[s] = { home: parseInt(score[0]) || 0, away: parseInt(score[1]) || 0 };
        }
      }
    }

    // Convert flat keys to nested
    const expand = (flat: Record<string, number>) => {
      const out: Record<string, Record<string, number>> = {};
      for (const [k, v] of Object.entries(flat)) {
        const [ns, key] = k.split(':');
        if (!out[ns]) out[ns] = {};
        out[ns][key] = v;
      }
      return out;
    };

    const he = expand(home);
    const ae = expand(away);

    setStats[s] = {
      home: {
        serve_types: he.serve_types || {},
        serve_grades: he.serve_grades || {},
        atk_loc: he.atk_loc || {},
        atk_grades: he.atk_grades || {},
        rec_grades: he.rec_grades || {},
        blk_grades: he.blk_grades || {},
        dig_grades: he.dig_grades || {},
      } as Record<string, number>,
      away: {
        serve_types: ae.serve_types || {},
        serve_grades: ae.serve_grades || {},
        atk_loc: ae.atk_loc || {},
        atk_grades: ae.atk_grades || {},
        rec_grades: ae.rec_grades || {},
        blk_grades: ae.blk_grades || {},
        dig_grades: ae.dig_grades || {},
      } as Record<string, number>,
    };
  }

  return { sets: setStats, teams: { home: homeTeam, away: awayTeam }, setScores };
}

function mergeAll(stats: MatchStats, key: string): SetStats {
  const r: SetStats = { home: {}, away: {} };
  for (const s of ['1', '2', '3', '4', '5']) {
    const d = stats.sets[s];
    if (!d) continue;
    for (const t of ['home', 'away'] as const) {
      const src = (d[t] as any)[key] || {};
      for (const [k, v] of Object.entries(src)) {
        r[t][k] = ((r[t][k] as number) || 0) + (v as number);
      }
    }
  }
  return r;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function CockpitPage() {
  const [selectedMatch, setSelectedMatch] = useState(MATCHES[0].file);
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('serve_type');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (file: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/data/matches/rallies/${file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: RawMatch = await res.json();
      if (!raw.instances) throw new Error('Brak danych instances');
      const prefixes = TEAM_PREFIXES[file] || ['HOME', 'AWAY'];
      setStats(parseInstances(raw.instances, prefixes[0], prefixes[1]));
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(selectedMatch); }, [selectedMatch, load]);

  // Auto-refresh co 30s (live update)
  useEffect(() => {
    const interval = setInterval(() => load(selectedMatch), 30000);
    return () => clearInterval(interval);
  }, [selectedMatch, load]);

  const tab = TABS[activeTab];
  const SETS = ['1', '2', '3', '4', '5'];
  const teamNames = TEAM_NAMES[selectedMatch] || ['Home', 'Away'];

  const getSetData = (s: string): Record<string, number> | null => {
    const d = stats?.sets[s];
    if (!d) return null;
    return (d as any);
  };

  const allData = stats ? mergeAll(stats, tab.key) : null;

  const SET_HEADERS = (s: string) => {
    const score = stats?.setScores[s];
    const label = `Set ${s}`;
    if (!score) return { label, scoreHome: null, scoreAway: null, winner: null };
    const winner = score.home > score.away ? 'home' : 'away';
    return { label, scoreHome: score.home, scoreAway: score.away, winner };
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080e1a',
      color: '#cbd5e1',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    }}>

      {/* ── HEADER ── */}
      <div style={{
        background: '#0e1520',
        borderBottom: '1px solid #1e293b',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#475569', letterSpacing: '-.3px' }}>
            ⚡ VolleyInsight
          </span>
          <div style={{ width: 1, height: 16, background: '#1e293b' }} />
          <span style={{ fontSize: 9, color: '#374151', textTransform: 'uppercase', letterSpacing: '.1em' }}>
            Match KPIs
          </span>
          <div style={{ width: 1, height: 16, background: '#1e293b' }} />
          <select
            value={selectedMatch}
            onChange={e => setSelectedMatch(e.target.value)}
            style={{
              padding: '4px 10px', borderRadius: 7,
              background: '#1a2740', border: '1px solid rgba(255,255,255,.1)',
              color: '#e2e8f0', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', colorScheme: 'dark',
            }}
          >
            {MATCHES.map(m => (
              <option key={m.file} value={m.file} style={{ background: '#1a2740' }}>{m.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 9, color: '#334155' }}>
              Aktualizacja: {lastUpdated.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 9, color: '#f87171', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>Live</span>
          </div>
          <a href="/" style={{ fontSize: 9, color: '#374151', textDecoration: 'none', padding: '4px 8px', border: '1px solid #1e293b', borderRadius: 5 }}>
            ← Komentarz
          </a>
        </div>
      </div>

      {/* ── LEGEND TEAMS ── */}
      {stats && (
        <div style={{
          padding: '6px 16px',
          borderBottom: '1px solid #0f172a',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          background: '#0b1120',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa' }}>{teamNames[0]}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>{teamNames[1]}</span>
          </div>
          <div style={{ flex: 1 }} />
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 3 }}>
            {TAB_ORDER.map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 5,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '.08em',
                  cursor: 'pointer',
                  border: 'none',
                  textTransform: 'uppercase',
                  transition: 'all .15s',
                  background: activeTab === t ? '#1e3a5f' : '#111827',
                  color: activeTab === t ? '#93c5fd' : '#374151',
                }}
              >
                {TABS[t].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── CONTENT ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#334155', fontSize: 11 }}>
          Ładowanie danych...
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: 40, color: '#dc2626', fontSize: 11 }}>
          Błąd: {error}
        </div>
      )}

      {stats && !loading && (
        <div style={{ padding: '12px 16px' }}>

          {/* ── 6 COLUMNS: 5 sets + total ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 8,
          }}>

            {/* SET COLUMNS */}
            {SETS.map((s, idx) => {
              const meta = SET_HEADERS(s);
              const setData = getSetData(s);
              const isEmpty = !setData || !stats.sets[s];

              return (
                <div key={s} style={{
                  background: isEmpty ? '#0d1118' : '#0f1825',
                  borderRadius: 10,
                  border: `1px solid ${isEmpty ? '#111827' : '#1e293b'}`,
                  padding: '10px 8px',
                  opacity: isEmpty ? 0.35 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}>

                  {/* Set header */}
                  <div style={{ textAlign: 'center', width: '100%' }}>
                    <div style={{
                      fontSize: 8, fontWeight: 700, letterSpacing: '.15em',
                      textTransform: 'uppercase',
                      color: isEmpty ? '#1f2937' : '#475569',
                    }}>
                      {meta.label}
                    </div>
                    {!isEmpty && meta.scoreHome !== null && (
                      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                        <span style={{ color: meta.winner === 'home' ? '#60a5fa' : '#374151' }}>{meta.scoreHome}</span>
                        <span style={{ color: '#1e293b', margin: '0 3px' }}>:</span>
                        <span style={{ color: meta.winner === 'away' ? '#fbbf24' : '#374151' }}>{meta.scoreAway}</span>
                      </div>
                    )}
                  </div>

                  {/* Donuts */}
                  {isEmpty ? (
                    <div style={{
                      width: 80, height: 80, borderRadius: '50%',
                      background: '#111827', opacity: .3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ width: 80, height: 80 }} />
                    </div>
                  ) : (
                    <>
                      <SvgDonut
                        data={(stats.sets[s]!.home as any)[tab.key] || {}}
                        cats={tab.cats}
                        colors={tab.colors}
                        size={88}
                        thickness={13}
                        label={teamNames[0].substring(0, 3).toUpperCase()}
                        unit={tab.unit}
                      />
                      <SvgDonut
                        data={(stats.sets[s]!.away as any)[tab.key] || {}}
                        cats={tab.cats}
                        colors={tab.colors}
                        size={88}
                        thickness={13}
                        label={teamNames[1].substring(0, 3).toUpperCase()}
                        unit={tab.unit}
                      />
                    </>
                  )}
                </div>
              );
            })}

            {/* TOTAL COLUMN */}
            {allData && (
              <div style={{
                background: '#0f1400',
                borderRadius: 10,
                border: '1px solid #1e2a00',
                padding: '10px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}>
                <div style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: '.15em',
                  textTransform: 'uppercase', color: '#fbbf24', textAlign: 'center',
                }}>
                  Mecz
                </div>

                <SvgDonut
                  data={allData.home}
                  cats={tab.cats}
                  colors={tab.colors}
                  size={88}
                  thickness={13}
                  label={teamNames[0].substring(0, 3).toUpperCase()}
                  unit={tab.unit}
                />
                <SvgDonut
                  data={allData.away}
                  cats={tab.cats}
                  colors={tab.colors}
                  size={88}
                  thickness={13}
                  label={teamNames[1].substring(0, 3).toUpperCase()}
                  unit={tab.unit}
                />
              </div>
            )}
          </div>

          {/* ── LEGEND ── */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid #1e293b',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase', letterSpacing: '.1em', alignSelf: 'center' }}>
              {tab.label}:
            </span>
            {tab.cats.map((c, i) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: tab.colors[i], flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: '#475569' }}>{c}</span>
              </div>
            ))}
          </div>

        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .4; }
        }
      `}</style>
    </div>
  );
}