# 🔄 Weekly Refresh System

Automatic incremental scraping system that adds only new matches (not re-scrape everything).

## 📁 Files Structure

```
scrapers/
├── scrape-tracker.json           # Tracks last scrape dates
├── refresh-weekly.js             # Main orchestrator
├── scraper-integration-example.js # Integration example
├── utils/
│   ├── date-tracker.js           # Date tracking utilities
│   └── incremental-utils.js      # Append/merge utilities
└── README-weekly-refresh.md      # This file
```

## 🚀 Quick Start

### 1. Setup

Copy all files to your scrapers directory:
```bash
scrapers/
├── utils/
│   ├── date-tracker.js
│   └── incremental-utils.js
├── refresh-weekly.js
├── scrape-tracker.json
└── scraper-integration-example.js
```

### 2. First Run (Initialize)

Set initial dates in `scrape-tracker.json`:
```json
{
  "plusliga-2024-2025": "2024-12-08",
  "tauronliga-2024-2025": "2024-12-07",
  "legavolley-femminile-2024-2025": "2024-12-09"
}
```

Use the last date you have in your current data.

### 3. Integrate Your Scrapers

You need to modify your existing scrapers to work incrementally.

**Example for PlusLiga:**

```javascript
// In your scrape-plusliga-enhanced.js

const { isMatchAfterDate } = require('./utils/date-tracker');
const { appendMatchesToPlayerFile, getPlayerIds } = require('./utils/incremental-utils');

async function incrementalScrape(season, sinceDate) {
  const league = 'plusliga';
  const playerIds = getPlayerIds(league, season);
  
  let totalNew = 0;
  
  for (const playerId of playerIds) {
    // Your existing scraping logic
    const allMatches = await scrapePlayerMatches(playerId);
    
    // Filter only new matches
    const newMatches = sinceDate 
      ? allMatches.filter(m => isMatchAfterDate(m.date, sinceDate))
      : allMatches;
    
    if (newMatches.length > 0) {
      const added = appendMatchesToPlayerFile(
        playerId, 
        newMatches, 
        league, 
        season
      );
      totalNew += added;
    }
    
    await delay(1000); // Rate limiting
  }
  
  return { playersUpdated: totalNew > 0 ? playerIds.length : 0, totalNewMatches: totalNew };
}

// Export for use by refresh-weekly.js
module.exports = {
  incrementalScrape,
  // ... your other exports
};
```

### 4. Update refresh-weekly.js

Replace the placeholder with your actual scrapers:

```javascript
// At top of refresh-weekly.js
const plusligaScraper = require('./scrape-plusliga-enhanced');
const tauronligaScraper = require('./scrape-tauronliga');
const legavolleyFemminileScraper = require('./scrape-legavolley-femminile');

// In incrementalScrapeLeague function:
async function incrementalScrapeLeague(league, season, sinceDate) {
  console.log(`\n📊 ${league} ${season}`);
  console.log(`Last scraped: ${sinceDate || 'NEVER (first run)'}`);
  
  let result;
  
  if (league === 'plusliga') {
    result = await plusligaScraper.incrementalScrape(season, sinceDate);
  } else if (league === 'tauronliga') {
    result = await tauronligaScraper.incrementalScrape(season, sinceDate);
  } else if (league === 'legavolley-femminile') {
    result = await legavolleyFemminileScraper.incrementalScrape(season, sinceDate);
  }
  
  return result;
}
```

### 5. Run Weekly Refresh

```bash
node scrapers/refresh-weekly.js
```

## 📊 How It Works

### Before (Current System)
```
Every week: Scrape ALL 200 players x 20 matches = 4000 requests
Time: 2-3 hours
Result: Duplicate data, slow
```

### After (Weekly Refresh)
```
Every week: Scrape 200 players x 1-2 NEW matches = 200-400 requests
Time: 15-30 minutes
Result: Only new data, fast ✅
```

### Logic Flow

1. **Check last date**: Read from `scrape-tracker.json`
2. **Scrape player**: Get all matches from website
3. **Filter new**: Keep only matches after last date
4. **Append**: Add to existing file (no duplicates)
5. **Update tracker**: Save today's date

## 🔧 Key Functions

### date-tracker.js

```javascript
getLastScrapedDate(league, season) 
// Returns: "2024-12-08" or null

updateLastScrapedDate(league, season, date)
// Saves new date to tracker

isMatchAfterDate(matchDate, sinceDate)
// Returns: true if match is newer
```

### incremental-utils.js

```javascript
appendMatchesToPlayerFile(playerId, newMatches, league, season)
// Appends new matches, removes duplicates, recalculates stats
// Returns: number of matches added

getPlayerIds(league, season)
// Returns: array of player IDs from existing files
```

## 🎯 Usage Examples

### Manual Run (Test)
```bash
node scrapers/refresh-weekly.js
```

### Scheduled Run (Cron)

**Linux/Mac** (`crontab -e`):
```bash
# Every Sunday at 11 PM
0 23 * * 0 cd /path/to/project && node scrapers/refresh-weekly.js
```

**Windows** (Task Scheduler):
```
Trigger: Weekly, Sunday 11:00 PM
Action: node.exe
Arguments: C:\EdVolley\volleyinsight-rag3\scrapers\refresh-weekly.js
Start in: C:\EdVolley\volleyinsight-rag3
```

### Programmatic Run
```javascript
const { refreshAllLeagues } = require('./scrapers/refresh-weekly');

// In your app
async function weeklyUpdate() {
  await refreshAllLeagues();
  // Then re-embed to Pinecone if needed
}
```

## 🐛 Troubleshooting

### "Directory not found"
- Make sure `scraped-data/` structure exists
- Check league name matches directory name

### "No new matches found"
- Check `scrape-tracker.json` dates
- Verify date format in your data (DD/MM/YYYY vs YYYY-MM-DD)

### Duplicates still appearing
- Check match ID logic in `incremental-utils.js`
- Ensure `giornata_id` or `match_id` exists in your data

## ✅ Checklist

Before first run:
- [ ] All utility files copied to `scrapers/utils/`
- [ ] `scrape-tracker.json` initialized with current dates
- [ ] Your scrapers export `incrementalScrape()` function
- [ ] `refresh-weekly.js` imports your scrapers
- [ ] Test run on 1-2 players first!

## 📈 Next Steps

After weekly refresh works:
1. Add to cron/scheduler for automatic runs
2. Add Slack/email notifications
3. Re-embed new data to Pinecone
4. Update RAG with fresh stats

---

**Questions?** Check `scraper-integration-example.js` for detailed integration guide.