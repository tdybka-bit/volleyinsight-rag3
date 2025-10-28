/**
 * Lega Volley Calendar Scraper
 * Scrapes match calendar with dates, teams, and results
 * 
 * Usage: node scripts/scrape-legavolley-calendar.js [year] [championship_id] [phase_id]
 * Example: node scripts/scrape-legavolley-calendar.js 2024 947 1
 * 
 * Championship IDs:
 * - 947: SuperLega 2024-2025 (Serie A1 Men)
 * - Check website for other championships
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

async function scrapeCalendar(year, championshipId, phaseId) {
  const url = `https://www.legavolley.it/calendario/?Anno=${year}&IdCampionato=${championshipId}&IdFase=${phaseId}`;
  
  console.log(`\n📅 Scraping calendar: ${url}\n`);

  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000
  });

  const $ = cheerio.load(response.data);
  const calendar = {};
  let currentGiornata = null;

  // Find all tables and rows
  $('table tbody tr').each((i, row) => {
    const $row = $(row);
    const cells = $row.find('td');

    // Check if this is a giornata header
    const headerText = $row.find('td[colspan]').text().trim();
    if (headerText && headerText.includes('Giornata')) {
      currentGiornata = headerText;
      console.log(`\n📋 ${currentGiornata}`);
      calendar[currentGiornata] = {
        matches: []
      };
      return;
    }

    // Skip if no current giornata or not enough cells
    if (!currentGiornata || cells.length < 4) return;

    // Extract match data
    const matchNum = $(cells[0]).text().trim();
    const dateTime = $(cells[1]).text().trim();
    const homeTeam = $(cells[2]).text().trim();
    const result = $(cells[3]).text().trim();
    const awayTeam = $(cells[4]).text().trim();

    if (homeTeam && awayTeam) {
      // Parse result
      let homeScore = null;
      let awayScore = null;
      if (result && result.includes('-')) {
        const scores = result.split('-');
        homeScore = parseInt(scores[0]);
        awayScore = parseInt(scores[1]);
      }

      const match = {
        match_number: matchNum,
        date: dateTime,
        home_team: homeTeam,
        away_team: awayTeam,
        result: result || null,
        home_score: homeScore,
        away_score: awayScore
      };

      calendar[currentGiornata].matches.push(match);
      console.log(`   ✅ Match ${matchNum}: ${homeTeam} vs ${awayTeam} (${result || 'TBD'})`);
    }
  });

  return calendar;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 3) {
    console.log('Usage: node scripts/scrape-legavolley-calendar.js [year] [championship_id] [phase_id]');
    console.log('Example: node scripts/scrape-legavolley-calendar.js 2024 947 1');
    console.log('\nChampionship IDs:');
    console.log('  947 = SuperLega 2024-2025 (Serie A1 Men)');
    process.exit(1);
  }

  const [year, championshipId, phaseId] = args;

  try {
    const calendar = await scrapeCalendar(year, championshipId, phaseId);

    // Save to file
    const outputDir = path.join(__dirname, '..', 'data', `legavolley-${year}`);
    await fs.mkdir(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, `calendar-${championshipId}-phase${phaseId}.json`);
    
    const output = {
      meta: {
        year: parseInt(year),
        championship_id: parseInt(championshipId),
        phase_id: parseInt(phaseId),
        scraped_at: new Date().toISOString(),
        total_giornate: Object.keys(calendar).length,
        total_matches: Object.values(calendar).reduce((sum, g) => sum + g.matches.length, 0)
      },
      calendar
    };

    await fs.writeFile(outputFile, JSON.stringify(output, null, 2));

    console.log(`\n✅ Calendar saved to: ${outputFile}`);
    console.log(`📊 Stats:`);
    console.log(`   Giornate: ${output.meta.total_giornate}`);
    console.log(`   Matches: ${output.meta.total_matches}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();