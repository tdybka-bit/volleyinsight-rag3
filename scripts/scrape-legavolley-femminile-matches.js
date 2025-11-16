/**
 * LegaVolley Femminile Matches Calendar Scraper
 * Scrapes match results from calendario-risultati page
 * 
 * Usage: node scripts/scrape-legavolley-femminile-matches.js [year]
 * Example: node scripts/scrape-legavolley-femminile-matches.js 2024
 */

const axios = require('axios');
const cheerio = require('cheerio');
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
 * Scrape matches from risultati page using championship ID
 */
async function scrapeMatches(year, championshipId, phase) {
  const url = `https://www.legavolleyfemminile.it/risultati/?serie=1&campionato=${championshipId}&stagione=${year}`;
  
  console.log(`\n📥 Fetching ${phase} (championship ${championshipId}): ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const matches = [];
    
    // Find all match containers
    $('.calendario-risultati-list .match-item, .match-box, [data-match-id]').each((idx, element) => {
      const $match = $(element);
      
      // Try to find match ID from various possible locations
      let matchId = $match.attr('data-match-id') || 
                    $match.find('[data-match-id]').attr('data-match-id') ||
                    $match.find('.match-id').text().trim().replace('#', '');
      
      // If no match ID found, try to extract from text content
      if (!matchId) {
        const matchIdText = $match.find('*').filter((i, el) => {
          return $(el).text().match(/#\d+/);
        }).first().text();
        matchId = matchIdText.replace('#', '').trim();
      }
      
      if (!matchId) return; // Skip if no match ID
      
      // Extract teams - look for team names
      const teamElements = $match.find('.team-name, .club-name, [class*="team"]');
      let homeTeam = '';
      let awayTeam = '';
      
      if (teamElements.length >= 2) {
        homeTeam = cleanText($(teamElements[0]).text());
        awayTeam = cleanText($(teamElements[1]).text());
      }
      
      // If not found, try alternative structure
      if (!homeTeam || !awayTeam) {
        const allText = $match.text();
        // Pattern: "Team A vs Team B" or "Team A - Team B"
        const teamMatch = allText.match(/([A-Za-z\s]+(?:Volley|Bergamo|Casalmaggiore|Conegliano)[A-Za-z\s]*)/g);
        if (teamMatch && teamMatch.length >= 2) {
          homeTeam = cleanText(teamMatch[0]);
          awayTeam = cleanText(teamMatch[1]);
        }
      }
      
      if (!homeTeam || !awayTeam) return; // Skip if teams not found
      
      // Extract score - look for set results (e.g., "3-2", "3:2", or separate numbers)
      let homeSets = 0;
      let awaySets = 0;
      
      const scoreElements = $match.find('.score, .result, [class*="set"]');
      
      if (scoreElements.length >= 2) {
        homeSets = parseInt($(scoreElements[0]).text().trim()) || 0;
        awaySets = parseInt($(scoreElements[1]).text().trim()) || 0;
      } else {
        // Try to find score in text like "3-2" or "3:2"
        const scoreText = $match.find('.score, .result').text();
        const scoreMatch = scoreText.match(/(\d+)[\s\-:]+(\d+)/);
        if (scoreMatch) {
          homeSets = parseInt(scoreMatch[1]) || 0;
          awaySets = parseInt(scoreMatch[2]) || 0;
        }
      }
      
      // Extract date
      const dateElement = $match.find('.date, .match-date, time');
      let date = cleanText(dateElement.text());
      
      // If date not found, try to extract from text
      if (!date) {
        const dateMatch = $match.text().match(/(\d{2}\/\d{2}\/\d{4})/);
        if (dateMatch) date = dateMatch[1];
      }
      
      matches.push({
        match_id: matchId,
        home_team: homeTeam,
        away_team: awayTeam,
        home_sets: homeSets,
        away_sets: awaySets,
        date: date,
        phase: phase
      });
    });
    
    console.log(`   ✅ Found ${matches.length} matches for ${phase}`);
    return matches;
    
  } catch (error) {
    console.error(`   ❌ Error fetching ${phase}:`, error.message);
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 1) {
    console.log('Usage: node scripts/scrape-legavolley-femminile-matches.js [year]');
    console.log('Example: node scripts/scrape-legavolley-femminile-matches.js 2024');
    process.exit(1);
  }
  
  const year = parseInt(args[0]);
  const season = `${year}-${parseInt(year) + 1}`;
  
  console.log(`\n🏐 LEGAVOLLEY FEMMINILE - MATCHES SCRAPER`);
  console.log(`Season: ${season}`);
  console.log(`============================================================\n`);
  
  // Championship IDs by year (from giornate files)
  const CHAMPIONSHIP_IDS = {
    2024: { regular: 710313, playoff: 710322 },
    2023: { regular: 710303, playoff: 710311 },
    2022: { regular: 710276, playoff: 710284 }
  };
  
  const ids = CHAMPIONSHIP_IDS[year];
  if (!ids) {
    console.error(`❌ Unknown year: ${year}. Available: 2022, 2023, 2024`);
    process.exit(1);
  }
  
  // Scrape regular season
  const regularMatches = await scrapeMatches(year, ids.regular, 'regular');
  await delay(DELAY_MS);
  
  // Scrape playoffs
  const playoffMatches = await scrapeMatches(year, ids.playoff, 'playoff');
  
  // Combine all matches
  const allMatches = [...regularMatches, ...playoffMatches];
  
  console.log(`\n✅ Total: ${allMatches.length} matches`);
  console.log(`   📊 Regular season: ${regularMatches.length}`);
  console.log(`   🏆 Playoff: ${playoffMatches.length}`);
  
  // Save to file
  const outputDir = path.join(__dirname, '..', 'data', `legavolley-femminile-${season}`);
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, 'matches-calendar.json');
  
  const output = {
    meta: {
      league: 'legavolley-femminile',
      season: season,
      scraped_at: new Date().toISOString(),
      total_matches: allMatches.length
    },
    matches: allMatches
  };
  
  await fs.writeFile(outputFile, JSON.stringify(output, null, 2));
  
  console.log(`\n💾 Saved: ${outputFile}`);
  console.log(`📦 Total: ${allMatches.length} matches\n`);
  console.log(`✅ SUCCESS!\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});