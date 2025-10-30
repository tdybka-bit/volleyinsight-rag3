/**
 * Lega Volley Enhanced Scraper
 * Scrapes player profiles with match-by-match stats and merges with calendar
 * 
 * Usage: node scripts/scrape-legavolley-enhanced.js [year] [serie] [start_index] [end_index]
 * Example: node scripts/scrape-legavolley-enhanced.js 2024 1 0 19
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const DELAY_MS = 3000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function parseNumber(text) {
  if (!text || text === '-') return 0;
  const num = parseFloat(text.replace(',', '.').trim());
  return isNaN(num) ? 0 : num;
}

/**
 * Load calendar data
 */
async function loadCalendar(year, championshipId, phases) {
  const calendar = {};
  
  for (const phase of phases) {
    const calendarFile = path.join(__dirname, '..', 'data', `legavolley-${year}`, `calendar-${championshipId}-phase${phase}.json`);
    
    if (await fs.access(calendarFile).then(() => true).catch(() => false)) {
      const content = await fs.readFile(calendarFile, 'utf-8');
      const data = JSON.parse(content);
      Object.assign(calendar, data.calendar);
    }
  }
  
  return calendar;
}

/**
 * Find match details in calendar for specific team and giornata
 */
function findMatchInCalendar(calendar, giornata, playerTeam) {
  // Extract giornata number (e.g., "RSA1 - 1 Andata" -> "1")
  const giornataNum = giornata.match(/(\d+)/)?.[1];
  if (!giornataNum) return null;
  
  for (const [key, value] of Object.entries(calendar)) {
    const calendarGiornataNum = key.match(/(\d+)/)?.[1];
    
    if (calendarGiornataNum === giornataNum) {
      // Find match where playerTeam played
      for (const match of value.matches) {
        if (match.home_team === playerTeam) {
          return {
            date: match.date,
            opponent: match.away_team,
            result: match.home_score > match.away_score ? 'W' : 'L',
            is_home: true,
            home_score: match.home_score,
            away_score: match.away_score
          };
        } else if (match.away_team === playerTeam) {
          return {
            date: match.date,
            opponent: match.home_team,
            result: match.away_score > match.home_score ? 'W' : 'L',
            is_home: false,
            home_score: match.home_score,
            away_score: match.away_score
          };
        }
      }
    }
  }
  
  return null;
}

/**
 * Scrape player profile
 */
async function scrapePlayer(playerId, playerName, playerTeam, year, serie, calendar) {
  try {
    console.log(`\n🔥 [${playerId}] ${playerName} (${playerTeam})`);
    
    const url = `https://www.legavolley.it/statistiche/?TipoStat=2.2&Serie=${serie}&AnnoInizio=${year}&Fase=100&Giornata=0&Atleta=${playerId}`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    
    // Collect matches
    const matches = [];
    $('table#Statistica tbody tr').each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length < 10) return;
      
      const giornata = cleanText(cells.eq(0).text());
      
      if (!giornata || giornata.includes('Giornata') || giornata === '') return;
      
      const matchData = {
        giornata: giornata,
        sets: parseNumber(cells.eq(1).text()),
        points_total: parseNumber(cells.eq(2).text()),
        points_break: parseNumber(cells.eq(3).text()),
        serve_total: parseNumber(cells.eq(4).text()),
        serve_aces: parseNumber(cells.eq(5).text()),
        serve_errors: parseNumber(cells.eq(6).text()),
        ace_per_set: parseNumber(cells.eq(7).text()),
        serve_efficiency: parseNumber(cells.eq(8).text()),
        reception_total: parseNumber(cells.eq(9).text()),
        reception_errors: parseNumber(cells.eq(10).text()),
        reception_negative: parseNumber(cells.eq(11).text()),
        reception_perfect: parseNumber(cells.eq(12).text()),
        reception_perfect_percent: parseNumber(cells.eq(13).text()),
        reception_efficiency: parseNumber(cells.eq(14).text()),
        attack_total: parseNumber(cells.eq(15).text()),
        attack_errors: parseNumber(cells.eq(16).text()),
        attack_winning: parseNumber(cells.eq(17).text()),
        attack_perfect: parseNumber(cells.eq(18).text()),
        attack_perfect_percent: parseNumber(cells.eq(19).text()),
        attack_efficiency: parseNumber(cells.eq(20).text()),
        block_points: parseNumber(cells.eq(21).text()),
        block_perfect: parseNumber(cells.eq(22).text()),
        points_per_set: parseNumber(cells.eq(23).text())
      };
      
      // Enrich with calendar data
      const calendarMatch = findMatchInCalendar(calendar, giornata, playerTeam);
      if (calendarMatch) {
        Object.assign(matchData, calendarMatch);
      }
      
      matches.push(matchData);
    });
    
    console.log(`   ✅ ${matches.length} matches`);
    
    return {
      id: playerId,
      name: playerName,
      team: playerTeam,
      league: 'legavolley',
      serie: serie,
      season: `${year}-${parseInt(year) + 1}`,
      url: url,
      match_by_match: matches,
      matches_count: matches.length,
      scraped_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 4) {
    console.log('Usage: node scripts/scrape-legavolley-enhanced.js [year] [serie] [start_index] [end_index]');
    console.log('Example: node scripts/scrape-legavolley-enhanced.js 2024 1 0 19');
    process.exit(1);
  }
  
  const [year, serie, startIndex, endIndex] = args.map(Number);
  
  // Load players list (now with teams!)
  const playersListFile = path.join(__dirname, '..', 'data', `legavolley-${year}`, `players-list-serie${serie}.json`);
  console.log(`\n📂 Loading ${playersListFile}...`);
  
  const playersListData = await fs.readFile(playersListFile, 'utf-8');
  const playersList = JSON.parse(playersListData);
  
  const totalPlayers = playersList.players.length;
  console.log(`📊 Total players: ${totalPlayers}`);
  
  if (startIndex < 0 || endIndex >= totalPlayers || startIndex > endIndex) {
    console.error(`❌ Invalid range. Must be 0-${totalPlayers - 1}`);
    process.exit(1);
  }
  
  // Load calendar
  console.log(`\n📅 Loading calendar...`);
  const calendar = await loadCalendar(year, 947, [1, 2]); // Regular season phases
  console.log(`✅ Loaded ${Object.keys(calendar).length} giornate`);
  
  const playersToScrape = playersList.players.slice(startIndex, endIndex + 1);
  
  console.log(`\n🚀 Starting: Lega Volley ${year} Serie ${serie} - Players ${startIndex}-${endIndex} (${playersToScrape.length} players)\n`);
  
  const players = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < playersToScrape.length; i++) {
    const playerInfo = playersToScrape[i];
    const progress = `[${i + 1}/${playersToScrape.length}]`;
    
    console.log(`${progress} Progress: ${successCount} success, ${failCount} failed`);
    
    const player = await scrapePlayer(
      playerInfo.id, 
      playerInfo.name, 
      playerInfo.team,  // Now we have team from players list!
      year, 
      serie, 
      calendar
    );
    
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
  const outputDir = path.join(__dirname, '..', 'data', `legavolley-${year}-enhanced`);
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, `players-serie${serie}-${startIndex}-${endIndex}.json`);
  
  const output = {
    meta: {
      league: 'legavolley',
      serie: serie,
      season: `${year}-${parseInt(year) + 1}`,
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
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total matches: ${players.reduce((sum, p) => sum + p.matches_count, 0)}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});