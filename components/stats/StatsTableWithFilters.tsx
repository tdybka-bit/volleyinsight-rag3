'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { PlayerWithCombinedStats } from '@/lib/playerData';

interface Props {
  players: PlayerWithCombinedStats[];
}

export default function StatsTableWithFilters({ players }: Props) {
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');

  const leagues = ['all', ...new Set(players.map(p => p.league))];
  const seasons = ['all', ...new Set(players.map(p => p.season))];

  const filteredPlayers = useMemo(() => {
    return players.filter(player => {
      if (leagueFilter !== 'all' && player.league !== leagueFilter) return false;
      if (seasonFilter !== 'all' && player.season !== seasonFilter) return false;
      if (genderFilter === 'men' && player.league !== 'plusliga') return false;
      if (genderFilter === 'women' && player.league !== 'tauronliga') return false;
      return true;
    });
  }, [players, leagueFilter, seasonFilter, genderFilter]);

  const sortedPlayers = filteredPlayers.sort((a, b) => 
    b.currentSeasonStats.points - a.currentSeasonStats.points
  );

  return (
    <>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          Statystyki Graczy
        </h1>
        <p className="text-gray-400">
          {sortedPlayers.length} graczy • Sortowanie: najlepsi punktujący
        </p>
      </div>

      {/* Filtry */}
      <div className="mb-6 bg-slate-800/50 rounded-lg border border-blue-800/30 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Płeć</label>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-blue-800/30"
            >
              <option value="all">Wszyscy</option>
              <option value="men">Mężczyźni</option>
              <option value="women">Kobiety</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Liga</label>
            <select
              value={leagueFilter}
              onChange={(e) => setLeagueFilter(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-blue-800/30"
            >
              {leagues.map(league => (
                <option key={league} value={league}>
                  {league === 'all' ? 'Wszystkie' : league === 'plusliga' ? 'PlusLiga' : 'TauronLiga'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Sezon</label>
            <select
              value={seasonFilter}
              onChange={(e) => setSeasonFilter(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-blue-800/30"
            >
              {seasons.map(season => (
                <option key={season} value={season}>
                  {season === 'all' ? 'Wszystkie' : season}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-slate-800/50 rounded-lg border border-blue-800/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Gracz</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Drużyna</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Mecze</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Sety</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-orange-400 uppercase font-bold">Punkty</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Ataki</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Asy</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Bloki</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Przyjęcie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-800/30">
              {sortedPlayers.map((player, idx) => (
                <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/player/${player.id}`} className="text-orange-400 hover:text-orange-300 font-medium">
                      {player.name}
                    </Link>
                    <div className="text-xs text-gray-500">{player.season}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-sm">{player.team}</td>
                  <td className="px-4 py-3 text-center text-white text-sm">
                    {player.currentSeasonStats.matches}
                    <span className="text-gray-500 text-xs ml-1">({player.careerTotals?.matches || 0})</span>
                  </td>
                  <td className="px-4 py-3 text-center text-white text-sm">
                    {player.currentSeasonStats.sets}
                    <span className="text-gray-500 text-xs ml-1">({player.careerTotals?.sets || 0})</span>
                  </td>
                  <td className="px-4 py-3 text-center text-orange-400 font-bold">
                    {player.currentSeasonStats.points}
                    <span className="text-gray-500 text-xs ml-1">({player.careerTotals?.points || 0})</span>
                  </td>
                  <td className="px-4 py-3 text-center text-white text-sm">
                    {player.currentSeasonStats.attacks}
                    <span className="text-gray-500 text-xs ml-1">({player.careerTotals?.attacks || 0})</span>
                  </td>
                  <td className="px-4 py-3 text-center text-white text-sm">
                    {player.currentSeasonStats.aces}
                    <span className="text-gray-500 text-xs ml-1">({player.careerTotals?.aces || 0})</span>
                  </td>
                  <td className="px-4 py-3 text-center text-white text-sm">
                    {player.currentSeasonStats.blocks}
                    <span className="text-gray-500 text-xs ml-1">({player.careerTotals?.blocks || 0})</span>
                  </td>
                  <td className="px-4 py-3 text-center text-white text-sm">
                    {player.currentSeasonStats.receptionEfficiency?.toFixed(1) || 'N/A'}%
                    <span className="text-gray-500 text-xs ml-1">
                      ({player.careerTotals?.receptionEfficiency?.toFixed(1) || 'N/A'}%)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}