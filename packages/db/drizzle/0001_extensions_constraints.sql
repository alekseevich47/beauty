-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- Geography column + GiST index for "masters nearby"
ALTER TABLE masters ADD COLUMN IF NOT EXISTS location geography(Point, 4326);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS masters_location_gix ON masters USING GIST (location);
--> statement-breakpoint

-- Full-text search on services
ALTER TABLE services ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS services_search_gin ON services USING GIN (search_tsv);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS services_title_trgm ON services USING GIN (title gin_trgm_ops);
--> statement-breakpoint

-- Double-booking prevention: overlapping active appointments are impossible at the
-- storage layer, so a race between two concurrent bookings cannot both succeed.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS during tstzrange
  GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED;
--> statement-breakpoint
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_no_overlap;
--> statement-breakpoint
ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (master_id WITH =, during WITH &&)
  WHERE (status IN ('pending', 'confirmed'));
--> statement-breakpoint

-- pgvector embeddings
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS embedding vector(1536);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS embeddings_ivfflat
  ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
--> statement-breakpoint

-- Revenue aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_master_revenue_day AS
SELECT
  master_id,
  date_trunc('day', completed_at AT TIME ZONE 'UTC') AS period_start,
  SUM(price_amount)::bigint AS total_amount,
  COUNT(*)::bigint AS appointment_count
FROM appointments
WHERE status = 'completed' AND completed_at IS NOT NULL
GROUP BY 1, 2;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS mv_master_revenue_day_uidx
  ON mv_master_revenue_day (master_id, period_start);
--> statement-breakpoint

-- Master of the week candidates
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_master_of_week AS
SELECT
  m.id AS master_id,
  m.city_id,
  s.category_id,
  COUNT(a.id)::bigint AS completed_count,
  AVG(m.rating_avg::float8) AS rating_avg
FROM masters m
JOIN services s ON s.master_id = m.id
LEFT JOIN appointments a
  ON a.master_id = m.id
  AND a.status = 'completed'
  AND a.completed_at >= (now() - interval '7 days')
WHERE m.is_active = true
GROUP BY m.id, m.city_id, s.category_id;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS mv_master_of_week_idx
  ON mv_master_of_week (city_id, category_id, completed_count DESC);
