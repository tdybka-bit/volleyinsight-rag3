/**
 * Merge Player Stats - Update individual files with detailed stats
 * Usage: node merge-player-stats.js <folder-name> <batch-file>
 * Example: node merge-player-stats.js plusliga-2025-2026 players-51-221-full.json
 */

const fs = require('fs');
const path = require('path');

function mergePlayerStats(folderName, batchFile) {
  console.log(`\n🔄 Merging stats from: ${batchFile}`);
  console.log(`📁 Target folder: ${folderName}`);
  console.log('='.repeat(60));
  
  const dataDir = path.join(__dirname, '../data', folderName);
  const batchFilePath = path.join(dataDir, batchFile);
  
  // Check if batch file exists
  if (!fs.existsSync(batchFilePath)) {
    console.error(`❌ Batch file not found: ${batchFilePath}`);
    process.exit(1);
  }
  
  // Read batch file
  console.log(`\n📖 Reading batch file...`);
  const batchContent = fs.readFileSync(batchFilePath, 'utf-8');
  const batchData = JSON.parse(batchContent);
  
  // Handle different structures
  let players;
  if (Array.isArray(batchData)) {
    players = batchData;
  } else if (batchData.players && Array.isArray(batchData.players)) {
    players = batchData.players;
    if (batchData.meta) {
      console.log(`📋 Meta info:`, batchData.meta);
    }
  } else {
    console.error('❌ Unknown batch file structure');
    process.exit(1);
  }
  
  console.log(`✅ Found ${players.length} players in batch`);
  
  // Process each player
  console.log(`\n🔄 Updating individual files...`);
  
  let updated = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const player of players) {
    try {
      // Generate player filename
      let playerId = player.id || player.player_id;
      
      if (!playerId) {
        // Generate ID from name if missing
        playerId = player.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
      }
      
      const playerFilePath = path.join(dataDir, `${playerId}.json`);
      
      // Check if file exists
      if (fs.existsSync(playerFilePath)) {
        // Read existing file
        const existingContent = fs.readFileSync(playerFilePath, 'utf-8');
        const existingPlayer = JSON.parse(existingContent);
        
        // Check if update is needed
        const hasDetailedStats = (player.season_totals || player.match_by_match || player.stats) && 
          (Object.keys(player.season_totals || {}).length > 0 || 
            (player.match_by_match && player.match_by_match.length > 0));
        const existingHasDetailedStats = existingPlayer.stats && Object.keys(existingPlayer.stats).length > 0;
        
        if (hasDetailedStats && !existingHasDetailedStats) {
          // Update with detailed stats
          fs.writeFileSync(playerFilePath, JSON.stringify(player, null, 2));
          updated++;
        } else if (hasDetailedStats && existingHasDetailedStats) {
          // Both have stats, merge them (prefer new data)
          const merged = {
            ...existingPlayer,
            ...player,
            stats: { ...existingPlayer.stats, ...player.stats },
            matches: player.matches || existingPlayer.matches
          };
          fs.writeFileSync(playerFilePath, JSON.stringify(merged, null, 2));
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Create new file
        fs.writeFileSync(playerFilePath, JSON.stringify(player, null, 2));
        created++;
      }
      
      // Progress indicator
      const total = updated + created + skipped;
      if (total % 50 === 0) {
        console.log(`  Processed ${total}/${players.length}...`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing player ${player.id || player.name}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n✅ Merge complete!`);
  console.log(`   Updated: ${updated} files`);
  console.log(`   Created: ${created} new files`);
  console.log(`   Skipped: ${skipped} (no changes needed)`);
  if (errors > 0) {
    console.log(`   Errors: ${errors}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`🎉 Done! Total processed: ${players.length}`);
}

// Main
if (require.main === module) {
  const folderName = process.argv[2];
  const batchFile = process.argv[3];
  
  if (!folderName || !batchFile) {
    console.log(`
Usage: node merge-player-stats.js <folder-name> <batch-file>

Examples:
  node merge-player-stats.js plusliga-2025-2026 players-51-221-full.json
  node merge-player-stats.js tauronliga-2025-2026 players-51-161-full.json

This will update individual player files with detailed stats from batch file.
`);
    process.exit(1);
  }
  
  mergePlayerStats(folderName, batchFile);
}

module.exports = { mergePlayerStats };