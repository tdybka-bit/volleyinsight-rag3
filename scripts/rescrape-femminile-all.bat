@echo off
echo ================================
echo RESCRAPE LEGAVOLLEY FEMMINILE
echo All 3 seasons (2022-2025)
echo ================================
echo.

echo [1/3] Scraping 2022-2023...
node scripts/scrape-legavolley-femminile-enhanced.js 2022 0 223
if %errorlevel% neq 0 (
    echo ERROR in 2022-2023!
    pause
    exit /b 1
)
echo.
echo ✅ 2022-2023 DONE!
echo.

echo [2/3] Scraping 2023-2024...
node scripts/scrape-legavolley-femminile-enhanced.js 2023 0 227
if %errorlevel% neq 0 (
    echo ERROR in 2023-2024!
    pause
    exit /b 1
)
echo.
echo ✅ 2023-2024 DONE!
echo.

echo [3/3] Scraping 2024-2025...
node scripts/scrape-legavolley-femminile-enhanced.js 2024 0 227
if %errorlevel% neq 0 (
    echo ERROR in 2024-2025!
    pause
    exit /b 1
)
echo.
echo ✅ 2024-2025 DONE!
echo.

echo ================================
echo ALL DONE! Merging...
echo ================================
node scripts/merge-all-leagues.js

echo.
echo ✅✅✅ COMPLETE! ✅✅✅
pause