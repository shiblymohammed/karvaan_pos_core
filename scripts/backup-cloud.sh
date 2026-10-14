#!/bin/bash
# =================================================================
# Karvaan POS - Cloud Database & Uploads Backup Utility
# =================================================================

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/karvaan_cloud_backup_${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "💾 Creating backup of Karvaan POS database and uploads..."

# Copy data directly from the running container to ensure consistency
docker exec karvaan-backend sqlite3 /app/data/karvaan.db ".backup '/app/data/backup_temp.db'" 2>/dev/null || true

# Archive data directory
docker run --rm \
  --volumes-from karvaan-backend \
  -v "$(pwd)/${BACKUP_DIR}:/backup_dest" \
  alpine tar -czf "/backup_dest/karvaan_cloud_backup_${TIMESTAMP}.tar.gz" -C /app/data .

# Remove temp backup inside container
docker exec karvaan-backend rm -f /app/data/backup_temp.db 2>/dev/null || true

echo "✅ Backup successfully created at: ${BACKUP_FILE}"
ls -lh "${BACKUP_FILE}"
