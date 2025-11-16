/**
 * Embed Player Stats to Pinecone
 * Embeds all player statistics for RAG chatbot
 * 
 * Usage: node scripts/embed-player-stats.js
 */

require('dotenv').config({ path: '.env.local' }); // Load environment variables

const fs = require('fs');
const path = require('path');
const { embedAndStore } = require('../lib/vectorStore');

/**
 * Load all players enhanced (Node.js version of getAllPlayersEnhanced)
 */
function getAllPlayersEnhanced() {
  const dataDir = path.join(__dirname, '..', 'data');
  const result = [];
  
  // Map to track player career totals across all seasons
  const careerMap = new Map();

  // Define all leagues and seasons to read
  const leagueConfigs = [
    { league: 'plusliga', seasons: ['2022-2023', '2023-2024', '2024-2025'], gender: 'men' },
    { league: 'tauronliga', seasons: ['2022-2023', '2023-2024', '2024-2025'], gender: 'women' },
    { league: 'legavolley', seasons: ['2024-2025'], gender: 'men' },
    { league: 'legavolley-femminile', seasons: ['2022-2023', '2023-2024', '2024-2025'], gender: 'women' }
  ];

  console.log('📂 Reading player data from disk...');

  // First pass: calculate career totals
  leagueConfigs.forEach(({ league, seasons, gender }) => {
    seasons.forEach(season => {
      const enhancedDir = path.join(dataDir, `${league}-${season}-enhanced`);
      
      if (!fs.existsSync(enhancedDir)) return;
      
      // Read all player files in the directory
      const files = fs.readdirSync(enhancedDir).filter(f => f.startsWith('players-') && f.endsWith('.json'));
      
      files.forEach(file => {
        const filePath = path.join(enhancedDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        data.players?.forEach((p) => {
          const playerId = `${league}-${p.id}`;
          const matches = p.match_by_match || [];
          
          const existing = careerMap.get(playerId) || {
            matches: 0, sets: 0, points: 0, attacks: 0,
            blocks: 0, aces: 0
          };

          // Sum up stats
          const matchesCount = matches.length;
          const sets = matches.reduce((sum, m) => sum + (m.sets || 0), 0);
          const points = matches.reduce((sum, m) => sum + (m.points_total || 0), 0);
          const attacks = matches.reduce((sum, m) => sum + (m.attack_total || 0), 0);
          const blocks = matches.reduce((sum, m) => sum + (m.block_points || 0), 0);
          const aces = matches.reduce((sum, m) => sum + (m.serve_aces || 0), 0);

          careerMap.set(playerId, {
            matches: existing.matches + matchesCount,
            sets: existing.sets + sets,
            points: existing.points + points,
            attacks: existing.attacks + attacks,
            blocks: existing.blocks + blocks,
            aces: existing.aces + aces
          });
        });
      });
    });
  });

  console.log(`✅ Career totals calculated for ${careerMap.size} unique players`);

  // Second pass: build final player objects with career context
  leagueConfigs.forEach(({ league, seasons, gender }) => {
    seasons.forEach(season => {
      const enhancedDir = path.join(dataDir, `${league}-${season}-enhanced`);
      
      if (!fs.existsSync(enhancedDir)) return;
      
      const files = fs.readdirSync(enhancedDir).filter(f => f.startsWith('players-') && f.endsWith('.json'));
      
      files.forEach(file => {
        const filePath = path.join(enhancedDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        data.players?.forEach((p) => {
          const playerId = `${league}-${p.id}`;
          const matches = p.match_by_match || [];
          const career = careerMap.get(playerId);
          
          // Current season stats
          const currentMatches = matches.length;
          const currentSets = matches.reduce((sum, m) => sum + (m.sets || 0), 0);
          const currentPoints = matches.reduce((sum, m) => sum + (m.points_total || 0), 0);
          const currentAttacks = matches.reduce((sum, m) => sum + (m.attack_total || 0), 0);
          const currentBlocks = matches.reduce((sum, m) => sum + (m.block_points || 0), 0);
          const currentAces = matches.reduce((sum, m) => sum + (m.serve_aces || 0), 0);
          
          const attackWon = matches.reduce((sum, m) => sum + (m.attack_won || 0), 0);
          const attackEfficiency = currentAttacks > 0 ? (attackWon / currentAttacks) * 100 : 0;
          
          const serveErrors = matches.reduce((sum, m) => sum + (m.serve_errors || 0), 0);
          const serveTotal = matches.reduce((sum, m) => sum + (m.serve_total || 0), 0);
          const serveEfficiency = serveTotal > 0 ? ((serveTotal - serveErrors) / serveTotal) * 100 : 0;
          
          const receptionTotal = matches.reduce((sum, m) => sum + (m.reception_total || 0), 0);
          const receptionErrors = matches.reduce((sum, m) => sum + (m.reception_errors || 0), 0);
          const receptionEfficiency = receptionTotal > 0 ? ((receptionTotal - receptionErrors) / receptionTotal) * 100 : 0;

          result.push({
            id: playerId,
            name: p.name,
            team: p.team,
            league: league,
            gender: gender,
            season: season,
            careerStats: {
              matches: career.matches,
              sets: career.sets,
              points: career.points,
              attacks: career.attacks,
              blocks: career.blocks,
              aces: career.aces,
              avgPointsPerMatch: career.matches > 0 ? career.points / career.matches : 0,
              avgAcesPerMatch: career.matches > 0 ? career.aces / career.matches : 0,
              avgBlocksPerMatch: career.matches > 0 ? career.blocks / career.matches : 0
            },
            currentSeasonStats: {
              matches: currentMatches,
              sets: currentSets,
              points: currentPoints,
              attacks: currentAttacks,
              blocks: currentBlocks,
              aces: currentAces,
              attackEfficiency: attackEfficiency,
              serveEfficiency: serveEfficiency,
              receptionEfficiency: receptionEfficiency
            }
          });
        });
      });
    });
  });

  return result;
}

/**
 * Format player data as text chunks for embedding
 */
function formatPlayerChunks(players) {
  const chunks = [];
  
  console.log(`\n📊 Formatting ${players.length} players into chunks...`);
  
  players.forEach((player, idx) => {
    if ((idx + 1) % 100 === 0) {
      console.log(`   Processing ${idx + 1}/${players.length}...`);
    }
    
    // Career summary chunk
    const careerText = `
Gracz: ${player.name}
Liga: ${player.league}
Płeć: ${player.gender === 'men' ? 'mężczyźni' : 'kobiety'}
Sezon: ${player.season}
Drużyna: ${player.team}

Statystyki kariery (wszystkie sezony):
- Mecze: ${player.careerStats.matches}
- Sety: ${player.careerStats.sets}
- Punkty: ${player.careerStats.points}
- Asy: ${player.careerStats.aces}
- Bloki: ${player.careerStats.blocks}
- Ataki: ${player.careerStats.attacks}

Średnie per mecz:
- Punkty: ${player.careerStats.avgPointsPerMatch.toFixed(2)}
- Asy: ${player.careerStats.avgAcesPerMatch.toFixed(2)}
- Bloki: ${player.careerStats.avgBlocksPerMatch.toFixed(2)}
`.trim();

    chunks.push({
      content: careerText,
      filename: `${player.id}-career`,
      chunkIndex: 0,
      metadata: {
        type: 'player_stats',
        originalFile: `${player.league}-${player.season}`,
        player_id: player.id,
        player_name: player.name,
        league: player.league,
        gender: player.gender,
        season: player.season,
        team: player.team,
        data_type: 'career_summary'
      }
    });
    
    // Current season chunk
    if (player.currentSeasonStats) {
      const seasonText = `
Gracz: ${player.name} - Sezon ${player.season}
Liga: ${player.league}
Drużyna: ${player.team}

Statystyki aktualnego sezonu ${player.season}:
- Mecze: ${player.currentSeasonStats.matches}
- Sety: ${player.currentSeasonStats.sets}
- Punkty: ${player.currentSeasonStats.points}
- Asy: ${player.currentSeasonStats.aces}
- Bloki: ${player.currentSeasonStats.blocks}
- Ataki: ${player.currentSeasonStats.attacks}
- Efektywność ataku: ${player.currentSeasonStats.attackEfficiency.toFixed(2)}%
- Efektywność zagrywki: ${player.currentSeasonStats.serveEfficiency.toFixed(2)}%
- Efektywność przyjęcia: ${player.currentSeasonStats.receptionEfficiency.toFixed(2)}%
`.trim();

      chunks.push({
        content: seasonText,
        filename: `${player.id}-season-${player.season}`,
        chunkIndex: 1,
        metadata: {
          type: 'player_stats',
          originalFile: `${player.league}-${player.season}`,
          player_id: player.id,
          player_name: player.name,
          league: player.league,
          gender: player.gender,
          season: player.season,
          team: player.team,
          data_type: 'season_stats'
        }
      });
    }
  });
  
  console.log(`✅ Created ${chunks.length} chunks from ${players.length} players`);
  return chunks;
}

async function main() {
  console.log('\n🏐 VOLLEYINSIGHT - PLAYER STATS EMBEDDER');
  console.log('============================================================\n');
  
  try {
    // Load all players
    console.log('📂 Loading player data...');
    const players = getAllPlayersEnhanced();
    
    console.log(`✅ Loaded ${players.length} players`);
    console.log(`   Leagues: ${[...new Set(players.map(p => p.league))].join(', ')}`);
    console.log(`   Seasons: ${[...new Set(players.map(p => p.season))].join(', ')}`);
    
    // Format into chunks
    const chunks = formatPlayerChunks(players);
    
    // Embed and store in Pinecone
    console.log('\n🤖 Embedding and storing in Pinecone...');
    console.log('⏳ This will take several minutes...\n');
    
    await embedAndStore(chunks);
    
    console.log('\n✅ SUCCESS!');
    console.log(`📊 Total embedded: ${chunks.length} chunks`);
    console.log(`👥 Players: ${players.length}`);
    console.log(`🏐 Matches: ${players.reduce((sum, p) => sum + p.careerStats.matches, 0)}`);
    console.log('\n💬 Chatbot is now ready to answer player stats questions!\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();