/**
 * Enhanced Batch Scraper - reads from players-list.json
 * Usage: node scripts/scrape-plusliga-enhanced-batch.js [league] [season] [start_index] [end_index]
 * Example: node scripts/scrape-plusliga-enhanced-batch.js plusliga 2024-2025 0 49
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const DELAY_MS = 3000;
const MATCH_DELAY_MS = 2000;
const BATCH_SIZE = 50;

// League config
const LEAGUE_CONFIG = {
  'plusliga': {
    baseUrl: 'https://www.plusliga.pl',
    tournamentId: '47'
  },
  'tauronliga': {
    baseUrl: 'https://www.tauronliga.pl',
    tournamentId: '48'
  }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function parseNumber(value) {
  if (!value || value === '-' || value === '') return 0;
  return parseFloat(value.replace(',', '.')) || 0;
}

function cleanText(text) {
  return text.trim().replace(/\s+/g, ' ');
}

async function fetchMatchDetails(matchId, baseUrl) {
  const url = `${baseUrl}/games/id/${matchId}.html`;
  
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    const dateText = $('.game-date').text().trim();
    
    const scores = $('.game-score');
    const scoreHome = parseInt(scores.eq(0).text().trim()) || 0;
    const scoreAway = parseInt(scores.eq(1).text().trim()) || 0;
    
    const teamLinks = $('.game-info a[href*="/teams/"]');
    const teamHome = teamLinks.eq(0).text().trim();
    const teamAway = teamLinks.eq(1).text().trim();
    
    let phase = 'regular';
    const breadcrumb = $('.breadcrumb').text().toLowerCase();
    if (breadcrumb.includes('playoff') || breadcrumb.includes('play-off')) {
      phase = 'playoff';
    }
    
    return {
      date: dateText || null,
      score_home: scoreHome,
      score_away: scoreAway,
      team_home: teamHome,
      team_away: teamAway,
      phase: phase
    };
  } catch (error) {
    console.error(`    ⚠️ Match ${matchId} error: ${error.message}`);
    return null;
  }
}

async function fetchPlayerPage(playerId, baseUrl, tournamentId) {
  const url = `${baseUrl}/statsPlayers/tournament_1/${tournamentId}/id/${playerId}.html`;
  
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

function extractPlayerBasicInfo($, playerId, baseUrl) {
  const playerName = $('h1.text-center.notranslate a').text().trim();
  return {
    id: playerId.toString(),
    name: playerName || `Player ${playerId}`,
    url: `${baseUrl}/statsPlayers/id/${playerId}.html`
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

async function extractMatchByMatchStats($, teamName, baseUrl) {
  const matches = [];
  const tables = $('table');
  if (tables.length < 3) return matches;
  
  const matchTable = tables.eq(2);
  const rows = matchTable.find('tr');
  
  for (let i = 2; i < rows.length; i++) {
    const row = $(rows[i]);
    const cells = row.find('td');
    
    if (cells.length < 23) continue;
    
    const matchLink = cells.eq(0).find('a').attr('href');
    let matchId = null;
    
    if (matchLink && matchLink.includes('/games/id/')) {
      const match = matchLink.match(/\/games\/id\/(\d+)\.html/);
      if (match) {
        matchId = match[1];
      }
    }
    
    const opponent = cleanText(cells.eq(0).text());
    
    if (opponent.toLowerCase().includes('suma') || 
        opponent.toLowerCase().includes('razem')) {
      continue;
    }
    
    const matchData = {
      match_id: matchId,
      opponent: opponent,
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
      assists: parseNumber(cells.eq(22).text()),
      is_home: opponent.startsWith(teamName)
    };
    
    if (matchId) {
      await delay(MATCH_DELAY_MS);
      const details = await fetchMatchDetails(matchId, baseUrl);
      
      if (details) {
        matchData.date = details.date;
        matchData.phase = details.phase;
        
        if (matchData.is_home) {
          matchData.result = details.score_home > details.score_away ? 'W' : 'L';
        } else {
          matchData.result = details.score_away > details.score_home ? 'W' : 'L';
        }
      }
    }
    
    if (matchData.points_total < 100) {
      matches.push(matchData);
    }
  }
  
  return matches;
}

async function scrapePlayer(playerId, playerName, season, league, baseUrl, tournamentId) {
  try {
    console.log(`\n🔥 [${playerId}] ${playerName}`);
    
    const html = await fetchPlayerPage(playerId, baseUrl, tournamentId);
    if (!html) {
      console.log(`   ⚠️ Not found (404)`);
      return null;
    }
    
    const $ = cheerio.load(html);
    const basicInfo = extractPlayerBasicInfo($, playerId, baseUrl);
    const seasonTotals = extractSeasonTotals($);
    
    let teamName = 'Unknown';
    const tables = $('table');
    if (tables.length >= 3) {
      const firstRow = tables.eq(2).find('tr').eq(2);
      const firstOpponent = firstRow.find('td').eq(0).text().trim();
      if (firstOpponent) {
        const parts = firstOpponent.split('-');
        if (parts.length >= 2) {
          teamName = parts[0].trim();
        }
      }
    }
    
    console.log(`   📊 Fetching ${seasonTotals.matches || 0} matches...`);
    const matchByMatch = await extractMatchByMatchStats($, teamName, baseUrl);
    
    const playerData = {
      ...basicInfo,
      season: season,
      league: league,
      team: teamName,
      season_totals: seasonTotals,
      match_by_match: matchByMatch,
      matches_count: matchByMatch.length,
      scraped_at: new Date().toISOString()
    };
    
    console.log(`   ✅ Complete - ${matchByMatch.length} matches with details`);
    return playerData;
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 4) {
    console.log('Usage: node scrape-plusliga-enhanced-batch.js [league] [season] [start_index] [end_index]');
    console.log('Example: node scrape-plusliga-enhanced-batch.js plusliga 2024-2025 0 49');
    console.log('\nAvailable leagues: plusliga, tauronliga');
    process.exit(1);
  }
  
  const league = args[0];
  const season = args[1];
  const startIndex = parseInt(args[2]);
  const endIndex = parseInt(args[3]);
  
  if (!LEAGUE_CONFIG[league]) {
    console.error(`❌ Unknown league: ${league}. Available: ${Object.keys(LEAGUE_CONFIG).join(', ')}`);
    process.exit(1);
  }
  
  const { baseUrl, tournamentId } = LEAGUE_CONFIG[league];
  const PLAYERS_LIST_FILE = path.join(__dirname, '..', 'data', `${league}-${season}`, 'players-list.json');
  const OUTPUT_DIR = path.join(__dirname, '..', 'data', `${league}-${season}-enhanced`);
  
  // Load players list
  console.log(`\n📂 Loading ${PLAYERS_LIST_FILE}...`);
  const playersListData = await fs.readFile(PLAYERS_LIST_FILE, 'utf-8');
  const playersList = JSON.parse(playersListData);
  
  const totalPlayers = playersList.players.length;
  console.log(`📊 Total players in list: ${totalPlayers}`);
  
  if (startIndex < 0 || endIndex >= totalPlayers || startIndex > endIndex) {
    console.error(`❌ Invalid range. Must be 0-${totalPlayers - 1}`);
    process.exit(1);
  }
  
  const playersToScrape = playersList.players.slice(startIndex, endIndex + 1);
  
  console.log(`\n🚀 Starting: ${league.toUpperCase()} ${season} - Players ${startIndex}-${endIndex} (${playersToScrape.length} players)\n`);
  console.log(`⏱️  Estimated time: ~${Math.round(playersToScrape.length * 3 / 60)} minutes\n`);
  
  const players = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < playersToScrape.length; i++) {
    const playerInfo = playersToScrape[i];
    const progress = `[${i + 1}/${playersToScrape.length}]`;
    
    console.log(`${progress} Progress: ${successCount} success, ${failCount} failed`);
    
    const player = await scrapePlayer(playerInfo.id, playerInfo.name, season, league, baseUrl, tournamentId);
    
    if (player) {
      players.push(player);
      successCount++;
    } else {
      failCount++;
    }
    
    if (i < playersToScrape.length - 1) {
      await delay(DELAY_MS);
    }
  }
  
  // Save results
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  
  const outputFile = path.join(OUTPUT_DIR, `players-${startIndex}-${endIndex}.json`);
  
  const output = {
    meta: {
      league: league,
      season: season,
      scraped_at: new Date().toISOString(),
      index_range: `${startIndex}-${endIndex}`,
      total_players: players.length,
      success_count: successCount,
      fail_count: failCount
    },
    players
  };
  
  await fs.writeFile(outputFile, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Saved ${players.length} players to: ${outputFile}`);
  console.log(`\n📊 Final Summary:`);
  console.log(`   League: ${league.toUpperCase()}`);
  console.log(`   Season: ${season}`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total matches: ${players.reduce((sum, p) => sum + p.matches_count, 0)}`);
  console.log(`\n💡 Next batch: node scripts/scrape-plusliga-enhanced-batch.js ${league} ${season} ${endIndex + 1} ${Math.min(endIndex + BATCH_SIZE, totalPlayers - 1)}`);
}


main().catch(console.error);