const axios = require('axios');
const cheerio = require('cheerio');

axios.get('https://www.plusliga.pl/games/tour/52.html')
  .then(r => {
    const $ = cheerio.load(r.data);
    
    const gameBoxes = $('.gamesbox[data-game-id]');
    console.log('Total matches:', gameBoxes.length, '\n');
    
    // Just show first match FULL HTML
    const firstBox = $(gameBoxes[0]);
    console.log('=== FIRST MATCH FULL HTML ===\n');
    console.log(firstBox.html().substring(0, 2000));
    
  })
  .catch(e => console.error('Error:', e.message));