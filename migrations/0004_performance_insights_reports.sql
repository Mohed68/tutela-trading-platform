-- Additive persistence for AI-generated performance insights.
-- The JSON fields mirror the report shape produced by the existing service and
-- consumed by the active PerformanceInsights UI. No fallback report is seeded.

CREATE TABLE IF NOT EXISTS "performance_insights_reports" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users" ("id"),
  "summary" jsonb NOT NULL,
  "insights" jsonb NOT NULL,
  "recommendations" jsonb NOT NULL,
  "risk_factors" jsonb NOT NULL,
  "opportunities" jsonb NOT NULL,
  "generated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "performance_insights_user_generated_idx"
  ON "performance_insights_reports" ("user_id", "generated_at");
