/**
 * Date Tracker - tracks last scrape date per league/season
 * Used by weekly refresh scraper
 */

const fs = require('fs');
const path = require('path');

const TRACKER_FILE = path.join(__dirname, '../scrape-tracker.json');

/**
 * Get tracker data
 */
function getTracker() {
  if (!fs.existsSync(TRACKER_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
  } catch (error) {
    console.error('Error reading tracker:', error);
    return {};
  }
}

/**
 * Save tracker data
 */
function saveTracker(tracker) {
  try {
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(tracker, null, 2));
  } catch (error) {
    console.error('Error saving tracker:', error);
  }
}

/**
 * Get last scraped date for league/season
 * @param {string} league - e.g. "plusliga"
 * @param {string} season - e.g. "2024-2025"
 * @returns {string|null} - Date string "2024-12-08" or null
 */
function getLastScrapedDate(league, season) {
  const tracker = getTracker();
  const key = `${league}-${season}`;
  return tracker[key] || null;
}

/**
 * Update last scraped date
 * @param {string} league 
 * @param {string} season 
 * @param {string} date - "2024-12-08" format
 */
function updateLastScrapedDate(league, season, date) {
  const tracker = getTracker();
  const key = `${league}-${season}`;
  tracker[key] = date;
  saveTracker(tracker);
  console.log(`✅ Updated tracker: ${key} → ${date}`);
}

/**
 * Parse match date string to Date object
 * Handles both DD/MM/YYYY and YYYY-MM-DD formats
 */
function parseMatchDate(dateStr) {
  if (!dateStr) return null;
  
  // Check format
  if (dateStr.includes('/')) {
    // "13/10/2024" format
    const [day, month, year] = dateStr.split('/');
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  } else {
    // "2024-10-13" format
    return new Date(dateStr);
  }
}

/**
 * Check if match is after given date
 */
function isMatchAfterDate(matchDate, sinceDate) {
  if (!sinceDate) return true; // No filter = include all
  
  const matchDateObj = parseMatchDate(matchDate);
  const sinceDateObj = new Date(sinceDate);
  
  return matchDateObj > sinceDateObj;
}

module.exports = {
  getLastScrapedDate,
  updateLastScrapedDate,
  parseMatchDate,
  isMatchAfterDate
};
