const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapePlusLiga() {
  console.log('🏐 Scrapowanie PlusLiga...');
  
  try {
    const { data } = await axios.get('https://www.plusliga.pl/table/tour/47.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    const tables = $('table.rs-standings-table');
    const lastTable = tables.last();
    
    console.log(`📊 Znaleziono ${tables.length} tabel`);
    
    // Map do przechowywania unikalnych drużyn
    const teamsMap = new Map();
    
    lastTable.find('tbody tr').each((index, element) => {
      const $row = $(element);
      const $cells = $row.find('td');
      
      if ($cells.length < 10) return;
      
      const teamName = $cells.eq(1).find('a').text().trim();
      if (!teamName) return;
      
      const team = {
        position: parseInt($cells.eq(0).text().trim()),
        name: teamName,
        matches: parseInt($cells.eq(2).text().trim()),
        wins: parseInt($cells.eq(3).text().trim()),
        losses: parseInt($cells.eq(4).text().trim()),
        points: parseInt($cells.eq(5).text().trim()),
        setsWon: parseInt($cells.eq(6).text().trim()),
        setsLost: parseInt($cells.eq(7).text().trim()),
        smallPointsWon: parseInt($cells.eq(8).text().trim()),
        smallPointsLost: parseInt($cells.eq(9).text().trim())
      };
      
      // Zachowaj tylko wpis z największą liczbą meczów dla każdej drużyny
      const existing = teamsMap.get(teamName);
      if (!existing || team.matches > existing.matches) {
        teamsMap.set(teamName, team);
      }
    });
    
    // Konwertuj Map -> Array i sortuj
    const standings = Array.from(teamsMap.values())
      .sort((a, b) => a.position - b.position);
    
    const result = {
      meta: {
        league: 'PlusLiga',
        season: '2024-2025',
        gender: 'male',
        scraped_at: new Date().toISOString(),
        source: 'plusliga.pl',
        url: 'https://www.plusliga.pl/table/tour/47.html'
      },
      standings: standings
    };
    
    if (!fs.existsSync('data')) {
      fs.mkdirSync('data');
    }
    
    fs.writeFileSync(
      'data/plusliga-2024-2025.json',
      JSON.stringify(result, null, 2),
      'utf-8'
    );
    
    console.log('✅ Zapisano do data/plusliga-2024-2025.json');
    console.log(`📊 Znaleziono ${standings.length} unikalnych drużyn\n`);
    console.log('🏆 TOP 5:');
    standings.slice(0, 5).forEach(team => {
      console.log(`   ${team.position}. ${team.name} - ${team.points} pkt (${team.wins}W-${team.losses}L)`);
    });
    
  } catch (error) {
    console.error('❌ Błąd:', error.message);
  }
}

scrapePlusLiga();