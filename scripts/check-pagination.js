const axios = require('axios');
const cheerio = require('cheerio');

axios.get('https://www.plusliga.pl/games/tour/52.html')
  .then(r => {
    const $ = cheerio.load(r.data);
    
    // Count ALL gamesbox elements
    const allBoxes = $('[data-game-id]');
    console.log('Total game boxes in HTML:', allBoxes.length);
    
    // Check for slider/carousel controls
    const sliderControls = $('.dc-slider-nav, .slider-arrow, .carousel-control, [class*="slider"], [class*="prev"], [class*="next"]');
    console.log('Slider controls:', sliderControls.length);
    
    // Look for "Show all" or "Load more" buttons
    $('button, a').each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text.includes('więcej') || text.includes('wszystkie') || text.includes('more') || text.includes('all')) {
        console.log('Found button:', $(el).text().trim(), '- class:', $(el).attr('class'));
      }
    });
    
    // Check game IDs range
    const gameIds = [];
    allBoxes.each((i, el) => {
      gameIds.push($(el).attr('data-game-id'));
    });
    console.log('\nGame IDs range:', Math.min(...gameIds), '-', Math.max(...gameIds));
    console.log('Total unique IDs:', new Set(gameIds).size);
  });