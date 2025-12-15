/**
 * Split Players - Convert 1 big file into many small files
 * Usage: node split-players.js <folder-name>
 * Example: node split-players.js plusliga-2024-2025-enhanced
 */

const fs = require('fs');
const path = require('path');

function splitPlayers(folderName) {
  console.log(`\n🔄 Splitting players in: ${folderName}`);
  console.log('='.repeat(60));
  
  const dataDir = path.join(__dirname, '../data', folderName);
  
  // Check if directory exists
  if (!fs.existsSync(dataDir)) {
    console.error(`❌ Directory not found: ${dataDir}`);
    process.exit(1);
  }
  
  // Find the big JSON file
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.error('❌ No JSON files found in directory');
    process.exit(1);
  }
  
  console.log(`\nFound ${files.length} JSON file(s):`);
  files.forEach(f => console.log(`  - ${f}`));
  
  // Process each file (usually just 1)
  let totalPlayers = 0;
  
  for (const file of files) {
    const filepath = path.join(dataDir, file);
    console.log(`\n📖 Reading: ${file}`);
    
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      let rawData = JSON.parse(content);
      
      // Handle different structures
      let data;
      let meta = null;
      
      if (Array.isArray(rawData)) {
        // Already an array
        data = rawData;
      } else if (rawData.players && Array.isArray(rawData.players)) {
        // Structure: { meta: {...}, players: [...] }
        data = rawData.players;
        meta = rawData.meta;
        console.log(`📋 Meta info:`, meta);
      } else {
        console.error('❌ Unknown file structure');
        console.log('   Expected: array or { players: [...] }');
        continue;
      }
      
      console.log(`✅ Found ${data.length} players`);
      
      // Create individual files
      console.log('\n📝 Creating individual player files...');
      
      let created = 0;
      let skipped = 0;
      
      for (const player of data) {
        // Generate player filename
        let playerId = player.id || player.player_id;
        
        if (!playerId) {
          // Generate ID from name if missing
          playerId = player.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
        }
        
        const playerFilepath = path.join(dataDir, `${playerId}.json`);
        
        // Check if file already exists
        if (fs.existsSync(playerFilepath)) {
          skipped++;
          continue;
        }
        
        // Write individual file
        fs.writeFileSync(
          playerFilepath, 
          JSON.stringify(player, null, 2)
        );
        
        created++;
        
        // Progress indicator
        if (created % 50 === 0) {
          console.log(`  Created ${created}/${data.length} files...`);
        }
      }
      
      console.log(`\n✅ Complete!`);
      console.log(`   Created: ${created} new files`);
      console.log(`   Skipped: ${skipped} (already exist)`);
      
      totalPlayers += data.length;
      
      // Optional: Backup original file
      const backupPath = filepath.replace('.json', '-ORIGINAL-BACKUP.json');
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(filepath, backupPath);
        console.log(`\n💾 Backed up original to: ${path.basename(backupPath)}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`🎉 Split complete! Total players: ${totalPlayers}`);
  console.log('\n💡 Next steps:');
  console.log('   1. Verify individual files created');
  console.log('   2. Run: node scripts/refresh-weekly.js');
  console.log('   3. Optional: Delete old big file (backup saved)');
}

// Main
if (require.main === module) {
  const folderName = process.argv[2];
  
  if (!folderName) {
    console.log(`
Usage: node split-players.js <folder-name>

Examples:
  node split-players.js plusliga-2024-2025-enhanced
  node split-players.js tauronliga-2024-2025-enhanced
  node split-players.js legavolley-femminile-2024-2025-enhanced

This will split the big players JSON into individual files.
Original file will be backed up automatically.
`);
    process.exit(1);
  }
  
  splitPlayers(folderName);
}

module.exports = { splitPlayers };