/**
 * TauronLiga - Build Calendar from Player Stats
 * Extracts all unique match_ids from player stats, then scrapes each match page
 * 
 * Usage: node scripts/build-calendar-from-players.js [league] [season]
 * Example: node scripts/build-calendar-from-players.js tauronliga 2024-2025
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const DELAY_MS = 1000; // 1 second between requests
const BASE_URL = 'https://www.tauronliga.pl';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function cleanText(text) {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Extract all unique match IDs from player stats
 */
async function extractMatchIds(league, season) {
  const dataDir = path.join(__dirname, '..', 'data', `${league}-${season}`);
  const playerFile = path.join(dataDir, 'players-all-full.json');
  
  console.log(`\n📂 Loading player stats: ${playerFile}`);
  
  const content = await fs.readFile(playerFile, 'utf-8');
  const data = JSON.parse(content);
  
  const matchIds = new Set();
  
  data.players.forEach(player => {
    if (!player.match_by_match) return;
    
    player.match_by_match.forEach(match => {
      if (match.match_id) {
        matchIds.add(match.match_id.toString());
      }
    });
  });
  
  console.log(`✅ Found ${matchIds.size} unique match IDs`);
  return Array.from(matchIds).sort();
}

/**
 * Scrape single match page
 */
async function scrapeMatch(matchId, tourId) {
  const url = `${BASE_URL}/games/id/${matchId}.html`;
  
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract teams - TauronLiga uses .game-team
    const teams = $('.game-team');
    if (teams.length < 2) {
      console.log(`⚠️  Match ${matchId}: Cannot find teams`);
      return null;
    }
    
    const homeTeam = cleanText($(teams[0]).text());
    const awayTeam = cleanText($(teams[1]).text());
    
    // Extract sets score - each score is in separate span.game-score
    let homeSets = 0;
    let awaySets = 0;
    
    const scoreSpans = $('.game-score');
    
    if (scoreSpans.length >= 2) {
      const homeText = $(scoreSpans[0]).text().trim();
      const awayText = $(scoreSpans[1]).text().trim();
      homeSets = parseInt(homeText) || 0;
      awaySets = parseInt(awayText) || 0;
    }
    
    // Extract date - use .first() to get only the match date, not all dates on page
    let date = '';
    const dateElement = $('.game-date').first();
    if (dateElement.length > 0) {
      date = cleanText(dateElement.text());
    }
    
    // Phase will be determined later based on match order
    let phase = 'regular';
    
    return {
      match_id: matchId,
      home_team: homeTeam,
      away_team: awayTeam,
      home_sets: homeSets,
      away_sets: awaySets,
      date: date,
      phase: phase
    };
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`⚠️  Match ${matchId}: Not found (404)`);
    } else {
      console.log(`❌ Match ${matchId}: ${error.message}`);
    }
    return null;
  }
}

/**
 * Detect phase from match sequence
 * TauronLiga: 22 kolejki × 6 meczów = 132 mecze regular season
 * Reszta = playoff
 */
function detectPhases(matches, league, season) {
  // Known regular season match counts
  const REGULAR_SEASON_MATCHES = {
    'tauronliga-2024-2025': 132, // 22 kolejki × 6 meczów
    'tauronliga-2023-2024': 132,
    'tauronliga-2022-2023': 132,
    'plusliga-2024-2025': 180,   // 16 teams × (15 × 2) / 2 rounds
    'plusliga-2023-2024': 180,
    'plusliga-2022-2023': 180
  };
  
  const key = `${league}-${season}`;
  const regularCount = REGULAR_SEASON_MATCHES[key] || Math.floor(matches.length * 0.75);
  
  console.log(`   Using ${regularCount} matches as regular season threshold`);
  
  matches.forEach((match, index) => {
    // First N matches = regular, rest = playoff
    match.phase = (index < regularCount) ? 'regular' : 'playoff';
  });
  
  return matches;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log('Usage: node scripts/build-calendar-from-players.js [league] [season]');
    console.log('Example: node scripts/build-calendar-from-players.js tauronliga 2024-2025');
    process.exit(1);
  }
  
  const [league, season] = args;
  
  console.log(`\n🏐 BUILD CALENDAR FROM PLAYER STATS`);
  console.log(`League: ${league}`);
  console.log(`Season: ${season}`);
  console.log(`============================================================`);
  
  // Tour ID mapping
  const TOUR_IDS = {
    'tauronliga-2024-2025': 48,
    'tauronliga-2023-2024': 45,
    'tauronliga-2022-2023': 42
  };
  
  const tourKey = `${league}-${season}`;
  const tourId = TOUR_IDS[tourKey];
  
  if (!tourId) {
    console.error(`❌ Unknown league/season: ${tourKey}`);
    process.exit(1);
  }
  
  // Step 1: Extract match IDs
  const matchIds = await extractMatchIds(league, season);
  
  // Step 2: Scrape each match
  console.log(`\n🔥 Scraping ${matchIds.length} matches...`);
  console.log(`   (This will take ~${Math.ceil(matchIds.length * DELAY_MS / 1000 / 60)} minutes)\n`);
  
  const matches = [];
  let successCount = 0;
  
  for (let i = 0; i < matchIds.length; i++) {
    const matchId = matchIds[i];
    
    if (i % 10 === 0) {
      console.log(`[${i + 1}/${matchIds.length}] Scraping match ${matchId}...`);
    }
    
    const matchData = await scrapeMatch(matchId, tourId);
    
    if (matchData) {
      matches.push(matchData);
      successCount++;
    }
    
    // Delay between requests
    if (i < matchIds.length - 1) {
      await delay(DELAY_MS);
    }
  }
  
  // Step 3: Detect phases (based on known regular season counts)
  console.log(`\n📊 Detecting phases...`);
  detectPhases(matches, league, season);
  
  const regularCount = matches.filter(m => m.phase === 'regular').length;
  const playoffCount = matches.filter(m => m.phase === 'playoff').length;
  
  // Step 4: Save to file
  const outputDir = path.join(__dirname, '..', 'data', `${league}-${season}`);
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, 'matches-calendar.json');
  
  const output = {
    meta: {
      league: league,
      season: season,
      tour_id: tourId,
      scraped_at: new Date().toISOString(),
      total_matches: matches.length,
      scraper: 'reverse-build-from-players'
    },
    matches: matches
  };
  
  await fs.writeFile(outputFile, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ SCRAPING COMPLETE!`);
  console.log(`   Total matches: ${matches.length}`);
  console.log(`   Success rate: ${successCount}/${matchIds.length} (${(successCount/matchIds.length*100).toFixed(1)}%)`);
  console.log(`   Regular season: ${regularCount}`);
  console.log(`   Playoffs: ${playoffCount}`);
  console.log(`\n💾 Saved: ${outputFile}\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err);
  process.exit(1);
});