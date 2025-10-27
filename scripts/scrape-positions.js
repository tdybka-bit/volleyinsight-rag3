/**
 * Scrape player positions from /players/section/playersByPosition.html
 * Usage: node scripts/scrape-positions.js [league] [season]
 * Example: node scripts/scrape-positions.js plusliga 2024-2025
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const LEAGUE_CONFIG = {
  'plusliga': 'https://www.plusliga.pl',
  'tauronliga': 'https://www.tauronliga.pl'
};

async function scrapePositions(league) {
  const baseUrl = LEAGUE_CONFIG[league];
  if (!baseUrl) {
    throw new Error(`Unknown league: ${league}`);
  }

  const url = `${baseUrl}/players/section/playersByPosition.html`;
  console.log(`\n📥 Fetching: ${url}\n`);

  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000
  });

  const $ = cheerio.load(response.data);
  const positions = {};

  // Find all player boxes
  $('.player-box').each((i, elem) => {
    const $box = $(elem);
    
    // Extract player ID from link
    const link = $box.find('a[href*="/players/id/"]').attr('href');
    if (!link) return;
    
    const match = link.match(/\/players\/id\/(\d+)\//);
    if (!match) return;
    
    const playerId = match[1];
    
    // Extract position from h4
    const position = $box.find('h4').text().trim();
    
    if (playerId && position) {
      positions[playerId] = position;
      console.log(`✅ [${playerId}] ${position}`);
    }
  });

  return positions;
}

async function updatePlayerData(league, season, positions) {
  const enhancedFile = path.join(__dirname, '..', 'data', `${league}-${season}`, 'players-enhanced.json');
  
  console.log(`\n📂 Updating: ${enhancedFile}`);
  
  if (!await fs.access(enhancedFile).then(() => true).catch(() => false)) {
    console.log(`⚠️ File not found: ${enhancedFile}`);
    return;
  }

  const content = await fs.readFile(enhancedFile, 'utf-8');
  const data = JSON.parse(content);

  let updated = 0;
  let notFound = 0;

  data.players.forEach(player => {
    if (positions[player.id]) {
      player.position = positions[player.id];
      updated++;
    } else {
      notFound++;
    }
  });

  // Add metadata
  data.meta.positions_updated_at = new Date().toISOString();
  data.meta.positions_found = updated;
  data.meta.positions_not_found = notFound;

  await fs.writeFile(enhancedFile, JSON.stringify(data, null, 2));

  console.log(`\n✅ Update complete:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Not found: ${notFound}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.log('Usage: node scripts/scrape-positions.js [league] [season]');
    console.log('Example: node scripts/scrape-positions.js plusliga 2024-2025');
    process.exit(1);
  }

  const [league, season] = args;

  console.log(`\n🏐 Scraping positions for ${league.toUpperCase()} ${season}\n`);

  try {
    const positions = await scrapePositions(league);
    console.log(`\n📊 Found ${Object.keys(positions).length} players with positions`);

    await updatePlayerData(league, season, positions);

    console.log('\n✅ Done!\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();