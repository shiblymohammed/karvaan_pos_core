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

node -e "const [major,minor]=process.versions.node.split('.').map(Number); if(major<22 || (major===22 && minor<12)) { console.error('Install Node.js 22.12 or newer before deploying.'); process.exit(1); }"
if errorlevel 1 exit /b 1

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
call npm ci
if %errorlevel% neq 0 (
    echo ERROR: Dependency installation failed. Check the output above.
    pause
    exit /b 1
)
echo       Done.

echo.
echo [2/6] Generating Prisma client...
call npx prisma generate
if errorlevel 1 exit /b 1
echo       Done.

echo.
echo [3/6] Local database will be backed up and upgraded automatically on startup.
echo       Use the Docker deployment for a cloud backend.

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
if errorlevel 1 exit /b 1
echo       Done.

echo.
echo [6/6] Starting backend with PM2...
call pm2 delete karvaan-backend 2>nul
call pm2 start ecosystem.config.js --env production
if errorlevel 1 exit /b 1
call pm2 save
if errorlevel 1 exit /b 1
echo       Done.

echo.
echo ============================================================
echo   Backend is now running on port 3001
echo   It will auto-restart on crash. Configure a Windows service or scheduled task for boot startup.
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
