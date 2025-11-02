'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { PlayerWithCombinedStats } from '@/lib/playerData';

interface Props {
  players: PlayerWithCombinedStats[];
}

export default function StatsTableWithFilters({ players }: Props) {
  const [countryFilter, setCountryFilter] = useState('all');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [minMatches, setMinMatches] = useState(0);
  const [sortBy, setSortBy] = useState<'points' | 'aces' | 'blocks' | 'attacks' | 'reception'>('points');

  const leagues = ['all', ...new Set(players.map(p => p.league))];
  const seasons = ['all', ...new Set(players.map(p => p.season))];

  const filteredPlayers = useMemo(() => {
    return players.filter(player => {
      // League filter
      if (leagueFilter !== 'all' && player.league !== leagueFilter) return false;
      
      // Season filter
      if (seasonFilter !== 'all' && player.season !== seasonFilter) return false;
      
      // Gender filter - FIX: include all men/women leagues!
      if (genderFilter === 'men' && player.gender !== 'men') return false;
      if (genderFilter === 'women' && player.gender !== 'women') return false;
      
      // Country filter - NOWE!
      if (countryFilter === 'PL') {
      if (player.league !== 'plusliga' && player.league !== 'tauronliga') return false;
      }
      if (countryFilter === 'IT') {
      if (player.league !== 'legavolley' && player.league !== 'legavolley-femminile') return false;
      }

      // Min matches filter
      if (player.currentSeasonStats.matches < minMatches) return false;
      
      return true;
    });
  }, [players, leagueFilter, seasonFilter, countryFilter, genderFilter, minMatches]);

  const sortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
      switch (sortBy) {
        case 'points':
          return b.currentSeasonStats.points - a.currentSeasonStats.points;
        case 'aces':
          return b.currentSeasonStats.aces - a.currentSeasonStats.aces;
        case 'blocks':
          return b.currentSeasonStats.blocks - a.currentSeasonStats.blocks;
        case 'attacks':
          return b.currentSeasonStats.attacks - a.currentSeasonStats.attacks;
        case 'reception':
          return (b.currentSeasonStats.receptionEfficiency || 0) - (a.currentSeasonStats.receptionEfficiency || 0);
        default:
          return 0;
      }
    });
  }, [filteredPlayers, sortBy]);

  // Get unique players (by name) with total matches across all seasons
  const uniquePlayers = useMemo(() => {
    const playerMap = new Map<string, PlayerWithCombinedStats & { totalMatches: number }>();
    
    sortedPlayers.forEach(player => {
      const existing = playerMap.get(player.name);
      if (existing) {
        existing.totalMatches += player.currentSeasonStats.matches;
      } else {
        playerMap.set(player.name, {
          ...player,
          totalMatches: player.currentSeasonStats.matches
        });
      }
    });
    
    return Array.from(playerMap.values());
  }, [sortedPlayers]);

  const sortLabels = {
    points: 'Punkty',
    aces: 'Asy',
    blocks: 'Bloki',
    attacks: 'Ataki',
    reception: 'Przyjęcie'
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          Statystyki Graczy
        </h1>
        <p className="text-gray-400">
          {uniquePlayers.length} graczy • Sortowanie: {sortLabels[sortBy]}
        </p>
      </div>

      {/* Filtry */}
      <div className="mb-6 bg-slate-800/50 rounded-lg border border-blue-800/30 p-6">
        {/* Gender buttons */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-3">Płeć</label>
          <div className="flex gap-3">
            <button
              onClick={() => setGenderFilter('all')}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                genderFilter === 'all'
                ? 'bg-slate-500 text-white shadow-lg shadow-slate-500/50'  // ✅ Nowe (szary)
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              <span className="text-2xl mr-2">⚡</span>
              Wszyscy
            </button>
            <button
              onClick={() => setGenderFilter('men')}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                genderFilter === 'men'
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              <span className="text-2xl mr-2">👨</span>
              Mężczyźni
            </button>
            <button
              onClick={() => setGenderFilter('women')}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                genderFilter === 'women'
                  ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/50'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              <span className="text-2xl mr-2">👩</span>
              Kobiety
            </button>
          </div>
        </div>

        {/* Country buttons */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-3">Kraj</label>
          <div className="flex gap-3">
            <button
              onClick={() => setCountryFilter('all')}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                countryFilter === 'all'
                  ? 'bg-slate-500 text-white shadow-lg shadow-slate-500/50'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              <span className="text-2xl mr-2">🌍</span>
              Wszystkie
            </button>
            <button
              onClick={() => setCountryFilter('PL')}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                countryFilter === 'PL'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/50'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              <span className="text-2xl mr-2">🇵🇱</span>
              Polska
            </button>
            <button
              onClick={() => setCountryFilter('IT')}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                countryFilter === 'IT'
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              <span className="text-2xl mr-2">🇮🇹</span>
              Włochy
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Liga</label>
            <select
              value={leagueFilter}
              onChange={(e) => setLeagueFilter(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-blue-800/30"
            >
              {leagues.map(league => (
                <option key={league} value={league}>
                  {league === 'all' ? 'Wszystkie' : 
                   league === 'plusliga' ? 'PlusLiga' : 
                   league === 'tauronliga' ? 'TauronLiga' :
                   league === 'legavolley' ? 'LegaVolley (IT)' :
                   league === 'legavolley-femminile' ? 'LegaVolley Femminile (IT)' :
                   league}
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

          <div>
            <label className="block text-sm text-gray-400 mb-2">Sortuj według</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-blue-800/30"
            >
              <option value="points">Punkty</option>
              <option value="aces">Asy</option>
              <option value="blocks">Bloki</option>
              <option value="attacks">Ataki</option>
              <option value="reception">Przyjęcie (%)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Min. meczów: {minMatches}</label>
            <input
              type="range"
              min="0"
              max="30"
              value={minMatches}
              onChange={(e) => setMinMatches(Number(e.target.value))}
              className="w-full"
            />
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
              {uniquePlayers.map((player, idx) => (
                <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/player/${player.id}`} className="text-orange-400 hover:text-orange-300 font-medium">
                      {player.name}
                    </Link>
                    <div className="text-xs text-gray-500">
                      {player.totalMatches} meczów (wszystkie sezony)
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-sm">{player.team}</td>
                  <td className="px-4 py-3 text-center text-white text-sm">
                    {player.currentSeasonStats.matches}
                  </td>
                  <td className="px-4 py-3 text-center text-white text-sm">
                    {player.currentSeasonStats.sets}
                  </td>
                  <td className="px-4 py-3 text-center text-orange-400 font-bold">
                    {player.currentSeasonStats.points}
                  </td>
                  <td className="px-4 py-3 text-center text-white text-sm">
                    {player.currentSeasonStats.attacks}
                  </td>
                  <td className="px-4 py-3 text-center text-white text-sm">
                    {player.currentSeasonStats.aces}
                  </td>
                  <td className="px-4 py-3 text-center text-white text-sm">
                    {player.currentSeasonStats.blocks}
                  </td>
                  <td className="px-4 py-3 text-center text-white text-sm">
                    {player.currentSeasonStats.receptionEfficiency?.toFixed(1) || 'N/A'}%
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