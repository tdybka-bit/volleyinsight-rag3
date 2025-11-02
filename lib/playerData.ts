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
 * Returns separate entry for each player-season combination
 */
export function getAllPlayersEnhanced(): PlayerWithCombinedStats[] {
  const dataDir = path.join(process.cwd(), 'data');
  const result: PlayerWithCombinedStats[] = [];
  
  // Map to track player career totals across all seasons
  const careerMap = new Map<string, SeasonStats>();

  // Define all leagues and seasons to read
  const leagueConfigs = [
    { league: 'plusliga', seasons: ['2022-2023', '2023-2024', '2024-2025'], gender: 'men' },
    { league: 'tauronliga', seasons: ['2022-2023', '2023-2024', '2024-2025'], gender: 'women' },
    { league: 'legavolley', seasons: ['2024-2025'], gender: 'men' },
    { league: 'legavolley-femminile', seasons: ['2024-2025'], gender: 'women' }
  ];

  // First pass: calculate career totals
  leagueConfigs.forEach(({ league, seasons, gender }) => {
    seasons.forEach(season => {
      const enhancedDir = path.join(dataDir, `${league}-${season}-enhanced`);
      
      if (!fs.existsSync(enhancedDir)) return;
      
      // Read all player files in the directory
      const files = fs.readdirSync(enhancedDir).filter(f => f.startsWith('players-') && f.endsWith('.json'));
      
      files.forEach(file => {
        const filePath = path.join(enhancedDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        data.players?.forEach((p: any) => {
          const playerId = `${league}-${p.id}`;
          const matches = p.match_by_match || [];
          
          const existing = careerMap.get(playerId) || {
            matches: 0, sets: 0, points: 0, attacks: 0, attackEfficiency: 0,
            blocks: 0, aces: 0, serves: 0, serveEfficiency: 0,
            reception: 0, receptionEfficiency: 0
          };

          // Sum up stats - use season_totals when available
          const matchesCount = matches.length;
          const sets = matches.reduce((sum: number, m: any) => sum + (parseInt(m.sets) || 0), 0);
          const points = matches.reduce((sum: number, m: any) => sum + (parseInt(m.points_total) || 0), 0);
          const attacks = matches.reduce((sum: number, m: any) => sum + (parseInt(m.attack_total) || parseInt(m.attack_won) || 0), 0);
          const blocks = matches.reduce((sum: number, m: any) => sum + (parseInt(m.block_points) || 0), 0);
          const aces = matches.reduce((sum: number, m: any) => sum + (parseInt(m.serve_aces) || 0), 0);
          const serves = matches.reduce((sum: number, m: any) => sum + (parseInt(m.serve_total) || 0), 0);
          
          // Reception - prefer season_totals (PlusLiga/TauronLiga), fallback to summing matches (LegaVolley)
          const receptionTotal = p.season_totals?.reception_total || 
            matches.reduce((sum: number, m: any) => sum + (parseInt(m.reception_total) || 0), 0);
          const receptionPerfect = p.season_totals?.reception_perfect || 
            matches.reduce((sum: number, m: any) => sum + (parseInt(m.reception_perfect) || parseInt(m.receptionPerfect) || 0), 0);

          careerMap.set(playerId, {
            matches: existing.matches + matchesCount,
            sets: existing.sets + sets,
            points: existing.points + points,
            attacks: existing.attacks + attacks,
            attackEfficiency: 0,
            blocks: existing.blocks + blocks,
            aces: existing.aces + aces,
            serves: existing.serves + serves,
            serveEfficiency: 0,
            reception: existing.reception + receptionTotal,
            receptionEfficiency: 0  // Calculate at the end
          });
        });
      });
    });
  });

  // Second pass: create player objects with both current season and career stats
  leagueConfigs.forEach(({ league, seasons, gender }) => {
    seasons.forEach(season => {
      const enhancedDir = path.join(dataDir, `${league}-${season}-enhanced`);
      
      if (!fs.existsSync(enhancedDir)) return;
      
      const files = fs.readdirSync(enhancedDir).filter(f => f.startsWith('players-') && f.endsWith('.json'));
      
      files.forEach(file => {
        const filePath = path.join(enhancedDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        data.players?.forEach((p: any) => {
          const playerId = `${league}-${p.id}`;
          const matches = p.match_by_match || [];
          
          // Calculate current season stats
          const matchesCount = matches.length;
          const sets = matches.reduce((sum: number, m: any) => sum + (parseInt(m.sets) || 0), 0);
          const points = matches.reduce((sum: number, m: any) => sum + (parseInt(m.points_total) || 0), 0);
          const attacks = matches.reduce((sum: number, m: any) => sum + (parseInt(m.attack_total) || parseInt(m.attack_won) || 0), 0);
          const blocks = matches.reduce((sum: number, m: any) => sum + (parseInt(m.block_points) || 0), 0);
          const aces = matches.reduce((sum: number, m: any) => sum + (parseInt(m.serve_aces) || 0), 0);
          const serves = matches.reduce((sum: number, m: any) => sum + (parseInt(m.serve_total) || 0), 0);
          
          // Reception - prefer season_totals (PlusLiga/TauronLiga), fallback to summing matches (LegaVolley)
          const receptionTotal = p.season_totals?.reception_total || 
            matches.reduce((sum: number, m: any) => sum + (parseInt(m.reception_total) || 0), 0);
          const receptionPerfect = p.season_totals?.reception_perfect || 
            matches.reduce((sum: number, m: any) => sum + (parseInt(m.reception_perfect) || parseInt(m.receptionPerfect) || 0), 0);

          const currentSeasonStats: SeasonStats = {
            matches: matchesCount,
            sets,
            points,
            attacks,
            attackEfficiency: attacks > 0 ? (points / attacks) * 100 : 0,
            blocks,
            aces,
            serves,
            serveEfficiency: serves > 0 ? (aces / serves) * 100 : 0,
            reception: receptionTotal,
            receptionEfficiency: receptionTotal > 0 ? (receptionPerfect / receptionTotal) * 100 : 0
          };

          const careerTotals = careerMap.get(playerId);

          result.push({
            id: playerId,
            name: p.name || 'Unknown',
            team: p.team || 'Unknown',
            league,
            gender,
            season,
            currentSeasonStats,
            careerTotals,
            matchByMatch: matches
          } as any);
        });
      });
    });
  });

  // Recalculate career reception efficiency
  careerMap.forEach((career, playerId) => {
    const playerMatches = result.filter(p => p.id === playerId);
    const totalPerfect = playerMatches.reduce((sum, p) => {
      const matchByMatch = (p as any).matchByMatch || [];
      const seasonPerfect = matchByMatch.reduce((s: number, m: any) => 
        s + (parseInt(m.reception_perfect) || parseInt(m.receptionPerfect) || 0), 0
      );
      return sum + seasonPerfect;
    }, 0);
    
    career.receptionEfficiency = career.reception > 0 
      ? (totalPerfect / career.reception) * 100 
      : 0;
  });

  return result;
}