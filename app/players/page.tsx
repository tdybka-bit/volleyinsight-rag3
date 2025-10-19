'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface PlayerSeasonTotals {
  matches: number;
  points: number;
  aces: number;
  block_points: number;
  attack_total: number;
  sets: number;
}

interface Player {
  id: string;
  name: string;
  season_totals: PlayerSeasonTotals;
  matches_count: number;
}

export default function PlayersPage() {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('points');
    const [minMatches, setMinMatches] = useState(15);
    const [league, setLeague] = useState<'plusliga' | 'tauronliga'>('plusliga');
    const [season, setSeason] = useState<string>('2024-2025');

  // Sprawdź preselekcję ligi z URL
useEffect(() => {
  const searchParams = new URLSearchParams(window.location.search);
  const preselect = searchParams.get('preselect');
  if (preselect && (preselect === 'plusliga' || preselect === 'tauronliga')) {
    setLeague(preselect);
  }
}, []);

    useEffect(() => {
    fetchPlayers();
  }, [sortBy, minMatches, league, season]);

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/players?sortBy=${sortBy}&minMatches=${minMatches}&league=${league}&season=${season}`
      );
      const data = await res.json();
      setPlayers(data.players || []);
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Przycisk powrotu */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors mb-4"
      >
        ← Powrót do menu głównego
      </Link>

      {/* Header */}
      <div className="mb-8">
        
        </div>{/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🏐 Gracze PlusLigi
          </h1>
          <p className="text-blue-200">Sezon 2024-2025 • Statystyki graczy</p>
        </div>

        {/* Filtry */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/20">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Selector sezonu */}
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">
                Sezon
              </label>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg border border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="2024-2025">2024/2025</option>
                <option value="2023-2024">2023/2024</option>
                <option value="2022-2023">2022/2023</option>
              </select>
            </div>
            {/* Przełącznik Ligi */}
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">
                Liga
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setLeague('plusliga')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    league === 'plusliga'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-blue-200 hover:bg-slate-700'
                  }`}
                >
                  ♂️ PlusLiga
                </button>
                <button
                  onClick={() => setLeague('tauronliga')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    league === 'tauronliga'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-purple-200 hover:bg-slate-700'
                  }`}
                >
                  ♀️ Tauron Liga
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">
                Sortuj według
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg border border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="points">Punkty</option>
                <option value="aces">Asy</option>
                <option value="block_points">Bloki</option>
                <option value="matches">Mecze</option>
                <option value="attack_total">Ataki</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">
                Min. meczów
              </label>
              <input
                type="number"
                value={minMatches}
                onChange={(e) => setMinMatches(parseInt(e.target.value) || 0)}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg border border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"
              />
            </div>

            <div className="ml-auto">
              <p className="text-blue-200 text-sm">
                Znaleziono: <span className="text-white font-bold">{players.length}</span> graczy
              </p>
            </div>
          </div>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-12 text-center border border-white/20">
            <div className="text-blue-200 text-lg">Ładowanie danych...</div>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl overflow-hidden border border-white/20">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-blue-900/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-blue-100">#</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-blue-100">Gracz</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-blue-100">Mecze</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-blue-100">Sety</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-blue-100">Punkty</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-blue-100">Asy</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-blue-100">Bloki</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-blue-100">Ataki</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-blue-100">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {players.map((player, index) => (
                    <tr
                      key={player.id}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 text-blue-200 font-medium">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white font-semibold">
                          {player.name}
                        </div>
                        <div className="text-blue-300 text-sm">
                          {player.matches_count} meczów szczegółowych
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-white">
                        {player.season_totals.matches}
                      </td>
                      <td className="px-6 py-4 text-center text-white">
                        {player.season_totals.sets}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-yellow-400 font-bold text-lg">
                          {player.season_totals.points}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-green-400 font-semibold">
                        {player.season_totals.aces}
                      </td>
                      <td className="px-6 py-4 text-center text-purple-400 font-semibold">
                        {player.season_totals.block_points}
                      </td>
                      <td className="px-6 py-4 text-center text-blue-300">
                        {player.season_totals.attack_total}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link
                          href={`/players/${player.id}?league=${league}&season=${season}`}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                          Szczegóły →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {players.length === 0 && !loading && (
              <div className="p-12 text-center text-blue-200">
                Brak graczy spełniających kryteria
              </div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        {!loading && players.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-yellow-500/20 backdrop-blur-lg rounded-xl p-4 border border-yellow-500/30">
              <div className="text-yellow-200 text-sm font-medium mb-1">
                Najlepszy Strzelec
              </div>
              <div className="text-white text-xl font-bold">
                {players[0]?.name}
              </div>
              <div className="text-yellow-300 text-2xl font-bold mt-1">
                {players[0]?.season_totals.points} pkt
              </div>
            </div>

            <div className="bg-green-500/20 backdrop-blur-lg rounded-xl p-4 border border-green-500/30">
              <div className="text-green-200 text-sm font-medium mb-1">
                Łącznie Punktów
              </div>
              <div className="text-white text-2xl font-bold mt-2">
                {players.reduce((sum, p) => sum + p.season_totals.points, 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-purple-500/20 backdrop-blur-lg rounded-xl p-4 border border-purple-500/30">
              <div className="text-purple-200 text-sm font-medium mb-1">
                Łącznie Asów
              </div>
              <div className="text-white text-2xl font-bold mt-2">
                {players.reduce((sum, p) => sum + p.season_totals.aces, 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-blue-500/20 backdrop-blur-lg rounded-xl p-4 border border-blue-500/30">
              <div className="text-blue-200 text-sm font-medium mb-1">
                Łącznie Bloków
              </div>
              <div className="text-white text-2xl font-bold mt-2">
                {players.reduce((sum, p) => sum + p.season_totals.block_points, 0).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}