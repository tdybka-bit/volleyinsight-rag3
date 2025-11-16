/**
 * VolleyInsight - TauronLiga Matches Scraper
 * Scrapuje mecze z https://www.tauronliga.pl/games/tour/{tourId}.html
 * Format: match_id, home_team, away_team, home_sets, away_sets, date, phase
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

// Konfiguracja
const SEASON_YEAR = process.argv[2] || '2024'; // npm run scrape 2024
const BASE_URL = 'https://www.tauronliga.pl';

// TauronLiga Tournament IDs
const TOURNAMENT_IDS = {
  2024: 48,  // 2024-2025
  2023: 45,  // 2023-2024
  2022: 42   // 2022-2023
};

const tourId = TOURNAMENT_IDS[SEASON_YEAR];
if (!tourId) {
  console.error(`❌ Nieznany rok: ${SEASON_YEAR}. Dostępne: 2022, 2023, 2024`);
  process.exit(1);
}

const SEASON = SEASON_YEAR === '2024' ? '2024-2025' : 
               SEASON_YEAR === '2023' ? '2023-2024' : '2022-2023';

console.log(`🏐 TauronLiga Matches Scraper - Sezon ${SEASON} (tour ${tourId})`);

/**
 * Scrapuj mecze z tour page
 */
async function scrapeMatches() {
  const url = `${BASE_URL}/games/tour/${tourId}.html`;
  console.log(`\n📥 Fetching: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    const matches = [];
    let currentPhase = 'regular';
    
    // TauronLiga ma DWA typy meczów:
    // 1. .gamesbox-body (mecze w głównej liście)
    // 2. .game-box (mecze w sliderze .dc-slider-item)

    $('.ajax-synced-games').each((idx, gameDiv) => {
        const $game = $(gameDiv);
        const matchId = $game.attr('data-game-id');
        if (!matchId) return;
        
        // Sprawdź fazę
        const phaseText = $game.find('.date-b').text().trim();
        if (phaseText.toLowerCase().includes('play') || phaseText.toLowerCase().includes('playoff')) {
        currentPhase = 'playoff';
        }
        
        // Drużyny - DWIE STRUKTURY!
        let teams = $game.find('.gamesbox-body > .team');
        
        // Jeśli nie ma - szukaj w .game-box (slider)
        if (teams.length < 2) {
        teams = $game.find('.game-box .team');
        }
        
        if (teams.length < 2) {
        console.log(`SKIP: matchId ${matchId}, teams=${teams.length}`);
        return;
        }
        
        const homeTeam = $(teams[0]).find('.name').text().trim();
        const awayTeam = $(teams[1]).find('.name').text().trim();
        
        if (!homeTeam || !awayTeam) return;
        
        // Wynik - DWIE STRUKTURY!
        let scoreDiv = $game.find('.gamesbox-body > .score[data-synced-games-hide-if]').first();
        
        // Jeśli nie ma - szukaj w .game-box
        if (scoreDiv.length === 0) {
        scoreDiv = $game.find('.game-box .score').first();
        }
        
        const scoreSpans = scoreDiv.find('span[data-synced-games-content]');
        
        let homeSets = 0;
        let awaySets = 0;
        
        if (scoreSpans.length >= 2) {
        const homeText = $(scoreSpans[0]).text().trim();
        const awayText = $(scoreSpans[1]).text().trim();
        homeSets = (homeText !== '···') ? parseInt(homeText) || 0 : 0;
        awaySets = (awayText !== '···') ? parseInt(awayText) || 0 : 0;
        }
        
        // Data
        const dateText = $game.find('.gamesbox-header .date').text().trim() ||
                        $game.find('.date-a').text().trim() ||
                        $game.find('.game-date').text().trim() || '';  // DODAJ game-date!
        
        matches.push({
        match_id: matchId,
        home_team: homeTeam,
        away_team: awayTeam,
        home_sets: homeSets,
        away_sets: awaySets,
        date: dateText,
        phase: currentPhase
        });
    });
    
    console.log(`✅ Znaleziono ${matches.length} meczów`);
    
    // Statystyki
    const regularCount = matches.filter(m => m.phase === 'regular').length;
    const playoffCount = matches.filter(m => m.phase === 'playoff').length;
    console.log(`   📊 Regular season: ${regularCount}`);
    console.log(`   🏆 Playoff: ${playoffCount}`);
    
    return matches;
    
  } catch (error) {
    console.error('❌ Błąd scrapowania:', error.message);
    return [];
  }
}

/**
 * Zapisz do pliku
 */
async function saveMatches(matches) {
  const dataDir = path.join(process.cwd(), 'data', `tauronliga-${SEASON}`);
  
  // Utwórz katalog jeśli nie istnieje
  await fs.mkdir(dataDir, { recursive: true });
  
  const filePath = path.join(dataDir, 'matches-calendar.json');
  
  const output = {
    season: SEASON,
    league: 'tauronliga',
    scraped_at: new Date().toISOString(),
    total_matches: matches.length,
    matches: matches
  };
  
  await fs.writeFile(filePath, JSON.stringify(output, null, 2), 'utf-8');
  
  console.log(`\n💾 Zapisano: ${filePath}`);
  console.log(`📦 Total: ${matches.length} meczów`);
}

/**
 * MAIN
 */
async function main() {
  console.log('=' .repeat(60));
  console.log(`🏐 TAURONLIGA - SCRAPER MECZÓW`);
  console.log(`Sezon: ${SEASON} (tour ${tourId})`);
  console.log('='.repeat(60));
  
  const matches = await scrapeMatches();
  
  if (matches.length > 0) {
    await saveMatches(matches);
    console.log('\n✅ SUKCES!');
  } else {
    console.log('\n⚠️  Brak meczów do zapisania!');
  }
}

main();