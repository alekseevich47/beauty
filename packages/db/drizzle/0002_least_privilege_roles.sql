-- Least-privilege runtime roles. Passwords are set out of band by ops on data-vm:
--   ALTER ROLE beauty_api_miniapp WITH PASSWORD '...';
-- Only the migration role owns DDL; the runtime roles get DML on existing tables.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'beauty_api_miniapp') THEN
    CREATE ROLE beauty_api_miniapp LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'beauty_api_internal') THEN
    CREATE ROLE beauty_api_internal LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'beauty_worker') THEN
    CREATE ROLE beauty_worker LOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO beauty_api_miniapp, beauty_api_internal, beauty_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO beauty_api_miniapp, beauty_api_internal, beauty_worker;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO beauty_api_miniapp, beauty_api_internal, beauty_worker;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
  TO beauty_api_miniapp, beauty_api_internal, beauty_worker;
