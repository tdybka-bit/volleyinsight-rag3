'use client';

import { useState, useEffect } from 'react';

interface Team {
  position: number;
  name: string;
  matches: number;
  wins: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
}

interface StatsData {
  meta: {
    league: string;
    season: string;
    gender: string;
    scraped_at: string;
  };
  standings: Team[];
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [season, setSeason] = useState('2024-2025');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stats?league=plusliga&season=${season}`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [season]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-xl">Ładowanie statystyk...</p>
        </div>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-xl text-red-600">Błąd ładowania danych</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            📊 Statystyki PlusLiga
          </h1>
          
          {/* Wybór sezonu */}
          <div className="flex gap-4 items-center">
            <label className="text-gray-700 font-medium">Sezon:</label>
            <select 
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="2024-2025">2024/2025</option>
              <option value="2023-2024">2023/2024</option>
              <option value="2022-2023">2022/2023</option>
            </select>
            
            <span className="text-sm text-gray-500 ml-auto">
              Zaktualizowano: {new Date(data.meta.scraped_at).toLocaleString('pl-PL')}
            </span>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Drużyna</th>
                <th className="px-4 py-3 text-center">M</th>
                <th className="px-4 py-3 text-center">W</th>
                <th className="px-4 py-3 text-center">L</th>
                <th className="px-4 py-3 text-center font-bold">PKT</th>
                <th className="px-4 py-3 text-center">Sety</th>
                <th className="px-4 py-3 text-center">Bilans</th>
              </tr>
            </thead>
            <tbody>
              {data.standings.map((team, index) => (
                <tr 
                  key={team.name}
                  className={`
                    border-b border-gray-200 hover:bg-blue-50 transition-colors
                    ${index < 3 ? 'bg-green-50' : ''}
                    ${index >= data.standings.length - 2 ? 'bg-red-50' : ''}
                  `}
                >
                  <td className="px-4 py-3 font-bold text-gray-700">
                    {team.position}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {team.name}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {team.matches}
                  </td>
                  <td className="px-4 py-3 text-center text-green-600 font-medium">
                    {team.wins}
                  </td>
                  <td className="px-4 py-3 text-center text-red-600 font-medium">
                    {team.losses}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-lg text-blue-700">
                    {team.points}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {team.setsWon}:{team.setsLost}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`
                      font-medium
                      ${team.setsWon > team.setsLost ? 'text-green-600' : 'text-red-600'}
                    `}>
                      {team.setsWon > team.setsLost ? '+' : ''}
                      {team.setsWon - team.setsLost}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legenda */}
        <div className="mt-6 flex gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
            <span>TOP 3</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
            <span>Strefa spadkowa</span>
          </div>
        </div>
      </div>
    </div>
  );
}
