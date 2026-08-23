import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const prerequisite = readFileSync(
  new URL("../../migrations/0010a_staging_baseline_prerequisites.sql", import.meta.url),
  "utf8",
);
const migration0011 = readFileSync(
  new URL("../../migrations/0011_self_service_registration.sql", import.meta.url),
  "utf8",
);
const migration0014 = readFileSync(
  new URL("../../migrations/0014_order_contract_authority.sql", import.meta.url),
  "utf8",
);

test("staging prerequisite is additive and never rewrites legacy rows", () => {
  assert.doesNotMatch(
    prerequisite,
    /\b(?:DELETE|TRUNCATE|DROP\s+(?:TABLE|COLUMN)|UPDATE|INSERT)\b/i,
  );
  assert.match(prerequisite, /ADD COLUMN IF NOT EXISTS kyb_status varchar/i);
  assert.match(prerequisite, /CREATE TABLE IF NOT EXISTS public\.orders/i);
  assert.doesNotMatch(prerequisite, /ADD COLUMN[^;]+DEFAULT/gi);
});

test("legacy authority values are not inferred by the prerequisite", () => {
  for (const authorityColumn of [
    "verified",
    "seller_org_verified",
    "delegate_is_authorized",
    "moderation_status",
  ]) {
    assert.match(
      prerequisite,
      new RegExp(`ADD COLUMN IF NOT EXISTS ${authorityColumn} [^;]+;`, "i"),
    );
    assert.match(
      prerequisite,
      new RegExp(`ALTER COLUMN ${authorityColumn} SET DEFAULT`, "i"),
    );
  }
  assert.doesNotMatch(prerequisite, /ALTER COLUMN verified SET NOT NULL/i);
  assert.doesNotMatch(prerequisite, /ALTER COLUMN seller_org_verified SET NOT NULL/i);
});

test("prerequisite supplies exactly the baseline objects consumed by 0011 and 0014", () => {
  assert.match(migration0011, /REFERENCES public\.users \(id\)/i);
  assert.match(prerequisite, /CREATE TABLE IF NOT EXISTS public\.orders/i);
  assert.match(prerequisite, /contract_id varchar NOT NULL REFERENCES public\.contracts/i);
  assert.match(prerequisite, /price_per_unit numeric\(15, 2\)/i);
  assert.match(prerequisite, /total_amount numeric\(15, 2\)/i);
  assert.match(
    prerequisite,
    /ALTER TABLE public\.contracts ALTER COLUMN total_price DROP NOT NULL/i,
  );
  assert.match(migration0014, /ALTER TABLE public\.orders ALTER COLUMN contract_id DROP NOT NULL/i);
  assert.match(migration0014, /ALTER TABLE public\.orders ADD COLUMN offer_id/i);
  assert.match(migration0014, /ALTER TABLE public\.contracts ADD COLUMN order_id/i);
  assert.doesNotMatch(prerequisite, /publication_eligibility_fingerprint/i);
  assert.doesNotMatch(prerequisite, /buyer_participation_eligibility_fingerprint/i);
  assert.doesNotMatch(prerequisite, /contract_fingerprint/i);
});

test("migration filename orders the prerequisite between 0010 and 0011", () => {
  assert.ok("0010_verification_immutability.sql" < "0010a_staging_baseline_prerequisites.sql");
  assert.ok("0010a_staging_baseline_prerequisites.sql" < "0011_self_service_registration.sql");
});
