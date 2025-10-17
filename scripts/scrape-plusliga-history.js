const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapePlusLiga(tourId, seasonName) {
  console.log(`🏐 Scrapowanie PlusLiga ${seasonName}...`);
  
  try {
    const url = `https://www.plusliga.pl/table/tour/${tourId}.html`;
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    const tables = $('table.rs-standings-table');
    const lastTable = tables.last();
    
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
      
      const existing = teamsMap.get(teamName);
      if (!existing || team.matches > existing.matches) {
        teamsMap.set(teamName, team);
      }
    });
    
    const standings = Array.from(teamsMap.values())
      .sort((a, b) => a.position - b.position);
    
    const result = {
      meta: {
        league: 'PlusLiga',
        season: seasonName,
        gender: 'male',
        scraped_at: new Date().toISOString(),
        source: 'plusliga.pl',
        url: url
      },
      standings: standings
    };
    
    if (!fs.existsSync('data')) {
      fs.mkdirSync('data');
    }
    
    const filename = `data/plusliga-${seasonName}.json`;
    fs.writeFileSync(filename, JSON.stringify(result, null, 2), 'utf-8');
    
    console.log(`✅ ${seasonName}: ${standings.length} drużyn → ${filename}`);
    
    return standings;
    
  } catch (error) {
    console.error(`❌ Błąd ${seasonName}:`, error.message);
    return null;
  }
}

// Wszystkie sezony
async function scrapeAllSeasons() {
  console.log('📅 Scrapowanie 3 sezonów PlusLigi...\n');
  
  const seasons = [
    { tour: 41, season: '2022-2023' },
    { tour: 44, season: '2023-2024' },
    { tour: 47, season: '2024-2025' }
  ];
  
  for (const s of seasons) {
    await scrapePlusLiga(s.tour, s.season);
    // Poczekaj 1 sekundę między requestami (żeby nie przeciążyć serwera)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🎉 Wszystkie sezony zescrapowane!');
  console.log('📂 Pliki w folderze data/:');
  console.log('   - plusliga-2022-2023.json');
  console.log('   - plusliga-2023-2024.json');
  console.log('   - plusliga-2024-2025.json');
}

scrapeAllSeasons();