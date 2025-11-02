/**
 * API Route: /api/players
 * Zwraca listę graczy z danymi enhanced (wszystkie ligi i sezony)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllPlayersEnhanced } from '@/lib/playerData';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minMatches = parseInt(searchParams.get('minMatches') || '0');
    const league = searchParams.get('league'); // null = wszystkie
    const gender = searchParams.get('gender'); // null = wszystkie
    const season = searchParams.get('season'); // null = wszystkie
    
    console.log('🔍 Fetching all players enhanced...');
    
    // Pobierz wszystkich graczy z folderów -enhanced
    let allPlayers = getAllPlayersEnhanced();
    
    console.log('📊 Total players loaded:', allPlayers.length);

    // Filtrowanie
    let filteredPlayers = allPlayers.filter(p => {
      if (minMatches > 0 && (p.currentSeasonStats?.matches || 0) < minMatches) {
        return false;
      }
      if (league && p.league !== league) {
        return false;
      }
      if (gender && p.gender !== gender) {
        return false;
      }
      if (season && p.season !== season) {
        return false;
      }
      return true;
    });

    console.log('✅ Filtered players:', filteredPlayers.length);

    // Sortowanie po punktach
    filteredPlayers.sort((a, b) => 
      (b.currentSeasonStats?.points || 0) - (a.currentSeasonStats?.points || 0)
    );

    return NextResponse.json({
      meta: {
        total_players: allPlayers.length,
        filtered_players: filteredPlayers.length,
        min_matches: minMatches,
        filters: { league, gender, season }
      },
      players: filteredPlayers
    });

  } catch (error) {
    console.error('❌ Error loading players:', error);
    return NextResponse.json(
      { 
        error: 'Failed to load players data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}