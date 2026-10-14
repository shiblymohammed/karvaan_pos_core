#!/bin/sh
set -e

echo "=================================================="
echo "🚀 Initializing Karvaan POS Backend (Cloud Mode)"
echo "=================================================="

# Ensure data directory exists
mkdir -p /app/data /app/data/uploads

# Run Prisma schema push on the database (creates tables or applies incremental schema updates)
echo "📦 Synchronizing Prisma database schema..."
npx prisma db push --skip-generate

# Seed initial super-admin if database is empty
echo "🌱 Checking seed data..."
npx ts-node prisma/seed.ts || true

echo "✅ Database ready. Starting server..."
exec node dist/src/main.js
