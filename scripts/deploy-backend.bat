@echo off
REM ============================================================
REM Karvaan POS — Deploy & Start with PM2
REM Run this to build and launch the backend in production mode.
REM ============================================================

echo.
echo ============================================================
echo   Karvaan POS Backend — Production Deployment
echo ============================================================
echo.

cd /d "%~dp0..\backend"

echo [1/4] Building NestJS backend...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed. Check the output above.
    pause
    exit /b 1
)
echo       Done.

echo.
echo [2/4] Installing PM2 globally (if not installed)...
call npm install -g pm2 2>nul
echo       Done.

echo.
echo [3/4] Starting backend with PM2...
call pm2 start ecosystem.config.js --env production
echo       Done.

echo.
echo [4/4] Saving PM2 process list (auto-restart on reboot)...
call pm2 save
echo       Done.

echo.
echo ============================================================
echo   Backend is now running on port 3001
echo   It will auto-restart on crash and on Windows reboot.
echo.
echo   Useful PM2 commands:
echo     pm2 status              - Check running status
echo     pm2 logs karvaan-backend - View live logs
echo     pm2 restart karvaan-backend - Restart after update
echo ============================================================
echo.

REM Show local IP addresses
echo Your PC IP addresses (for tablet/phone setup):
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    echo   http:%%i:3001
)

echo.
pause
