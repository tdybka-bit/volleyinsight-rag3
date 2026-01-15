/**
 * DataVolley JSON Parser
 * Converts DataVolley format to VolleyInsight format
 */

export interface DataVolleyLabel {
  group: string;
  text: string;
}

export interface DataVolleyInstance {
  id: string;
  start: string;
  end: string;
  code: string;
  label: DataVolleyLabel[];
}

export interface DataVolleyFile {
  file: {
    SORT_INFO: {
      sort_type: string;
    };
    MATCH_INFO?: {
      match_id: string;
      home_team: string;
      away_team: string;
      date?: string;
      league?: string;
      season?: string;
      final_score?: {
        home: number;
        away: number;
      };
      total_rallies?: number;
    };
    ALL_INSTANCES: {
      instance: DataVolleyInstance[];
    };
  };
}

export interface Rally {
  id: number;
  homeScore: number;
  awayScore: number;
  set: number;
  action: string;
  player: string;
  team: 'home' | 'away';
  commentary?: string;
  tags?: string[];
  icon?: string;
  rallyNumber?: number;
}

export interface MatchData {
  matchInfo?: {
    matchId: string;
    homeTeam: string;
    awayTeam: string;
    date?: string;
    finalScore?: {
      home: number;
      away: number;
    };
  };
  rallies: Rally[];
}

/**
 * Parse DataVolley JSON to VolleyInsight format
 */
export function parseDataVolleyJSON(data: DataVolleyFile): MatchData {
  const instances = data.file.ALL_INSTANCES.instance;
  const matchInfo = data.file.MATCH_INFO;
  
  const rallies: Rally[] = [];
  let rallyCounter = 0;
  
  // Group instances by rally
  const rallyInstances: Map<string, DataVolleyInstance[]> = new Map();
  
  instances.forEach(inst => {
    // Rally instances have code "Rally"
    if (inst.code === 'Rally') {
      const rallyNum = getLabel(inst, 'Rally Number');
      if (rallyNum) {
        rallyInstances.set(rallyNum, [inst]);
      }
    } else {
      // Touch instances - group by rally number
      const rallyNum = getLabel(inst, 'Rally Number');
      if (rallyNum) {
        const existing = rallyInstances.get(rallyNum) || [];
        existing.push(inst);
        rallyInstances.set(rallyNum, existing);
      }
    }
  });
  
  // Convert each rally group to our format
  rallyInstances.forEach((instances, rallyNum) => {
    const rallyInst = instances.find(i => i.code === 'Rally');
    const touchInsts = instances.filter(i => i.code !== 'Rally');
    
    if (!rallyInst) return;
    
    // Parse rally info
    const setNum = parseInt(getLabel(rallyInst, 'Set') || '1');
    const gameScore = getLabel(rallyInst, 'Game Score') || '0:0';
    const scoreAfter = getLabel(rallyInst, 'Score After') || gameScore;
    
    const [homeBefore, awayBefore] = gameScore.split(':').map(s => parseInt(s.trim()));
    const [homeAfter, awayAfter] = scoreAfter.split(':').map(s => parseInt(s.trim()));
    
    // Find the final touch (last action that scored)
    const finalTouch = touchInsts[touchInsts.length - 1];
    
    if (finalTouch) {
      const player = getLabel(finalTouch, 'Player Name') || 'Unknown';
      const actionType = getLabel(finalTouch, 'Action Type') || 'Unknown';
      const result = getLabel(finalTouch, 'Result') || '';
      const team = getLabel(finalTouch, 'Team') || 'Home';
      const teamName = getLabel(finalTouch, 'Team Name') || '';
      
      // Determine action description
      let action = actionType;
      if (result === 'Ace') action = 'Ace';
      else if (result === 'Error') action = `${actionType} Error`;
      else if (result === 'Kill' || result === 'Perfect') action = `${actionType} Kill`;
      
      // Add player name to action
      if (player !== 'Unknown') {
        action = `${action} - ${player}`;
      }
      
      rallyCounter++;
      
      rallies.push({
        id: rallyCounter,
        homeScore: homeAfter,
        awayScore: awayAfter,
        set: setNum,
        action: action,
        player: player,
        team: team.toLowerCase() === 'home' ? 'home' : 'away',
        rallyNumber: parseInt(rallyNum)
      });
    }
  });
  
  // Sort by rally number
  rallies.sort((a, b) => (a.rallyNumber || 0) - (b.rallyNumber || 0));
  
  return {
    matchInfo: matchInfo ? {
      matchId: matchInfo.match_id,
      homeTeam: matchInfo.home_team,
      awayTeam: matchInfo.away_team,
      date: matchInfo.date,
      finalScore: matchInfo.final_score
    } : undefined,
    rallies
  };
}

/**
 * Helper to get label value by group name
 */
function getLabel(instance: DataVolleyInstance, groupName: string): string | undefined {
  const label = instance.label.find(l => l.group === groupName);
  return label?.text;
}

/**
 * Load and parse DataVolley JSON file
 */
export async function loadDataVolleyMatch(filepath: string): Promise<MatchData> {
  const response = await fetch(filepath);
  if (!response.ok) {
    throw new Error(`Failed to load match data: ${response.statusText}`);
  }
  
  const data: DataVolleyFile = await response.json();
  return parseDataVolleyJSON(data);
}