/**
 * VolleyInsight - Match-Player Linker
 * Łączy matches-calendar.json z player_stats przez podmatch -> match_id
 * Dodaje: home_team, away_team, home_sets, away_sets, phase do każdego meczu gracza
 */

const fs = require('fs');
const path = require('path');

// Konfiguracja
const DATA_DIR = 'data';
const SEASONS = ['2022-2023', '2023-2024', '2024-2025'];
const LEAGUES = ['plusliga', 'tauronliga'];

/**
 * Wczytaj matches-calendar.json dla danego sezonu i ligi
 */
function loadMatchesCalendar(season, league) {
  const matchesPath = path.join(DATA_DIR, `${league}-${season}`, 'matches-calendar.json');
  
  if (!fs.existsSync(matchesPath)) {
    console.log(`⚠️  Brak matches-calendar.json: ${matchesPath}`);
    return [];
  }
  
  const json = JSON.parse(fs.readFileSync(matchesPath, 'utf-8'));
  const data = json.matches || []; // FIX: Wyciągnij tablicę matches!
  console.log(`✅ Załadowano ${data.length} meczów z ${league}-${season}`);
  return data;
}

/**
 * Znajdź mecz po match_id
 */
function findMatch(matchId, matchesMap) {
  return matchesMap.get(matchId) || null;
}

/**
 * Przetwórz wszystkich graczy dla danego sezonu i ligi
 */
function processPlayers(season, league) {
  console.log(`\n🔄 Przetwarzam: ${league}-${season}`);
  
  // 1. Wczytaj mecze
  const matches = loadMatchesCalendar(season, league);
  if (matches.length === 0) {
    console.log(`⏭️  Pomijam - brak meczów`);
    return { processed: 0, enriched: 0, missing: 0 };
  }
  
  // 2. Stwórz mapę match_id -> match
  const matchesMap = new Map();
  matches.forEach(match => {
    matchesMap.set(match.match_id, match);
  });
  
  // 3. Wczytaj batch files (players-X-Y.json)
  const enhancedDir = path.join(DATA_DIR, `${league}-${season}-enhanced`);
  if (!fs.existsSync(enhancedDir)) {
    console.log(`⏭️  Brak katalogu: ${enhancedDir}`);
    return { processed: 0, enriched: 0, missing: 0 };
  }
  
  const batchFiles = fs.readdirSync(enhancedDir)
    .filter(f => f.startsWith('players-') && f.endsWith('.json'));
  
  console.log(`📂 Znaleziono ${batchFiles.length} batch files`);
  
  let stats = {
    processed: 0,
    enriched: 0,
    missing: 0
  };
  
  // 4. Dla każdego batch file
  batchFiles.forEach(batchFile => {
    const batchPath = path.join(enhancedDir, batchFile);
    const batchData = JSON.parse(fs.readFileSync(batchPath, 'utf-8'));
    const players = batchData.players || [];
    
    if (!Array.isArray(players) || players.length === 0) {
      console.log(`⚠️  ${batchFile} - brak graczy - pomijam`);
      return;
    }
    
    console.log(`   👥 Graczy w batchu: ${players.length}`);
    
    let batchModified = false;
    
    // 5. Dla każdego gracza w batchu
    players.forEach(player => {
      stats.processed++;
      
      if (!player.match_by_match || !Array.isArray(player.match_by_match)) {
        return;
      }
      
      // 6. Dla każdego meczu gracza
      player.match_by_match = player.match_by_match.map(playerMatch => {
        const matchId = playerMatch.match_id; // FIX: match_id zamiast podmatch!
        
        if (!matchId) {
          return playerMatch; // Brak match_id - skip
        }
        
        // 7. Znajdź pełny mecz
        const fullMatch = findMatch(matchId, matchesMap);
        
        if (!fullMatch) {
          stats.missing++;
          return playerMatch; // Nie znaleziono meczu
        }
        
        // 8. ENRICH - dodaj dane z meczu
        batchModified = true;
        stats.enriched++;
        
        return {
          ...playerMatch,
          // Dodaj dane z matches-calendar (home_team, away_team, sets)
          home_team: fullMatch.home_team,
          away_team: fullMatch.away_team,
          home_sets: fullMatch.home_sets,
          away_sets: fullMatch.away_sets,
          phase: fullMatch.phase,
          match_date: fullMatch.date
        };
      });
    });
    
    // 9. Zapisz cały batch jeśli był modyfikowany (zachowaj meta!)
    if (batchModified) {
      batchData.players = players; // Podmień graczy
      fs.writeFileSync(batchPath, JSON.stringify(batchData, null, 2), 'utf-8');
      console.log(`   💾 Zapisano: ${batchFile}`);
    }
  });
  
  console.log(`✅ Przetworzono: ${stats.processed} graczy`);
  console.log(`   💎 Wzbogacono: ${stats.enriched} meczów`);
  console.log(`   ⚠️  Brak match_id: ${stats.missing} meczów`);
  
  return stats;
}

/**
 * MAIN
 */
function main() {
  console.log('🏐 VolleyInsight - Match-Player Linker\n');
  console.log('ŁĄCZĘ matches-calendar.json z player_stats...\n');
  
  const totalStats = {
    processed: 0,
    enriched: 0,
    missing: 0
  };
  
  // Dla każdej ligi i sezonu
  LEAGUES.forEach(league => {
    SEASONS.forEach(season => {
      const stats = processPlayers(season, league);
      totalStats.processed += stats.processed;
      totalStats.enriched += stats.enriched;
      totalStats.missing += stats.missing;
    });
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 PODSUMOWANIE:');
  console.log('='.repeat(60));
  console.log(`Przetworzonych graczy: ${totalStats.processed}`);
  console.log(`Wzbogaconych meczów: ${totalStats.enriched}`);
  console.log(`Brakujących match_id: ${totalStats.missing}`);
  console.log('='.repeat(60));
  
  if (totalStats.enriched > 0) {
    console.log('\n✅ SUKCES! Dane zostały zaktualizowane!');
    console.log('💡 Możesz teraz wyświetlać prawdziwe wyniki w tabeli!');
  } else {
    console.log('\n⚠️  Nie znaleziono danych do wzbogacenia!');
  }
}

// RUN
main();