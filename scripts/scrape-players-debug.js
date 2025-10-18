/**
 * VolleyInsight RAG - Player Scraper DEBUG
 * Testowa wersja do analizy struktury HTML
 * 
 * Usage: node scripts/scrape-players-debug.js <player_id>
 * Example: node scripts/scrape-players-debug.js 777
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;

const BASE_URL = 'https://www.plusliga.pl';

async function debugPlayerPage(playerId) {
  const url = `${BASE_URL}/statsPlayers/id/${playerId}.html`;
  console.log(`\n🔍 Analyzing: ${url}\n`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // === ANALIZA PODSTAWOWA ===
    console.log('=== PODSTAWOWE INFO ===');
    const playerName = $('h2').first().text().trim();
    console.log(`Imię i nazwisko: ${playerName}`);
    
    // === ANALIZA TABEL ===
    console.log('\n=== TABELE NA STRONIE ===');
    const tables = $('table');
    console.log(`Liczba tabel: ${tables.length}\n`);
    
    tables.each((tableIndex, table) => {
      console.log(`--- TABELA ${tableIndex + 1} ---`);
      const rows = $(table).find('tr');
      console.log(`Liczba wierszy: ${rows.length}`);
      
      // Analizujemy pierwsze 3 wiersze
      rows.slice(0, 3).each((rowIndex, row) => {
        const cells = $(row).find('th, td');
        console.log(`\nWiersz ${rowIndex + 1} (${cells.length} komórek):`);
        
        cells.each((cellIndex, cell) => {
          const text = $(cell).text().trim().replace(/\s+/g, ' ');
          const tag = cell.tagName;
          const colspan = $(cell).attr('colspan') || '1';
          console.log(`  [${cellIndex}] <${tag}> ${colspan === '1' ? '' : `colspan=${colspan} `}"${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
        });
      });
      
      console.log('');
    });
    
    // === ANALIZA STRUKTURY MATCH-BY-MATCH ===
    console.log('\n=== ANALIZA TABELI MECZOWEJ (Tabela 2) ===');
    if (tables.length >= 2) {
      const matchTable = tables.eq(1);
      const rows = matchTable.find('tr');
      
      console.log(`\n📊 Nagłówki (pierwszy rząd):`);
      const headerRow = $(rows[0]);
      const headers = [];
      headerRow.find('th, td').each((i, cell) => {
        const text = $(cell).text().trim();
        const colspan = $(cell).attr('colspan') || '1';
        headers.push({ text, colspan: parseInt(colspan) });
        console.log(`  [${i}] "${text}" (colspan: ${colspan})`);
      });
      
      console.log(`\n🏐 Przykładowy mecz (drugi rząd):`);
      if (rows.length > 1) {
        const exampleRow = $(rows[1]);
        const cells = exampleRow.find('td');
        cells.each((i, cell) => {
          const text = $(cell).text().trim();
          console.log(`  [${i}] "${text}"`);
        });
        console.log(`\n  Razem kolumn: ${cells.length}`);
      }
      
      // Sprawdzamy linki do meczów
      console.log(`\n🔗 Linki do meczów:`);
      const matchLinks = matchTable.find('a[href*="/games/id/"]');
      console.log(`  Znaleziono ${matchLinks.length} linków do meczów`);
      if (matchLinks.length > 0) {
        matchLinks.slice(0, 3).each((i, link) => {
          console.log(`  - ${$(link).attr('href')} -> "${$(link).text().trim()}"`);
        });
      }
    }
    
    // === ZAPIS SUROWEGO HTML DO PLIKU ===
    const outputPath = `data/debug-player-${playerId}.html`;
    await fs.writeFile(outputPath, response.data);
    console.log(`\n💾 Raw HTML saved to: ${outputPath}`);
    
    // === ZAPIS STRUKTURY DO JSON ===
    const structure = {
      player_id: playerId,
      player_name: playerName,
      url: url,
      tables_count: tables.length,
      tables: []
    };
    
    tables.each((tableIndex, table) => {
      const rows = $(table).find('tr');
      const tableData = {
        index: tableIndex + 1,
        rows_count: rows.length,
        sample_rows: []
      };
      
      rows.slice(0, 3).each((rowIndex, row) => {
        const cells = $(row).find('th, td');
        const rowData = {
          row_index: rowIndex + 1,
          cells: []
        };
        
        cells.each((cellIndex, cell) => {
          rowData.cells.push({
            index: cellIndex,
            tag: cell.tagName,
            text: $(cell).text().trim().substring(0, 100),
            colspan: $(cell).attr('colspan') || '1'
          });
        });
        
        tableData.sample_rows.push(rowData);
      });
      
      structure.tables.push(tableData);
    });
    
    const jsonPath = `data/debug-player-${playerId}.json`;
    await fs.writeFile(jsonPath, JSON.stringify(structure, null, 2));
    console.log(`📊 Structure saved to: ${jsonPath}`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

// Uruchomienie
const playerId = process.argv[2] || '777';
debugPlayerPage(playerId).catch(console.error);