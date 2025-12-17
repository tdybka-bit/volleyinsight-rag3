const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeCalendar(tournamentId) {
  const url = `https://www.plusliga.pl/games/tour/${tournamentId}.html`;
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  
  const matches = [];
  
  $('[data-game-id]').each((i, box) => {
    const $box = $(box);
    const gameId = $box.attr('data-game-id');
    
    // Date
    const dateText = $box.find('.gamesbox-header .date').first().text().trim();
    
    // Teams
    const teams = $box.find('.team .name');
    const homeTeam = $(teams[0]).text().trim();
    const awayTeam = $(teams[1]).text().trim();
    
    // Score
    const scores = $box.find('.score span');
    const homeScore = $(scores[0]).text().trim();
    const awayScore = $(scores[1]).text().trim();
    
    // Phase detection (look for "Faza zasadnicza" vs "Playoff" in full text)
    const fullText = $box.text();
    let phase = 'unknown';
    if (fullText.includes('Faza zasadnicza')) {
      phase = 'regular';
    } else if (fullText.includes('Playoff') || fullText.includes('Ćwierćfinał') || fullText.includes('Półfinał') || fullText.includes('Finał')) {
      phase = 'playoff';
    }
    
    matches.push({
      match_id: gameId,
      date: dateText,
      home_team: homeTeam,
      away_team: awayTeam,
      home_score: homeScore,
      away_score: awayScore,
      phase: phase
    });
  });
  
  return matches;
}

// Test
scrapeCalendar(52).then(matches => {
  console.log(`Scraped ${matches.length} matches\n`);
  console.log('First 5 matches:');
  matches.slice(0, 5).forEach((m, i) => {
    console.log(`\n${i + 1}. ${m.home_team} vs ${m.away_team}`);
    console.log(`   Date: ${m.date}`);
    console.log(`   Score: ${m.home_score} - ${m.away_score}`);
    console.log(`   Match ID: ${m.match_id}`);
    console.log(`   Phase: ${m.phase}`);
  });
});

const fs = require('fs').promises;
const path = require('path');

async function saveCalendar(tournamentId, league, season) {
  const matches = await scrapeCalendar(tournamentId);
  
  const output = {
    meta: {
      league: league,
      season: season,
      tournament_id: tournamentId,
      scraped_at: new Date().toISOString(),
      total_matches: matches.length
    },
    matches: matches
  };
  
  const filepath = path.join(__dirname, '..', 'data', `${league}-${season}`, 'calendar.json');
  await fs.writeFile(filepath, JSON.stringify(output, null, 2));
  
  console.log(`\n✅ Saved calendar: ${filepath}`);
  console.log(`📊 Matches: ${matches.length}`);
  
  return matches;
}

// Run
saveCalendar(52, 'plusliga', '2025-2026');