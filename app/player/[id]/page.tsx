'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';

interface PlayerData {
  id: string;
  name: string;
  team: string;
  season: string;
  league: string;
  gender?: string;
  currentSeasonStats: any;
  careerTotals: any;
  matchByMatch: any[];  // ← ZMIANA: camelCase zamiast snake_case
}

interface SPCData {
  mean: number;
  ucl: number;
  lcl: number;
  data: Array<{ 
    match: string; 
    value: number; 
    isOutlier: boolean;
    opponent: string;
    date: string;
    uclLine: number;
    lclLine: number;
  }>;
}

function calculateSPC(values: number[], matches: any[]): SPCData {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  );
  
  const ucl = mean + 3 * stdDev;
  const lcl = Math.max(0, mean - 3 * stdDev);
  
  const data = values.map((value, index) => ({
    match: `M${index + 1}`,
    value,
    isOutlier: value > ucl || value < lcl,
    opponent: matches[index]?.opponent || 'N/A',
    date: matches[index]?.date || 'N/A',
    uclLine: ucl,
    lclLine: lcl
  }));
  
  return { mean, ucl, lcl, data };
}

export default function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const [allPlayers, setAllPlayers] = useState<PlayerData[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerId, setPlayerId] = useState('');

  useEffect(() => {
    params.then(async (p) => {
      setPlayerId(p.id);
      try {
        const res = await fetch(`/api/player/${p.id}/all-seasons`);
        const data = await res.json();
        setAllPlayers(data.players || []);
        if (data.players && data.players.length > 0) {
          setSelectedPlayer(data.players[0]);
        }
      } catch (error) {
        console.error('Error fetching player:', error);
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Ładowanie danych gracza...</div>
      </div>
    );
  }

  if (!selectedPlayer || allPlayers.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Gracz nie znaleziony</div>
          <Link href="/stats" className="text-orange-400 hover:text-orange-300">
            ← Powrót do dashboardu
          </Link>
        </div>
      </div>
    );
  }

  const player = selectedPlayer;
  
  console.log('🎯 selectedPlayer:', selectedPlayer);
  console.log('🎯 matchByMatch exists?', !!selectedPlayer?.matchByMatch);
  console.log('🎯 matchByMatch length:', selectedPlayer?.matchByMatch?.length);
  console.log('🎯 matchByMatch type:', typeof selectedPlayer?.matchByMatch);
  console.log('🎯 Is array?', Array.isArray(selectedPlayer?.matchByMatch));
    
  const matches = (player.matchByMatch || []).filter((m: any) => {
    // Usuń agregaty (totalsy, średnie)
    const giornata = m.giornata || '';
    return !giornata.match(/^\d+$/) && // nie same cyfry jak "121"
           !giornata.includes('Media') && // nie średnie
           !giornata.includes('Totale') && // nie totale
           m.points_total !== undefined; // musi mieć punkty
  });

  console.log('🎯 matches length after:', matches.length);
  console.log('🔍 First match structure:', matches[0]);
  console.log('🔍 Match 35:', matches[34]); // array starts at 0

  const totalPoints = matches.map(m => parseInt(m.points_total) || 0);
  const attackPoints = matches.map(m => 
  parseInt(m.attack_winning) || parseInt(m.attack_perfect) || 0
  );
  const blockPoints = matches.map(m => parseInt(m.block_points) || 0);
  const aces = matches.map(m => parseInt(m.serve_aces) || 0);

  const spcTotal = calculateSPC(totalPoints, matches);
  const spcAttack = calculateSPC(attackPoints, matches);
  const spcBlock = calculateSPC(blockPoints, matches);
  const spcAces = calculateSPC(aces, matches);

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.isOutlier) {
      return (
        <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
      );
    }
    return <circle cx={cx} cy={cy} r={4} fill="#fbbf24" />;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-bold">{data.match}</p>
          <p className="text-gray-300 text-sm">{data.opponent}</p>
          <p className="text-gray-400 text-xs">{data.date}</p>
          <p className="text-yellow-400 font-bold mt-2">Wartość: {data.value}</p>
          {data.isOutlier && <p className="text-red-400 text-xs mt-1">⚠️ Outlier</p>}
        </div>
      );
    }
    return null;
  };

  const stats = player.currentSeasonStats;
  const career = player.careerTotals;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Link href="/stats" className="text-orange-400 hover:text-orange-300 mb-4 inline-block">
            ← Powrót do dashboardu
          </Link>
          <h1 className="text-5xl font-bold text-white mb-2">{player.name}</h1>
          <div className="flex items-center gap-4">
            <p className="text-blue-200">{player.team}</p>
            
            {allPlayers.length > 1 && (
              <select
                value={`${player.league}-${player.season}`}
                onChange={(e) => {
                  const selected = allPlayers.find(p => `${p.league}-${p.season}` === e.target.value);
                  if (selected) setSelectedPlayer(selected);
                }}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg border border-blue-800/30"
              >
                {allPlayers.map((p, idx) => (
                   <option key={`${p.id}-${p.season}-${idx}`} value={`${p.league}-${p.season}`}>
                    {p.season} • {
                      p.league === 'plusliga' ? 'PlusLiga' : 
                      p.league === 'tauronliga' ? 'TauronLiga' :
                      p.league === 'legavolley' ? 'LegaVolley (IT)' :
                      p.league === 'legavolley-femminile' ? 'LegaVolley Femminile (IT)' :
                      p.league
                    }
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-yellow-500/20 backdrop-blur-lg rounded-xl p-6 border border-yellow-500/30">
            <div className="text-yellow-200 text-sm font-medium mb-1">Punkty</div>
            <div className="text-white text-3xl font-bold">
              {stats.points}
              <span className="text-xl text-gray-400 ml-2">({career?.points || 0})</span>
            </div>
            <div className="text-yellow-300 text-sm mt-1">
              {(stats.points / stats.sets || 0).toFixed(2)} / set
            </div>
          </div>

          <div className="bg-green-500/20 backdrop-blur-lg rounded-xl p-6 border border-green-500/30">
            <div className="text-green-200 text-sm font-medium mb-1">Asy</div>
            <div className="text-white text-3xl font-bold">
              {stats.aces}
              <span className="text-xl text-gray-400 ml-2">({career?.aces || 0})</span>
            </div>
            <div className="text-green-300 text-sm mt-1">
              {(stats.aces / stats.sets || 0).toFixed(2)} / set
            </div>
          </div>

          <div className="bg-purple-500/20 backdrop-blur-lg rounded-xl p-6 border border-purple-500/30">
            <div className="text-purple-200 text-sm font-medium mb-1">Bloki</div>
            <div className="text-white text-3xl font-bold">
              {stats.blocks}
              <span className="text-xl text-gray-400 ml-2">({career?.blocks || 0})</span>
            </div>
            <div className="text-purple-300 text-sm mt-1">
              {(stats.blocks / stats.sets || 0).toFixed(2)} / set
            </div>
          </div>

          <div className="bg-blue-500/20 backdrop-blur-lg rounded-xl p-6 border border-blue-500/30">
            <div className="text-blue-200 text-sm font-medium mb-1">Mecze</div>
            <div className="text-white text-3xl font-bold">
              {stats.matches}
              <span className="text-xl text-gray-400 ml-2">({career?.matches || 0})</span>
            </div>
            <div className="text-blue-300 text-sm mt-1">{stats.sets} setów</div>
          </div>
        </div>

        {matches.length > 0 ? (
          <>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">
                📊 Wszystkie punkty per mecz (SPC)
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Średnia: {spcTotal.mean.toFixed(1)} | 
                <span className="text-red-300"> UCL: {spcTotal.ucl.toFixed(1)}</span> | 
                <span className="text-red-300"> LCL: {spcTotal.lcl.toFixed(1)}</span>
                <span className="ml-4 text-red-400">● Outlier</span>
              </p>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={spcTotal.data}>
                  <defs>
                    <linearGradient id="controlArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" vertical={true} />
                  <XAxis dataKey="match" stroke="#94a3b8" interval={1} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="uclLine" stroke="none" fill="url(#controlArea)" fillOpacity={0.5} />
                  <ReferenceLine y={spcTotal.mean} stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" label="Średnia" />
                  <ReferenceLine y={spcTotal.ucl} stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" label="UCL" />
                  <ReferenceLine y={spcTotal.lcl} stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" label="LCL" />
                  <Line type="monotone" dataKey="value" stroke="#fbbf24" strokeWidth={3} name="Punkty" dot={<CustomDot />} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h3 className="text-lg font-bold text-white mb-2">🔥 Atak (SPC)</h3>
                <p className="text-xs text-gray-400 mb-3">Śr: {spcAttack.mean.toFixed(1)} | UCL: {spcAttack.ucl.toFixed(1)}</p>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={spcAttack.data}>
                    <defs>
                      <linearGradient id="attackArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" vertical={true} />
                    <XAxis dataKey="match" stroke="#94a3b8" tick={{ fontSize: 10 }} interval={1} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="uclLine" stroke="none" fill="url(#attackArea)" />
                    <ReferenceLine y={spcAttack.mean} stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" />
                    <ReferenceLine y={spcAttack.ucl} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" />
                    <ReferenceLine y={spcAttack.lcl} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={<CustomDot />} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h3 className="text-lg font-bold text-white mb-2">🛡️ Blok (SPC)</h3>
                <p className="text-xs text-gray-400 mb-3">Śr: {spcBlock.mean.toFixed(1)} | UCL: {spcBlock.ucl.toFixed(1)}</p>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={spcBlock.data}>
                    <defs>
                      <linearGradient id="blockArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" vertical={true} />
                    <XAxis dataKey="match" stroke="#94a3b8" tick={{ fontSize: 10 }} interval={1} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="uclLine" stroke="none" fill="url(#blockArea)" />
                    <ReferenceLine y={spcBlock.mean} stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" />
                    <ReferenceLine y={spcBlock.ucl} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" />
                    <ReferenceLine y={spcBlock.lcl} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={<CustomDot />} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <h3 className="text-lg font-bold text-white mb-2">⚡ Asy (SPC)</h3>
                <p className="text-xs text-gray-400 mb-3">Śr: {spcAces.mean.toFixed(1)} | UCL: {spcAces.ucl.toFixed(1)}</p>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={spcAces.data}>
                    <defs>
                      <linearGradient id="acesArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" vertical={true} />
                    <XAxis dataKey="match" stroke="#94a3b8" tick={{ fontSize: 10 }} interval={1} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="uclLine" stroke="none" fill="url(#acesArea)" />
                    <ReferenceLine y={spcAces.mean} stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" />
                    <ReferenceLine y={spcAces.ucl} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" />
                    <ReferenceLine y={spcAces.lcl} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={<CustomDot />} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center">
            <p className="text-gray-400">Brak danych meczowych dla tego sezonu</p>
          </div>
        )}
      </div>
    </div>
  );
}