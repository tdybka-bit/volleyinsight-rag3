/**
 * Player Stats Engine
 * Comprehensive volleyball statistics tracking per player
 */

export interface Rally {
  rally_number: number;
  score_before: { aluron: number; bogdanka: number };
  score_after: { aluron: number; bogdanka: number };
  team_scored: string;
  touches: Array<{
    action: string;
    player: string;
    number: string;
    team: string;
  }>;
  final_action: {
    type: string;
    player: string;
    number: string;
  };
}

export interface PlayerStats {
  // BASIC
  name: string;
  team: 'aluron' | 'bogdanka';
  position: string;
  
  // POINTS
  totalPoints: number;          // All points scored
  breakPoints: number;          // Points scored on opponent's serve (BP)
  pointBalance: number;         // Points scored - Points lost
  
  // SERVE
  serveAll: number;             // Total serves
  serveError: number;           // Serve errors
  serveAce: number;             // Aces
  serveEff: number;             // Serve effectiveness %
  
  // PASS (RECEPTION)
  passAll: number;              // All receptions
  passError: number;            // Reception errors
  passPositive: number;         // Positive receptions
  passPerfect: number;          // Perfect receptions
  passPos: number;              // Positive % ((positive + perfect) / all) * 100
  passPerf: number;             // Perfect % (perfect / all) * 100
  
  // ATTACK
  attackAll: number;            // All attacks
  attackError: number;          // Attack errors
  attackBlocked: number;        // Attacks blocked
  attackScore: number;          // Attack points
  attackSkut: number;           // Attack effectiveness % (score / all) * 100
  attackEff: number;            // Attack efficiency % ((score - error) / all) * 100
  
  // BLOCK
  blockScore: number;           // Block points
  blockTouch: number;           // Blocks keeping ball in play (not scored, not error)
  blockError: number;           // Block errors
  
  // DIG (DEFENSE)
  digAll: number;               // All digs
  digError: number;             // Dig errors
  digGood: number;              // Good digs (all - error)
  
  // SETTING
  setAll: number;               // All sets
  setToScore: number;           // Sets leading to attack score
  setToError: number;           // Sets leading to attack error
}

export interface Substitution {
  rallyNumber: number;
  playerIn: string;
  playerOut: string;
  team: 'aluron' | 'bogdanka';
  immediateServe: boolean;      // Did player serve right after sub?
}

export interface MatchStats {
  players: Map<string, PlayerStats>;
  substitutions: Substitution[];
  currentLineup: {
    aluron: string[];
    bogdanka: string[];
  };
}

/**
 * Initialize empty stats for a player
 */
function createEmptyStats(name: string, team: 'aluron' | 'bogdanka', position: string = ''): PlayerStats {
  return {
    name,
    team,
    position,
    totalPoints: 0,
    breakPoints: 0,
    pointBalance: 0,
    serveAll: 0,
    serveError: 0,
    serveAce: 0,
    serveEff: 0,
    passAll: 0,
    passError: 0,
    passPositive: 0,
    passPerfect: 0,
    passPos: 0,
    passPerf: 0,
    attackAll: 0,
    attackError: 0,
    attackBlocked: 0,
    attackScore: 0,
    attackSkut: 0,
    attackEff: 0,
    blockScore: 0,
    blockTouch: 0,
    blockError: 0,
    digAll: 0,
    digError: 0,
    digGood: 0,
    setAll: 0,
    setToScore: 0,
    setToError: 0,
  };
}

/**
 * Calculate percentages for a player
 */
function calculatePercentages(stats: PlayerStats): PlayerStats {
  // Serve Effectiveness: (aces - errors) / all serves
  if (stats.serveAll > 0) {
    stats.serveEff = ((stats.serveAce - stats.serveError) / stats.serveAll) * 100;
  }
  
  // Pass Positive %: (positive + perfect) / all
  if (stats.passAll > 0) {
    stats.passPos = ((stats.passPositive + stats.passPerfect) / stats.passAll) * 100;
    stats.passPerf = (stats.passPerfect / stats.passAll) * 100;
  }
  
  // Attack Skuteczność (effectiveness): score / all
  if (stats.attackAll > 0) {
    stats.attackSkut = (stats.attackScore / stats.attackAll) * 100;
    // Attack Efektywność (efficiency): (score - error) / all
    stats.attackEff = ((stats.attackScore - stats.attackError) / stats.attackAll) * 100;
  }
  
  // Dig Good
  stats.digGood = stats.digAll - stats.digError;
  
  return stats;
}

/**
 * Determine team from action/player context
 */
function getTeam(touch: { team: string; action: string }): 'aluron' | 'bogdanka' {
  if (touch.team.toLowerCase().includes('aluron')) return 'aluron';
  if (touch.team.toLowerCase().includes('bogdanka')) return 'bogdanka';
  // Fallback: parse from action text
  if (touch.action.toLowerCase().includes('aluron')) return 'aluron';
  if (touch.action.toLowerCase().includes('bogdanka')) return 'bogdanka';
  return 'aluron'; // default
}

/**
 * Parse a single rally and update stats
 */
