import fs from 'fs';
import path from 'path';

export interface PlayerMatch {
  date: string;
  opponent: string;
  isHome: boolean;
  points: number;
  attacks: number;
  attackEfficiency: number;
  blocks: number;
  aces: number;
  serves: number;
  serveEfficiency: number;
  reception: number;
  receptionEfficiency: number;
}

export interface SeasonStats {
  matches: number;
  sets: number;
  points: number;
  attacks: number;
  attackEfficiency: number;
  blocks: number;
  aces: number;
  serves: number;
  serveEfficiency: number;
  reception: number;
  receptionEfficiency: number;
}

export interface Player {
  id: string;
  name: string;
  team: string;
  position?: string;
  league: string;
  season: string;
  career_totals: any;
  season_totals: any;
  match_by_match?: any[];
}

export interface PlayerWithCombinedStats extends Player {
  currentSeasonStats: SeasonStats;
  careerTotals: SeasonStats;
}

function guessPosition(player: any): string {
  const blocks = player.season_totals?.block_points || 0;
  const aces = player.season_totals?.aces || 0;
  const attacks = player.season_totals?.attack_total || 0;
  const reception = player.season_totals?.reception_total || 0;
  
  if (blocks > 50) return 'Środkowy';
  if (reception > 200) return 'Libero';
  if (aces > 30) return 'Przyjmujący';
  if (attacks > 500) return 'Atakujący';
  return 'Rozgrywający';
}

export function getAllPlayers(): PlayerWithCombinedStats[] {
  const dataDir = path.join(process.cwd(), 'data');
  
  if (!fs.existsSync(dataDir)) {
    console.warn('Data directory not found:', dataDir);
    return [];
  }

  const allPlayers: PlayerWithCombinedStats[] = [];
  
  const seasonDirs = fs.readdirSync(dataDir).filter(dir => {
    const fullPath = path.join(dataDir, dir);
    return fs.statSync(fullPath).isDirectory() && !dir.includes('OLD');
  });

  seasonDirs.forEach(seasonDir => {
    const seasonPath = path.join(dataDir, seasonDir);
    const files = fs.readdirSync(seasonPath).filter(f => 
      f.endsWith('.json') && f.includes('players-') && f.includes('full')
    );

    const parts = seasonDir.split('-');
    const league = parts[0];
    const seasonName = `${parts[1]}-${parts[2]}`;

    files.forEach(file => {
      try {
        const filePath = path.join(seasonPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        const players = data.players || [];

        players.forEach((player: any) => {
          const matches = player.match_by_match || [];
          const currentSeasonStats: SeasonStats = {
            matches: matches.length,
            sets: matches.reduce((sum: number, m: any) => sum + (parseInt(m.sets) || 0), 0),
            points: matches.reduce((sum: number, m: any) => sum + (parseInt(m.points_total) || 0), 0),
            attacks: matches.reduce((sum: number, m: any) => sum + (parseInt(m.attack_total) || 0), 0),
            attackEfficiency: 0,
            blocks: matches.reduce((sum: number, m: any) => sum + (parseInt(m.block_points) || 0), 0),
            aces: matches.reduce((sum: number, m: any) => sum + (parseInt(m.serve_aces) || 0), 0),
            serves: matches.reduce((sum: number, m: any) => sum + (parseInt(m.serve_total) || 0), 0),
            serveEfficiency: 0,
            reception: matches.reduce((sum: number, m: any) => sum + (parseInt(m.reception_total) || 0), 0),
            receptionEfficiency: 0
          };

          const careerTotals: SeasonStats = {
            matches: player.season_totals?.matches || 0,
            sets: player.season_totals?.sets || 0,
            points: player.season_totals?.points || 0,
            attacks: player.season_totals?.attack_total || 0,
            attackEfficiency: player.season_totals?.attack_perfect_percent || 0,
            blocks: player.season_totals?.block_points || 0,
            aces: player.season_totals?.aces || 0,
            serves: player.season_totals?.serve_total || 0,
            serveEfficiency: 0,
            reception: player.season_totals?.reception_total || 0,
            receptionEfficiency: player.season_totals?.reception_perfect_percent || 0
          };

          allPlayers.push({
            ...player,
            position: player.position || guessPosition(player),
            league,
            season: seasonName,
            currentSeasonStats,
            careerTotals
          });
        });
      } catch (error) {
        console.error(`Error reading ${file}:`, error);
      }
    });
  });

  return allPlayers;
}

export function getPlayerById(id: string): PlayerWithCombinedStats | null {
  const players = getAllPlayers();
  return players.find(p => p.id === id) || null;
}