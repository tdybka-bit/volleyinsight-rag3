/**
 * VolleyInsight RAG - Players List Scraper
 * Pobiera listę ID wszystkich graczy z aktualnego sezonu
 * 
 * Usage: node scripts/scrape-players-list.js
 * Output: data/players/plusliga-2024-2025-players-list.json
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const SEASON = '2024-2025';
const LEAGUE = 'plusliga';
const BASE_URL = 'https://www.plusliga.pl';
const RANKING_URL = `${BASE_URL}/statsPlayers/tournament_1/47.html`;

/**
 * Pobiera listę graczy z rankingu
 */
async function fetchPlayersList() {
  console.log(`\n🏐 VolleyInsight - Players List Scraper`);
  console.log(`📅 Season: ${SEASON}`);
  console.log(`🔗 Source: ${RANKING_URL}\n`);
  
  try {
    console.log(`📥 Fetching players list...`);
    
    const response = await axios.get(RANKING_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const players = [];
    
    // Znajdujemy wszystkie linki do profili graczy
    // Format: /statsPlayers/id/XXXX.html
    const playerLinks = $('a[href*="/statsPlayers/id/"]');
    
    console.log(`🔍 Znaleziono ${playerLinks.length} linków do profili graczy\n`);
    
    playerLinks.each((index, element) => {
      const href = $(element).attr('href');
      const name = $(element).text().trim();
      
      // Ekstraktujemy ID z URL
      const match = href.match(/\/statsPlayers\/id\/(\d+)\.html/);
      
      if (match && name) {
        const playerId = match[1];
        
        // Sprawdzamy czy nie mamy już tego gracza (mogą być duplikaty)
        const exists = players.find(p => p.id === playerId);
        
        if (!exists) {
          players.push({
            id: playerId,
            name: name,
            url: `${BASE_URL}${href}`
          });
          
          console.log(`✅ [${players.length}] ${name} (ID: ${playerId})`);
        }
      }
    });
    
    // Sortujemy po ID (rosnąco)
    players.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    
    // Zapisujemy do pliku
    const outputDir = path.join(__dirname, '..', 'data', 'players');
    await fs.mkdir(outputDir, { recursive: true });
    
    const filename = `${LEAGUE}-${SEASON}-players-list.json`;
    const filepath = path.join(outputDir, filename);
    
    const output = {
      meta: {
        league: LEAGUE,
        season: SEASON,
        scraped_at: new Date().toISOString(),
        total_players: players.length,
        source_url: RANKING_URL,
        id_range: {
          min: players[0]?.id || null,
          max: players[players.length - 1]?.id || null
        }
      },
      players: players
    };
    
    await fs.writeFile(filepath, JSON.stringify(output, null, 2));
    
    console.log(`\n✅ Lista graczy zapisana!`);
    console.log(`📁 File: ${filepath}`);
    console.log(`📊 Total players: ${players.length}`);
    console.log(`🔢 ID range: ${output.meta.id_range.min} - ${output.meta.id_range.max}`);
    
    return players;
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    throw error;
  }
}

// Uruchomienie
fetchPlayersList().catch(console.error);