/**
 * Lega Volley Calendar Scraper
 * Scrapes match calendar with dates, teams, and results
 * Supports both Regular Season and Play-Off formats
 * 
 * Usage: node scripts/scrape-legavolley-calendar.js [year] [championship_id] [phase_id]
 * Example: node scripts/scrape-legavolley-calendar.js 2024 947 1
 * 
 * Championship IDs:
 * - 947: SuperLega Regular Season 2024-2025
 * - 961: SuperLega Play-Off 2024-2025
 * - 964: SuperLega Fase Finale 2024-2025
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

function cleanText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

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

    // Check if this is a giornata/gara header (has colspan)
    const headerCell = $row.find('td[colspan]');
    if (headerCell.length > 0) {
      const headerText = cleanText(headerCell.text());
      
      // Match both formats:
      // - "1ª Giornata Andata - Domenica 29 Settembre 2024 Ore 18:00"
      // - "Gara 1 Quarti - Domenica 9 Marzo 2025"
      if (headerText && (headerText.includes('Giornata') || headerText.includes('Gara'))) {
        currentGiornata = headerText;
        console.log(`\n📋 ${currentGiornata}`);
        calendar[currentGiornata] = {
          matches: []
        };
      }
      return;
    }

    // Skip if no current giornata
    if (!currentGiornata) return;

    // Detect format by number of cells
    // Regular Season: 5 cells (match#, date, home, result, away)
    // Play-Off: 8 cells (match#, date, home, result, away, arbitri, impianto, note)
    
    if (cells.length >= 5) {
      const matchNum = cleanText($(cells[0]).text());
      const dateTime = cleanText($(cells[1]).text());
      const homeTeam = cleanText($(cells[2]).text());
      const result = cleanText($(cells[3]).text());
      const awayTeam = cleanText($(cells[4]).text());

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
    console.log('  947 = SuperLega Regular Season 2024-2025');
    console.log('  961 = SuperLega Play-Off 2024-2025');
    console.log('  964 = SuperLega Fase Finale 2024-2025');
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
    console.error(error.stack);
    process.exit(1);
  }
}

main();