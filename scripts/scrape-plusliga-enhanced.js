/**
 * PLUSLIGA Enhanced Scraper - with match details (date, W/L, phase)
 * Usage: node scripts/scrape-plusliga-enhanced.js [player_id_start] [player_id_end]
 * Example: node scripts/scrape-plusliga-enhanced.js 12 16
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const SEASON = '2024-2025';
const LEAGUE = 'plusliga';
const BASE_URL = 'https://www.plusliga.pl';
const DELAY_MS = 3000;
const MATCH_DELAY_MS = 2000; // Delay between match detail requests

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function parseNumber(value) {
  if (!value || value === '-' || value === '') return 0;
  return parseFloat(value.replace(',', '.')) || 0;
}

function cleanText(text) {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Fetch match details from /games/id/{matchId}.html
 */
async function fetchMatchDetails(matchId) {
    const url = `${BASE_URL}/games/id/${matchId}.html`;
    console.log(`  📅 Fetching match details: ${matchId}`);
    
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      // DEBUG: Sprawdź czy element istnieje
      console.log(`    🔍 HTML length: ${response.data.length}`);
      console.log(`    🔍 .game-date found: ${$('.game-date').length}`);
      console.log(`    🔍 Date text: "${$('.game-date').text()}"`);

      // Extract date (class: game-date)
      const dateText = $('.game-date').text().trim();
      
      // Extract scores (class: game-score, first=home, second=away)
      const scores = $('.game-score');
      const scoreHome = parseInt(scores.eq(0).text().trim()) || 0;
      const scoreAway = parseInt(scores.eq(1).text().trim()) || 0;
      
      // Extract team names (links in game header)
      const teamLinks = $('.game-info a[href*="/teams/"]');
      const teamHome = teamLinks.eq(0).text().trim();
      const teamAway = teamLinks.eq(1).text().trim();
      
      // Determine phase (regular/playoff)
      let phase = 'regular';
      const breadcrumb = $('.breadcrumb').text().toLowerCase();
      if (breadcrumb.includes('playoff') || breadcrumb.includes('play-off')) {
        phase = 'playoff';
      }
      
      console.log(`    ✅ Returning:`, { date: dateText, score_home: scoreHome, score_away: scoreAway });

      return {
        date: dateText || null,
        score_home: scoreHome,
        score_away: scoreAway,
        team_home: teamHome,
        team_away: teamAway,
        phase: phase
      };
    } catch (error) {
      console.error(`  ⚠️ Error fetching match ${matchId}:`, error.message);
      return null;
    }
  }

async function fetchPlayerPage(playerId) {
  const url = `${BASE_URL}/statsPlayers/tournament_1/47/id/${playerId}.html`;
  console.log(`🔥 Fetching player: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`⚠️ Player ${playerId} not found (404)`);
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

/**
 * Extract match-by-match stats WITH match links
 */
async function extractMatchByMatchStats($, teamName) {
  const matches = [];
  const tables = $('table');
  if (tables.length < 3) return matches;
  
  const matchTable = tables.eq(2);
  const rows = matchTable.find('tr');
  
  console.log(`🏐 Found ${rows.length - 2} matches`);
  
  for (let i = 2; i < rows.length; i++) {
    const row = $(rows[i]);
    const cells = row.find('td');
    
    if (cells.length < 23) continue;
    
    // Extract match ID from link
    const matchLink = cells.eq(0).find('a').attr('href');
    let matchId = null;
    
    if (matchLink && matchLink.includes('/games/id/')) {
      const match = matchLink.match(/\/games\/id\/(\d+)\.html/);
      if (match) {
        matchId = match[1];
      }
    }
    
    const opponent = cleanText(cells.eq(0).text());
    
    // Skip summary rows
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
    
    // Fetch match details if we have matchId
    if (matchId) {
      await delay(MATCH_DELAY_MS);
      const details = await fetchMatchDetails(matchId);
      
      console.log(`    📦 Received details:`, details);

      if (details) {
        matchData.date = details.date;
        matchData.phase = details.phase;
        
        console.log(`    💾 Set matchData.date = "${matchData.date}"`); // DODAJ

        // Determine W/L
        if (matchData.is_home) {
          matchData.result = details.score_home > details.score_away ? 'W' : 'L';
        } else {
          matchData.result = details.score_away > details.score_home ? 'W' : 'L';
        }
      }
    }
    
    if (matchData.points_total < 100) {
      console.log(`    ➕ Pushing match with date: "${matchData.date}"`);
    matches.push(matchData);
    }
  }
  
  console.log(`\n  🎯 Total matches to return: ${matches.length}`);
  if (matches.length > 0) {
    console.log(`  🎯 First match date: "${matches[0].date}"`);
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
    
    // Extract team name
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
    
    const matchByMatch = await extractMatchByMatchStats($, teamName);
    
    const playerData = {
      ...basicInfo,
      season: SEASON,
      team: teamName,
      season_totals: seasonTotals,
      match_by_match: matchByMatch,
      matches_count: matchByMatch.length,
      scraped_at: new Date().toISOString()
    };
    
    console.log(`✅ ${basicInfo.name} - ${matchByMatch.length} matches with details`);
    return playerData;
    
  } catch (error) {
    console.error(`❌ Error scraping player ${playerId}:`, error.message);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log('Usage: node scrape-plusliga-enhanced.js [start_id] [end_id]');
    console.log('Example: node scrape-plusliga-enhanced.js 12 16');
    process.exit(1);
  }
  
  const startId = parseInt(args[0]);
  const endId = parseInt(args[1]);
  
  console.log(`\n🚀 Starting enhanced scraper: Players ${startId}-${endId}\n`);
  
  const players = [];
  
  for (let playerId = startId; playerId <= endId; playerId++) {
    const player = await scrapePlayer(playerId);
    
    if (player) {
      players.push(player);
    }
    
    if (playerId < endId) {
      await delay(DELAY_MS);
    }
  }
  
  // Save results
  const outputDir = path.join(__dirname, '..', 'data', 'plusliga-enhanced');
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, `players-${startId}-${endId}.json`);
  
  const output = {
    meta: {
      league: LEAGUE,
      season: SEASON,
      scraped_at: new Date().toISOString(),
      player_range: `${startId}-${endId}`,
      total_players: players.length
    },
    players
  };
  
  await fs.writeFile(outputFile, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Saved ${players.length} players to: ${outputFile}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Players scraped: ${players.length}`);
  console.log(`   Total matches: ${players.reduce((sum, p) => sum + p.matches_count, 0)}`);
}

main().catch(console.error);