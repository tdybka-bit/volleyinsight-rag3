@echo off
echo ========================================
echo LEGAVOLLEY FEMMINILE FIX - Correct ranges
echo ========================================
echo Start: %time%
echo.

REM ===== 2024 - Dokoncz (50-227) =====
echo [1/4] Femminile 2024 sezon zasadniczy (50-227)...
node scripts/scrape-legavolley-femminile-enhanced.js 2024 50 227
echo.

REM ===== 2024 - Playoff (caly roster 0-227) =====
echo [2/4] Femminile 2024 playoff (0-227)...
node scripts/scrape-legavolley-femminile-enhanced.js 2024 0 227
echo.

REM ===== 2023 - All players (0-219) =====
echo [3/4] Femminile 2023 all players (0-219)...
node scripts/scrape-legavolley-femminile-enhanced.js 2023 0 219
echo.

REM ===== 2022 - All players (0-223) =====
echo [4/4] Femminile 2022 all players (0-223)...
node scripts/scrape-legavolley-femminile-enhanced.js 2022 0 223
echo.

echo ========================================
echo DONE at %time%
echo Check data/ folders!
echo ========================================
pause