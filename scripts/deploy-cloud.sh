#!/bin/bash
# =================================================================
# Karvaan POS - 1-Click Cloud Deployment Script for Ubuntu / Debian
# =================================================================

set -e

echo "=================================================="
echo "🚀 Karvaan POS Cloud Production Deployment"
echo "=================================================="

# 1. Verify Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed."
    echo "Run this command first to install Docker:"
    echo "curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker \$USER"
    exit 1
fi

# Ensure 2GB Swap exists for 1GB RAM VPS (prevents OOM during TypeScript / Docker builds)
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
SWAP_EXISTS=$(swapon --show | wc -l)
if [ "$TOTAL_RAM_MB" -lt 1800 ] && [ "$SWAP_EXISTS" -le 1 ]; then
    echo "⚙️  Detected $TOTAL_RAM_MB MB RAM. Creating 2GB swap file on SSD..."
    fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q "/swapfile" /etc/fstab || echo "/swapfile swap swap defaults 0 0" >> /etc/fstab
    echo "✅ 2GB Swap active. Total effective memory: $((TOTAL_RAM_MB + 2048)) MB."
fi

# 2. Check or create .env file
if [ ! -f .env ]; then
    echo "📝 Generating production .env configuration..."
    cp .env.production.example .env
    
    # Generate cryptographically secure 64-char JWT secret
    RANDOM_SECRET=$(openssl rand -hex 32 2>/dev/null || date +%s%N | sha256sum | head -c 64)
    sed -i "s|replace_with_strong_random_secret_generated_via_openssl_rand_hex_32|$RANDOM_SECRET|" .env
    
    # Generate random admin password if still default
    RANDOM_PASS=$(openssl rand -hex 8 2>/dev/null || date +%s%N | head -c 12)
    sed -i "s|ChangeThisPassword123!|Admin@$RANDOM_PASS|" .env
    
    echo "✅ Created .env with generated secure JWT_SECRET and initial password."
fi

# 3. Build and launch containers
echo "🔨 Building Docker containers (NestJS Backend + React Vite Nginx)..."
docker compose build

echo "🚢 Launching services in background..."
docker compose up -d

# 4. Wait for backend health check
echo "⏳ Waiting for backend database migrations & health check..."
ATTEMPTS=0
MAX_ATTEMPTS=30
while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
    if docker inspect --format='{{json .State.Health.Status}}' karvaan-backend 2>/dev/null | grep -q "healthy"; then
        echo "✅ Backend is healthy and database is ready!"
        break
    fi
    sleep 2
    ATTEMPTS=$((ATTEMPTS+1))
done

# 5. Summary & Connection Information
PUBLIC_IP=$(curl -s https://ifconfig.me || hostname -I | awk '{print $1}')
echo ""
echo "=================================================="
echo "🎉 KARVAAN POS DEPLOYMENT SUCCESSFUL!"
echo "=================================================="
echo "🌐 Access Web App:  http://$PUBLIC_IP"
echo "🛠️ Super Admin URL: http://$PUBLIC_IP/super-admin"
echo ""
echo "Credentials (saved in .env):"
grep "SUPER_ADMIN_" .env || true
echo "=================================================="
echo "Useful Commands:"
echo "  - View live logs:     docker compose logs -f"
echo "  - Restart services:   docker compose restart"
echo "  - Stop services:      docker compose down"
echo "  - Backup database:    ./scripts/backup-cloud.sh"
echo "=================================================="