function parseRally(
  rally: Rally,
  stats: Map<string, PlayerStats>,
  substitutions: Substitution[],
  prevServerTeam: 'aluron' | 'bogdanka' | null
): 'aluron' | 'bogdanka' | null {
  const touches = rally.touches;
  if (touches.length === 0) return prevServerTeam;
  
  // First touch is usually serve
  const firstTouch = touches[0];
  const serverPlayer = firstTouch.player;
  const serverTeam = getTeam(firstTouch);
  
  // Determine if this is a break point (scoring team != serving team)
  const scoringTeam = rally.team_scored.toLowerCase().includes('aluron') ? 'aluron' : 'bogdanka';
  const isBreakPoint = serverTeam !== scoringTeam;
  
  // Process each touch
  for (let i = 0; i < touches.length; i++) {
    const touch = touches[i];
    const player = touch.player;
    const action = touch.action.toLowerCase();
    const team = getTeam(touch);
    
    // Initialize player stats if new
    if (!stats.has(player)) {
      stats.set(player, createEmptyStats(player, team));
    }
    
    const playerStats = stats.get(player)!;
    
    // === SERVE ===
    if (action.includes('serve')) {
      playerStats.serveAll++;
      
      if (action.includes('error')) {
        playerStats.serveError++;
        playerStats.pointBalance--; // Lost point
      } else if (action.includes('ace')) {
        playerStats.serveAce++;
        playerStats.totalPoints++;
        playerStats.pointBalance++;
      }
    }
    
    // === PASS (RECEPTION) ===
    if (action.includes('pass')) {
      playerStats.passAll++;
      
      if (action.includes('error')) {
        playerStats.passError++;
        playerStats.pointBalance--; // Lost point
      } else if (action.includes('perfect')) {
        playerStats.passPerfect++;
      } else if (action.includes('positive') || action.includes('good')) {
        playerStats.passPositive++;
      }
    }
    
    // === ATTACK ===
    if (action.includes('attack')) {
      playerStats.attackAll++;
      
      if (action.includes('error')) {
        playerStats.attackError++;
        playerStats.pointBalance--; // Lost point
      } else if (action.includes('kill') || action.includes('score') || action.includes('point')) {
        playerStats.attackScore++;
        playerStats.totalPoints++;
        playerStats.pointBalance++;
        
        if (isBreakPoint) {
          playerStats.breakPoints++;
        }
        
        // Track setting assist (previous touch should be set)
        if (i > 0) {
          const prevTouch = touches[i - 1];
          if (prevTouch.action.toLowerCase().includes('set')) {
            const setter = prevTouch.player;
            if (stats.has(setter)) {
              stats.get(setter)!.setToScore++;
            }
          }
        }
      }
    }
    
    // === BLOCK ===
    if (action.includes('block')) {
      if (action.includes('error')) {
        playerStats.blockError++;
        // Note: Block error means opponent scored, so we track attacker's point elsewhere
      } else if (action.includes('kill') || action.includes('score') || action.includes('point')) {
        playerStats.blockScore++;
        playerStats.totalPoints++;
        playerStats.pointBalance++;
        
        if (isBreakPoint) {
          playerStats.breakPoints++;
        }
      } else {
        // Block touch (keeping ball in play)
        playerStats.blockTouch++;
      }
    }
    
    // === DIG (DEFENSE) ===
    if (action.includes('dig')) {
      playerStats.digAll++;
      
      if (action.includes('error')) {
        playerStats.digError++;
        playerStats.pointBalance--; // Lost point
      }
    }
    
    // === SETTING ===
    if (action.includes('set')) {
      playerStats.setAll++;
      
      // Check next touch for attack result
      if (i + 1 < touches.length) {
        const nextTouch = touches[i + 1];
        if (nextTouch.action.toLowerCase().includes('attack')) {
          if (nextTouch.action.toLowerCase().includes('error')) {
            playerStats.setToError++;
          }
          // setToScore is tracked in attack section above
        }
      }
    }
  }
  
  // Handle attack blocks (opponent scored via block, attacker gets -1)
  const finalAction = touches[touches.length - 1];
  if (finalAction.action.toLowerCase().includes('block') && !finalAction.action.toLowerCase().includes('error')) {
    // Find the attacker who got blocked
    for (let i = touches.length - 2; i >= 0; i--) {
      if (touches[i].action.toLowerCase().includes('attack')) {
        const attacker = touches[i].player;
        if (stats.has(attacker)) {
          stats.get(attacker)!.attackBlocked++;
        }
        break;
      }
    }
  }
  
  return serverTeam;
}

/**
 * Calculate all player statistics from rallies
 */
export function calculateMatchStats(rallies: Rally[]): MatchStats {
  const players = new Map<string, PlayerStats>();
  const substitutions: Substitution[] = [];
  let prevServerTeam: 'aluron' | 'bogdanka' | null = null;
  
  for (const rally of rallies) {
    prevServerTeam = parseRally(rally, players, substitutions, prevServerTeam);
  }
  
  // Calculate percentages for all players
  for (const [name, stats] of players.entries()) {
    players.set(name, calculatePercentages(stats));
  }
  
  return {
    players,
    substitutions,
    currentLineup: {
      aluron: [],
      bogdanka: [],
    },
  };
}

/**
 * Get top players by specific stat
 */
export function getTopPlayers(
  stats: Map<string, PlayerStats>,
  stat: keyof PlayerStats,
  limit: number = 5
): PlayerStats[] {
  return Array.from(stats.values())
    .sort((a, b) => {
      const aVal = a[stat];
      const bVal = b[stat];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return bVal - aVal;
      }
      return 0;
    })
    .slice(0, limit);
}

/**
 * Get player stats by name
 */
export function getPlayerStats(
  stats: Map<string, PlayerStats>,
  playerName: string
): PlayerStats | null {
  return stats.get(playerName) || null;
}