/**
 * PLUSLIGA 2024-2025 - Players Scraper
 * Usage: node scripts/scrape-plusliga-2024-2025-players.js [count] or [start] [end]
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const SEASON = '2024-2025';
const LEAGUE = 'plusliga';
const BASE_URL = 'https://www.plusliga.pl';
const DELAY_MS = 3000;
const PLAYERS_LIST_FILE = path.join(__dirname, '..', 'data', 'plusliga-2024-2025', 'players-list.json');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function parseNumber(value) {
  if (!value || value === '-' || value === '') return 0;
  return parseFloat(value.replace(',', '.')) || 0;
}

function cleanText(text) {
  return text.trim().replace(/\s+/g, ' ');
}

async function fetchPlayerPage(playerId) {
  const url = `${BASE_URL}/statsPlayers/tournament_1/47/id/${playerId}.html`;
  console.log(`📥 Fetching: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`⚠️  Player ${playerId} not found (404)`);
      return null;
    }
    throw error;
  }
}

function extractPlayerBasicInfo($, playerId) {
  const playerName = $('h1.text-center.notranslate a').text().trim();
  return {
    id: playerId.toString(),
    name: playerName || `Player ${playerId}`,
    url: `${BASE_URL}/statsPlayers/id/${playerId}.html`
  };
}

function extractSeasonTotals($) {
  const stats = {};
  const tables = $('table');
  if (tables.length < 2) return stats;
  
  const mainTable = tables.eq(1);
  const rows = mainTable.find('tr');
  if (rows.length < 3) return stats;
  
  const cells = $(rows[2]).find('td');
  console.log(`📊 Znaleziono ${cells.length} kolumn`);
  
  if (cells.length >= 19) {
    stats.matches = parseNumber(cells.eq(0).text());
    stats.sets = parseNumber(cells.eq(1).text());
    stats.points = parseNumber(cells.eq(2).text());
    stats.serve_total = parseNumber(cells.eq(3).text());
    stats.aces = parseNumber(cells.eq(4).text());
    stats.serve_errors = parseNumber(cells.eq(5).text());
    stats.aces_per_set = parseNumber(cells.eq(6).text());
    stats.reception_total = parseNumber(cells.eq(7).text());
    stats.reception_errors = parseNumber(cells.eq(8).text());
    stats.reception_negative = parseNumber(cells.eq(9).text());
    stats.reception_perfect = parseNumber(cells.eq(10).text());
    stats.reception_perfect_percent = parseNumber(cells.eq(11).text());
    stats.attack_total = parseNumber(cells.eq(12).text());
    stats.attack_errors = parseNumber(cells.eq(13).text());
    stats.attack_blocked = parseNumber(cells.eq(14).text());
    stats.attack_perfect = parseNumber(cells.eq(15).text());
    stats.attack_perfect_percent = parseNumber(cells.eq(16).text());
    stats.block_points = parseNumber(cells.eq(17).text());
    stats.block_points_per_set = parseNumber(cells.eq(18).text());
  }
  return stats;
}

function extractMatchByMatchStats($) {
  const matches = [];
  const tables = $('table');
  if (tables.length < 3) return matches;
  
  const matchTable = tables.eq(2);
  const rows = matchTable.find('tr');
  console.log(`🏐 Znaleziono ${rows.length - 2} meczów`);
  
  for (let i = 2; i < rows.length; i++) {
    const row = $(rows[i]);
    const cells = row.find('td');
    if (cells.length < 23) continue;
    
    const matchData = {
      opponent: cleanText(cells.eq(0).text()),
      sets: parseNumber(cells.eq(1).text()),
      points_total: parseNumber(cells.eq(2).text()),
      points_break: parseNumber(cells.eq(3).text()),
      points_balance: parseNumber(cells.eq(4).text()),
      serve_total: parseNumber(cells.eq(5).text()),
      serve_errors: parseNumber(cells.eq(6).text()),
      serve_aces: parseNumber(cells.eq(7).text()),
      serve_efficiency: parseNumber(cells.eq(8).text()),
      reception_total: parseNumber(cells.eq(9).text()),
      reception_errors: parseNumber(cells.eq(10).text()),
      reception_positive_percent: parseNumber(cells.eq(11).text()),
      reception_perfect_percent: parseNumber(cells.eq(12).text()),
      attack_total: parseNumber(cells.eq(13).text()),
      attack_errors: parseNumber(cells.eq(14).text()),
      attack_blocked: parseNumber(cells.eq(15).text()),
      attack_points: parseNumber(cells.eq(16).text()),
      attack_success_percent: parseNumber(cells.eq(17).text()),
      attack_efficiency: parseNumber(cells.eq(18).text()),
      block_points: parseNumber(cells.eq(19).text()),
      block_plus: parseNumber(cells.eq(20).text()),
      defense: parseNumber(cells.eq(21).text()),
      assists: parseNumber(cells.eq(22).text())
    };
    
    const opponent = matchData.opponent?.toLowerCase() || '';
    if (opponent && !opponent.includes('suma') && !opponent.includes('razem') && matchData.points_total < 100) {
      matches.push(matchData);
    }
  }
  return matches;
}

async function scrapePlayer(playerId) {
  try {
    const html = await fetchPlayerPage(playerId);
    if (!html) return null;
    
    const $ = cheerio.load(html);
    const basicInfo = extractPlayerBasicInfo($, playerId);
    const seasonTotals = extractSeasonTotals($);
    const matchByMatch = extractMatchByMatchStats($);
    
    // Extract team name from first match
    let teamName = 'Unknown';
    if (matchByMatch.length > 0 && matchByMatch[0].opponent) {
      const firstMatch = matchByMatch[0].opponent;
      const parts = firstMatch.split('-');
      if (parts.length >= 2) {
        teamName = parts[0].trim();
      }
    }
    
    // Add is_home field to each match
    const matchesWithHome = matchByMatch.map(match => ({
      ...match,
      is_home: match.opponent ? match.opponent.trim().startsWith(teamName) : false
    }));

    const playerData = {
      ...basicInfo,
      season: SEASON,
      team: teamName,
      season_totals: seasonTotals,
      match_by_match: matchesWithHome,
      matches_count: matchesWithHome.length
    };
    
    console.log(`✅ ${basicInfo.name}: ${matchByMatch.length} meczów`);
    return playerData;
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log(`\n🏐 ${LEAGUE.toUpperCase()} ${SEASON} - Players Scraper\n`);
  
  let playersList;
  try {
    const data = await fs.readFile(PLAYERS_LIST_FILE, 'utf-8');
    playersList = JSON.parse(data);
  } catch (error) {
    console.error(`❌ Run list scraper first!`);
    process.exit(1);
  }
  
  const allPlayers = playersList.players;
  console.log(`✅ Loaded ${allPlayers.length} players\n`);
  
  const args = process.argv.slice(2);
  let startIndex = 0;
  let endIndex = allPlayers.length;
  
  if (args.length === 1) {
    endIndex = Math.min(parseInt(args[0]), allPlayers.length);
  } else if (args.length === 2) {
    startIndex = parseInt(args[0]) - 1;
    endIndex = parseInt(args[1]);
  }
  
  const playersToScrape = allPlayers.slice(startIndex, endIndex);
  console.log(`🔢 Scraping ${playersToScrape.length} players (${startIndex + 1} - ${endIndex})\n`);
  
  const players = [];
  let successCount = 0;
  
  for (let i = 0; i < playersToScrape.length; i++) {
    const playerInfo = playersToScrape[i];
    console.log(`[${i + 1}/${playersToScrape.length}] ${playerInfo.name} (ID: ${playerInfo.id})`);
    
    const player = await scrapePlayer(playerInfo.id);
    if (player) {
      players.push(player);
      successCount++;
    }
    
    if (i < playersToScrape.length - 1) await delay(DELAY_MS);
  }
  
  const outputDir = path.join(__dirname, '..', 'data', 'plusliga-2024-2025');
  await fs.mkdir(outputDir, { recursive: true });
  
  const rangeStr = startIndex === 0 && endIndex === allPlayers.length ? 'all' : `${startIndex + 1}-${endIndex}`;
  const filepath = path.join(outputDir, `players-${rangeStr}-full.json`);
  
  const output = {
    meta: {
      league: LEAGUE,
      season: SEASON,
      scraped_at: new Date().toISOString(),
      player_range: rangeStr,
      total_players: players.length
    },
    players: players
  };
  
  await fs.writeFile(filepath, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Saved: ${filepath}`);
  console.log(`📊 Players: ${successCount}`);
  console.log(`🏐 Matches: ${players.reduce((sum, p) => sum + p.matches_count, 0)}`);
}

main();

/**
 * INCREMENTAL SCRAPE - for weekly refresh
 */
