#!/usr/bin/env bash
set -euo pipefail

# `--latest-age` prints the age in seconds of the newest local backup and exits.
# The deploy-data workflow uses it as a gate so stateful changes never run without
# a recent dump to fall back on.
if [[ "${1:-}" == "--latest-age" ]]; then
  BACKUP_DIR="${BACKUP_DIR:-/backups}"
  NEWEST="$(find "${BACKUP_DIR}" -type f -name 'beauty-*.sql.gz' -printf '%T@\n' 2>/dev/null \
    | sort -nr | head -n1)"
  if [[ -z "${NEWEST}" ]]; then
    echo 999999999
    exit 0
  fi
  NOW="$(date -u +%s)"
  printf '%.0f\n' "$(echo "${NOW} - ${NEWEST}" | bc 2>/dev/null || awk "BEGIN{print ${NOW}-${NEWEST}}")"
  exit 0
fi

: "${POSTGRES_HOST:?}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:?}"
: "${POSTGRES_USER:?}"
: "${POSTGRES_PASSWORD:?}"
: "${S3_ENDPOINT:?}"
: "${S3_BUCKET:?}"
: "${S3_ACCESS_KEY:?}"
: "${S3_SECRET_KEY:?}"
: "${S3_REGION:=ru-central1}"
: "${BACKUP_RETENTION_DAYS:=14}"

export PGPASSWORD="${POSTGRES_PASSWORD}"
export AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY}"
export AWS_SECRET_ACCESS_KEY="${S3_SECRET_KEY}"
export AWS_DEFAULT_REGION="${S3_REGION}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="beauty-${POSTGRES_DB}-${STAMP}.sql.gz"
LOCAL_PATH="/backups/${FILE}"

echo "[backup] dumping ${POSTGRES_DB}@${POSTGRES_HOST} → ${LOCAL_PATH}"
pg_dump \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip -9 > "${LOCAL_PATH}"

echo "[backup] uploading to s3://${S3_BUCKET}/postgres/${FILE}"
aws --endpoint-url "${S3_ENDPOINT}" s3 cp "${LOCAL_PATH}" "s3://${S3_BUCKET}/postgres/${FILE}"

echo "[backup] pruning local files older than ${BACKUP_RETENTION_DAYS}d"
find /backups -type f -name 'beauty-*.sql.gz' -mtime "+${BACKUP_RETENTION_DAYS}" -delete || true

echo "[backup] pruning remote objects older than ${BACKUP_RETENTION_DAYS}d"
CUTOFF="$(date -u -d "-${BACKUP_RETENTION_DAYS} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-"${BACKUP_RETENTION_DAYS}"d +%Y-%m-%dT%H:%M:%SZ)"
aws --endpoint-url "${S3_ENDPOINT}" s3 ls "s3://${S3_BUCKET}/postgres/" \
  | awk '{print $1"T"$2"Z",$4}' \
  | while read -r ts key; do
      if [[ "${ts}" < "${CUTOFF}" && -n "${key}" ]]; then
        aws --endpoint-url "${S3_ENDPOINT}" s3 rm "s3://${S3_BUCKET}/postgres/${key}" || true
      fi
    done

echo "[backup] done ${FILE}"
