/**
 * VolleyInsight RAG - Extended Player Scraper
 * Pobiera SUMY SEZONOWE + STATYSTYKI MECZ PO MECZU
 * 
 * Usage: node scripts/scrape-players-extended.js <start_id> <end_id>
 * Example: node scripts/scrape-players-extended.js 1 30
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const SEASON = '2024-2025';
const LEAGUE = 'plusliga';
const BASE_URL = 'https://www.plusliga.pl';
const DELAY_MS = 2000; // Delay między requestami

/**
 * Opóźnienie między requestami
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Pobiera HTML strony gracza
 */
async function fetchPlayerPage(playerId) {
    const url = `${BASE_URL}/statsPlayers/tournament_1/47/id/${playerId}.html`;
  console.log(`📥 Fetching: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`⚠️  Player ${playerId} not found (404)`);
      return null;
    }
    throw error;
  }
}

/**
 * Parsuje wartość numeryczną (obsługuje przecinki i myślniki)
 */
function parseNumber(value) {
  if (!value || value === '-' || value === '') return 0;
  return parseFloat(value.replace(',', '.')) || 0;
}

/**
 * Czyści tekst z białych znaków
 */
function cleanText(text) {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Ekstraktuje podstawowe dane gracza z nagłówka
 */
function extractPlayerBasicInfo($, playerId) {
    // Prawdziwe imię jest w <h1 class="text-center notranslate">
    const playerName = $('h1.text-center.notranslate a').text().trim();
    
    return {
      id: playerId.toString(),
      name: playerName || `Player ${playerId}`,
      url: `${BASE_URL}/statsPlayers/id/${playerId}.html`
    };
  }

/**
 * Ekstraktuje sumy sezonowe z TABELI 2 (nie 1!)
 * TABELA 2 ma 19 kolumn z sumami
 */
function extractSeasonTotals($) {
  const stats = {};
  
  const tables = $('table');
  
  if (tables.length < 2) {
    console.log('⚠️  Brak tabeli z sumami sezonowymi');
    return stats;
  }
  
  const mainTable = tables.eq(1); // DRUGA tabela (index 1)
  const rows = mainTable.find('tr');
  
  if (rows.length < 3) {
    console.log('⚠️  Tabela sum ma mniej niż 3 rzędy');
    return stats;
  }
  
  // Rząd 3 (index 2) zawiera wartości
  const valueRow = $(rows[2]);
  const cells = valueRow.find('td');
  
  console.log(`📊 Znaleziono ${cells.length} kolumn statystyk sezonowych`);
  
  // Mapowanie według struktury TABELI 2:
  // [0] Rozegrane mecze
  // [1] Sety
  // [2] Punkty
  // [3-6] Zagrywka (Suma, As, Błąd, Asy na set)
  // [7-11] Przyjęcie (Suma, Błąd, Neg, Perf, Perf%)
  // [12-16] Atak (Suma, Błąd, Blok, Perf, Perf%)
  // [17-18] Blok (Pkt, Pkt na set)
  
  if (cells.length >= 19) {
    stats.matches = parseNumber(cells.eq(0).text());
    stats.sets = parseNumber(cells.eq(1).text());
    stats.points = parseNumber(cells.eq(2).text());
    
    // Zagrywka
    stats.serve_total = parseNumber(cells.eq(3).text());
    stats.aces = parseNumber(cells.eq(4).text());
    stats.serve_errors = parseNumber(cells.eq(5).text());
    stats.aces_per_set = parseNumber(cells.eq(6).text());
    
    // Przyjęcie
    stats.reception_total = parseNumber(cells.eq(7).text());
    stats.reception_errors = parseNumber(cells.eq(8).text());
    stats.reception_negative = parseNumber(cells.eq(9).text());
    stats.reception_perfect = parseNumber(cells.eq(10).text());
    stats.reception_perfect_percent = parseNumber(cells.eq(11).text());
    
    // Atak
    stats.attack_total = parseNumber(cells.eq(12).text());
    stats.attack_errors = parseNumber(cells.eq(13).text());
    stats.attack_blocked = parseNumber(cells.eq(14).text());
    stats.attack_perfect = parseNumber(cells.eq(15).text());
    stats.attack_perfect_percent = parseNumber(cells.eq(16).text());
    
    // Blok
    stats.block_points = parseNumber(cells.eq(17).text());
    stats.block_points_per_set = parseNumber(cells.eq(18).text());
  }
  
  return stats;
}

/**
 * Ekstraktuje statystyki mecz po meczu z TABELI 3 (nie 2!)
 * TABELA 2 = sumy sezonowe (19 kolumn)
 * TABELA 3 = mecze szczegółowe (23 kolumny)
 */
function extractMatchByMatchStats($) {
  const matches = [];
  
  const tables = $('table');
  
  if (tables.length < 3) {
    console.log('⚠️  Brak tabeli z meczami (potrzeba min. 3 tabel)');
    return matches;
  }
  
  const matchTable = tables.eq(2); // TRZECIA tabela! (index 2)
  const rows = matchTable.find('tr');
  
  console.log(`🏐 Znaleziono ${rows.length - 2} meczów w tabeli`);
  
  // Pierwsze 2 rzędy to nagłówki (grupy + szczegółowe)
  // Dane zaczynają się od trzeciego rzędu (indeks 2)
  for (let i = 2; i < rows.length; i++) {
    const row = $(rows[i]);
    const cells = row.find('td');
    
    if (cells.length === 0) continue;
    if (cells.length < 23) continue; // Musi mieć wszystkie 23 kolumny
    
    // Struktura TABELI 3 (23 kolumny):
    // [0] Przeciwnik/Mecz
    // [1] Sety
    // [2-4] Punkty (Suma, BP, Bilans)
    // [5-8] Zagrywka (Suma, Błąd, As, Eff%)
    // [9-12] Przyjęcie (Suma, Błąd, Poz%, Perf%)
    // [13-18] Atak (Suma, Błąd, Blok, Pkt, Skut%, Eff%)
    // [19-20] Blok (Pkt, Wyblok)
    // [21-22] Inne (Obrona, Asysta)
    
    const matchData = {
      opponent: cleanText(cells.eq(0).text()),
      sets: parseNumber(cells.eq(1).text()),
      
      // Punkty
      points_total: parseNumber(cells.eq(2).text()),
      points_break: parseNumber(cells.eq(3).text()),
      points_balance: parseNumber(cells.eq(4).text()),
      
      // Zagrywka
      serve_total: parseNumber(cells.eq(5).text()),
      serve_errors: parseNumber(cells.eq(6).text()),
      serve_aces: parseNumber(cells.eq(7).text()),
      serve_efficiency: parseNumber(cells.eq(8).text()),
      
      // Przyjęcie
      reception_total: parseNumber(cells.eq(9).text()),
      reception_errors: parseNumber(cells.eq(10).text()),
      reception_positive_percent: parseNumber(cells.eq(11).text()),
      reception_perfect_percent: parseNumber(cells.eq(12).text()),
      
      // Atak
      attack_total: parseNumber(cells.eq(13).text()),
      attack_errors: parseNumber(cells.eq(14).text()),
      attack_blocked: parseNumber(cells.eq(15).text()),
      attack_points: parseNumber(cells.eq(16).text()),
      attack_success_percent: parseNumber(cells.eq(17).text()),
      attack_efficiency: parseNumber(cells.eq(18).text()),
      
      // Blok
      block_points: parseNumber(cells.eq(19).text()),
      block_plus: parseNumber(cells.eq(20).text()),
      
      // Inne
      defense: parseNumber(cells.eq(21).text()),
      assists: parseNumber(cells.eq(22).text())
    };
    
    // Dodajemy tylko jeśli ma przeciwnika
    if (matchData.opponent && matchData.opponent !== '-') {
      matches.push(matchData);
    }
  }
  
  return matches;
}

/**
 * Scrapuje pojedynczego gracza
 */
async function scrapePlayer(playerId) {
  try {
    const html = await fetchPlayerPage(playerId);
    
    if (!html) {
      return null; // Gracz nie znaleziony
    }
    
    const $ = cheerio.load(html);
    
    // Podstawowe info
    const basicInfo = extractPlayerBasicInfo($, playerId);
    
    // Sumy sezonowe
    const seasonTotals = extractSeasonTotals($);
    
    // Statystyki mecz po meczu
    const matchByMatch = extractMatchByMatchStats($);
    
    // Ekstraktuj nazwę drużyny z pierwszego meczu
    let teamName = 'Unknown';
    if (matchByMatch.length > 0 && matchByMatch[0].opponent) {
      // Format: "ZAKSA Kędzierzyn-Koźle - Jastrzębski Węgiel"
      const firstMatch = matchByMatch[0].opponent;
      const parts = firstMatch.split('-');
      if (parts.length >= 2) {
        teamName = parts[0].trim();
      }
    }
    
    const playerData = {
      ...basicInfo,
      season: SEASON,
      team: teamName,  // <-- DODANE!
      season_totals: seasonTotals,
      match_by_match: matchByMatch,
      matches_count: matchByMatch.length
    };
    
    console.log(`✅ ${basicInfo.name}: ${matchByMatch.length} meczów`);
    
    return playerData;
    
  } catch (error) {
    console.error(`❌ Error scraping player ${playerId}:`, error.message);
    return null;
  }
}

/**
 * Główna funkcja
 */
async function main() {
    console.log(`\n🏐 VolleyInsight - Players Scraper (from list)`);
    console.log(`📅 Season: ${SEASON}\n`);
    
    // Ścieżka do listy graczy
    const PLAYERS_LIST_FILE = path.join(__dirname, '..', 'data', 'players', `${LEAGUE}-${SEASON}-players-list.json`);
    
    // Wczytaj listę graczy
    console.log(`📂 Loading players list...`);
    
    let playersList;
    try {
      const data = await fs.readFile(PLAYERS_LIST_FILE, 'utf-8');
      playersList = JSON.parse(data);
    } catch (error) {
      console.error(`❌ Error loading players list: ${error.message}`);
      console.log(`\nRun first: node scripts/scrape-players-list.js`);
      process.exit(1);
    }
    
    const allPlayers = playersList.players;
    console.log(`✅ Loaded ${allPlayers.length} players from list\n`);
    
    // Obsługa argumentów
    const args = process.argv.slice(2);
    let startIndex = 0;
    let endIndex = allPlayers.length;
    
    if (args.length === 1) {
      endIndex = Math.min(parseInt(args[0]), allPlayers.length);
    } else if (args.length === 2) {
      startIndex = parseInt(args[0]) - 1;
      endIndex = parseInt(args[1]);
    }
    
    const playersToScrape = allPlayers.slice(startIndex, endIndex);
    
    console.log(`🔢 Scraping ${playersToScrape.length} players (${startIndex + 1} - ${endIndex})\n`);
    
    const players = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Scrapujemy graczy
    for (let i = 0; i < playersToScrape.length; i++) {
      const playerInfo = playersToScrape[i];
      console.log(`[${i + 1}/${playersToScrape.length}] ${playerInfo.name} (ID: ${playerInfo.id})`);
      
      const player = await scrapePlayer(playerInfo.id);
      
      if (player) {
        players.push(player);
        successCount++;
      } else {
        errorCount++;
      }
      
      if (i < playersToScrape.length - 1) {
        await delay(DELAY_MS);
      }
    }
    
    // Zapisujemy do pliku
    const outputDir = path.join(__dirname, '..', 'data', 'players');
    await fs.mkdir(outputDir, { recursive: true });
    
    const rangeStr = startIndex === 0 && endIndex === allPlayers.length 
      ? 'all' 
      : `${startIndex + 1}-${endIndex}`;
    
    const filename = `${LEAGUE}-${SEASON}-players-${rangeStr}-full.json`;
    const filepath = path.join(outputDir, filename);
    
    const output = {
      meta: {
        league: LEAGUE,
        season: SEASON,
        scraped_at: new Date().toISOString(),
        player_range: rangeStr,
        total_players: players.length,
        errors: errorCount,
        source_url: `${BASE_URL}/statsPlayers/tournament_1/47.html`
      },
      players: players
    };
    
    await fs.writeFile(filepath, JSON.stringify(output, null, 2));
    
    console.log(`\n✅ Scraping complete!`);
    console.log(`📁 Saved to: ${filepath}`);
    console.log(`📊 Players scraped: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`🏐 Total matches: ${players.reduce((sum, p) => sum + p.matches_count, 0)}`);
  }

// Uruchomienie
main().catch(console.error);