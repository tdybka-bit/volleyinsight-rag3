/**
 * VolleyInsight - Scraper Generator
 * Generuje wszystkie scrapery dla 3 sezonów (PlusLiga + Tauron Liga)
 * 
 * Usage: node generate-scrapers.js
 */

const fs = require('fs').promises;
const path = require('path');

const SEASONS = [
  { year: '2024-2025', plusliga: 47, tauronliga: 48 },
  { year: '2023-2024', plusliga: 44, tauronliga: 45 },
  { year: '2022-2023', plusliga: 41, tauronliga: 42 }
];

// Template dla list scraper
const listTemplate = (league, season, tournamentId, baseUrl) => `/**
 * ${league.toUpperCase()} ${season} - Players List Scraper
 * Usage: node scripts/scrape-${league}-${season}-list.js
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const SEASON = '${season}';
const LEAGUE = '${league}';
const BASE_URL = '${baseUrl}';
const RANKING_URL = \`\${BASE_URL}/statsPlayers/tournament_1/${tournamentId}.html\`;

async function fetchPlayersList() {
  console.log(\`\\n🏐 \${LEAGUE.toUpperCase()} \${SEASON} - Players List Scraper\`);
  console.log(\`🔗 Source: \${RANKING_URL}\\n\`);
  
  try {
    const response = await axios.get(RANKING_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const players = [];
    const playerLinks = $('a[href*="/statsPlayers/id/"]');
    
    console.log(\`🔍 Znaleziono \${playerLinks.length} linków\\n\`);
    
    playerLinks.each((index, element) => {
      const href = $(element).attr('href');
      const name = $(element).text().trim();
      const match = href.match(/\\/statsPlayers\\/id\\/(\\d+)\\.html/);
      
      if (match && name) {
        const playerId = match[1];
        if (!players.find(p => p.id === playerId)) {
          players.push({
            id: playerId,
            name: name,
            url: \`\${BASE_URL}\${href}\`
          });
          console.log(\`✅ [\${players.length}] \${name} (ID: \${playerId})\`);
        }
      }
    });
    
    players.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    
    const outputDir = path.join(__dirname, '..', 'data', '${league}-${season}');
    await fs.mkdir(outputDir, { recursive: true });
    
    const output = {
      meta: {
        league: LEAGUE,
        season: SEASON,
        scraped_at: new Date().toISOString(),
        total_players: players.length,
        source_url: RANKING_URL
      },
      players: players
    };
    
    const filepath = path.join(outputDir, 'players-list.json');
    await fs.writeFile(filepath, JSON.stringify(output, null, 2));
    
    console.log(\`\\n✅ Saved: \${filepath}\`);
    console.log(\`📊 Total: \${players.length} players\`);
    
  } catch (error) {
    console.error(\`❌ Error: \${error.message}\`);
  }
}

fetchPlayersList();
`;

