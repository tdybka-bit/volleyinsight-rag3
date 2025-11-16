'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';

interface PlayerData {
  id: string;
  name: string;
  team: string;
  season: string;
  league: string;
  gender?: string;
  currentSeasonStats: any;
  careerTotals: any;
  matchByMatch: any[];
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
  
  const data = values.map((value, i) => ({
    match: `M${i + 1}`,
    value,
    isOutlier: value > ucl || value < lcl,
    opponent: matches[i]?.opponent || 'Unknown',
    date: matches[i]?.date || '',
    uclLine: ucl,
    lclLine: lcl
  }));
  
  return { mean, ucl, lcl, data };
}

export default function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const [playerId, setPlayerId] = useState<string>('');
  const [allPlayers, setAllPlayers] = useState<PlayerData[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerData | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string>('2024-2025');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(async (p) => {
      setPlayerId(p.id);
      try {
        const res = await fetch(`/api/player/${p.id}/all-seasons`);
        const data = await res.json();
        setAllPlayers(data.players || []);
        
        // Znajdź gracza z selectedSeason
        if (data.players && data.players.length > 0) {
          const playerInSeason = data.players.find(pl => pl.season === selectedSeason);
          setSelectedPlayer(playerInSeason || data.players[0]);
        }
      } catch (error) {
        console.error('Error fetching player:', error);
      } finally {
        setLoading(false);
      }
    });
  }, [params, selectedSeason]); // Dodaj selectedSeason!
  
  // Dodaj useEffect do zmiany sezonu
  useEffect(() => {
    if (allPlayers.length > 0) {
      const playerInSeason = allPlayers.find(p => p.season === selectedSeason);
      if (playerInSeason) {
        setSelectedPlayer(playerInSeason);
      }
    }
  }, [selectedSeason, allPlayers]);
  
  // useMemo PRZED warunkami!
  const { player, matches, stats, career, spcTotal, spcAttack, spcBlock, spcAces, compareData } = useMemo(() => {
    console.log('🔄 useMemo recalculating!');
    console.log('🎯 selectedPlayer:', selectedPlayer?.season, selectedPlayer?.league);
  
    if (!selectedPlayer) {
      return {
        player: null,
        matches: [],
        stats: { points: 0, aces: 0, blocks: 0, matches: 0, sets: 0 },
        career: null,
        spcTotal: { mean: 0, ucl: 0, lcl: 0, data: [] },
        spcAttack: { mean: 0, ucl: 0, lcl: 0, data: [] },
        spcBlock: { mean: 0, ucl: 0, lcl: 0, data: [] },
        spcAces: { mean: 0, ucl: 0, lcl: 0, data: [] },
        compareData: null
      };
    }
  
    const player = selectedPlayer;
        
    const matches = (player.matchByMatch || []).filter((m: any) => {
      const giornata = m.giornata || '';
      return !giornata.match(/^\d+$/) && 
             !giornata.includes('Media') && 
             !giornata.includes('Totale') && 
             m.points_total !== undefined;
    });
  
    console.log('📊 Filtered matches count:', matches.length);
    console.log('📋 First match:', matches[0]);
    console.log('🔢 Total points array length:', matches.map(m => parseInt(m.points_total) || 0).length);
  
    const totalPoints = matches.map(m => parseInt(m.points_total) || 0);
    const attackPoints = matches.map(m => {
      // LegaVolley uses attack_won, PlusLiga uses attack_points
      if (m.attack_points !== undefined) {
        return parseInt(m.attack_points) || 0;
      }
      if (m.attack_won !== undefined) {
        return parseInt(m.attack_won) || 0;
      }
      return (parseInt(m.attack_winning) || 0) + (parseInt(m.attack_perfect) || 0);
    });
    const blockPoints = matches.map(m => parseInt(m.block_points) || 0);
    const aces = matches.map(m => parseInt(m.serve_aces) || 0);
  
    const spcTotal = calculateSPC(totalPoints, matches);
    const spcAttack = calculateSPC(attackPoints, matches);
    const spcBlock = calculateSPC(blockPoints, matches);
    const spcAces = calculateSPC(aces, matches);

  // Dodaj breakdown do spcTotal.data
  spcTotal.data = spcTotal.data.map((point, idx) => ({
    ...point,
    attack: attackPoints[idx] || 0,
    block: blockPoints[idx] || 0,
    ace: aces[idx] || 0,
    phase: matches[idx]?.phase || 'regular'
  }));

  // DEBUG
  console.log('📊 Playoff index:', spcTotal.data.findIndex(d => d.phase === 'playoff'));
  console.log('📋 First 5 phases:', spcTotal.data.slice(0, 5).map(d => d.phase));
  console.log('📋 Last 5 phases:', spcTotal.data.slice(-5).map(d => d.phase));

  const stats = player.currentSeasonStats;
  const career = player.careerTotals;

  // Dane porównawcze z innego sezonu
  let compareData = null;
  if (compareWith && player) {
    const comparePlayer = allPlayers.find(p => 
      p.id === player.id && 
      p.season === compareWith && 
      p.league === player.league
    );
    
    if (comparePlayer?.matchByMatch) {
      const compareMatches = comparePlayer.matchByMatch
        .filter((m: any) => {
          const giornata = m.giornata || '';
          return !giornata.match(/^\d+$/) && 
                 !giornata.includes('Media') && 
                 !giornata.includes('Totale') && 
                 m.points_total !== undefined;
        })
        .slice(0, matches.length);
      
      compareData = compareMatches.map((m, idx) => ({
        match: idx + 1,
        value: parseInt(m.points_total) || 0
      }));
    }
  }

  return { player, matches, stats, career, spcTotal, spcAttack, spcBlock, spcAces, compareData };
}, [selectedPlayer, compareWith]); // Dodaj compareWith!

