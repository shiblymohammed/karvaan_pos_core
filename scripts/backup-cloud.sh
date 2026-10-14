#!/bin/bash
# Consistent SQLite snapshot plus uploaded media; never archive a live WAL database.
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/karvaan_cloud_backup_${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"
if [ -e "$BACKUP_FILE" ] || [ -e "$BACKUP_FILE.part" ]; then
    echo "Backup filename already exists; retry in a second." >&2
    exit 1
fi

STAGING_DIR=$(docker exec karvaan-backend mktemp -d /tmp/karvaan-backup.XXXXXX)
# Verify the cleanup target before allowing a recursive remove in the container.
case "$STAGING_DIR" in
    /tmp/karvaan-backup.[A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9]) ;;
    *) echo "Unexpected backup staging directory" >&2; exit 1 ;;
esac
cleanup() {
    docker exec karvaan-backend rm -rf -- "$STAGING_DIR" || true
    rm -f -- "$BACKUP_FILE.part"
}
trap cleanup EXIT

echo "Creating a consistent database snapshot and copying uploads..."
docker exec karvaan-backend sqlite3 /app/data/karvaan.db ".backup '$STAGING_DIR/karvaan.db'"
CHECK=$(docker exec karvaan-backend sqlite3 "$STAGING_DIR/karvaan.db" 'PRAGMA quick_check;')
if [ "$CHECK" != "ok" ]; then
    echo "Database snapshot failed its integrity check: $CHECK" >&2
    exit 1
fi
docker exec karvaan-backend cp -a /app/data/uploads "$STAGING_DIR/uploads"
docker exec karvaan-backend tar -czf - -C "$STAGING_DIR" . > "$BACKUP_FILE.part"
tar -tzf "$BACKUP_FILE.part" > /dev/null
mv -- "$BACKUP_FILE.part" "$BACKUP_FILE"
echo "Backup created at: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"
