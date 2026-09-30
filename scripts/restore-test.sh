#!/bin/sh
set -eu
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL é obrigatória e deve apontar para banco descartável}"
: "${BACKUP_FILE:?BACKUP_FILE é obrigatório}"
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" "$BACKUP_FILE"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) AS migrations FROM "_prisma_migrations";'
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) AS tenants FROM "Barbershop";'
