@echo off
echo ========================================
echo TAURONLIGA FIX - Correct ranges
echo ========================================
echo Start: %time%
echo.

echo [1/3] TauronLiga 2024-2025 (0-176)...
node scripts/scrape-plusliga-enhanced-batch.js tauronliga 2024-2025 0 176
echo.

echo [2/3] TauronLiga 2023-2024 (0-163)...
node scripts/scrape-plusliga-enhanced-batch.js tauronliga 2023-2024 0 163
echo.

echo [3/3] TauronLiga 2022-2023 (0-168)...
node scripts/scrape-plusliga-enhanced-batch.js tauronliga 2022-2023 0 168
echo.

echo ========================================
echo DONE at %time%
echo ========================================
pause