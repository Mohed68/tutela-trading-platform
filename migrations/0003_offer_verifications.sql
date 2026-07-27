-- Additive persistence for offer verification submissions.
-- Offer verification is distinct from user KYB document verification:
-- it is submitted for a specific offer and stores the offer-document manifest.
-- Active code currently creates only pending submissions. No review fields are
-- added because no active route or UI consumes them.

CREATE TABLE IF NOT EXISTS "offer_verifications" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "offer_id" varchar NOT NULL REFERENCES "offers" ("id"),
  "submitted_by" varchar NOT NULL REFERENCES "users" ("id"),
  "documents" text NOT NULL,
  "notes" text,
  "status" varchar NOT NULL DEFAULT 'pending',
  "submitted_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "offer_verifications_status_check"
    CHECK ("status" IN ('pending'))
);

CREATE INDEX IF NOT EXISTS "offer_verifications_offer_idx"
  ON "offer_verifications" ("offer_id");

CREATE INDEX IF NOT EXISTS "offer_verifications_submitter_idx"
  ON "offer_verifications" ("submitted_by");
