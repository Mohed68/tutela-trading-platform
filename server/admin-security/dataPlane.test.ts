import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { toAdminCompanySummary, toAdminOfferSummary, toSecurityAuditSummary } from "./index.js";

test("Admin company DTO allow-list excludes authentication and MFA material", () => {
  const dto = toAdminCompanySummary({ id: "u1", email: "user@example.invalid", passwordHash: "secret", adminRole: "admin", is2FAEnabled: true, authProvider: "local", encryptedSecret: "cipher" });
  assert.deepEqual(Object.keys(dto).sort(), ["accountRole","companyName","createdAt","displayName","email","id","kybStatus","verificationLevel"].sort());
  for (const forbidden of ["passwordHash","adminRole","is2FAEnabled","authProvider","encryptedSecret"]) assert.equal(forbidden in dto, false);
});

test("Admin Offer DTO never serializes joined raw user data", () => {
  const dto = toAdminOfferSummary({ id: "o1", sellerId: "u1", user: { passwordHash: "secret" }, seller: { email: "private@example.invalid" } });
  assert.equal("user" in dto, false); assert.equal("seller" in dto, false);
});

test("Security Audit DTO is an explicit metadata allow-list", () => {
  const dto = toSecurityAuditSummary({ id: "a1", action: "view", beforeValue: { secret: true }, ipAddress: "private", userAgent: "private" });
  assert.equal("beforeValue" in dto, false); assert.equal("ipAddress" in dto, false); assert.equal("userAgent" in dto, false);
});

test("legacy privileged mutations are retained only as fail-closed unavailable handlers", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  assert.match(routes, /Legacy direct KYB decisions are retired/);
  assert.match(routes, /Legacy moderation mutation is unavailable/);
  assert.match(routes, /Legacy account mutation is unavailable/);
});

test("migration is additive and does not bootstrap authority", () => {
  const migration = readFileSync("migrations/0019_platform_authority_security_audit.sql", "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.platform_principals/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.security_audit_events/);
  assert.doesNotMatch(migration, /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE)\b/im);
  assert.doesNotMatch(migration, /INSERT INTO public\.platform_principals|INSERT INTO public\.platform_role_assignments/);
});
