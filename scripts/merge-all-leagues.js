/**
 * Merge All Leagues - Unified Dataset
 * Merges PlusLiga, TauronLiga and LegaVolley into single dataset
 * 
 * Usage: node scripts/merge-all-leagues.js
 */

const fs = require('fs').promises;
const path = require('path');

async function loadAllPlayers(directory, league, gender) {
  const players = [];
  
  try {
    const files = await fs.readdir(directory);
    
    for (const file of files) {
      if (file.startsWith('players-') && file.endsWith('.json')) {
        const content = await fs.readFile(path.join(directory, file), 'utf-8');
        const data = JSON.parse(content);
        
        // Add identifiers to each player and match
        for (const player of data.players) {
          player.source_league = league;
          player.gender = gender;
          
          // Add league and gender to each match
          if (player.match_by_match) {
            for (const match of player.match_by_match) {
              match.league = league;
              match.gender = gender;
            }
          }
          
          players.push(player);
        }
      }
    }
  } catch (err) {
    console.log(`   ⚠️  Directory not found, skipping`);
  }
  
  return players;
}

async function main() {
  console.log('🔄 Merging all leagues...\n');
  
  const allPlayers = [];
  
  // === PLUSLIGA MEN ===
  console.log('📂 Loading PlusLiga Men...');
  
  // 2024-2025
  const plusliga2024 = await loadAllPlayers(
    path.join(__dirname, '..', 'data', 'plusliga-2024-2025-enhanced'),
    'plusliga',
    'men'
  );
  console.log(`   ✅ 2024-2025: ${plusliga2024.length} players`);
  allPlayers.push(...plusliga2024);
  
  // 2023-2024
  const plusliga2023 = await loadAllPlayers(
    path.join(__dirname, '..', 'data', 'plusliga-2023-2024-enhanced'),
    'plusliga',
    'men'
  );
  console.log(`   ✅ 2023-2024: ${plusliga2023.length} players`);
  allPlayers.push(...plusliga2023);
  
  // 2022-2023
  const plusliga2022 = await loadAllPlayers(
    path.join(__dirname, '..', 'data', 'plusliga-2022-2023-enhanced'),
    'plusliga',
    'men'
  );
  console.log(`   ✅ 2022-2023: ${plusliga2022.length} players`);
  allPlayers.push(...plusliga2022);
  
  // === TAURONLIGA WOMEN ===
console.log('\n📂 Loading TauronLiga Women...');

// 2024-2025
const tauronliga2024 = await loadAllPlayers(
  path.join(__dirname, '..', 'data', 'tauronliga-2024-2025-enhanced'),  // Zmienione!
  'tauronliga',
  'women'
);
console.log(`   ✅ 2024-2025: ${tauronliga2024.length} players`);
allPlayers.push(...tauronliga2024);

// 2023-2024
const tauronliga2023 = await loadAllPlayers(
  path.join(__dirname, '..', 'data', 'tauronliga-2023-2024-enhanced'),  // Dodane!
  'tauronliga',
  'women'
);
console.log(`   ✅ 2023-2024: ${tauronliga2023.length} players`);
allPlayers.push(...tauronliga2023);

// 2022-2023
const tauronliga2022 = await loadAllPlayers(
  path.join(__dirname, '..', 'data', 'tauronliga-2022-2023-enhanced'),  // Dodane!
  'tauronliga',
  'women'
);
console.log(`   ✅ 2022-2023: ${tauronliga2022.length} players`);
allPlayers.push(...tauronliga2022);
  
  // === LEGAVOLLEY MEN ===
  console.log('\n📂 Loading LegaVolley Men...');
  
  const legavolley2024 = await loadAllPlayers(
    path.join(__dirname, '..', 'data', 'legavolley-2024-2025-enhanced'),
    'legavolley',
    'men'
  );
  console.log(`   ✅ 2024-2025: ${legavolley2024.length} players`);
  allPlayers.push(...legavolley2024);
  
  // === LEGAVOLLEY WOMEN (players list only - no match by match yet) ===
  console.log('\n📂 Loading LegaVolley Femminile...');
  
  try {
    const content = await fs.readFile(
      path.join(__dirname, '..', 'data', 'legavolley-femminile-2024', 'players-list.json'),
      'utf-8'
    );
    const data = JSON.parse(content);
    
    for (const player of data.players) {
      player.source_league = 'legavolley-femminile';
      player.gender = 'women';
      player.match_by_match = []; // Empty for now
      allPlayers.push(player);
    }
    console.log(`   ✅ 2024-2025: ${data.players.length} players (no match data yet)`);
  } catch (err) {
    console.log(`   ⚠️  Not found, skipping`);
  }
  
  // === STATS ===
  const totalMatches = allPlayers.reduce((sum, p) => sum + (p.match_by_match?.length || 0), 0);
  
  console.log(`\n📊 Total Summary:`);
  console.log(`   Players: ${allPlayers.length}`);
  console.log(`   Matches: ${totalMatches}`);
  
  // Count by league and gender
  const byLeague = {};
  const byGender = { men: 0, women: 0 };
  
  allPlayers.forEach(p => {
    byLeague[p.source_league] = (byLeague[p.source_league] || 0) + 1;
    byGender[p.gender] = (byGender[p.gender] || 0) + 1;
  });
  
  console.log(`\n📊 By League:`);
  Object.entries(byLeague).forEach(([league, count]) => {
    console.log(`   ${league}: ${count} players`);
  });
  
  console.log(`\n📊 By Gender:`);
  console.log(`   Men: ${byGender.men} players`);
  console.log(`   Women: ${byGender.women} players`);
  
  // Save merged dataset
  const outputDir = path.join(__dirname, '..', 'data', 'merged');
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputFile = path.join(outputDir, 'all-players-enhanced.json');
  
  const output = {
    meta: {
      merged_at: new Date().toISOString(),
      total_players: allPlayers.length,
      total_matches: totalMatches,
      leagues: Object.keys(byLeague),
      by_league: byLeague,
      by_gender: byGender
    },
    players: allPlayers
  };
  
  await fs.writeFile(outputFile, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Merged dataset saved to: ${outputFile}`);
  console.log(`   Size: ${(JSON.stringify(output).length / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});