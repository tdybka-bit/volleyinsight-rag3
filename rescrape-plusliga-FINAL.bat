@echo off
echo ========================================
echo CLEAN RESCRAPE PlusLiga - FINAL FIX
echo ========================================

REM Usuń stare enhanced foldery
echo [CLEANUP] Removing old enhanced folders...
if exist data\plusliga-2024-2025-enhanced rmdir /s /q data\plusliga-2024-2025-enhanced
if exist data\plusliga-2023-2024-enhanced rmdir /s /q data\plusliga-2023-2024-enhanced
if exist data\plusliga-2022-2023-enhanced rmdir /s /q data\plusliga-2022-2023-enhanced
echo Done.
echo.

REM Rescrape z poprawnymi rangami
echo [1/3] PlusLiga 2024-2025 (0-251 = 252 players)...
node scripts/scrape-plusliga-enhanced-batch.js plusliga 2024-2025 0 251
echo.

echo [2/3] PlusLiga 2023-2024 (0-258 = 259 players)...
node scripts/scrape-plusliga-enhanced-batch.js plusliga 2023-2024 0 258
echo.

echo [3/3] PlusLiga 2022-2023 (0-258 = 259 players)...
node scripts/scrape-plusliga-enhanced-batch.js plusliga 2022-2023 0 258
echo.

echo ========================================
echo DONE at %time%
echo All PlusLiga data rescraped with FIXED is_home!
echo ========================================
pause