/**
 * PLUSLIGA 2025-2026 - Players List Scraper
 * Usage: node scripts/scrape-plusliga-2025-2026-list.js
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const SEASON = '2025-2026';
const LEAGUE = 'plusliga';
const BASE_URL = 'https://www.plusliga.pl';
const RANKING_URL = `${BASE_URL}/statsPlayers/tournament_1/52.html`;

async function fetchPlayersList() {
  console.log(`\n🏐 ${LEAGUE.toUpperCase()} ${SEASON} - Players List Scraper`);
  console.log(`🔗 Source: ${RANKING_URL}\n`);
  
  try {
    const response = await axios.get(RANKING_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const players = [];
    const playerLinks = $('a[href*="/statsPlayers/id/"]');
    
    console.log(`🔍 Znaleziono ${playerLinks.length} linków\n`);
    
    playerLinks.each((index, element) => {
      const href = $(element).attr('href');
      const name = $(element).text().trim();
      const match = href.match(/\/statsPlayers\/id\/(\d+)\.html/);
      
      if (match && name) {
        const playerId = match[1];
        if (!players.find(p => p.id === playerId)) {
          players.push({
            id: playerId,
            name: name,
            url: `${BASE_URL}${href}`
          });
          console.log(`✅ [${players.length}] ${name} (ID: ${playerId})`);
        }
      }
    });
    
    players.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    
    const outputDir = path.join(__dirname, '..', 'data', 'plusliga-2025-2026');
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
    
    console.log(`\n✅ Saved: ${filepath}`);
    console.log(`📊 Total: ${players.length} players`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

fetchPlayersList();