const { isMatchAfterDate } = require('./utils/date-tracker');
const { appendMatchesToPlayerFile, getPlayerIds } = require('./utils/incremental-utils');

async function incrementalScrape(season, sinceDate) {
  console.log(`\n🔄 PlusLiga Incremental Scrape`);
  console.log(`Season: ${season}`);
  console.log(`Since: ${sinceDate || 'ALL (first run)'}`);
  
  const league = 'plusliga';
  
  // Get all player IDs from existing files
  const playerIds = getPlayerIds(league, season);
  console.log(`Found ${playerIds.length} players to update`);
  
  let totalNewMatches = 0;
  let playersUpdated = 0;
  
  for (let i = 0; i < playerIds.length; i++) {
    const playerId = playerIds[i];
    console.log(`\n[${i+1}/${playerIds.length}] Processing ${playerId}...`);
    
    try {
      // Fetch player page
      const html = await fetchPlayerPage(playerId);
      
      if (!html) {
        console.log(`  ⏭️  Skipped (404)`);
        continue;
      }
      
      // Parse matches
      const $ = cheerio.load(html);
      const allMatches = extractMatchByMatchStats($);
      
      if (!allMatches || allMatches.length === 0) {
        console.log(`  ℹ️  No matches found`);
        continue;
      }
      
      // Filter only NEW matches (after sinceDate)
      const newMatches = sinceDate 
        ? allMatches.filter(m => {
            // Match doesn't have date field, so we can't filter by date
            // For now, just return all matches and let appendMatchesToPlayerFile handle duplicates
            return true;
          })
        : allMatches;
      
      console.log(`  📊 Total matches: ${allMatches.length}, New: ${newMatches.length}`);
      
      if (newMatches.length > 0) {
        // Append to player file
        const added = appendMatchesToPlayerFile(
          playerId,
          newMatches,
          league,
          season
        );
        
        if (added > 0) {
          totalNewMatches += added;
          playersUpdated++;
        }
      }
      
      // Rate limiting
      await delay(DELAY_MS);
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
  
  return { 
    playersUpdated, 
    totalNewMatches 
  };
}

// Export for use by refresh-weekly.js
module.exports = {
  incrementalScrape
};