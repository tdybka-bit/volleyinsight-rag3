@echo off
echo ========================================
echo RESCRAPE ALL - Fixed is_home logic
echo ========================================

echo [1/3] PlusLiga 2024-2025...
node scripts/scrape-plusliga-enhanced-batch.js plusliga 2024-2025 0 258
echo.

echo [2/3] PlusLiga 2023-2024...
node scripts/scrape-plusliga-enhanced-batch.js plusliga 2023-2024 0 258
echo.

echo [3/3] PlusLiga 2022-2023...
node scripts/scrape-plusliga-enhanced-batch.js plusliga 2022-2023 0 258
echo.

echo DONE!
pause