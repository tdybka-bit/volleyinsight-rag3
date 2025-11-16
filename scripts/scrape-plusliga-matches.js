/**
 * PlusLiga Matches Scraper - FINAL
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

function cleanText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

async function scrapeMatches(year) {
  const tourId = year === 2024 ? 47 : (year === 2023 ? 44 : 41);
  const url = `https://www.plusliga.pl/games/tour/${tourId}.html`;
  
  console.log(`\n🔄 Scraping: ${url}`);
  
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000
  });
  
  const $ = cheerio.load(response.data);
  const matches = [];
  
  // Parse each game section
  $('section[data-game-id]').each((idx, section) => {
    const $section = $(section);
    const matchId = $section.attr('data-game-id');
    
    // Get phase from parent sections
    const $parent = $section.closest('section[data-phase]');
    const phaseAttr = $parent.attr('data-phase');
    const phase = phaseAttr === 'RS' ? 'regular' : 'playoff';
    
    // Get teams
    const homeTeam = cleanText($section.find('.notranslate.game-team.left').text());
    const awayTeam = cleanText($section.find('.notranslate.game-team.right').text());
    
    if (!homeTeam || !awayTeam) return;
    
    // Get scores
    const scores = $section.find('.game-score');
    if (scores.length < 2) return;
    
    const homeScore = parseInt($(scores[0]).text()) || 0;
    const awayScore = parseInt($(scores[1]).text()) || 0;
    
    // Only add if match played
    if (homeScore === 0 && awayScore === 0) return;
    
    // Get date
    const date = cleanText($section.find('.game-date span').text());
    
    matches.push({
      match_id: matchId,
      home_team: homeTeam,
      away_team: awayTeam,
      home_sets: homeScore,
      away_sets: awayScore,
      date: date,
      phase: phase
    });
    
    if (matches.length % 50 === 0) {
      console.log(`   📊 ${matches.length} matches scraped...`);
    }
  });
  
  console.log(`\n✅ Total: ${matches.length} matches`);
  return matches;
}

async function main() {
  const year = parseInt(process.argv[2]);
  if (!year) {
    console.log('Usage: node scrape-plusliga-matches.js [year]');
    console.log('Example: node scrape-plusliga-matches.js 2024');
    process.exit(1);
  }
  
  const season = `${year}-${year + 1}`;
  console.log(`\n🏐 PlusLiga ${season}`);
  
  const matches = await scrapeMatches(year);
  
  const outputDir = path.join(__dirname, '..', 'data', `plusliga-${season}`);
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, 'matches-calendar.json');
  await fs.writeFile(outputFile, JSON.stringify({
    season: season,
    league: 'plusliga',
    scraped_at: new Date().toISOString(),
    total_matches: matches.length,
    matches: matches
  }, null, 2));
  
  console.log(`\n💾 Saved: ${outputFile}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Total: ${matches.length}`);
  console.log(`   Regular: ${matches.filter(m => m.phase === 'regular').length}`);
  console.log(`   Playoff: ${matches.filter(m => m.phase === 'playoff').length}`);
}

main().catch(console.error);