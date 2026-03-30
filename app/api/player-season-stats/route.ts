import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// ─── CACHE ────────────────────────────────────────────────────────────────────
let cachedPlayers: any[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function getPlayers() {
  if (cachedPlayers && Date.now() - cacheTime < CACHE_TTL) return cachedPlayers;
  try {
    const filePath = path.join(process.cwd(), 'data', 'plusliga-2025-2026', 'players-all-full.json');
    const raw = await fs.readFile(filePath, 'utf-8');
    const json = JSON.parse(raw);
    cachedPlayers = json.players || [];
    cacheTime = Date.now();
    return cachedPlayers;
  } catch {
    return [];
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Filter out floats (averages) and outliers from match_by_match
function cleanLast5(matches: any[]): number[] {
  const real = matches
    .map(m => m.points_total)
    .filter(v => {
      if (v === null || v === undefined) return false;
      const n = Number(v);
      return Number.isInteger(n) && n >= 0 && n < 60; // integers only, no outliers
    })
    .map(Number);
  return real.slice(-5);
}

function getTrend(last5: number[]): 'up' | 'down' | 'stable' {
  if (last5.length < 3) return 'stable';
  const recent = last5.slice(-2).reduce((a, b) => a + b, 0) / 2;
  const older  = last5.slice(0, -2).reduce((a, b) => a + b, 0) / (last5.length - 2);
  if (recent > older * 1.15) return 'up';
  if (recent < older * 0.85) return 'down';
  return 'stable';
}

function lookupPlayer(surname: string, teamHint?: string, players: any[] = []) {
  const s = surname.toLowerCase().trim();
  const candidates = players.filter(p => {
    const parts = p.name.split(' ');
    return parts[parts.length - 1].toLowerCase() === s;
  });
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  // Conflict — resolve via team hint
  if (teamHint) {
    const th = teamHint.toLowerCase();
    const match = candidates.find(c => c.team.toLowerCase().includes(th));
    if (match) return match;
  }
  return candidates[0];
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name     = searchParams.get('name')     || '';
  const team     = searchParams.get('team')     || '';
  const namesRaw = searchParams.get('names')    || ''; // batch: "Kaczmarek,Gierżot,Szalpuk"

  if (!name && !namesRaw) {
    return Response.json({ error: 'name or names required' }, { status: 400 });
  }

  const players = await getPlayers();

  // ── BATCH MODE ──────────────────────────────────────────────────────────────
  if (namesRaw) {
    const names = namesRaw.split(',').map(n => n.trim()).filter(Boolean);
    const results: Record<string, any> = {};

    for (const n of names) {
      const [surname, teamHint] = n.includes('|') ? n.split('|') : [n, team];
      const p = lookupPlayer(surname, teamHint, players);

      if (!p) {
        results[surname] = { found: false };
        continue;
      }

      const st      = p.season_totals || {};
      const matches = p.match_by_match || [];
      const last5   = cleanLast5(matches);
      const avgPts  = st.matches > 0 ? Math.round((st.points / st.matches) * 10) / 10 : 0;

      results[surname] = {
        found:       true,
        id:          p.id,
        fullName:    p.name,
        team:        p.team,
        avgPoints:   avgPts,
        last5,
        trend:       getTrend(last5),
        season: {
          matches:      st.matches      || 0,
          points:       st.points       || 0,
          aces:         st.aces         || 0,
          blocks:       st.block_points || 0,
          attackPct:    st.attack_perfect_percent || 0,
        },
      };
    }

    return Response.json({ players: results });
  }

  // ── SINGLE MODE ─────────────────────────────────────────────────────────────
  const p = lookupPlayer(name, team, players);
  if (!p) {
    return Response.json({ found: false, name });
  }

  const st      = p.season_totals || {};
  const matches = p.match_by_match || [];
  const last5   = cleanLast5(matches);

  return Response.json({
    found:     true,
    id:        p.id,
    fullName:  p.name,
    team:      p.team,
    avgPoints: st.matches > 0 ? Math.round((st.points / st.matches) * 10) / 10 : 0,
    last5,
    trend:     getTrend(last5),
    season: {
      matches:   st.matches      || 0,
      points:    st.points       || 0,
      aces:      st.aces         || 0,
      blocks:    st.block_points || 0,
      attackPct: st.attack_perfect_percent || 0,
    },
  });
}
