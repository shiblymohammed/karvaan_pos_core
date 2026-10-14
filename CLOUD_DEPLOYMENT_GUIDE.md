# Karvaan POS — Cloud Deployment & Multi-Restaurant Setup Guide

This guide covers deploying the full **Karvaan POS** stack (NestJS backend + React Vite frontend + SQLite multi-tenant engine + Nginx reverse proxy + WebSockets) to a single budget Linux VPS for hosting up to **3 restaurants** (and scalable to dozens).

---

## 1. VPS Sizing & Recommended Providers

Because Karvaan POS is built with an ultra-efficient compiled architecture, you do **not** need expensive Kubernetes or managed cloud databases. A single budget VPS handles 3 active restaurants with under 15% resource utilization.

| Provider | Recommended Tier | Specs | Approx. Cost |
| :--- | :--- | :--- | :--- |
| **Hetzner Cloud** | CX22 | 2 vCPU, 4 GB RAM, 40 GB NVMe | ~€3.80 / mo (~$4.10) |
| **DigitalOcean** | Basic Droplet | 1 vCPU, 1 GB–2 GB RAM, 25 GB SSD | $6.00 / mo |
| **Linode / Akamai** | Shared Nanode | 1 vCPU, 1 GB–2 GB RAM, 25 GB SSD | $5.00 / mo |
| **AWS Lightsail** | Linux Instance | 1 vCPU, 1 GB RAM, 40 GB SSD | $5.00 / mo |

> **OS Recommendation:** Ubuntu 24.04 LTS or 22.04 LTS (64-bit).

---

## 2. Server Initial Setup (2 Minutes)

SSH into your clean VPS:
```bash
ssh root@<YOUR_VPS_IP>
```

Update system packages and install Docker with official 1-line script:
```bash
# 1. Update packages
apt update && apt upgrade -y
apt install -y git curl wget

# 2. Install Docker & Docker Compose plugin
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

---

## 3. Clone Repository & 1-Click Launch

```bash
# 1. Clone your Karvaan POS repository
git clone https://github.com/<YOUR_GITHUB_USERNAME>/karvaan_pos_basic.git /opt/karvaan
cd /opt/karvaan

# 2. Make scripts executable
chmod +x scripts/*.sh

# 3. Run the automated cloud deployment
./scripts/deploy-cloud.sh
```

### What this script does automatically:
1. Copies `.env.production.example` to `.env`.
2. Generates a cryptographically strong 64-character `JWT_SECRET`.
3. Generates a secure random initial `SUPER_ADMIN_PASSWORD`.
4. Builds the lightweight Docker containers:
   - `karvaan-backend`: Node 20 Alpine, Prisma engine, WebSocket gateway.
   - `karvaan-frontend`: Nginx Alpine serving the React SPA and reverse-proxying API & WebSocket connections.
5. Executes Prisma schema migration and idempotently seeds initial Super Admin.
6. Waits for the `/health` endpoint to report healthy.
7. Prints your live server IP and credentials.

---

## 4. Production Domain & Free Automatic HTTPS (SSL)

To enable secure HTTPS with automatic Let's Encrypt certificates:

### Step 4.1: Point DNS
In your DNS registrar (Cloudflare, GoDaddy, Namecheap), add an **A Record**:
- **Type:** `A`
- **Name:** `pos` (or `@` for root domain)
- **Value:** `<YOUR_VPS_IP>`

### Step 4.2: Enable Caddy for 1-minute HTTPS
Caddy is the simplest zero-maintenance reverse proxy with automatic SSL renewal:

```bash
# 1. Install Caddy on host
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy

# 2. Switch Docker HTTP port to 8080 so Caddy can use 80 and 443
sed -i "s/PORT_HTTP=80/PORT_HTTP=8080/" /opt/karvaan/.env
cd /opt/karvaan && docker compose up -d

# 3. Configure Caddy (Replace pos.yourdomain.com with your domain)
cat << 'EOF' > /etc/caddy/Caddyfile
pos.yourdomain.com {
    reverse_proxy localhost:8080
}
EOF

# 4. Restart Caddy to obtain SSL
systemctl restart caddy
```
Your POS is now live with full A+ HTTPS security at `https://pos.yourdomain.com`!

---

## 5. Onboarding Your 3 Restaurants

1. Navigate to: `https://pos.yourdomain.com/super-admin`
2. Log in with the credentials printed by the deploy script (or in `/opt/karvaan/.env`).
3. Click **"+ Add Restaurant"** for each of your 3 restaurants:
   - **Restaurant 1:** e.g., *Downtown Cafe*
   - **Restaurant 2:** e.g., *Mall Food Court Outlet*
   - **Restaurant 3:** e.g., *Express Takeaway*
4. Create an **Owner** and assign the restaurants, or create individual **Restaurant Admin** accounts for the managers of each outlet.
5. Each restaurant is completely isolated with its own:
   - Menu categories & items
   - Dine-in tables / takeaway counters
   - KDS kitchen screens & customer token queue screens
   - Staff roles (Cashiers, Waiters, Managers)
   - Daily sales history, GST reports, and inventory

---

## 6. How Waiters, Cashiers & Managers Connect

- **Direct Web Access:**
  Staff can open `https://pos.yourdomain.com` in Chrome, Safari, or Edge on any device (iPad, Android tablet, Windows PC, or mobile). The app automatically connects to the cloud backend.
- **Offline-First Desktop App (Optional):**
  If an outlet has unstable internet, install the Windows/Android app locally. In the local app's **Admin Settings > Cloud Sync**, enter:
  - **VPS URL:** `https://pos.yourdomain.com`
  - **Sync API Key:** The key configured in `.env` for that restaurant.
  The local outlet bills offline 100% of the time and background-syncs all sales to the cloud every minute.

---

## 7. Daily Operations & Maintenance

### Creating a Database Backup
Run the backup script anytime to snapshot the SQLite database and all uploaded media:
```bash
cd /opt/karvaan
./scripts/backup-cloud.sh
```
Backups are saved to `/opt/karvaan/backups/karvaan_cloud_backup_<TIMESTAMP>.tar.gz`.

### Updating to the Latest Code
When you push code updates:
```bash
cd /opt/karvaan
git pull
docker compose up -d --build
```
The persistent volume `karvaan_data` retains all database records, menus, and bills across updates.

### Viewing Container Logs
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

### Menu Image Uploads

Menu category and item photos work without Cloudinary. Local uploads are stored in
`/app/data/uploads` on the persistent `karvaan_data` volume and served at `/uploads/`.
If `CLOUDINARY_URL` is configured, menu photos use Cloudinary with local storage as
a fallback.

After applying an upload fix, rebuild **both** containers so the frontend proxy and
image handling are updated:

```bash
cd /opt/karvaan
git pull
docker compose up -d --build backend frontend
```

Refresh the POS app after the rebuild. An HTTP 404 or 405 from `/upload?type=menu`
usually means the proxy did not forward the request to the backend. The proxy must
match both `/upload` and `/upload/`; `/uploads/` must also reach the backend for image
previews. An HTTP 413 means the image exceeded the proxy's 50 MB limit.
