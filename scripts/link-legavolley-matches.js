/**
 * Link Player Stats with Matches Calendar (ENHANCED for LegaVolley)
 * Links by date+teams when giornata_id doesn't match
 *
 * Usage: node scripts/link-legavolley-matches.js [league] [season]
 * Example: node scripts/link-legavolley-matches.js legavolley-femminile 2024-2025
 */

const fs = require('fs').promises;
const path = require('path');

// Normalize text for comparison
function normalizeText(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, ''); // Remove special chars
}

// Extract key words from team name (ignore sponsors)
function getTeamKeywords(teamName) {
  const normalized = normalizeText(teamName);
  // Remove common sponsor/prefix words
  const withoutSponsors = normalized
    .replace(/wash4green|prosecco doc|reale mutua|igor|eurotek|megabox|bartoccini|smi|cda|savino del bene|honda olivero|il bisonte|numia vero|uyba|imoco|fenera|gorgonzola|onviso/gi, '')
    .trim();
  
  // Split into words, keep words longer than 3 chars
  const words = withoutSponsors.split(/\s+/).filter(w => w.length > 3);
  return words;
}

async function linkPlayerMatches(league, season) {
  console.log(`\n🔗 LINKING PLAYER STATS WITH CALENDAR (DATE+TEAMS FUZZY)`);
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

  // 2. Create multiple lookup strategies
  const matchLookup = new Map();
  
  calendar.matches.forEach(match => {
    const matchData = {
      phase: match.phase || 'regular',
      home_sets: match.home_sets,
      away_sets: match.away_sets,
      date: match.date,
      home_team: match.home_team,
      away_team: match.away_team,
      giornata_id: match.giornata_id,
      match_id: match.match_id
    };
    
    // Strategy 1: By giornata_id
    if (match.giornata_id) {
      matchLookup.set(`gid_${match.giornata_id}`, matchData);
    }
    
    // Strategy 2: By match_id
    if (match.match_id) {
      matchLookup.set(`mid_${match.match_id}`, matchData);
    }
    
    // Strategy 3: By date + teams (normalized)
    if (match.date && match.home_team && match.away_team) {
      const dateNorm = normalizeText(match.date.split(',')[0]); // Just date, no time
      const homeNorm = normalizeText(match.home_team);
      const awayNorm = normalizeText(match.away_team);
      const lookupKey = `${dateNorm}_${homeNorm}_${awayNorm}`;
      matchLookup.set(lookupKey, matchData);
    }
  });

  console.log(`📋 Created match lookup: ${matchLookup.size} entries`);
  console.log(`   Regular: ${calendar.matches.filter(m => m.phase === 'regular').length}`);
  console.log(`   Playoff: ${calendar.matches.filter(m => m.phase === 'playoff').length}`);

  // 3. Update player files
  const playerFiles = await fs.readdir(enhancedDir);
  const jsonFiles = playerFiles.filter(f => f.startsWith('players-') && f.endsWith('.json'));

  console.log(`\n📂 Found ${jsonFiles.length} player files to update\n`);

  let totalPlayers = 0;
  let totalMatches = 0;
  let linkedMatches = 0;
  let linkedByGiornataId = 0;
  let linkedByDateTeams = 0;

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

        let matchData = null;
        let linkMethod = '';

        // Try Strategy 1: giornata_id
        if (match.giornata_id) {
          matchData = matchLookup.get(`gid_${match.giornata_id}`);
          if (matchData) {
            linkMethod = 'giornata_id';
            linkedByGiornataId++;
          }
        }

        // Try Strategy 2: match_id
        if (!matchData && match.match_id) {
          matchData = matchLookup.get(`mid_${match.match_id}`);
          if (matchData) linkMethod = 'match_id';
        }

        // Try Strategy 3: date + player team + opponent (fuzzy matching)
        if (!matchData && match.date && player.team) {
          const dateNorm = normalizeText(match.date.split(',')[0]);
          const playerKeywords = getTeamKeywords(player.team);
          
          // Try to match with calendar
          calendar.matches.forEach(calMatch => {
            if (matchData) return; // Already found
            
            const calDateNorm = normalizeText(calMatch.date?.split(',')[0] || '');
            
            // Check if date matches
            if (calDateNorm === dateNorm) {
              const homeKeywords = getTeamKeywords(calMatch.home_team || '');
              const awayKeywords = getTeamKeywords(calMatch.away_team || '');
              
              // Fuzzy match: check if any keyword overlaps
              const matchesHome = playerKeywords.some(pk => 
                homeKeywords.some(hk => hk.includes(pk) || pk.includes(hk))
              );
              const matchesAway = playerKeywords.some(pk => 
                awayKeywords.some(ak => ak.includes(pk) || pk.includes(ak))
              );
              
              if (matchesHome || matchesAway) {
                matchData = {
                  phase: calMatch.phase || 'regular',
                  home_sets: calMatch.home_sets,
                  away_sets: calMatch.away_sets,
                  date: calMatch.date,
                  home_team: calMatch.home_team,
                  away_team: calMatch.away_team,
                  giornata_id: calMatch.giornata_id
                };
                linkMethod = 'date+teams';
                linkedByDateTeams++;
              }
            }
          });
        }

        if (matchData) {
          // Add/update all available fields
          match.phase = matchData.phase;
          
          if (matchData.home_sets !== undefined) {
            match.home_sets = matchData.home_sets;
            match.away_sets = matchData.away_sets;
          }
          
          if (matchData.date) {
            match.date = matchData.date;
          }
          
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
  console.log(`   └─ By giornata_id: ${linkedByGiornataId}`);
  console.log(`   └─ By date+teams: ${linkedByDateTeams}`);
  console.log(`   Unlinked: ${totalMatches - linkedMatches}`);
  console.log(`\n💾 Updated ${jsonFiles.length} player files\n`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.log('Usage: node scripts/link-legavolley-matches.js [league] [season]');
    console.log('Example: node scripts/link-legavolley-matches.js legavolley-femminile 2024-2025');
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