import { NextRequest, NextResponse } from 'next/server';
import { getAllPlayersEnhanced } from '@/lib/playerData';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    // Używamy getAllPlayersEnhanced - czyta z folderów -enhanced
    const allPlayers = getAllPlayersEnhanced();
    
    // Znajdź gracza po ID (może być z lub bez prefixu league)
    let player = allPlayers.find(p => p.id === id);
    
    // Jeśli nie znaleziono, spróbuj dodać prefix plusliga
    if (!player && !id.includes('-')) {
      player = allPlayers.find(p => p.id === `plusliga-${id}`);
    }
    
    // Jeśli wciąż nie ma, spróbuj inne ligi
    if (!player && !id.includes('-')) {
      player = allPlayers.find(p => p.id.endsWith(`-${id}`));
    }
    
    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(player);
  } catch (error) {
    console.error('Error fetching player:', error);
    return NextResponse.json(
      { error: 'Failed to load player data' },
      { status: 500 }
    );
  }
}