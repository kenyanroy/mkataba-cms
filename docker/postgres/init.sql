-- Mkataba PostgreSQL initialization
-- Runs once on first container start

-- Enable pgcrypto for gen_random_uuid() and column-level encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For full-text search on contract bodies

-- Audit log table is insert-only.
-- We enforce this at DB level by revoking UPDATE/DELETE from the app role.
-- The app connects as: mkataba_app (read/write on all tables except audit_logs update/delete)
-- Migrations run as: mkataba (owner role)

-- App user with restricted audit log permissions (optional — set up after Prisma migrate)
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mkataba_app') THEN
--     CREATE ROLE mkataba_app LOGIN PASSWORD 'app_password';
--   END IF;
-- END $$;
-- GRANT CONNECT ON DATABASE mkataba TO mkataba_app;
-- GRANT USAGE ON SCHEMA public TO mkataba_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mkataba_app;
-- REVOKE UPDATE, DELETE ON audit_logs FROM mkataba_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mkataba_app;
