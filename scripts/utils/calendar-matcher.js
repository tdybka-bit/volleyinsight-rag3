// scripts/utils/calendar-matcher.js
const fs = require('fs');
const path = require('path');

/**
 * Load calendar for league/season
 */
function loadCalendar(league, season) {
  const filepath = path.join(__dirname, '../../data', `${league}-${season}`, 'calendar.json');
  
  if (!fs.existsSync(filepath)) {
    console.warn(`⚠️  Calendar not found: ${filepath}`);
    return null;
  }
  
  const content = fs.readFileSync(filepath, 'utf-8');
  const data = JSON.parse(content);
  return data.matches;
}

/**
 * Match opponent string to calendar entry
 * Input: "JSW Jastrzębski Węgiel -Indykpol AZS Olsztyn"
 * Output: { match_id, date, phase, is_home }
 */
function matchOpponentToCalendar(opponentString, calendar, playerTeam) {
  if (!calendar) return null;
  
  // Parse opponent string
  // Format: "TeamA -TeamB" or "TeamB -TeamA"
  const parts = opponentString.split(' -');
  if (parts.length !== 2) return null;
  
  const team1 = parts[0].trim();
  const team2 = parts[1].trim();
  
  // Find in calendar
  for (const match of calendar) {
    const homeMatch = match.home_team === team1 && match.away_team === team2;
    const awayMatch = match.home_team === team2 && match.away_team === team1;
    
    if (homeMatch || awayMatch) {
      // Determine if player's team was home
      let isHome = null;
      if (playerTeam) {
        isHome = match.home_team.includes(playerTeam) || playerTeam.includes(match.home_team);
      }
      
      return {
        match_id: match.match_id,
        date: match.date,
        phase: match.phase,
        is_home: isHome,
        home_team: match.home_team,
        away_team: match.away_team
      };
    }
  }
  
  return null;
}

module.exports = {
  loadCalendar,
  matchOpponentToCalendar
};