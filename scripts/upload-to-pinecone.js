/**
 * VolleyInsight - Upload Players Data to Pinecone
 * Przygotowuje embeddingi statystyk graczy i uploaduje do Pinecone
 * 
 * Usage: node scripts/upload-to-pinecone.js
 */

const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX_NAME;

const BATCH_SIZE = 100; // Pinecone limit
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Przygotowuje tekstową reprezentację gracza do embeddingu
 */
function preparePlayerText(player, league, season) {
  const stats = player.season_totals;
  const homeGames = player.match_by_match.filter(m => m.is_home).length;
  const awayGames = player.match_by_match.length - homeGames;
  
  return `
Zawodnik: ${player.name}
Liga: ${league === 'plusliga' ? 'PlusLiga (mężczyźni)' : 'Tauron Liga (kobiety)'}
Sezon: ${season}
Drużyna: ${player.team}

Statystyki całej kariery:
- Mecze: ${stats.matches}
- Sety: ${stats.sets}
- Punkty: ${stats.points}
- Asy: ${stats.aces} (${stats.aces_per_set} na set)
- Bloki: ${stats.block_points} (${stats.block_points_per_set} na set)
- Ataki: ${stats.attack_total} (skuteczność ${stats.attack_perfect_percent}%)
- Przyjęcia: ${stats.reception_total} (perfekcyjne ${stats.reception_perfect_percent}%)

Mecze szczegółowe w sezonie ${season}:
- Łącznie: ${player.matches_count} meczów
- U siebie: ${homeGames} meczów
- Na wyjeździe: ${awayGames} meczów

Średnie per mecz (sezon ${season}):
- Punkty: ${(player.match_by_match.reduce((sum, m) => sum + m.points_total, 0) / player.matches_count).toFixed(2)}
- Asy: ${(player.match_by_match.reduce((sum, m) => sum + m.serve_aces, 0) / player.matches_count).toFixed(2)}
- Bloki: ${(player.match_by_match.reduce((sum, m) => sum + m.block_points, 0) / player.matches_count).toFixed(2)}
`;
}

/**
 * Tworzy embedding używając OpenAI
 */
async function createEmbedding(text) {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 768  // ← DODAJ TO!
    });
  return response.data[0].embedding;
}

/**
 * Wczytuje wszystkich graczy z wszystkich sezonów
 */
async function loadAllPlayers() {
  const dataDir = path.join(__dirname, '..', 'data');
  const folders = await fs.readdir(dataDir);
  
  const players = [];
  
  for (const folder of folders) {
    // Skip backup folders
    if (folder.includes('backup') || folder.includes('OLD')) continue;
    
    // Parsuj nazwę folderu: plusliga-2024-2025 lub tauronliga-2023-2024
    const match = folder.match(/(plusliga|tauronliga)-(\d{4}-\d{4})/);
    if (!match) continue;
    
    const league = match[1];
    const season = match[2];
    
    const folderPath = path.join(dataDir, folder);
    const files = await fs.readdir(folderPath);
    
    // Znajdź pliki *-full.json
    const fullFiles = files.filter(f => f.includes('-full.json') && !f.includes('players-list'));
    
    for (const file of fullFiles) {
      const filePath = path.join(folderPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      // Dodaj każdego gracza z metadatą
      data.players.forEach(player => {
        players.push({
          ...player,
          _league: league,
          _season: season
        });
      });
    }
  }
  
  return players;
}

/**
 * Upload graczy do Pinecone w batchach
 */
async function uploadToPinecone(players) {
  console.log(`\n🔄 Connecting to Pinecone index: ${indexName}...`);
  const index = pinecone.index(indexName);
  
  console.log(`📊 Total players to upload: ${players.length}\n`);
  
  let uploaded = 0;
  
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    
    console.log(`[${i + 1}/${players.length}] Processing: ${player.name} (${player._league} ${player._season})`);
    
    try {
      // Przygotuj tekst
      const text = preparePlayerText(player, player._league, player._season);
      
      // Stwórz embedding
      const embedding = await createEmbedding(text);
      
      // Przygotuj vector do uploadu
      const vector = {
        id: `${player._league}-${player._season}-${player.id}`,
        values: embedding,
        metadata: {
          player_id: player.id,
          name: player.name,
          league: player._league,
          season: player._season,
          team: player.team,
          matches: player.season_totals.matches,
          points: player.season_totals.points,
          aces: player.season_totals.aces,
          blocks: player.season_totals.block_points,
          matches_detailed: player.matches_count,
          text: text.substring(0, 40000) // Pinecone metadata limit
        }
      };
      
      // Upload pojedynczego vectora
      await index.upsert([vector]);
      uploaded++;
      
      // Rate limiting - opóźnienie co 10 requestów
      if ((i + 1) % 10 === 0) {
        console.log(`  ⏸️  Rate limit pause...`);
        await delay(1000);
      }
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log(`\n✅ Upload complete!`);
  console.log(`📊 Uploaded: ${uploaded}/${players.length} players`);
}

/**
 * Główna funkcja
 */
async function main() {
  console.log('🏐 VolleyInsight - Pinecone Upload Script\n');
  
  // Sprawdź env variables
  if (!process.env.PINECONE_API_KEY || !process.env.OPENAI_API_KEY) {
    console.error('❌ Missing API keys in .env.local');
    console.error('Required: PINECONE_API_KEY, OPENAI_API_KEY, PINECONE_INDEX_NAME');
    process.exit(1);
  }
  
  console.log('📂 Loading players from all seasons...');
  const players = await loadAllPlayers();
  console.log(`✅ Loaded ${players.length} players\n`);
  
  // Pokaż breakdown
  const byLeague = players.reduce((acc, p) => {
    const key = `${p._league} ${p._season}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  
  console.log('📊 Breakdown:');
  Object.entries(byLeague).forEach(([key, count]) => {
    console.log(`   ${key}: ${count} players`);
  });
  
  console.log('\n🚀 Starting upload to Pinecone...');
  await uploadToPinecone(players);
  
  console.log('\n✅ All done!');
}

main().catch(console.error);