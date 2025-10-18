/**
 * API Route: /api/players
 * Zwraca listę graczy z sumami sezonowymi
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface PlayerSeasonTotals {
  matches: number;
  sets: number;
  points: number;
  aces: number;
  serve_errors: number;
  attack_points?: number;
  block_points: number;
  reception_total: number;
  attack_total: number;
}

interface Player {
  id: string;
  name: string;
  url: string;
  season: string;
  season_totals: PlayerSeasonTotals;
  matches_count: number;
}

interface PlayersData {
  meta: {
    league: string;
    season: string;
    total_players: number;
  };
  players: Player[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minMatches = parseInt(searchParams.get('minMatches') || '0');
    const sortBy = searchParams.get('sortBy') || 'points';
    const limit = parseInt(searchParams.get('limit') || '0');
    const league = searchParams.get('league') || 'plusliga'; // plusliga or tauronliga

    // Ścieżki do plików z graczami (wybór folderu na podstawie ligi)
    const dataDir = path.join(
      process.cwd(), 
      'data', 
      league === 'tauronliga' ? 'tauronliga' : 'players'
    );
    const files = await fs.readdir(dataDir);
    
    // Znajdujemy wszystkie pliki *-full.json
    const fullFiles = files.filter(f => f.includes('-full.json'));
    
    if (fullFiles.length === 0) {
      return NextResponse.json({
        error: 'No player data found',
        message: 'Run scraper first: node scripts/scrape-players-extended.js'
      }, { status: 404 });
    }

    // Łączymy dane ze wszystkich plików (deduplikacja po ID)
    const playersMap = new Map<string, Player>();
    
    for (const file of fullFiles) {
      const filePath = path.join(dataDir, file);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const data: PlayersData = JSON.parse(fileContent);
      
      // Dodaj tylko jeśli gracz nie istnieje (deduplikacja)
      data.players.forEach((player: Player) => {
        if (!playersMap.has(player.id)) {
          playersMap.set(player.id, player);
        }
      });
    }
    
    // Konwertuj Map na Array
    const allPlayers = Array.from(playersMap.values());

    // Filtrowanie po minimalnej liczbie meczów
    let filteredPlayers = allPlayers.filter(
      p => p.season_totals.matches >= minMatches
    );

    // Sortowanie
    filteredPlayers.sort((a, b) => {
      const aValue = a.season_totals[sortBy as keyof PlayerSeasonTotals] || 0;
      const bValue = b.season_totals[sortBy as keyof PlayerSeasonTotals] || 0;
      return (bValue as number) - (aValue as number);
    });

    // Limit (jeśli podany)
    if (limit > 0) {
      filteredPlayers = filteredPlayers.slice(0, limit);
    }

    return NextResponse.json({
      meta: {
        total_players: allPlayers.length,
        filtered_players: filteredPlayers.length,
        min_matches: minMatches,
        sort_by: sortBy
      },
      players: filteredPlayers
    });

  } catch (error) {
    console.error('Error loading players:', error);
    return NextResponse.json(
      { error: 'Failed to load players data' },
      { status: 500 }
    );
  }
}