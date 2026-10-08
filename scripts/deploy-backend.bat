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

REM ─── Check .env exists ───────────────────────────────────────
if not exist ".env" (
    echo.
    echo  ERROR: .env file not found in backend\
    echo  Please copy .env.example to .env and fill in:
    echo    - RESTAURANT_ID  (run: node get-id.js after first db push^)
    echo    - JWT_SECRET
    echo    - CLOUDINARY_URL (optional^)
    echo.
    pause
    exit /b 1
)

echo [1/6] Installing NPM dependencies...
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo ERROR: npm install failed. Check the output above.
    pause
    exit /b 1
)
echo       Done.

echo.
echo [2/6] Generating Prisma client...
call npx prisma generate
echo       Done.

echo.
echo [3/6] Pushing database schema (creates dev.db if missing)...
call npx prisma db push
echo       Done.

echo.
echo [4/6] Building NestJS backend...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed. Check the output above.
    pause
    exit /b 1
)
echo       Done.

echo.
echo [5/6] Installing PM2 globally (if not installed)...
call npm install -g pm2 2>nul
echo       Done.

echo.
echo [6/6] Starting backend with PM2...
call pm2 delete karvaan-backend 2>nul
call pm2 start ecosystem.config.js --env production
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
echo  TIP: Cloud sync is disabled by default.
echo  The system will run 100%% offline until you configure the VPS.
echo.
pause
