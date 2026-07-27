-- TUTELA local authentication migration.
-- Safe to run repeatedly against an existing TUTELA database.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" varchar DEFAULT 'local';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;

-- Preserve legacy users while identifying accounts that still require a local password.
UPDATE "users"
SET "auth_provider" = 'legacy'
WHERE "password_hash" IS NULL
  AND ("auth_provider" IS NULL OR "auth_provider" = 'local');

CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" varchar PRIMARY KEY,
  "sess" jsonb NOT NULL,
  "expire" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");
