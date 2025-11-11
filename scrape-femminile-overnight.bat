@echo off
echo ========================================
echo OVERNIGHT SCRAPING - LegaVolley Femminile
echo ========================================
echo Start: %time%
echo.

REM ===== 2024-2025 - Dokoncz sezon zasadniczy =====
echo [1/7] Femminile 2024-2025 sezon zasadniczy (players 50-227)...
node scripts/scrape-legavolley-femminile-enhanced.js 2024 50 227
echo.

REM ===== 2024-2025 - Scrape giornate playoff =====
echo [2/7] Scraping giornate 2024-2025 playoff (710322)...
node scripts/scrape-legavolley-femminile-giornate.js 2024 710322
echo.

REM ===== 2024-2025 - Scrape playoff =====
echo [2.1/7] Femminile 2024-2025 playoff (all players)...
node scripts/scrape-legavolley-femminile-enhanced.js 2024 0 227
echo.

REM ===== 2023-2024 - Scrape players list =====
echo [3/7] Scraping players list 2023...
node scripts/scrape-legavolley-femminile-players-list.js 2023
echo.

REM ===== 2023-2024 - Scrape giornate (sezon + playoff) =====
echo [4/7] Scraping giornate 2023 (sezon zasadniczy 710303)...
node scripts/scrape-legavolley-femminile-giornate.js 2023 710303
echo.

echo [4.1/7] Scraping giornate 2023 (playoff 710311)...
node scripts/scrape-legavolley-femminile-giornate.js 2023 710311
echo.

REM ===== 2023-2024 - Scrape all players =====
echo [5/7] Femminile 2023-2024 (all players)...
node scripts/scrape-legavolley-femminile-enhanced.js 2023 0 999
echo.

REM ===== 2022-2023 - Scrape players list =====
echo [6/7] Scraping players list 2022...
node scripts/scrape-legavolley-femminile-players-list.js 2022
echo.

REM ===== 2022-2023 - Scrape giornate (sezon + playoff) =====
echo [6.1/7] Scraping giornate 2022 (sezon zasadniczy 710276)...
node scripts/scrape-legavolley-femminile-giornate.js 2022 710276
echo.

echo [6.2/7] Scraping giornate 2022 (playoff 710284)...
node scripts/scrape-legavolley-femminile-giornate.js 2022 710284
echo.

REM ===== 2022-2023 - Scrape all players =====
echo [7/7] Femminile 2022-2023 (all players)...
node scripts/scrape-legavolley-femminile-enhanced.js 2022 0 999
echo.

echo ========================================
echo DONE at %time%
echo Check data/ folders!
echo ========================================
pause