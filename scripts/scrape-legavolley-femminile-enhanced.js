/**
 * Lega Volley Femminile Enhanced Scraper
 * Scrapes match-by-match stats for female players
 * 
 * Usage: node scripts/scrape-legavolley-femminile-enhanced.js [year] [start_index] [end_index]
 * Example: node scripts/scrape-legavolley-femminile-enhanced.js 2024 0 49
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
  if (!text || text === '-' || text === '') return 0;
  const num = parseFloat(text.replace(',', '.').trim());
  return isNaN(num) ? 0 : num;
}

/**
 * Load giornate list
 */
async function loadGiornate(year, championshipId) {
  const giornateFile = path.join(__dirname, '..', 'data', `legavolley-femminile-${year}`, `giornate-${championshipId}.json`);
  
  const content = await fs.readFile(giornateFile, 'utf-8');
  const data = JSON.parse(content);
  
  return data.giornate;
}

/**
 * Scrape player stats for one giornata
 */
async function scrapePlayerGiornata(playerId, giornataId, year) {
  const stagione = `${year}%2F${parseInt(year) + 1}`;
  const url = `https://ww5.legavolleyfemminile.it/Statistiche_i.asp?TipoStat=2.2&Serie=1&AnnoInizio=${year}&Giornata=${giornataId}&Atleta=${playerId}&Stagione=${stagione}`;
  
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    
    // Find the main stats table
    const stats = {};
    
    // Find rows with data (skip header and total rows)
    $('table tr').each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      // Skip if not enough cells or if it's header/total row
      if (cells.length < 20) return;
      
      const firstCell = cleanText(cells.eq(0).text());
      
      // Check if this is a match row (e.g., "4 Andata", "1 Ritorno")
      if (!firstCell.match(/\d+\s+(Andata|Ritorno|Quarti|Semifinali|Finale)/i)) return;
      
      // Parse cells by index (based on table structure)
      const sets = parseNumber(cells.eq(1).text());
      
      // Only process if player actually played (sets > 0)
      if (sets === 0) return;
      
      stats.sets = sets;
      stats.points_total = parseNumber(cells.eq(2).text());
      stats.points_won = parseNumber(cells.eq(3).text());
      stats.points_bp = parseNumber(cells.eq(4).text());
      
      // Serve stats (columns 5-9)
      stats.serve_total = parseNumber(cells.eq(5).text());
      stats.serve_aces = parseNumber(cells.eq(6).text());
      stats.serve_errors = parseNumber(cells.eq(7).text());
      
      // Reception stats (columns 10-15)
      stats.reception_total = parseNumber(cells.eq(10).text());
      stats.reception_errors = parseNumber(cells.eq(11).text());
      stats.reception_negative = parseNumber(cells.eq(12).text());
      stats.reception_perfect = parseNumber(cells.eq(13).text());
      
      // Attack stats (columns 16-21)
      stats.attack_total = parseNumber(cells.eq(16).text());
      stats.attack_errors = parseNumber(cells.eq(17).text());
      stats.attack_blocked = parseNumber(cells.eq(18).text());
      stats.attack_won = parseNumber(cells.eq(19).text());
      
      // Block stats (columns 22-24)
      stats.block_points = parseNumber(cells.eq(23).text());
      
      return false; // Found the row, stop searching
    });
    
    // Return stats only if we found data
    if (Object.keys(stats).length > 0) {
      return stats;
    }
    
    return null;
    
  } catch (error) {
    console.log(`     ⚠️  Failed giornata ${giornataId}: ${error.message}`);
    return null;
  }
}

/**
 * Scrape player profile with all matches
 */
async function scrapePlayer(player, year, giornate) {
  try {
    console.log(`\n🔥 [${player.id}] ${player.name} (${player.team})`);
    
    const matches = [];
    let successCount = 0;
    let emptyCount = 0;
    
    for (const giornata of giornate) {
      const stats = await scrapePlayerGiornata(player.id, giornata.id, year);
      
      if (stats && stats.sets > 0) {
        matches.push({
          giornata: giornata.name,
          giornata_id: giornata.id,
          date: giornata.date,
          phase: giornata.phase,
          ...stats
        });
        successCount++;
      } else {
        emptyCount++;
      }
      
      // Small delay between giornate
      await delay(200);
    }
    
    console.log(`   ✅ ${matches.length} matches (${successCount} with data, ${emptyCount} empty)`);
    
    return {
      id: player.id,
      name: player.name,
      team: player.team,
      team_id: player.team_id,
      league: 'legavolley-femminile',
      gender: 'women',
      season: `${year}-${parseInt(year) + 1}`,
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
  
  if (args.length !== 3) {
    console.log('Usage: node scripts/scrape-legavolley-femminile-enhanced.js [year] [start_index] [end_index]');
    console.log('Example: node scripts/scrape-legavolley-femminile-enhanced.js 2024 0 49');
    process.exit(1);
  }
  
  const [year, startIndex, endIndex] = args.map(Number);
  
  // Load players list
  const playersListFile = path.join(__dirname, '..', 'data', `legavolley-femminile-${year}`, `players-list.json`);
  console.log(`\n📂 Loading ${playersListFile}...`);
  
  const playersListData = await fs.readFile(playersListFile, 'utf-8');
  const playersList = JSON.parse(playersListData);
  
  const totalPlayers = playersList.players.length;
  console.log(`📊 Total players: ${totalPlayers}`);
  
  if (startIndex < 0 || endIndex >= totalPlayers || startIndex > endIndex) {
    console.error(`❌ Invalid range. Must be 0-${totalPlayers - 1}`);
    process.exit(1);
  }
  
  // Load giornate (Regular Season + Play-offs)
  console.log(`\n📅 Loading giornate...`);
  const giornateRegular = await loadGiornate(year, 710313); // Regular season
  const giornatePlayoffs = await loadGiornate(year, 710322); // Play-offs
  const giornate = [...giornateRegular, ...giornatePlayoffs];
  console.log(`✅ Loaded ${giornate.length} giornate (${giornateRegular.length} regular + ${giornatePlayoffs.length} playoffs)`);
  
  const playersToScrape = playersList.players.slice(startIndex, endIndex + 1);
  
  console.log(`\n🚀 Starting: LegaVolley Femminile ${year} - Players ${startIndex}-${endIndex} (${playersToScrape.length} players)\n`);
  
  const players = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < playersToScrape.length; i++) {
    const playerInfo = playersToScrape[i];
    const progress = `[${i + 1}/${playersToScrape.length}]`;
    
    console.log(`${progress} Progress: ${successCount} success, ${failCount} failed`);
    
    const player = await scrapePlayer(playerInfo, year, giornate);
    
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
  const outputDir = path.join(__dirname, '..', 'data', `legavolley-femminile-${year}-enhanced`);
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, `players-${startIndex}-${endIndex}.json`);
  
  const output = {
    meta: {
      league: 'legavolley-femminile',
      gender: 'women',
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