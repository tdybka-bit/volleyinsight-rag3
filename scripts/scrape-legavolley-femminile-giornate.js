/**
 * Lega Volley Femminile Giornate Scraper
 * Scrapes list of all giornate with IDs
 * 
 * Usage: node scripts/scrape-legavolley-femminile-giornate.js [year] [championship_id]
 * Example: node scripts/scrape-legavolley-femminile-giornate.js 2024 710313
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

async function scrapeGiornate(year, championshipId) {
  const url = `https://legavf.b-cdn.net/risultati/?serie=1&campionato=${championshipId}&stagione=${year}&giornata=tutte&no_cache_sa=1`;

  
  console.log(`\n📅 Scraping giornate: ${url}\n`);

  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000
  });

  const $ = cheerio.load(response.data);
  const giornate = [];

  // Find dropdown with giornate
  $('#filtroGiornata').parent().find('ul.dropdown-menu li a').each((i, elem) => {
    const $link = $(elem);
    const href = $link.attr('href');
    const text = $link.find('b').text().trim();
    
    // Skip "TUTTE"
    if (text === 'TUTTE') return;
    
    // Extract giornata ID from href
    const match = href.match(/giornata=(\d+)/);
    if (match) {
      const giornataId = match[1];
      
      // Parse text: "1ª Giornata - Andata - 06/10/2024"
      const parts = text.split(' - ');
      const name = parts[0]?.trim() || '';
      const phase = parts[1]?.trim() || '';
      const date = parts[2]?.trim() || '';
      
      giornate.push({
        id: giornataId,
        name: name,
        phase: phase,
        date: date,
        full_name: text
      });
      
      console.log(`✅ [${giornataId}] ${text}`);
    }
  });

  return giornate;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.log('Usage: node scripts/scrape-legavolley-femminile-giornate.js [year] [championship_id]');
    console.log('Example: node scripts/scrape-legavolley-femminile-giornate.js 2024 710313');
    console.log('\nChampionship IDs:');
    console.log('  710313 = Regular Season 2024-2025');
    console.log('  710322 = Play-offs 2024-2025');
    process.exit(1);
  }

  const [year, championshipId] = args;

  try {
    const giornate = await scrapeGiornate(year, championshipId);

    // Save to file
    const outputDir = path.join(__dirname, '..', 'data', `legavolley-femminile-${year}`);
    await fs.mkdir(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, `giornate-${championshipId}.json`);
    
    const output = {
      meta: {
        year: parseInt(year),
        championship_id: parseInt(championshipId),
        scraped_at: new Date().toISOString(),
        total_giornate: giornate.length
      },
      giornate
    };

    await fs.writeFile(outputFile, JSON.stringify(output, null, 2));

    console.log(`\n✅ Giornate saved to: ${outputFile}`);
    console.log(`📊 Total: ${giornate.length} giornate`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();