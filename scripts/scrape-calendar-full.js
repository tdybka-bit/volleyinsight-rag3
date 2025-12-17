const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function scrapeFullCalendar(tournamentId, league, season) {
  console.log('🚀 Launching browser...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  console.log('📄 Loading page...');
  await page.goto(`https://www.plusliga.pl/games/tour/${tournamentId}.html`, {
    waitUntil: 'networkidle2'
  });
  
  console.log('🖱️  Clicking "Wszystkie" filters...');

  // Click "Wszystkie kolejki"
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button.filter-button[data-filter-type="term"]'));
    const allButton = buttons.find(btn => btn.textContent.includes('Wszystkie'));
    if (allButton) {
        allButton.click();
        console.log('Clicked: Wszystkie kolejki');
    }
  });

  // Wait for reload
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Click "Wszystkie drużyny" (if exists)
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button.filter-button'));
    buttons.forEach(btn => {
        if (btn.textContent.includes('Wszystkie') && !btn.textContent.includes('Kolejka')) {
        btn.click();
        console.log('Clicked:', btn.textContent.trim());
        }
    });
  });

  // Wait for content to load
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('📊 Extracting matches...');
  
  const matches = await page.evaluate(() => {
    const results = [];
    const gameBoxes = document.querySelectorAll('[data-game-id]');
    
    gameBoxes.forEach(box => {
      const gameId = box.getAttribute('data-game-id');
      
      const dateEl = box.querySelector('.date');
      const teams = box.querySelectorAll('.team .name, .game-team');
      const scores = box.querySelectorAll('.score span, .game-result');
      
      const fullText = box.textContent;
      let phase = 'unknown';
      if (fullText.includes('Faza zasadnicza')) {
        phase = 'regular';
      } else if (fullText.includes('Playoff') || fullText.includes('Ćwierćfinał') || fullText.includes('Półfinał') || fullText.includes('Finał')) {
        phase = 'playoff';
      }
      
      results.push({
        match_id: gameId,
        date: dateEl ? dateEl.textContent.trim() : '',
        home_team: teams[0] ? teams[0].textContent.trim() : '',
        away_team: teams[1] ? teams[1].textContent.trim() : '',
        home_score: scores[0] ? scores[0].textContent.trim() : '',
        away_score: scores[1] ? scores[1].textContent.trim() : '',
        phase: phase
      });
    });
    
    return results;
  });
  
  await browser.close();
  
  console.log(`\n✅ Extracted ${matches.length} matches`);
  
  // Save
  const output = {
    meta: {
      league,
      season,
      tournament_id: tournamentId,
      scraped_at: new Date().toISOString(),
      total_matches: matches.length
    },
    matches
  };
  
  const filepath = path.join(__dirname, '..', 'data', `${league}-${season}`, 'calendar.json');
  await fs.writeFile(filepath, JSON.stringify(output, null, 2));
  
  console.log(`💾 Saved: ${filepath}`);
  
  return matches;
}

// Run
scrapeFullCalendar(52, 'plusliga', '2025-2026');