/**
 * API Route: /api/players/[id]
 * Zwraca szczegóły gracza z match-by-match stats
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const playerId = params.id;
    const { searchParams } = new URL(request.url);
    const league = searchParams.get('league') || 'plusliga';

    // Ścieżki do plików (wybór folderu na podstawie ligi)
    const dataDir = path.join(
      process.cwd(), 
      'data', 
      league === 'tauronliga' ? 'tauronliga' : 'players'
    );
    const files = await fs.readdir(dataDir);
    
    // Znajdujemy wszystkie pliki *-full.json
    const fullFiles = files.filter(f => f.includes('-full.json'));
    
    // Szukamy gracza we wszystkich plikach
    for (const file of fullFiles) {
      const filePath = path.join(dataDir, file);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(fileContent);
      
      const player = data.players.find((p: any) => p.id === playerId);
      
      if (player) {
        return NextResponse.json({
          player: player
        });
      }
    }

    // Gracz nie znaleziony
    return NextResponse.json(
      { error: 'Player not found', id: playerId },
      { status: 404 }
    );

  } catch (error) {
    console.error('Error loading player:', error);
    return NextResponse.json(
      { error: 'Failed to load player data' },
      { status: 500 }
    );
  }
}