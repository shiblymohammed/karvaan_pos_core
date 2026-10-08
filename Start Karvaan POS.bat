@echo off
title Karvaan POS Server
echo ========================================================
echo Starting Karvaan POS Backend Server...
echo Do not close this window! If you close it, waiter tablets will disconnect.
echo ========================================================

cd /d "%~dp0backend"

:: Start the backend silently using start /B or just let it run in this terminal
start /B npm run start:prod

:: Wait 3 seconds to ensure backend is up
timeout /t 3 /nobreak >nul

echo Starting POS Desktop App...
cd /d "%~dp0frontend\src-tauri\target\release"

:: Launch Tauri app
start "" karvaan-pos.exe

echo All systems running! You can minimize this window.
