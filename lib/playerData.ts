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
  const stats = player.season_totals || player;
  const blocks = stats.block_points || 0;
  const aces = stats.aces || 0;
  const attacks = stats.attack_total || 0;
  const reception = stats.reception_total || 0;
  
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

/**
 * Get all players with enhanced data (includes match dates, W/L, phase)
 * Reads from multiple seasons and combines player data
 */
/**
 * Get all players with enhanced data (includes match dates, W/L, phase)
 * Returns separate entry for each player-season combination
 */
export function getAllPlayersEnhanced(): PlayerWithCombinedStats[] {
  const dataDir = path.join(process.cwd(), 'data');
  const result: PlayerWithCombinedStats[] = [];
  
  // Map to track player career totals across all seasons
  const careerMap = new Map<string, SeasonStats>();

  // Read enhanced data from all seasons
  const seasons = ['2023-2024', '2024-2025'];

  // First pass: calculate career totals
  seasons.forEach(season => {
    const enhancedFile = path.join(dataDir, `plusliga-${season}`, 'players-enhanced.json');
    
    if (fs.existsSync(enhancedFile)) {
      const content = fs.readFileSync(enhancedFile, 'utf-8');
      const data = JSON.parse(content);

      data.players?.forEach((p: any) => {
        const playerId = p.id;
        const currentStats = p.season_totals || {};
        
        const existing = careerMap.get(playerId) || {
          matches: 0, sets: 0, points: 0, attacks: 0, attackEfficiency: 0,
          blocks: 0, aces: 0, serves: 0, serveEfficiency: 0,
          reception: 0, receptionEfficiency: 0
        };

        careerMap.set(playerId, {
          matches: existing.matches + (currentStats.matches || 0),
          sets: existing.sets + (currentStats.sets || 0),
          points: existing.points + (currentStats.points || 0),
          attacks: existing.attacks + (currentStats.attack_total || 0),
          attackEfficiency: 0,
          blocks: existing.blocks + (currentStats.block_points || 0),
          aces: existing.aces + (currentStats.aces || 0),
          serves: existing.serves + (currentStats.serve_total || 0),
          serveEfficiency: 0,
          reception: existing.reception + (currentStats.reception_total || 0),
          receptionEfficiency: 0
        });
      });
    }
  });

  // Second pass: create player entries for each season
  seasons.forEach(season => {
    const enhancedFile = path.join(dataDir, `plusliga-${season}`, 'players-enhanced.json');
    
    if (fs.existsSync(enhancedFile)) {
      console.log(`📊 Reading enhanced data for ${season}...`);
      const content = fs.readFileSync(enhancedFile, 'utf-8');
      const data = JSON.parse(content);

      data.players?.forEach((p: any) => {
        const currentStats = p.season_totals || {};
        
        result.push({
          id: p.id,
          name: p.name,
          team: p.team || 'Unknown',
          league: p.league || 'plusliga',
          season: season,
          position: p.position || 'Unknown',
          career_totals: {},
          season_totals: currentStats,
          match_by_match: p.match_by_match || [],
          currentSeasonStats: {
            matches: p.match_by_match?.length || 0,
            sets: p.match_by_match?.reduce((sum: number, m: any) => sum + (m.sets || 0), 0) || 0,
            points: p.match_by_match?.reduce((sum: number, m: any) => sum + (m.points_total || 0), 0) || 0,
            attacks: p.match_by_match?.reduce((sum: number, m: any) => sum + (m.attack_total || 0), 0) || 0,
            attackEfficiency: 0,
            blocks: p.match_by_match?.reduce((sum: number, m: any) => sum + (m.block_points || 0), 0) || 0,
            aces: p.match_by_match?.reduce((sum: number, m: any) => sum + (m.serve_aces || 0), 0) || 0,
            serves: p.match_by_match?.reduce((sum: number, m: any) => sum + (m.serve_total || 0), 0) || 0,
            serveEfficiency: 0,
            reception: p.match_by_match?.reduce((sum: number, m: any) => sum + (m.reception_total || 0), 0) || 0,
            receptionEfficiency: 0
          },
          careerTotals: careerMap.get(p.id) || {
            matches: 0, sets: 0, points: 0, attacks: 0, attackEfficiency: 0,
            blocks: 0, aces: 0, serves: 0, serveEfficiency: 0,
            reception: 0, receptionEfficiency: 0
          }
        });
      });
    }
  });

  console.log(`✅ Loaded ${result.length} player-season entries`);
  return result;
}