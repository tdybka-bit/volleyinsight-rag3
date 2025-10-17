const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Delay między requestami (1 sekunda)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Funkcja do scraping szczegółów gracza
async function scrapePlayerDetails(playerId, playerName) {
    try {
      const url = `https://www.plusliga.pl/statsPlayers/id/${playerId}.html`;
      
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(data);
      
      // Znajdź tabelę ze statystykami
      const statsRow = $('table.rs-standings-table tbody tr').first();
      const cells = statsRow.find('td');
      
      // Wyciągnij dane z komórek (indeksy zgodne z HTML)
      const player = {
        id: playerId,
        name: playerName,
        matches: parseInt(cells.eq(0).text().trim()) || 0,        // Rozegrane mecze
        sets: parseInt(cells.eq(1).text().trim()) || 0,           // Sety
        points: parseInt(cells.eq(2).text().trim()) || 0,         // Punkty
        serve: {
          suma: parseInt(cells.eq(3).text().trim()) || 0,         // Zagrywka suma
          aces: parseInt(cells.eq(4).text().trim()) || 0,         // Asy
          errors: parseInt(cells.eq(5).text().trim()) || 0,       // Błędy
          acePerSet: parseFloat(cells.eq(6).text().replace(',', '.')) || 0  // Asy na set
        },
        reception: {
          suma: parseInt(cells.eq(7).text().trim()) || 0,         // Przyjęcie suma
          errors: parseInt(cells.eq(8).text().trim()) || 0,       // Błędy
          neg: parseInt(cells.eq(9).text().trim()) || 0,          // Neg
          perf: parseInt(cells.eq(10).text().trim()) || 0,        // Perf
          perfPercent: parseFloat(cells.eq(11).text().replace(',', '.')) || 0  // Perf%
        },
        attack: {
          suma: parseInt(cells.eq(12).text().trim()) || 0,        // Atak suma
          errors: parseInt(cells.eq(13).text().trim()) || 0,      // Błędy
          blocked: parseInt(cells.eq(14).text().trim()) || 0,     // Zablokowane
          perf: parseInt(cells.eq(15).text().trim()) || 0,        // Perf
          perfPercent: parseFloat(cells.eq(16).text().replace(',', '.')) || 0  // Perf%
        },
        block: {
          points: parseInt(cells.eq(17).text().trim()) || 0,      // Blok punkty
          pointsPerSet: parseFloat(cells.eq(18).text().replace(',', '.')) || 0  // Pkt na set
        }
      };
      
      console.log(`   ✅ ${playerName} - ${player.points} pkt (${player.matches} meczów)`);
      return player;
      
    } catch (error) {
      console.error(`   ❌ Błąd dla ${playerName}:`, error.message);
      return null;
    }
  }

// Główna funkcja - scraping zakresu graczy
async function scrapePlayers(startIndex = 1, endIndex = 30, season = '2024-2025', tourId = 47) {
  console.log(`\n🏐 Scrapowanie graczy ${startIndex}-${endIndex} (PlusLiga ${season})\n`);
  
  try {
    // 1. Pobierz listę graczy ze strony głównej
    const listUrl = `https://www.plusliga.pl/statsPlayers/tournament_1/${tourId}.html`;
    const { data } = await axios.get(listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    
    // 2. Wyciągnij wszystkich graczy (linki do profili)
    const playerLinks = [];
    $('article.player-box a[href*="/statsPlayers/id/"]').each((index, element) => {
      const href = $(element).attr('href');
      const name = $(element).find('h3').text().trim() || 
                   $(element).closest('article').find('h3 a').text().trim();
      
      if (href && name) {
        const playerId = href.match(/\/id\/(\d+)\.html/)?.[1];
        if (playerId && !playerLinks.find(p => p.id === playerId)) {
          playerLinks.push({ id: playerId, name });
        }
      }
    });
    
    console.log(`📊 Znaleziono ${playerLinks.length} graczy\n`);
    
    // 3. Pobierz tylko zakres (startIndex - endIndex)
    const selectedPlayers = playerLinks.slice(startIndex - 1, endIndex);
    console.log(`🎯 Scrapuję graczy ${startIndex}-${endIndex} (${selectedPlayers.length} graczy)\n`);
    
    // 4. Scraping szczegółów dla każdego gracza
    const players = [];
    
    for (let i = 0; i < selectedPlayers.length; i++) {
      const { id, name } = selectedPlayers[i];
      console.log(`[${i + 1}/${selectedPlayers.length}] ${name}...`);
      
      const playerData = await scrapePlayerDetails(id, name);
      if (playerData) {
        players.push(playerData);
      }
      
      // Delay 1 sekunda między requestami
      if (i < selectedPlayers.length - 1) {
        await delay(1000);
      }
    }
    
    // 5. Zapisz do JSON
    const result = {
      meta: {
        league: 'PlusLiga',
        season: season,
        gender: 'male',
        scraped_at: new Date().toISOString(),
        source: 'plusliga.pl',
        range: `${startIndex}-${endIndex}`,
        total_scraped: players.length
      },
      players: players.sort((a, b) => b.points - a.points) // Sortuj po punktach
    };
    
    if (!fs.existsSync('data/players')) {
      fs.mkdirSync('data/players', { recursive: true });
    }
    
    const filename = `data/players/plusliga-${season}-players-${startIndex}-${endIndex}.json`;
    fs.writeFileSync(filename, JSON.stringify(result, null, 2), 'utf-8');
    
    console.log(`\n✅ Zapisano do ${filename}`);
    console.log(`📊 Zescrapowano ${players.length} graczy\n`);
    
    // TOP 5 punktujących z tego zakresu
    console.log('🏆 TOP 5 z tego zakresu:');
    players.slice(0, 5).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} - ${p.points} pkt (${p.matches} meczów)`);
    });
    
  } catch (error) {
    console.error('❌ Błąd:', error.message);
  }
}

// Argumenty z linii komend lub domyślne
const args = process.argv.slice(2);
const startIndex = parseInt(args[0]) || 1;
const endIndex = parseInt(args[1]) || 30;

scrapePlayers(startIndex, endIndex);