const BAR_SIZE = 12;
const BAR_MIN_POINT_SIZE = 1; // łatwo wrócić do starego ustawienia ustawiając 0
const CHART_AXIS_FONT_SIZE = 11;
const CHART_LEFT_MARGIN = -24; // ustaw na 0, żeby wrócić do poprzedniego wyglądu

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (payload.isOutlier) {
    return (
      <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
    );
  }
  return <circle cx={cx} cy={cy} r={4} fill="#fbbf24" />;
};

  const CustomTooltip = ({ active, payload, mean }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-4 shadow-lg">
          <p className="text-white font-bold text-sm">{data.match}</p>
          <p className="text-gray-300 text-sm">{data.opponent}</p>
          <p className="text-gray-400 text-xs mb-2">{data.date}</p>
          
          <div className="border-t border-slate-600 my-2"></div>
          
          <div className="space-y-1">
            <p className="text-sm" style={{ color: '#3B82F6' }}>⚔️ Punkty atakiem: {data.attack || 0}</p>
            <p className="text-sm" style={{ color: '#FCB07C' }}>🛡️ Punkty blokiem: {data.block || 0}</p>
            <p className="text-green-400 text-sm">🎯 Punkty asami: {data.ace || 0}</p>
          </div>
          
          <div className="border-t border-slate-600 my-2"></div>
          
          <p className="text-yellow-400 font-bold">📊 TOTAL: {data.value} punktów</p>
          <p className="text-gray-400 text-xs mt-1">📈 Średnia sezonu: {mean?.toFixed(1) || '-'}</p>
          
          {data.isOutlier && <p className="text-red-400 text-xs mt-2">⚠️ Outlier</p>}
        </div>
      );
    }
    return null;
  };

  // Warunki loading/empty
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">Ładowanie...</div>
      </div>
    );
  }

  if (!selectedPlayer || allPlayers.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-2xl mb-4">Nie znaleziono gracza</p>
          <Link href="/stats" className="text-orange-400 hover:text-orange-300">
            ← Powrót do dashboardu
          </Link>
        </div>
      </div>
    );
  }

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
                  console.log('📝 Dropdown changed to:', e.target.value);
                  console.log('📦 Found player:', selected?.season, selected?.league);
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
              {/* Nagłówek z wyborem sezonu */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">
                  📊 Wszystkie punkty per mecz (SPC)
                </h2>
                
                <select 
                  value={selectedSeason} 
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm border border-slate-600 hover:bg-slate-600"
                >
                  <option value="2024-2025">Sezon 2024-2025</option>
                  <option value="2023-2024">Sezon 2023-2024</option>
                  <option value="2022-2023">Sezon 2022-2023</option>
                </select>
              </div>

              {/* Statystyki SPC */}
              <p className="text-sm text-gray-400 mb-4">
                Średnia: {spcTotal.mean.toFixed(1)} | 
                <span className="text-red-300"> UCL: {spcTotal.ucl.toFixed(1)}</span> | 
                <span className="text-red-300"> LCL: {spcTotal.lcl.toFixed(1)}</span>
                <span className="ml-4 text-red-400">● Outlier</span>
              </p>

              {/* Porównanie z innym sezonem */}
              <div className="mb-4 flex items-center gap-4">
                <label className="text-gray-300 text-sm">Porównaj z:</label>
                <select 
                  value={compareWith || ''} 
                  onChange={(e) => setCompareWith(e.target.value || null)}
                  className="bg-slate-700 text-white px-3 py-2 rounded-lg text-sm"
                >
                  <option value="">Brak porównania</option>
                  <option value="2023-2024">Sezon 2023-2024</option>
                  <option value="2022-2023">Sezon 2022-2023</option>
                </select>
              </div>
              
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart
                  data={spcTotal.data}
                  barCategoryGap="28%"
                  barGap={0}
                  margin={{ top: 20, right: 0, bottom: 0, left: CHART_LEFT_MARGIN }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" vertical={true} />
                  <XAxis
                    dataKey="match"
                    stroke="#94a3b8"
                    interval={1}
                    tick={{ fill: '#94a3b8', fontSize: CHART_AXIS_FONT_SIZE }}
                  />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: CHART_AXIS_FONT_SIZE }} />
                  <Tooltip content={<CustomTooltip mean={spcTotal.mean}  />} />
                  <Legend />
                  
                  {/* Stacked Bars */}
                  <Bar
                    dataKey="attack"
                    stackId="points"
                    fill="#3B82F6"
                    name="Punkty atakiem"
                    barSize={BAR_SIZE}
                    maxBarSize={BAR_SIZE}
                    minPointSize={BAR_MIN_POINT_SIZE}
                  />
                  <Bar
                    dataKey="block"
                    stackId="points"
                    fill="#FCB07C"
                    name="Punkty blokiem"
                    barSize={BAR_SIZE}
                    maxBarSize={BAR_SIZE}
                    minPointSize={BAR_MIN_POINT_SIZE}
                  />
                  <Bar
                    dataKey="ace"
                    stackId="points"
                    fill="#10b981"
                    name="Punkty asami"
                    barSize={BAR_SIZE}
                    maxBarSize={BAR_SIZE}
                    minPointSize={BAR_MIN_POINT_SIZE}
                  />
                  
                  {/* Overlay */}
                  {compareData && (
                    <Line 
                      type="monotone" 
                      data={compareData}
                      dataKey="value" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name={`Sezon ${compareWith}`}
                    />
                  )}

                  {/* SPC Lines */}
                  <ReferenceLine y={spcTotal.mean} stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" label="Średnia" />
                  <ReferenceLine y={spcTotal.ucl} stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" label="UCL" />
                  <ReferenceLine y={spcTotal.lcl} stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" label="LCL" />
                
                  {/* Obszar Playoff - przeszklony */}
                  {(() => {
                    const playoffStartIndex = spcTotal.data.findIndex(d => d.phase === 'playoff');
                    if (playoffStartIndex > 0) {
                      return (
                        <ReferenceArea
                          x1={`M${playoffStartIndex}`}
                          x2={`M${spcTotal.data.length}`}
                          fill="#ffffff"        // Białe szkło
                          fillOpacity={0.08}     // Bardzo delikatne (8%)
                          stroke="#94a3b8"       // Szary border
                          strokeOpacity={0.3}    // Delikatny border
                          strokeWidth={1}
                          strokeDasharray="5 5"  // Przerywana linia
                          label={{ 
                            value: "PLAYOFF", 
                            position: "insideTopRight", 
                            fill: "#cbd5e1",     // Jasny szary tekst
                            fontSize: 12, 
                            fontWeight: "bold",
                            opacity: 0.7
                          }}
                        />
                      );
                    }
                    return null;
                  })()}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* TABELA MECZ PO MECZU */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mt-6">
              <h2 className="text-xl font-bold text-white mb-4">
                📋 Mecze szczegółowo ({matches.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left p-2 text-gray-300">#</th>
                      <th className="text-left p-2 text-gray-300">Data</th>
                      <th className="text-left p-2 text-gray-300">Mecz</th>
                      <th className="text-center p-2 text-gray-300">Wynik</th>
                      <th className="text-center p-2 text-gray-300">Pkt</th>
                      <th className="text-center p-2 text-gray-300">Atak</th>
                      <th className="text-center p-2 text-gray-300">Blok</th>
                      <th className="text-center p-2 text-gray-300">Asy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((match, idx) => {
                      // Wynik - teraz mamy prawdziwe dane z matches-calendar!
                      const homeSets = match.home_sets ?? 0;
                      const awaySets = match.away_sets ?? 0;
                      const homeTeam = match.home_team || '';
                      const awayTeam = match.away_team || '';

                      // ZAWSZE: Gospodarz - Gość (sety gospodarza : sety gościa)
                      const matchDisplay = `${homeTeam} - ${awayTeam}`;
                      const resultDisplay = `${homeSets}:${awaySets}`;
                      
                      return (
                        <tr key={idx} className="border-b border-white/10 hover:bg-white/5">
                          <td className="p-2 text-gray-400">{idx + 1}</td>
                          <td className="p-2 text-white text-xs">{match.date}</td>
                          <td className="p-2 text-white text-sm">{matchDisplay}</td>
                          <td className="p-2 text-center text-gray-300 font-mono">{resultDisplay}</td>
                          <td className="p-2 text-center text-yellow-300 font-bold">{match.points_total || 0}</td>
                          <td className="p-2 text-center" style={{ color: '#3B82F6' }}>
                            {match.attack_points || match.attack_winning || 0}
                          </td>
                          <td className="p-2 text-center" style={{ color: '#F97316' }}>
                            {match.block_points || 0}
                          </td>
                          <td className="p-2 text-center text-green-300">{match.serve_aces || 0}</td>
                        </tr>
                      );
                      })}
                                        </tbody>
                                      </table>
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