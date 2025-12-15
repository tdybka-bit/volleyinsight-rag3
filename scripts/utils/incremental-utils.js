/**
 * Incremental Scraper Utilities
 * Functions for appending new matches to existing player data
 */

const fs = require('fs');
const path = require('path');
const { parseMatchDate } = require('./date-tracker');

/**
 * Append new matches to player file (no duplicates)
 * @param {string} playerId 
 * @param {Array} newMatches 
 * @param {string} league 
 * @param {string} season 
 */
function appendMatchesToPlayerFile(playerId, newMatches, league, season) {
  const filepath = path.join(__dirname, `../../data/${league}-${season}/${playerId}.json`);

  
  // Check if file exists
  if (!fs.existsSync(filepath)) {
    console.log(`  ⚠️  File not found: ${playerId}.json - skipping`);
    return 0;
  }
  
  try {
    // Read existing data
    let playerData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    
    // Get existing match IDs to avoid duplicates
    const existingMatchIds = new Set();
    if (playerData.match_by_match) {
      playerData.match_by_match.forEach(m => {
        // Use giornata_id or match_id as unique identifier
        const id = m.giornata_id || m.match_id || `${m.date}_${m.opponent}`;
        existingMatchIds.add(id);
      });
    } else {
      playerData.match_by_match = [];
    }
    
    // Filter only truly new matches
    const uniqueNewMatches = newMatches.filter(m => {
      const id = m.giornata_id || m.match_id || `${m.date}_${m.opponent}`;
      return !existingMatchIds.has(id);
    });
    
    if (uniqueNewMatches.length === 0) {
      console.log(`  ℹ️  No new matches for ${playerId}`);
      return 0;
    }
    
    // Append new matches
    playerData.match_by_match.push(...uniqueNewMatches);
    
    // Sort by date (oldest first)
    playerData.match_by_match.sort((a, b) => {
      const dateA = parseMatchDate(a.date);
      const dateB = parseMatchDate(b.date);
      return dateA - dateB;
    });
    
    // Recalculate season totals
    playerData.stats = calculateSeasonStats(playerData.match_by_match);
    
    // Update metadata
    playerData.updated_at = new Date().toISOString();
    playerData.total_matches = playerData.match_by_match.length;
    
    // Save
    fs.writeFileSync(filepath, JSON.stringify(playerData, null, 2));
    console.log(`  ✅ Added ${uniqueNewMatches.length} new matches to ${playerId}`);
    
    return uniqueNewMatches.length;
    
  } catch (error) {
    console.error(`  ❌ Error appending to ${playerId}:`, error.message);
    return 0;
  }
}

/**
 * Recalculate season statistics from match-by-match data
 */
function calculateSeasonStats(matches) {
  if (!matches || matches.length === 0) {
    return {
      matches: 0,
      sets: 0,
      points: 0,
      aces: 0,
      blocks: 0,
      attacks: 0,
      attack_efficiency: 0,
      serve_efficiency: 0
    };
  }
  
  const stats = {
    matches: matches.length,
    sets: 0,
    points: 0,
    aces: 0,
    blocks: 0,
    attacks: 0,
    attack_won: 0,
    attack_errors: 0,
    attack_blocked: 0,
    serve_total: 0,
    serve_errors: 0
  };
  
  matches.forEach(match => {
    stats.sets += match.sets || 0;
    stats.points += match.points_total || 0;
    stats.aces += match.serve_aces || 0;
    stats.blocks += match.block_points || 0;
    stats.attacks += match.attack_total || 0;
    stats.attack_won += match.attack_won || 0;
    stats.attack_errors += match.attack_errors || 0;
    stats.attack_blocked += match.attack_blocked || 0;
    stats.serve_total += match.serve_total || 0;
    stats.serve_errors += match.serve_errors || 0;
  });
  
  // Calculate efficiencies
  if (stats.attacks > 0) {
    stats.attack_efficiency = (
      ((stats.attack_won - stats.attack_errors - stats.attack_blocked) / stats.attacks) * 100
    ).toFixed(2);
  } else {
    stats.attack_efficiency = 0;
  }
  
  if (stats.serve_total > 0) {
    stats.serve_efficiency = (
      ((stats.serve_total - stats.serve_errors) / stats.serve_total) * 100
    ).toFixed(2);
  } else {
    stats.serve_efficiency = 0;
  }
  
  return stats;
}

/**
 * Get list of player files in a league/season directory
 */
function getPlayerFiles(league, season) {
  const dir = path.join(__dirname, `../../data/${league}-${season}`);

  
  if (!fs.existsSync(dir)) {
    console.log(`⚠️  Directory not found: ${dir}`);
    return [];
  }
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  return files;
}

/**
 * Get player IDs from files
 */
function getPlayerIds(league, season) {
  const files = getPlayerFiles(league, season);
  return files.map(f => f.replace('.json', ''));
}

module.exports = {
  appendMatchesToPlayerFile,
  calculateSeasonStats,
  getPlayerFiles,
  getPlayerIds
};
