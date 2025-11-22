/**
 * Link Player Stats with Matches Calendar (ENHANCED)
 * Adds phase, home_sets, away_sets, date to player match_by_match data
 *
 * Usage: node scripts/link-player-matches.js [league] [season]
 * Example: node scripts/link-player-matches.js tauronliga 2024-2025
 */

const fs = require('fs').promises;
const path = require('path');

async function linkPlayerMatches(league, season) {
  console.log(`\n🔗 LINKING PLAYER STATS WITH CALENDAR (ENHANCED)`);
  console.log(`League: ${league}`);
  console.log(`Season: ${season}`);
  console.log(`============================================================\n`);

  const baseDir = path.join(__dirname, '..', 'data');
  const calendarDir = path.join(baseDir, `${league}-${season}`);
  const enhancedDir = path.join(baseDir, `${league}-${season}-enhanced`);

  // 1. Load matches calendar
  const calendarFile = path.join(calendarDir, 'matches-calendar.json');

  let calendar;
  try {
    const calendarData = await fs.readFile(calendarFile, 'utf-8');
    calendar = JSON.parse(calendarData);
    console.log(`✅ Loaded calendar: ${calendar.matches.length} matches`);
  } catch (error) {
    console.error(`❌ Cannot find calendar file: ${calendarFile}`);
    console.error(`   Make sure you scraped calendar first!`);
    process.exit(1);
  }

  // 2. Create match_id → full match data map
  const matchDataMap = new Map();
  calendar.matches.forEach(match => {
    const matchData = {
      phase: match.phase || 'regular',
      home_sets: match.home_sets,
      away_sets: match.away_sets,
      date: match.date,
      home_team: match.home_team,
      away_team: match.away_team
    };
    matchDataMap.set(match.match_id.toString(), matchData);
  });

  console.log(`📋 Created match data map: ${matchDataMap.size} matches`);
  console.log(`   Regular: ${Array.from(matchDataMap.values()).filter(m => m.phase === 'regular').length}`);
  console.log(`   Playoff: ${Array.from(matchDataMap.values()).filter(m => m.phase === 'playoff').length}`);

  // 3. Update player files
  const playerFiles = await fs.readdir(enhancedDir);
  const jsonFiles = playerFiles.filter(f => f.startsWith('players-') && f.endsWith('.json'));

  console.log(`\n📂 Found ${jsonFiles.length} player files to update\n`);

  let totalPlayers = 0;
  let totalMatches = 0;
  let linkedMatches = 0;
  let addedHomeAwaySets = 0;

  for (const file of jsonFiles) {
    const filePath = path.join(enhancedDir, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (!data.players) continue;

    let fileModified = false;

    data.players.forEach(player => {
      totalPlayers++;

      if (!player.match_by_match) return;

      player.match_by_match.forEach(match => {
        totalMatches++;

        const matchId = match.match_id?.toString();
        if (!matchId) return;

        const matchData = matchDataMap.get(matchId);
        if (matchData) {
          // Add/update all available fields
          match.phase = matchData.phase;
          
          // Add home_sets and away_sets if available
          if (matchData.home_sets !== undefined) {
            match.home_sets = matchData.home_sets;
            match.away_sets = matchData.away_sets;
            addedHomeAwaySets++;
          }
          
          // Add date if available
          if (matchData.date) {
            match.date = matchData.date;
          }
          
          // Add teams if available
          if (matchData.home_team) {
            match.home_team = matchData.home_team;
          }
          if (matchData.away_team) {
            match.away_team = matchData.away_team;
          }

          linkedMatches++;
          fileModified = true;
        }
      });
    });

    // Save if modified
    if (fileModified) {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      process.stdout.write('.');
    }
  }

  console.log('\n');
  console.log(`\n✅ LINKING COMPLETE!`);
  console.log(`   Players processed: ${totalPlayers}`);
  console.log(`   Total matches: ${totalMatches}`);
  console.log(`   Linked matches: ${linkedMatches} (${(linkedMatches/totalMatches*100).toFixed(1)}%)`);
  console.log(`   Added home/away sets: ${addedHomeAwaySets}`);
  console.log(`   Unlinked: ${totalMatches - linkedMatches}`);
  console.log(`\n💾 Updated ${jsonFiles.length} player files\n`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.log('Usage: node scripts/link-player-matches.js [league] [season]');
    console.log('Example: node scripts/link-player-matches.js tauronliga 2024-2025');
    console.log('');
    console.log('Available leagues: tauronliga, plusliga, legavolley, legavolley-femminile');
    process.exit(1);
  }

  const [league, season] = args;

  await linkPlayerMatches(league, season);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err);
  process.exit(1);
});