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
  const url = `https://www.legavolleyfemminile.it/risultati/?serie=1&campionato=${championshipId}&stagione=${year}&giornata=tutte`;
  
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
    
    // Find all match tables
    $('table.risultati').each((idx, table) => {
      const $table = $(table);
      
      // Extract match ID from first th in thead
      const matchIdText = $table.find('thead th').first().text().trim();
      const matchId = matchIdText.replace('#', '');

      // Extract giornata_id from MATCH CENTER link
      const matchCenterLink = $table.find('a[href*="match-center"]').attr('href');
      let giornataId = null;
      if (matchCenterLink) {
        const idMatch = matchCenterLink.match(/match-center\/(\d+)/);
        if (idMatch) giornataId = idMatch[1];
      }

      if (!matchId) return;
      
      // Extract date
      const dateText = $table.find('thead th').eq(1).text().trim();
      
      // Extract teams and scores from tbody rows
      const rows = $table.find('tbody tr');
      if (rows.length < 2) return;
      
      const homeSets = parseInt($(rows[0]).find('th.num').text().trim()) || 0;
      const homeTeam = cleanText($(rows[0]).find('td a').text());
      
      const awaySets = parseInt($(rows[1]).find('th.num').text().trim()) || 0;
      const awayTeam = cleanText($(rows[1]).find('td a').text());
      
      if (!homeTeam || !awayTeam) return;
      
      matches.push({
        match_id: matchId,
        giornata_id: giornataId,  // ✅ DODAJ TO!
        home_team: homeTeam,
        away_team: awayTeam,
        home_sets: homeSets,
        away_sets: awaySets,
        date: dateText,
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
  const year = process.argv[2] || '2024';
  const season = `${year}-${parseInt(year) + 1}`;
  
  console.log('🏐 LEGAVOLLEY FEMMINILE - MATCHES SCRAPER');
  console.log(`Season: ${season}`);
  console.log('============================================================');
  
  // Championship IDs for 2024-2025
  const CHAMPIONSHIP_IDS = {
    'regular': '710313',  // Serie A1 Tigotà - Regular season
    'playoff': '710322'   // Poule Scudetto / Playoff
  };
  
  const allMatches = [];
  
  // Scrape regular season
  const regularMatches = await scrapeMatches(year, CHAMPIONSHIP_IDS.regular, 'regular');
  allMatches.push(...regularMatches);
  
  await delay(DELAY_MS);
  
  // Scrape playoff
  const playoffMatches = await scrapeMatches(year, CHAMPIONSHIP_IDS.playoff, 'playoff');
  allMatches.push(...playoffMatches);
  
  console.log(`\n✅ Total: ${allMatches.length} matches`);
  console.log(`   📊 Regular season: ${regularMatches.length}`);
  console.log(`   🏆 Playoff: ${playoffMatches.length}`);
  
  // Save to file
  const outputDir = path.join(__dirname, '..', 'data', `legavolley-femminile-${season}`);
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, 'matches-calendar.json');
  
  const output = {
    meta: {
      league: 'legavolley-femminile',
      season: season,
      scraped_at: new Date().toISOString(),
      total_matches: allMatches.length
    },
    matches: allMatches
  };
  
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`\n💾 Saved: ${outputPath}`);
  console.log(`📦 Total: ${allMatches.length} matches`);
  console.log('\n✅ SUCCESS!');
}

main().catch(console.error);