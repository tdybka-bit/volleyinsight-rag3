/**
 * Weekly Refresh - Main Orchestrator
 * Runs incremental scrapes for all leagues
 * 
 * Usage: node refresh-weekly.js
 */

const { getLastScrapedDate, updateLastScrapedDate, isMatchAfterDate } = require('./utils/date-tracker');
const { appendMatchesToPlayerFile, getPlayerIds } = require('./utils/incremental-utils');

// Import scrapers
const plusligaScraper = require('./scrape-plusliga-2025-2026-players');
const tauronligaScraper = require('./scrape-tauronliga-2025-2026-players');
// const tauronligaScraper = require('./scrape-tauronliga-2024-2025-players');
// const legavolleyFemminileScraper = require('./scrape-legavolley-femminile-enhanced');
// const tauronligaScraper = require('./scrape-tauronliga');
// const legavolleyFemminileScraper = require('./scrape-legavolley-femminile');

const LEAGUES = [
  { 
    name: 'plusliga', 
    season: '2025-2026',
    displayName: 'PlusLiga (men)'
  },
  { 
    name: 'tauronliga', 
    season: '2025-2026',
    displayName: 'TauronLiga (women)'
  }
  // LegaVolley Femminile - parkowane (fix later)
];

/**
 * Generic incremental scrape function
 * This is a TEMPLATE - you'll need to adapt to your specific scrapers
 */
async function incrementalScrapeLeague(league, season, sinceDate) {
  console.log(`\n📊 ${league} ${season}`);
  console.log(`Last scraped: ${sinceDate || 'NEVER (first run)'}`);
  
  let result;
  
  if (league === 'plusliga') {
    result = await plusligaScraper.incrementalScrape(season, sinceDate);
  } else if (league === 'tauronliga') {
    result = await tauronligaScraper.incrementalScrape(season, sinceDate);
  } else if (league === 'legavolley-femminile') {
    // result = await legavolleyFemminileScraper.incrementalScrape(season, sinceDate);
    console.log('⚠️  LegaVolley Femminile scraper not integrated yet');
    result = { playersUpdated: 0, totalNewMatches: 0 };
  } else {
    console.log('⚠️  Unknown league');
    result = { playersUpdated: 0, totalNewMatches: 0 };
  }
  
  console.log(`\n✅ ${league} complete!`);
  console.log(`   Updated: ${result.playersUpdated} players`);
  console.log(`   New matches: ${result.totalNewMatches}`);
  
  return result;
}
  
  

/**
 * Main refresh function
 */
async function refreshAllLeagues() {
  console.log('🔄 WEEKLY REFRESH STARTED');
  console.log(`Time: ${new Date().toISOString()}\n`);
  console.log('='.repeat(60));
  
  const results = {};
  
  for (const league of LEAGUES) {
    try {
      const lastDate = getLastScrapedDate(league.name, league.season);
      
      const result = await incrementalScrapeLeague(
        league.name, 
        league.season, 
        lastDate
      );
      
      results[league.name] = result;
      
      // Update tracker with today's date
      const today = new Date().toISOString().split('T')[0]; // "2024-12-10"
      updateLastScrapedDate(league.name, league.season, today);
      
    } catch (error) {
      console.error(`\n❌ FATAL ERROR with ${league.name}:`, error);
      results[league.name] = { error: error.message };
    }
    
    console.log('\n' + '='.repeat(60));
  }
  
  // Summary
  console.log('\n📊 REFRESH SUMMARY:');
  console.log('='.repeat(60));
  
  let totalPlayers = 0;
  let totalMatches = 0;
  
  for (const league of LEAGUES) {
    const result = results[league.name];
    if (result.error) {
      console.log(`❌ ${league.displayName}: ERROR - ${result.error}`);
    } else {
      console.log(`✅ ${league.displayName}:`);
      console.log(`   Players updated: ${result.playersUpdated}`);
      console.log(`   New matches: ${result.totalNewMatches}`);
      totalPlayers += result.playersUpdated;
      totalMatches += result.totalNewMatches;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`🎉 TOTAL: ${totalPlayers} players, ${totalMatches} matches`);
  console.log(`✅ Weekly refresh complete!`);
  console.log(`Time: ${new Date().toISOString()}`);
}

// Run if called directly
if (require.main === module) {
  refreshAllLeagues().catch(error => {
    console.error('❌ FATAL ERROR:', error);
    process.exit(1);
  });
}

module.exports = {
  refreshAllLeagues,
  incrementalScrapeLeague
};