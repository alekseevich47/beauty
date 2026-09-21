-- Beauty+ Postgres bootstrap (runs once on an empty data dir).
-- Versioned migrations in packages/db/drizzle own the schema; this file only makes
-- sure the extensions the first migration depends on are installable.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Provided by infra/docker/postgres.Dockerfile (postgresql-17-pgvector)
CREATE EXTENSION IF NOT EXISTS vector;
