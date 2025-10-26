/**
 * Merge enhanced player JSONs into one file
 * Usage: node scripts/merge-enhanced-data.js [league] [season]
 * Example: node scripts/merge-enhanced-data.js plusliga 2024-2025
 */

const fs = require('fs').promises;
const path = require('path');

async function mergeEnhancedData(league, season) {
  const inputDir = path.join(__dirname, '..', 'data', `${league}-${season}-enhanced`);
  const outputDir = path.join(__dirname, '..', 'data', `${league}-${season}`);
  const outputFile = path.join(outputDir, 'players-enhanced.json');

  console.log(`\n🔄 Merging enhanced data for ${league} ${season}...`);
  console.log(`📂 Input: ${inputDir}`);
  console.log(`📂 Output: ${outputFile}\n`);

  // Read all JSON files from input directory
  const files = await fs.readdir(inputDir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  console.log(`📊 Found ${jsonFiles.length} JSON files\n`);

  const allPlayers = [];
  let totalMatches = 0;

  for (const file of jsonFiles) {
    const filePath = path.join(inputDir, file);
    console.log(`📥 Reading ${file}...`);
    
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    if (data.players && Array.isArray(data.players)) {
      console.log(`   ✅ ${data.players.length} players, ${data.players.reduce((sum, p) => sum + (p.matches_count || 0), 0)} matches`);
      allPlayers.push(...data.players);
      totalMatches += data.players.reduce((sum, p) => sum + (p.matches_count || 0), 0);
    }
  }

  // Sort by player ID
  allPlayers.sort((a, b) => parseInt(a.id) - parseInt(b.id));

  const output = {
    meta: {
      league,
      season,
      merged_at: new Date().toISOString(),
      total_players: allPlayers.length,
      total_matches: totalMatches,
      source_files: jsonFiles.length
    },
    players: allPlayers
  };

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Write merged file
  await fs.writeFile(outputFile, JSON.stringify(output, null, 2));

  console.log(`\n✅ Merge complete!`);
  console.log(`📊 Stats:`);
  console.log(`   Total players: ${allPlayers.length}`);
  console.log(`   Total matches: ${totalMatches}`);
  console.log(`   Output file: ${outputFile}`);
  console.log(`   File size: ${(await fs.stat(outputFile)).size / 1024 / 1024} MB\n`);
}

// Main
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.log('Usage: node scripts/merge-enhanced-data.js [league] [season]');
  console.log('Example: node scripts/merge-enhanced-data.js plusliga 2024-2025');
  process.exit(1);
}

const [league, season] = args;

mergeEnhancedData(league, season)
  .then(() => console.log('✅ Done!'))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });