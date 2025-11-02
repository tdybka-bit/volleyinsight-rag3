/**
 * Lega Volley Femminile Players List Scraper
 * Scrapes clubs and their rosters with player IDs
 * 
 * Usage: node scripts/scrape-legavolley-femminile-players-list.js [year]
 * Example: node scripts/scrape-legavolley-femminile-players-list.js 2024
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const DELAY_MS = 2000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

async function scrapeClubs(year) {
    const url = `https://www.legavolleyfemminile.it/clubs/?stagione=${year}`;
    
    console.log(`\n🏐 Scraping clubs: ${url}\n`);
  
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
  
    const $ = cheerio.load(response.data);
    const clubs = [];
  
    // Find all club links in carousel
    $('.carousel-header a[href*="/club/"]').each((i, elem) => {
      const $link = $(elem);
      const href = $link.attr('href');
      
      // Extract from: /club/bartoccini-mc-restauri-perugia/710908/
      const match = href.match(/\/club\/([^\/]+)\/(\d+)/);
      
      if (match) {
        const clubSlug = match[1];
        const clubId = match[2];
        
        // Convert slug to name
        const clubName = clubSlug
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        clubs.push({
          id: clubId,
          name: clubName,
          slug: clubSlug
        });
        console.log(`✅ [${clubId}] ${clubName}`);
      }
    });
  
    return clubs;
  }

  async function scrapeRoster(clubId, clubName, clubSlug, stagione) {
    const rosterUrl = `https://www.legavolleyfemminile.it/club/${clubSlug}/${clubId}/roster/?stagione=${stagione}`;
    
    console.log(`\n  📋 ${clubName}`);
    console.log(`     → ${rosterUrl}`);
    
    const response = await axios.get(rosterUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 60000
    });
    
    const $ = cheerio.load(response.data);
    const players = [];
    
    // Find all player cards
    $('.scheda-giocatrice-squadra').each((i, elem) => {
      const $card = $(elem);
      
      // Get player link
      const $link = $card.find('a[href*="/player/"]');
      const href = $link.attr('href');
      
      if (!href) return;
      
      // Extract player ID: /player/gryka-aleksandra/GRY-ALE/
      const match = href.match(/\/player\/[^\/]+\/([^\/]+)/);
      
      if (match) {
        const playerId = match[1];
        
        // Get player name from h2 tags FIRST (before using it)
        const h2Tags = $card.find('.dati h2');
        const firstName = cleanText(h2Tags.eq(0).text());
        const lastName = cleanText(h2Tags.eq(1).text());
        const playerName = `${firstName} ${lastName}`;
        
        // Get position to distinguish players from staff
        const position = cleanText($card.find('.dati p').first().text());

        // Skip if no position (staff members don't have positions)
        if (!position || position === '') {
          console.log(`     ⏭️  Skipping staff: ${playerName} [${playerId}]`);
          return;
        }

        // Additional check: skip common staff positions
        const staffKeywords = ['allenatore', 'assistant', 'preparatore', 'medico', 'fisioterapista', 'coach', '1st', '2nd'];
        if (staffKeywords.some(keyword => position.toLowerCase().includes(keyword))) {
          console.log(`     ⏭️  Skipping staff (${position}): ${playerName} [${playerId}]`);
         return;
        }
        
        if (playerName && playerId) {
          players.push({
            id: playerId,
            first_name: firstName,
            last_name: lastName,
            name: playerName,
            team: clubName,
            team_id: clubId
          });
          console.log(`     ✅ ${playerName} [${playerId}]`);
        }
      }
    });
    
    return players;
  }

  async function main() {
    const args = process.argv.slice(2);
  
    if (args.length !== 1) {
      console.log('Usage: node scripts/scrape-legavolley-femminile-players-list.js [year]');
      console.log('Example: node scripts/scrape-legavolley-femminile-players-list.js 2024');
      process.exit(1);
    }
  
    const year = args[0];
    const season = `${year}-${parseInt(year) + 1}`;
  
    try {
      // Scrape clubs
      const clubs = await scrapeClubs(year);
      console.log(`\n📊 Found ${clubs.length} clubs (all series)`);
  
      // Filter only first 14 clubs (Serie A1)
      const serieA1Clubs = clubs.slice(0, 14);
      console.log(`🎯 Filtering Serie A1: ${serieA1Clubs.length} clubs\n`);
      
      // Scrape rosters for each Serie A1 club
      const allPlayers = [];
      
      for (let i = 0; i < serieA1Clubs.length; i++) {
        const club = serieA1Clubs[i];
        console.log(`\n[${i + 1}/${serieA1Clubs.length}] ${club.name}`);
        
        const players = await scrapeRoster(club.id, club.name, club.slug, year);
        allPlayers.push(...players);
        
        if (i < serieA1Clubs.length - 1) {
          await delay(DELAY_MS);
        }
      }
  
      // Save to file
      const outputDir = path.join(__dirname, '..', 'data', `legavolley-femminile-${year}`);
      await fs.mkdir(outputDir, { recursive: true });
  
      const outputFile = path.join(outputDir, `players-list.json`);
      
      const output = {
        meta: {
          year: parseInt(year),
          season,
          serie: 'A1',
          scraped_at: new Date().toISOString(),
          total_clubs: serieA1Clubs.length,
          total_players: allPlayers.length
        },
        clubs: serieA1Clubs,
        players: allPlayers
      };
  
      await fs.writeFile(outputFile, JSON.stringify(output, null, 2));
  
      console.log(`\n✅ Players list saved to: ${outputFile}`);
      console.log(`📊 Total: ${serieA1Clubs.length} clubs (Serie A1), ${allPlayers.length} players`);
  
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
  
  main();