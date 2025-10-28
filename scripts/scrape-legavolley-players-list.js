/**
 * Lega Volley Players List Scraper
 * Scrapes list of all players with IDs
 * 
 * Usage: node scripts/scrape-legavolley-players-list.js [year] [serie]
 * Example: node scripts/scrape-legavolley-players-list.js 2024 1
 * 
 * Serie:
 * - 1 = Serie A1 (SuperLega)
 * - 2 = Serie A2
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

async function scrapePlayers(year, serie) {
  // URL for player statistics page
  const url = `https://www.legavolley.it/rendimento/?Tipo=2&Classifica=2.1&AnnoInizio=${year}&AnnoFine=${year}&Serie=${serie}&Fase=1&Giornata=0&Pos=200&lang=en`;  
  console.log(`\n👥 Scraping players: ${url}\n`);

  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000
  });

  const $ = cheerio.load(response.data);
  const players = [];

  // Find all player cells with onclick attribute containing player URL
  $('td[onclick*="player/"]').each((i, elem) => {
    const $td = $(elem);
    const onclick = $td.attr('onclick') || '';
    const playerName = $td.text().trim();

    // Extract player ID from onclick attribute
    // Example: onclick="return document.location.href=('http://www.legavolley.it/player/KEI-NOU-01')"
    const match = onclick.match(/player\/([A-Z\-0-9]+)/);
    
    if (match && playerName) {
      const playerId = match[1];
      players.push({
        id: playerId,
        name: playerName,
        url: `https://www.legavolley.it/player/${playerId}`
      });
      console.log(`✅ [${playerId}] ${playerName}`);
    }
  });

  return players;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.log('Usage: node scripts/scrape-legavolley-players-list.js [year] [serie]');
    console.log('Example: node scripts/scrape-legavolley-players-list.js 2024 1');
    console.log('\nSerie:');
    console.log('  1 = Serie A1 (SuperLega)');
    console.log('  2 = Serie A2');
    process.exit(1);
  }

  const [year, serie] = args;
  const season = `${year}-${parseInt(year) + 1}`;

  try {
    const players = await scrapePlayers(year, serie);

    // Save to file
    const outputDir = path.join(__dirname, '..', 'data', `legavolley-${year}`);
    await fs.mkdir(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, `players-list-serie${serie}.json`);
    
    const output = {
      meta: {
        year: parseInt(year),
        season,
        serie: parseInt(serie),
        scraped_at: new Date().toISOString(),
        total_players: players.length
      },
      players
    };

    await fs.writeFile(outputFile, JSON.stringify(output, null, 2));

    console.log(`\n✅ Players list saved to: ${outputFile}`);
    console.log(`📊 Total players: ${players.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();