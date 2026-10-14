# Karvaan POS

React/TypeScript cashier, waiter, kitchen, and delivery interfaces with a NestJS backend, Prisma, and SQLite. The Windows app in desktopApp bundles the backend. Android devices connect to it over the restaurant network.

## Development

Use Node.js 22.12 or newer. Install each package with npm ci; backend framework and authentication integration are upgraded together to NestJS/Passport 12.

Install dependencies in backend and frontend. Copy backend/.env.example to backend/.env and configure the intended database. Run npm run prisma:generate and npm run prisma:push from backend. Run npm run start:dev in backend and npm run dev in frontend.

Local runtime uses %APPDATA%\KarvaanPOS\dev.db. The database in backend/prisma initializes new local installations only. Startup backs up the active local database before applying schema updates; unsafe changes stop startup. IS_CLOUD=true uses DATABASE_URL; relative SQLite paths resolve from backend/prisma. See WORKFLOW_UPGRADE.md before updating existing installations.

## Verification and builds

Run npm test from backend. The suite uses temporary databases, real local HTTP/WebSocket connections, and a frontend storage harness. Both packages' dependencies must be installed.

Run npm run build in each package. Run npm run tauri:build from frontend to build both packages and the Windows installer using desktopApp. Rust and Windows build tools are required. The installer contains runtime dependencies and excludes developer .env files. Provision a clean database template with private credentials before distributing it.

## Pending writes and cloud sync

Writes are saved on the device before sending and removed only after successful server acknowledgment. Bills and kitchen tickets retain identifiers on retry. The pending-actions banner shows rejected writes for review. Check server history before removing a pending bill.

Actions belong to their original backend, restaurant, and cashier. Unowned legacy queue entries remain in IndexedDB for manual recovery and never replay under a new login. Data in the old default storage namespace remains intact; identify its owner before migrating it.

Cloud sync requires RESTAURANT_ID, VPS_SYNC_URL, and a private CLOUD_SYNC_API_KEY locally. Provision the restaurant and owner on the receiver first and configure separate restaurant keys in CLOUD_SYNC_KEYS. Sync includes dependent order items and menu tombstones and advances cursors after acknowledgment. Use one authoritative operational backend; timestamp replication cannot safely merge simultaneous financial writes to independent databases.

Single-restaurant backups contain compressed, consistent SQLite snapshots. Shared databases export only the requesting tenant as compressed JSON. Destinations are scoped to restaurants and must be outside public uploads. See INSTALLATION_GUIDE.md for deployment modes and recovery limitations.
