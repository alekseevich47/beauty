#!/usr/bin/env bash
set -euo pipefail

# Usage: restore.sh s3://bucket/postgres/beauty-....sql.gz
# Or:    restore.sh /backups/beauty-....sql.gz

SRC="${1:?path or s3 uri required}"

: "${POSTGRES_HOST:?}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:?}"
: "${POSTGRES_USER:?}"
: "${POSTGRES_PASSWORD:?}"

export PGPASSWORD="${POSTGRES_PASSWORD}"

TMP="/tmp/restore.sql.gz"

if [[ "${SRC}" == s3://* ]]; then
  : "${S3_ENDPOINT:?}"
  : "${S3_ACCESS_KEY:?}"
  : "${S3_SECRET_KEY:?}"
  : "${S3_REGION:=ru-central1}"
  export AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY}"
  export AWS_SECRET_ACCESS_KEY="${S3_SECRET_KEY}"
  export AWS_DEFAULT_REGION="${S3_REGION}"
  aws --endpoint-url "${S3_ENDPOINT}" s3 cp "${SRC}" "${TMP}"
else
  cp "${SRC}" "${TMP}"
fi

echo "[restore] applying ${SRC} → ${POSTGRES_DB}@${POSTGRES_HOST}"
gunzip -c "${TMP}" | psql \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --set ON_ERROR_STOP=1

rm -f "${TMP}"
echo "[restore] done"
