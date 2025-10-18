'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Match {
  opponent: string;
  points_total: number;
  serve_aces: number;
  attack_points: number;
  block_points: number;
  sets: number;
}

interface Player {
  id: string;
  name: string;
  url: string;
  season_totals: {
    matches: number;
    points: number;
    aces: number;
    block_points: number;
    attack_total: number;
    sets: number;
    serve_errors: number;
    reception_total: number;
  };
  match_by_match: Match[];
  matches_count: number;
}

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerId, setPlayerId] = useState<string>('');
  const [league, setLeague] = useState<string>('plusliga');

  useEffect(() => {
    params.then(p => {
      setPlayerId(p.id);
      const searchParams = new URLSearchParams(window.location.search);
      const playerLeague = searchParams.get('league') || 'plusliga';
      setLeague(playerLeague);
      fetchPlayer(p.id, playerLeague);
    });
  }, [params]);

  const fetchPlayer = async (id: string, playerLeague: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/players/${id}?league=${playerLeague}`);
      const data = await res.json();
      setPlayer(data.player);
    } catch (error) {
      console.error('Error fetching player:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Ładowanie danych gracza...</div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Gracz nie znaleziony</div>
          <Link href="/players" className="text-blue-400 hover:text-blue-300">
            ← Powrót do listy graczy
          </Link>
        </div>
      </div>
    );
  }

  // Przygotowanie danych do wykresów (filtruj sumy)
  const matchesData = player.match_by_match
    .filter(match => {
      // Usuń wiersze z sumą lub nieprawidłowe dane
      const opponent = match.opponent?.toLowerCase() || '';
      return opponent && 
             !opponent.includes('suma') && 
             !opponent.includes('razem') &&
             match.points_total < 100; // Pojedynczy mecz nie może mieć 100+ punktów
    })
    .map((match, index) => ({
      match: `M${index + 1}`,
      opponent: match.opponent.split('-')[1]?.trim() || match.opponent,
      points: match.points_total,
      aces: match.serve_aces,
      blocks: match.block_points
    }));

  // Rozkład punktów (Pie Chart)
  const pointsBreakdown = [
    { name: 'Asy', value: player.season_totals.aces, color: '#10b981' },
    { name: 'Bloki', value: player.season_totals.block_points, color: '#8b5cf6' },
    { 
      name: 'Ataki', 
      value: player.season_totals.points - player.season_totals.aces - player.season_totals.block_points,
      color: '#f59e0b'
    }
  ];

  const stats = player.season_totals;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/players" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
            ← Powrót do listy graczy
          </Link>
          <h1 className="text-5xl font-bold text-white mb-2">
            {player.name}
          </h1>
          <p className="text-blue-200">Sezon 2024-2025 • PlusLiga</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-yellow-500/20 backdrop-blur-lg rounded-xl p-6 border border-yellow-500/30">
            <div className="text-yellow-200 text-sm font-medium mb-1">Punkty</div>
            <div className="text-white text-3xl font-bold">{stats.points}</div>
            <div className="text-yellow-300 text-sm mt-1">
              {(stats.points / stats.sets).toFixed(2)} / set
            </div>
          </div>

          <div className="bg-green-500/20 backdrop-blur-lg rounded-xl p-6 border border-green-500/30">
            <div className="text-green-200 text-sm font-medium mb-1">Asy</div>
            <div className="text-white text-3xl font-bold">{stats.aces}</div>
            <div className="text-green-300 text-sm mt-1">
              {(stats.aces / stats.sets).toFixed(2)} / set
            </div>
          </div>

          <div className="bg-purple-500/20 backdrop-blur-lg rounded-xl p-6 border border-purple-500/30">
            <div className="text-purple-200 text-sm font-medium mb-1">Bloki</div>
            <div className="text-white text-3xl font-bold">{stats.block_points}</div>
            <div className="text-purple-300 text-sm mt-1">
              {(stats.block_points / stats.sets).toFixed(2)} / set
            </div>
          </div>

          <div className="bg-blue-500/20 backdrop-blur-lg rounded-xl p-6 border border-blue-500/30">
            <div className="text-blue-200 text-sm font-medium mb-1">Mecze</div>
            <div className="text-white text-3xl font-bold">{stats.matches}</div>
            <div className="text-blue-300 text-sm mt-1">{stats.sets} setów</div>
          </div>
        </div>

        {/* Wykresy */}
        {player.matches_count > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Wykres: Punkty w kolejnych meczach */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-4">
                📈 Punkty w kolejnych meczach
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={matchesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="match" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="points" stroke="#fbbf24" strokeWidth={2} name="Punkty" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Wykres: Rozkład punktów */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-4">
                🥧 Rozkład punktów
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pointsBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pointsBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 mb-8 border border-white/20 text-center">
            <p className="text-blue-200">Brak danych match-by-match dla tego gracza</p>
          </div>
        )}

        {/* Tabela meczów */}
        {player.matches_count > 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl overflow-hidden border border-white/20">
            <div className="p-6 border-b border-white/20">
              <h2 className="text-xl font-bold text-white">
                🏐 Historia meczów ({player.matches_count})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-blue-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-blue-100">#</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-blue-100">Przeciwnik</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-blue-100">Sety</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-blue-100">Punkty</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-blue-100">Asy</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-blue-100">Bloki</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-blue-100">Ataki</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {player.match_by_match.map((match, index) => (
                    <tr key={index} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-blue-200">{index + 1}</td>
                      <td className="px-6 py-4 text-white">{match.opponent}</td>
                      <td className="px-6 py-4 text-center text-blue-200">{match.sets}</td>
                      <td className="px-6 py-4 text-center text-yellow-400 font-bold">
                        {match.points_total}
                      </td>
                      <td className="px-6 py-4 text-center text-green-400">
                        {match.serve_aces}
                      </td>
                      <td className="px-6 py-4 text-center text-purple-400">
                        {match.block_points}
                      </td>
                      <td className="px-6 py-4 text-center text-blue-300">
                        {match.attack_points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Link do źródła */}
        <div className="mt-8 text-center">
          <a
            href={player.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            Źródło danych: PlusLiga.pl →
          </a>
        </div>
      </div>
    </div>
  );
}