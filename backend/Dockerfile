# ============================================================
# Karvaan POS Backend - Production Container
# Multi-tenant Node.js + NestJS + Prisma + SQLite Engine
# ============================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Install all npm dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source and prisma schema
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma Client and compile TypeScript (including prisma/seed.ts -> dist/prisma/seed.js)
RUN npx prisma generate
RUN npm run build

# ── Runtime Stage ───────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime tools
RUN apk add --no-cache wget

# Create data directory for persistent SQLite database and uploads
RUN mkdir -p /app/data /app/data/uploads

ENV PORT=3001
ENV IS_CLOUD=true

# Copy package manifests, compiled dist, prisma schema, and complete node_modules from builder
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
