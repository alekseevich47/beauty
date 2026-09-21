-- Runtime roles are created by migration 0002_least_privilege_roles.sql so that
-- their grants stay versioned with the schema. Passwords are never baked into an
-- image or a repo file — ops sets them once on data-vm:
--
--   ALTER ROLE beauty_api_miniapp WITH PASSWORD '<from secret store>';
--   ALTER ROLE beauty_api_internal WITH PASSWORD '<from secret store>';
--   ALTER ROLE beauty_worker       WITH PASSWORD '<from secret store>';
--
-- The migration role is the POSTGRES_USER superuser from .env.data
-- (`beauty_admin`) and is used only by the migrate workflow.
--
-- A read-only role for ad-hoc inspection, with no password until ops sets one.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'beauty_readonly') THEN
    CREATE ROLE beauty_readonly LOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO beauty_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO beauty_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO beauty_readonly;
