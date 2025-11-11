import { NextResponse } from 'next/server';
import { getAllPlayersEnhanced } from '@/lib/playerData';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const allPlayers = getAllPlayersEnhanced();
  
  // Filter players by ID (match with or without league prefix)
  const players = allPlayers.filter(p => 
    p.id === id || p.id.endsWith(`-${id}`)
  );
  
  console.log('🔍 Found players:', players.length);
  players.forEach(p => {
    console.log(`  - ${p.season} ${p.league}: ${p.matchByMatch?.length || 0} matches, first match date: ${p.matchByMatch?.[0]?.date}`);
  });

  // Deduplicate - keep only unique season+league combinations
const uniquePlayers = Array.from(
  new Map(players.map(p => [`${p.id}-${p.season}-${p.league}`, p])).values()
);

if (uniquePlayers.length === 0) {
  return NextResponse.json({ error: 'Player not found' }, { status: 404 });
}

return NextResponse.json({ players: uniquePlayers });
}