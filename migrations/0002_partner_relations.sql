-- Additive partner-relations persistence for the active partnership workflow.
-- Active statuses found in the client and routes: pending, approved, rejected.
-- Only one pending or approved relationship may exist for an unordered user pair.
-- Rejected relationships remain as history and do not prevent a later request.

CREATE TABLE IF NOT EXISTS "partner_relations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "requester_id" varchar NOT NULL REFERENCES "users" ("id"),
  "partner_id" varchar NOT NULL REFERENCES "users" ("id"),
  "status" varchar NOT NULL DEFAULT 'pending',
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "partner_relations_no_self"
    CHECK ("requester_id" <> "partner_id"),
  CONSTRAINT "partner_relations_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS "partner_relations_requester_idx"
  ON "partner_relations" ("requester_id");

CREATE INDEX IF NOT EXISTS "partner_relations_partner_idx"
  ON "partner_relations" ("partner_id");

CREATE UNIQUE INDEX IF NOT EXISTS "partner_relations_active_pair_unique"
  ON "partner_relations" (
    LEAST("requester_id", "partner_id"),
    GREATEST("requester_id", "partner_id")
  )
  WHERE "status" IN ('pending', 'approved');
