@echo off
echo ============================================================
echo LEGAVOLLEY FEMMINILE - FULL RESCRAPE (3 SEASONS)
echo ============================================================
echo.
echo Total: 672 players
echo Starting at: %TIME%
echo.

echo 2024-2025: 228 players
node scrape-legavolley-femminile-enhanced.js 2024 0 227

echo 2023-2024: 220 players  
node scrape-legavolley-femminile-enhanced.js 2023 0 219

echo 2022-2023: 224 players
node scrape-legavolley-femminile-enhanced.js 2022 0 223

echo.
echo COMPLETED at: %TIME%
pause
