const puppeteer = require('puppeteer');

async function debug() {
  const browser = await puppeteer.launch({ headless: false }); // VISIBLE browser
  const page = await browser.newPage();
  
  await page.goto('https://www.plusliga.pl/games/tour/52.html', {
    waitUntil: 'networkidle2'
  });
  
  console.log('Browser opened - check manually:');
  console.log('1. Click "Wszystkie kolejki"');
  console.log('2. Click "Wszystkie drużyny"');
  console.log('3. Count matches visible');
  console.log('\nPress Ctrl+C when done...');
  
  // Keep browser open
  await new Promise(() => {});
}

debug();