// scripts/compute-layer.js
const fs = require('fs').promises;
const path = require('path');

class ComputeLayer {
  constructor() {
    this.players = [];
  }

  async loadPlayers(league, season) {
    console.log(`📖 Loading ${league} ${season} players...`);
    
    const dataDir = path.join(__dirname, '..', 'data', `${league}-${season}`);
    const files = await fs.readdir(dataDir);
    
    const playerFiles = files.filter(f => 
      f.endsWith('.json') && 
      !f.includes('BACKUP') && 
      !f.includes('list') && 
      !f.includes('full') &&
      !f.includes('calendar')
    );
    
    for (const file of playerFiles) {
      try {
        const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
        const player = JSON.parse(content);
        this.players.push(player);
      } catch (error) {
        // Skip invalid files
      }
    }
    
    console.log(`✅ Loaded ${this.players.length} players`);
  }

  // TOP N servers by aces
  topServers(n = 10, phase = null) {
    let filtered = this.players.filter(p => p.season_totals);
    
    // Filter by phase if specified
    if (phase) {
      filtered = filtered.map(p => {
        const phaseMatches = p.match_by_match?.filter(m => m.phase === phase) || [];
        if (phaseMatches.length === 0) return null;
        
        // Calculate phase stats
        const phaseAces = phaseMatches.reduce((sum, m) => sum + (m.serve_aces || 0), 0);
        
        return {
          ...p,
          phase_stats: { aces: phaseAces, matches: phaseMatches.length }
        };
      }).filter(p => p !== null);
      
      return filtered
        .sort((a, b) => (b.phase_stats?.aces || 0) - (a.phase_stats?.aces || 0))
        .slice(0, n)
        .map(p => ({
          name: p.name,
          team: p.team,
          aces: p.phase_stats.aces,
          matches: p.phase_stats.matches,
          aces_per_match: (p.phase_stats.aces / p.phase_stats.matches).toFixed(2)
        }));
    }
    
    // Season totals
    return filtered
      .sort((a, b) => (b.season_totals.aces || 0) - (a.season_totals.aces || 0))
      .slice(0, n)
      .map(p => ({
        name: p.name,
        team: p.team,
        aces: p.season_totals.aces,
        aces_per_set: p.season_totals.aces_per_set
      }));
  }

  // Average serving stats by position
  avgByPosition() {
    const byPosition = {};
    
    this.players.forEach(p => {
      if (!p.season_totals) return;
      
      // Infer position from team name pattern or metadata
      // For now, aggregate all
      const pos = 'all';
      
      if (!byPosition[pos]) {
        byPosition[pos] = { count: 0, total_aces: 0, total_errors: 0 };
      }
      
      byPosition[pos].count++;
      byPosition[pos].total_aces += p.season_totals.aces || 0;
      byPosition[pos].total_errors += p.season_totals.serve_errors || 0;
    });
    
    return Object.entries(byPosition).map(([pos, data]) => ({
      position: pos,
      players: data.count,
      avg_aces: (data.total_aces / data.count).toFixed(2),
      avg_errors: (data.total_errors / data.count).toFixed(2)
    }));
  }

  // Filter by criteria
  filterPlayers(criteria) {
    return this.players.filter(p => {
      if (criteria.team && !p.team.includes(criteria.team)) return false;
      if (criteria.minAces && (p.season_totals?.aces || 0) < criteria.minAces) return false;
      return true;
    });
  }
}

// Test
async function test() {
  const compute = new ComputeLayer();
  
  await compute.loadPlayers('plusliga', '2025-2026');
  await compute.loadPlayers('tauronliga', '2025-2026');
  
  console.log('\n🔥 TOP 10 SERVERS (Season):');
  const top10 = compute.topServers(10);
  top10.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} (${p.team}) - ${p.aces} aces, ${p.aces_per_set}/set`);
  });
  
  console.log('\n📊 AVG by Position:');
  console.log(compute.avgByPosition());
}

test().catch(console.error);

module.exports = { ComputeLayer };