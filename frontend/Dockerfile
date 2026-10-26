# ============================================================
# Karvaan POS Frontend - Production Container
# Vite React SPA + Nginx Reverse Proxy
# ============================================================

FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests and install dependencies
COPY frontend/package*.json ./
RUN npm ci

# Copy application source
COPY frontend/tsconfig*.json ./
COPY frontend/vite.config.ts ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./
COPY frontend/index.html ./
COPY frontend/public ./public
COPY frontend/src ./src
COPY print-agent /print-agent

# Build production bundle
RUN npm run build

# ── Nginx Web Server ─────────────────────────────────────────
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
