# Karvaan POS deployment

Choose one backend mode for the cashier PC. Two processes cannot share port 3001.

## Desktop app with bundled backend

1. Prepare a clean database template with private account credentials in backend/prisma/dev.db. Do not distribute a live restaurant database or its WAL files.
2. Install frontend/backend dependencies and generate the Prisma client. Run npm run tauri:build from frontend. Installers appear under desktopApp/target/release/bundle/nsis.
3. Install and launch Karvaan POS. Its backend starts with the desktop app and stops when it exits. Keep the app open while tablets are using it.
4. Choose Standard PC and Localhost in Network Setup. Sign in with the provisioned username and password or PIN.
5. First launch initializes data under %APPDATA%\KarvaanPOS. Later launches preserve that database. Signing secrets and uploads also live there. Optional installed configuration belongs in %APPDATA%\KarvaanPOS\.env.

## Independently managed backend

Use this mode when the backend must run while the cashier app is closed. Use the frontend in a browser against the managed backend.

1. Install Node.js 22.12 or newer, copy backend and scripts, and configure backend/.env from .env.example.
2. Back up the active database before schema updates. Local runtime uses AppData and creates an additional restore point before upgrading. Prisma CLI commands operate on their configured URL, which can refer to a different database.
3. scripts/deploy-backend.bat installs lockfile dependencies, generates Prisma, builds, and starts PM2. Local startup backs up and upgrades the active database. Use Docker for cloud deployment. npm run start:prod runs dist/src/main.js directly.
4. PM2 restarts a crashed backend. pm2 save preserves its process list. Windows reboot startup requires a configured Windows service or scheduled task.
5. Do not also launch a desktop build that starts a bundled backend on port 3001.

## Android clients and kitchen displays

Connect devices and the cashier PC to the same network. Allow port 3001 using scripts/setup-firewall.ps1 with administrator privileges.

Choose Tablet Client, enter http://<cashier-PC-IP>:3001, test, and connect. Sign in with a restaurant account. Legacy Tablet Master mode must be reconfigured as a client; it does not provide a persistent standalone backend.

## Recovery and cloud sync

Configure backups as a restaurant administrator. Single-restaurant backups use consistent SQLite snapshots, including committed WAL data. Shared databases produce tenant-only JSON exports. JSON exports require a dedicated import workflow and cannot be opened as SQLite databases.

Review rejected writes in the pending-actions banner and retry after correcting the cause. A queued bill awaits server confirmation. Check server history before removing it: the write may have succeeded before its acknowledgment was interrupted. Unowned legacy queue entries remain in IndexedDB for manual recovery.

Provision the same restaurant and owner on the cloud receiver, configure a private key for that restaurant, and enable sync in settings. Supply JWT_SECRET on cloud servers. Keep production .env files out of installers and source control.
