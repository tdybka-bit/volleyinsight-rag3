/**
 * TAURONLIGA 2024-2025 - Players Scraper (FIXED - with match_id extraction)
 * Usage: node scripts/scrape-tauronliga-2024-2025-players.js [count] or [start] [end]
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const SEASON = '2025-2026';
const LEAGUE = 'tauronliga';
const BASE_URL = 'https://www.tauronliga.pl';
const DELAY_MS = 3000;
const PLAYERS_LIST_FILE = path.join(__dirname, '..', 'data', 'tauronliga-2025-2026', 'players-list.json');


const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function parseNumber(value) {
  if (!value || value === '-' || value === '') return 0;
  return parseFloat(value.replace(',', '.')) || 0;
}

function cleanText(text) {
  return text.trim().replace(/\s+/g, ' ');
}

// 🔧 NEW: Extract match_id from URL
function extractMatchId(url) {
  if (!url) return null;
  // URL formats możliwe:
  // /statsMatches/id/1104418.html
  // /statsMatches/tournament_1/48/id/1104418.html
  const match = url.match(/\/id\/(\d+)\.html/);
  return match ? match[1] : null;
}

async function fetchPlayerPage(playerId) {
  const url = `${BASE_URL}/statsPlayers/tournament_1/50/id/${playerId}.html`;
  console.log(`🔥 Fetching: ${url}`);

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

    // 🔧 FIX: Extract match_id from link in first column
    const opponentCell = cells.eq(0);
    const opponentLink = opponentCell.find('a').attr('href');
    const matchId = extractMatchId(opponentLink);

    const matchData = {
      match_id: matchId, // 🎯 DODANE!
      opponent: cleanText(opponentCell.text()),
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
      // Debug log dla pierwszych 3 meczów
      if (matches.length < 3) {
        console.log(`  🔍 Match: ${matchData.opponent} -> match_id: ${matchId || 'NULL'}`);
      }
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

    const playerData = {
      ...basicInfo,
      season: SEASON,
      team: teamName,
      season_totals: seasonTotals,
      match_by_match: matchByMatch.map(match => ({ 
        ...match, 
        is_home: match.opponent ? match.opponent.trim().startsWith(teamName) : false 
      })),
      matches_count: matchByMatch.length
    };

    const matchesWithId = matchByMatch.filter(m => m.match_id).length;
    console.log(`✅ ${basicInfo.name}: ${matchByMatch.length} meczów (${matchesWithId} z match_id)`);
    return playerData;

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log(`\n🏐 ${LEAGUE.toUpperCase()} ${SEASON} - Players Scraper (FIXED)\n`);

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
  console.log(`📢 Scraping ${playersToScrape.length} players (${startIndex + 1} - ${endIndex})\n`);

  const players = [];
  let successCount = 0;
  let totalMatches = 0;
  let totalMatchesWithId = 0;

  for (let i = 0; i < playersToScrape.length; i++) {
    const playerInfo = playersToScrape[i];
    console.log(`[${i + 1}/${playersToScrape.length}] ${playerInfo.name} (ID: ${playerInfo.id})`);

    const player = await scrapePlayer(playerInfo.id);
    if (player) {
      players.push(player);
      successCount++;
      totalMatches += player.matches_count;
      totalMatchesWithId += player.match_by_match.filter(m => m.match_id).length;
    }

    if (i < playersToScrape.length - 1) await delay(DELAY_MS);
  }

  const outputDir = path.join(__dirname, '..', 'data', 'tauronliga-2025-2026');
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
  console.log(`🏐 Matches: ${totalMatches}`);
  console.log(`🎯 Matches with match_id: ${totalMatchesWithId} (${((totalMatchesWithId/totalMatches)*100).toFixed(1)}%)`);
}

/**
 * Incremental scrape function for weekly refresh
 * Add this BEFORE main() call in scrape-tauronliga-2025-2026-players.js
 */

async function incrementalScrape(season, sinceDate) {
  console.log(`\n🔄 TauronLiga Incremental Scrape`);
  console.log(`Season: ${season}`);
  console.log(`Since: ${sinceDate || 'NEVER (full refresh)'}`);
  console.log('='.repeat(60));

  // Read player list
  const playersListPath = path.join(__dirname, '..', 'data', `tauronliga-${season}`, 'players-list.json');
  const listContent = await fs.readFile(playersListPath, 'utf-8');
  const listData = JSON.parse(listContent);
  const allPlayers = listData.players;

  console.log(`📋 Total players in list: ${allPlayers.length}`);

  const dataDir = path.join(__dirname, '..', 'data', `tauronliga-${season}`);
  
  let playersUpdated = 0;
  let totalNewMatches = 0;

  // Scrape each player incrementally
  for (let i = 0; i < allPlayers.length; i++) {
    const playerInfo = allPlayers[i];
    
    try {
      console.log(`\n[${i + 1}/${allPlayers.length}] ${playerInfo.name} (ID: ${playerInfo.id})`);
      
      // Scrape fresh data
      const freshPlayer = await scrapePlayer(playerInfo.id);
      
      if (!freshPlayer) {
        console.log('  ⚠️  Skipped (no data)');
        continue;
      }

      // Check if player file exists
      const playerFilePath = path.join(dataDir, `${playerInfo.id}.json`);
      
      if (await fs.access(playerFilePath).then(() => true).catch(() => false)) {
        // File exists - check for new matches
        const existingContent = await fs.readFile(playerFilePath, 'utf-8');
        const existingPlayer = JSON.parse(existingContent);
        
        const existingMatchCount = existingPlayer.match_by_match?.length || 0;
        const freshMatchCount = freshPlayer.match_by_match?.length || 0;
        
        if (freshMatchCount > existingMatchCount) {
          // New matches found!
          const newMatchesCount = freshMatchCount - existingMatchCount;
          console.log(`  ✅ ${newMatchesCount} new matches!`);
          
          // Update file with fresh data
          await fs.writeFile(playerFilePath, JSON.stringify(freshPlayer, null, 2));
          
          playersUpdated++;
          totalNewMatches += newMatchesCount;
        } else {
          console.log(`  ℹ️  No new matches (${existingMatchCount} total)`);
        }
      } else {
        // New player file
        console.log(`  🆕 New player file created`);
        await fs.writeFile(playerFilePath, JSON.stringify(freshPlayer, null, 2));
        playersUpdated++;
        totalNewMatches += freshPlayer.match_by_match?.length || 0;
      }
      
      // Delay between requests
      if (i < allPlayers.length - 1) {
        await delay(DELAY_MS);
      }
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Incremental scrape complete!`);
  console.log(`   Players updated: ${playersUpdated}`);
  console.log(`   New matches: ${totalNewMatches}`);

  return {
    playersUpdated,
    totalNewMatches
  };
}

// Export for refresh-weekly.js
module.exports = {
  incrementalScrape
};

// Only run main() if called directly (not required as module)
if (require.main === module) {
  main();
}
