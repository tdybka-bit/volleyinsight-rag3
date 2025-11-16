/**
 * TauronLiga Matches Scraper with Puppeteer
 * Handles dynamic content (sliders, AJAX)
 * 
 * Usage: node scripts/scrape-tauronliga-matches-puppeteer.js [year]
 * Example: node scripts/scrape-tauronliga-matches-puppeteer.js 2024
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const DELAY_MS = 2000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Scrape matches using Puppeteer
 */
async function scrapeMatches(year, tourId) {
  const url = `https://www.tauronliga.pl/games/tour/${tourId}.html`;
  const season = `${year}-${parseInt(year) + 1}`;
  
  console.log(`\n📥 Opening: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // Set User-Agent to look like real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to page
    console.log('   Loading page...');
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    // Wait longer and check if page loaded
    await delay(3000);
    
    // DEBUG - Screenshot
    await page.screenshot({ path: 'tauronliga-debug.png' });
    console.log('   📸 Screenshot saved: tauronliga-debug.png');
    
    // DEBUG - Check what's on page
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    await fs.writeFile('tauronliga-debug.html', bodyHTML);
    console.log('   📄 HTML saved: tauronliga-debug.html');
    
    // Check if .ajax-synced-games exists
    const gamesCount = await page.$$eval('.ajax-synced-games', games => games.length).catch(() => 0);
    console.log(`   🔍 Found ${gamesCount} .ajax-synced-games elements`);
    
    if (gamesCount === 0) {
      console.log('   ⚠️  No .ajax-synced-games found! Check debug files.');
      throw new Error('No matches found on page');
    }
    
    // Wait for games to load
    console.log('   Waiting for matches to load...');
    await page.waitForSelector('.ajax-synced-games', { timeout: 30000 });
    
    // Scroll to bottom to trigger lazy loading
    console.log('   Scrolling to load all matches...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    await delay(2000);
    
    // Count matches
    const matchCount = await page.$$eval('.ajax-synced-games', games => games.length);
    console.log(`   Found ${matchCount} match elements`);
    
    // Extract match data
    console.log('   Extracting match data...');
    const matches = await page.evaluate(() => {
      const results = [];
      let currentPhase = 'regular';
      
      document.querySelectorAll('.ajax-synced-games').forEach((gameDiv) => {
        // Match ID
        const matchId = gameDiv.getAttribute('data-game-id');
        if (!matchId) return;
        
        // Check phase from previous elements
        const prevElements = Array.from(document.querySelectorAll('*'));
        const gameIndex = prevElements.indexOf(gameDiv);
        for (let i = gameIndex - 1; i >= Math.max(0, gameIndex - 10); i--) {
          const text = prevElements[i].textContent || '';
          if (text.toLowerCase().includes('play') || text.toLowerCase().includes('playoff')) {
            currentPhase = 'playoff';
            break;
          }
        }
        
        // Try multiple selectors for teams
        let homeTeam = '';
        let awayTeam = '';
        
        // Strategy 1: .gamesbox-body > .team
        const teamsGamesbox = gameDiv.querySelectorAll('.gamesbox-body > .team');
        if (teamsGamesbox.length >= 2) {
          homeTeam = teamsGamesbox[0].querySelector('.name')?.textContent.trim() || '';
          awayTeam = teamsGamesbox[1].querySelector('.name')?.textContent.trim() || '';
        }
        
        // Strategy 2: .game-box .team (for slider matches)
        if (!homeTeam || !awayTeam) {
          const teamsGameBox = gameDiv.querySelectorAll('.game-box .team');
          if (teamsGameBox.length >= 2) {
            homeTeam = teamsGameBox[0].querySelector('.name')?.textContent.trim() || '';
            awayTeam = teamsGameBox[1].querySelector('.name')?.textContent.trim() || '';
          }
        }
        
        // Strategy 3: Any .team in game div
        if (!homeTeam || !awayTeam) {
          const teamsAny = gameDiv.querySelectorAll('.team');
          if (teamsAny.length >= 2) {
            homeTeam = teamsAny[0].querySelector('.name')?.textContent.trim() || '';
            awayTeam = teamsAny[1].querySelector('.name')?.textContent.trim() || '';
          }
        }
        
        if (!homeTeam || !awayTeam) return;
        
        // Score - try multiple selectors
        let homeSets = 0;
        let awaySets = 0;
        
        // Strategy 1: .gamesbox-body > .score
        let scoreDiv = gameDiv.querySelector('.gamesbox-body > .score[data-synced-games-hide-if]');
        
        // Strategy 2: .game-box .score
        if (!scoreDiv) {
          scoreDiv = gameDiv.querySelector('.game-box .score');
        }
        
        if (scoreDiv) {
          const scoreSpans = scoreDiv.querySelectorAll('span[data-synced-games-content]');
          if (scoreSpans.length >= 2) {
            const homeText = scoreSpans[0].textContent.trim();
            const awayText = scoreSpans[1].textContent.trim();
            homeSets = (homeText !== '···' && homeText !== '-') ? parseInt(homeText) || 0 : 0;
            awaySets = (awayText !== '···' && awayText !== '-') ? parseInt(awayText) || 0 : 0;
          }
        }
        
        // Date
        const dateText = gameDiv.querySelector('.gamesbox-header .date')?.textContent.trim() ||
                        gameDiv.querySelector('.date-a')?.textContent.trim() ||
                        gameDiv.querySelector('.game-date')?.textContent.trim() || '';
        
        results.push({
          match_id: matchId,
          home_team: homeTeam,
          away_team: awayTeam,
          home_sets: homeSets,
          away_sets: awaySets,
          date: dateText,
          phase: currentPhase
        });
      });
      
      return results;
    });
    
    console.log(`   ✅ Extracted ${matches.length} matches`);
    
    await browser.close();
    return matches;
    
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 1) {
    console.log('Usage: node scripts/scrape-tauronliga-matches-puppeteer.js [year]');
    console.log('Example: node scripts/scrape-tauronliga-matches-puppeteer.js 2024');
    process.exit(1);
  }
  
  const year = parseInt(args[0]);
  const season = `${year}-${parseInt(year) + 1}`;
  
  console.log(`\n🏐 TAURONLIGA - PUPPETEER MATCHES SCRAPER`);
  console.log(`Season: ${season}`);
  console.log(`============================================================\n`);
  
  // Tour IDs by year
  const TOUR_IDS = {
    2024: 48, // 2024-2025 (FIXED!)
    2023: 45, // 2023-2024
    2022: 43  // 2022-2023
  };
  
  const tourId = TOUR_IDS[year];
  if (!tourId) {
    console.error(`❌ Unknown year: ${year}. Available: 2022, 2023, 2024`);
    process.exit(1);
  }
  
  // Scrape matches
  const matches = await scrapeMatches(year, tourId);
  
  // Count by phase
  const regularCount = matches.filter(m => m.phase === 'regular').length;
  const playoffCount = matches.filter(m => m.phase === 'playoff').length;
  
  console.log(`\n✅ Total: ${matches.length} matches`);
  console.log(`   📊 Regular season: ${regularCount}`);
  console.log(`   🏆 Playoff: ${playoffCount}`);
  
  // Save to file
  const outputDir = path.join(__dirname, '..', 'data', `tauronliga-${season}`);
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, 'matches-calendar.json');
  
  const output = {
    meta: {
      league: 'tauronliga',
      season: season,
      tour_id: tourId,
      scraped_at: new Date().toISOString(),
      total_matches: matches.length,
      scraper: 'puppeteer'
    },
    matches: matches
  };
  
  await fs.writeFile(outputFile, JSON.stringify(output, null, 2));
  
  console.log(`\n💾 Saved: ${outputFile}`);
  console.log(`📦 Total: ${matches.length} matches\n`);
  console.log(`✅ SUCCESS!\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});