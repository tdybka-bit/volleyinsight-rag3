import { NextRequest, NextResponse } from 'next/server';
import { getAllPlayers } from '@/lib/playerData';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const allPlayers = getAllPlayers();
    const playerSeasons = allPlayers.filter(p => p.id === id);
    
    if (playerSeasons.length === 0) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    const sorted = playerSeasons.sort((a, b) => {
      const [aYear] = a.season.split('-').map(Number);
      const [bYear] = b.season.split('-').map(Number);
      return bYear - aYear;
    });

    return NextResponse.json({ players: sorted });
  } catch (error) {
    console.error('Error fetching player seasons:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}