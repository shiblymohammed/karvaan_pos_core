@echo off
setlocal
title Karvaan POS
cd /d "%~dp0backend"
if exist "%~dp0desktopApp\target\release\karvaan-pos.exe" (
  start "" "%~dp0desktopApp\target\release\karvaan-pos.exe"
  exit /b 0
)
if not exist "dist\src\main.js" (
  call npm run build
  if errorlevel 1 exit /b 1
)
start "Karvaan POS Backend" /MIN cmd /c npm run start:prod
echo Backend started. Run npm run dev from frontend for the browser interface.
echo To build the desktop application, run npm run tauri:build from frontend.
endlocal
