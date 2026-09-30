#!/bin/sh
set -eu
: "${DATABASE_URL:?DATABASE_URL é obrigatória}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
TARGET="$BACKUP_DIR/navalha-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-acl --file="$TARGET" "$DATABASE_URL"
find "$BACKUP_DIR" -type f -name 'navalha-*.dump' -mtime +"${BACKUP_RETENTION_DAYS:-30}" -delete
echo "$TARGET"
