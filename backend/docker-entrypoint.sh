#!/bin/sh
set -e

echo "=================================================="
echo "🚀 Initializing Karvaan POS Backend (Cloud Mode)"
echo "=================================================="

# Ensure data directory exists
mkdir -p /app/data /app/data/uploads

# Run Prisma schema push on the database non-interactively using local binary
echo "📦 Synchronizing Prisma database schema..."
./node_modules/.bin/prisma db push --skip-generate --accept-data-loss

# Seed initial super-admin if database is empty using compiled JS
echo "🌱 Checking seed data..."
node dist/prisma/seed.js || true

echo "✅ Database ready. Starting server..."
exec node dist/src/main.js
