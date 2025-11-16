@echo off
echo ============================================================
echo LEGAVOLLEY FEMMINILE - FULL RESCRAPE (3 SEASONS)
echo ============================================================
echo.
echo Total: 672 players across 3 seasons
echo Estimated time: 6-8 hours
echo.
echo Starting at: %TIME%
echo.
pause

REM ============================================================
REM SEASON 2024-2025 (228 players)
REM ============================================================
echo.
echo ============================================================
echo SEASON 2024-2025: 228 players
echo ============================================================
echo.

node scripts/scrape-legavolley-femminile-enhanced.js 2024 0 227

if %errorlevel% neq 0 (
    echo ERROR in 2024-2025 scraping!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo SEASON 2024-2025 COMPLETED!
echo ============================================================
echo.

REM ============================================================
REM SEASON 2023-2024 (220 players)
REM ============================================================
echo.
echo ============================================================
echo SEASON 2023-2024: 220 players
echo ============================================================
echo.

node scripts/scrape-legavolley-femminile-enhanced.js 2023 0 219

if %errorlevel% neq 0 (
    echo ERROR in 2023-2024 scraping!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo SEASON 2023-2024 COMPLETED!
echo ============================================================
echo.

REM ============================================================
REM SEASON 2022-2023 (224 players)
REM ============================================================
echo.
echo ============================================================
echo SEASON 2022-2023: 224 players
echo ============================================================
echo.

node scripts/scrape-legavolley-femminile-enhanced.js 2022 0 223

if %errorlevel% neq 0 (
    echo ERROR in 2022-2023 scraping!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo ALL SEASONS COMPLETED!
echo ============================================================
echo.
echo Finished at: %TIME%
echo.
echo Total scraped: 672 players
echo.
pause