// Template dla players scraper
const playersTemplate = (league, season, tournamentId, baseUrl) => `/**
 * ${league.toUpperCase()} ${season} - Players Scraper
 * Usage: node scripts/scrape-${league}-${season}-players.js [count] or [start] [end]
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const SEASON = '${season}';
const LEAGUE = '${league}';
const BASE_URL = '${baseUrl}';
const DELAY_MS = 3000;
const PLAYERS_LIST_FILE = path.join(__dirname, '..', 'data', '${league}-${season}', 'players-list.json');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function parseNumber(value) {
  if (!value || value === '-' || value === '') return 0;
  return parseFloat(value.replace(',', '.')) || 0;
}

function cleanText(text) {
  return text.trim().replace(/\\s+/g, ' ');
}

async function fetchPlayerPage(playerId) {
  const url = \`\${BASE_URL}/statsPlayers/tournament_1/${tournamentId}/id/\${playerId}.html\`;
  console.log(\`📥 Fetching: \${url}\`);
  
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(\`⚠️  Player \${playerId} not found (404)\`);
      return null;
    }
    throw error;
  }
}

function extractPlayerBasicInfo($, playerId) {
  const playerName = $('h1.text-center.notranslate a').text().trim();
  return {
    id: playerId.toString(),
    name: playerName || \`Player \${playerId}\`,
    url: \`\${BASE_URL}/statsPlayers/id/\${playerId}.html\`
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
  console.log(\`📊 Znaleziono \${cells.length} kolumn\`);
  
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
  console.log(\`🏐 Znaleziono \${rows.length - 2} meczów\`);
  
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
    
    const playerData = {
      ...basicInfo,
      season: SEASON,
      team: teamName,
      season_totals: seasonTotals,
      match_by_match: matchByMatch,
      matches_count: matchByMatch.length
    };
    
    console.log(\`✅ \${basicInfo.name}: \${matchByMatch.length} meczów\`);
    return playerData;
    
  } catch (error) {
    console.error(\`❌ Error: \${error.message}\`);
    return null;
  }
}

async function main() {
  console.log(\`\\n🏐 \${LEAGUE.toUpperCase()} \${SEASON} - Players Scraper\\n\`);
  
  let playersList;
  try {
    const data = await fs.readFile(PLAYERS_LIST_FILE, 'utf-8');
    playersList = JSON.parse(data);
  } catch (error) {
    console.error(\`❌ Run list scraper first!\`);
    process.exit(1);
  }
  
  const allPlayers = playersList.players;
  console.log(\`✅ Loaded \${allPlayers.length} players\\n\`);
  
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
  console.log(\`🔢 Scraping \${playersToScrape.length} players (\${startIndex + 1} - \${endIndex})\\n\`);
  
  const players = [];
  let successCount = 0;
  
  for (let i = 0; i < playersToScrape.length; i++) {
    const playerInfo = playersToScrape[i];
    console.log(\`[\${i + 1}/\${playersToScrape.length}] \${playerInfo.name} (ID: \${playerInfo.id})\`);
    
    const player = await scrapePlayer(playerInfo.id);
    if (player) {
      players.push(player);
      successCount++;
    }
    
    if (i < playersToScrape.length - 1) await delay(DELAY_MS);
  }
  
  const outputDir = path.join(__dirname, '..', 'data', '${league}-${season}');
  await fs.mkdir(outputDir, { recursive: true });
  
  const rangeStr = startIndex === 0 && endIndex === allPlayers.length ? 'all' : \`\${startIndex + 1}-\${endIndex}\`;
  const filepath = path.join(outputDir, \`players-\${rangeStr}-full.json\`);
  
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
  
  console.log(\`\\n✅ Saved: \${filepath}\`);
  console.log(\`📊 Players: \${successCount}\`);
  console.log(\`🏐 Matches: \${players.reduce((sum, p) => sum + p.matches_count, 0)}\`);
}

main();
`;

async function generateScrapers() {
  console.log('🎯 VolleyInsight - Scraper Generator\n');
  
  const scriptsDir = path.join(__dirname, 'scripts');
  
  for (const season of SEASONS) {
    const year = season.year;
    
    // PlusLiga
    console.log(`📝 Generating PlusLiga ${year}...`);
    
    const plusligaListPath = path.join(scriptsDir, `scrape-plusliga-${year}-list.js`);
    const plusligaListCode = listTemplate('plusliga', year, season.plusliga, 'https://www.plusliga.pl');
    await fs.writeFile(plusligaListPath, plusligaListCode);
    console.log(`   ✅ ${plusligaListPath}`);
    
    const plusligaPlayersPath = path.join(scriptsDir, `scrape-plusliga-${year}-players.js`);
    const plusligaPlayersCode = playersTemplate('plusliga', year, season.plusliga, 'https://www.plusliga.pl');
    await fs.writeFile(plusligaPlayersPath, plusligaPlayersCode);
    console.log(`   ✅ ${plusligaPlayersPath}`);
    
    // Tauron Liga
    console.log(`📝 Generating Tauron Liga ${year}...`);
    
    const tauronligaListPath = path.join(scriptsDir, `scrape-tauronliga-${year}-list.js`);
    const tauronligaListCode = listTemplate('tauronliga', year, season.tauronliga, 'https://www.tauronliga.pl');
    await fs.writeFile(tauronligaListPath, tauronligaListCode);
    console.log(`   ✅ ${tauronligaListPath}`);
    
    const tauronligaPlayersPath = path.join(scriptsDir, `scrape-tauronliga-${year}-players.js`);
    const tauronligaPlayersCode = playersTemplate('tauronliga', year, season.tauronliga, 'https://www.tauronliga.pl');
    await fs.writeFile(tauronligaPlayersPath, tauronligaPlayersCode);
    console.log(`   ✅ ${tauronligaPlayersPath}\n`);
  }
  
  console.log('✅ Generated 12 scrapers!');
  console.log('\n📋 Next steps:');
  console.log('1. Run list scrapers first (e.g., node scripts/scrape-plusliga-2023-2024-list.js)');
  console.log('2. Then run player scrapers (e.g., node scripts/scrape-plusliga-2023-2024-players.js 50)');
}

generateScrapers().catch(console.error);