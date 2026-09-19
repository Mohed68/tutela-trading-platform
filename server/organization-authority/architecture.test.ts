import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(path:string)=>readFileSync(path,"utf8");
test("Delta A migration is additive, history preserving, and seeds no manufactured authority",()=>{
  const sql=read("migrations/0026_delta_a_organization_authority.sql");
  assert.doesNotMatch(sql,/\b(?:DROP TABLE|TRUNCATE|DELETE FROM|UPDATE public\.organization_memberships|INSERT INTO public\.platform_terms_versions|INSERT INTO public\.commercial_fee_schedules|status\s*[,)]\s*VALUES[^;]*'ACTIVE')\b/i);
  assert.match(sql,/organization_signing_mandates/);assert.match(sql,/organization_signing_policies/);assert.match(sql,/external_integrity_anchors/);
  assert.match(sql,/ADD COLUMN platform_terms_version_id/);assert.match(sql,/ADD COLUMN fee_schedule_id/);
  assert.match(sql,/confirmation_status <> 'CONFIRMED'/);assert.match(sql,/status <> 'ACTIVE' OR approved_authority_reference IS NOT NULL/);
});
test("tenant mutations require membership authority and sensitive grants require recent step-up",()=>{
  const service=read("server/organization-authority/service.ts"),routes=read("server/organization-authority/routes.ts");
  assert.match(service,/hasCapability\(pool, organizationId, userId, "MANAGE_MEMBERS"\)/);
  assert.match(service,/hasCapability\(pool, organizationId, userId, "GRANT_SIGNING_MANDATE"\)/);
  assert.match(service,/MANAGE_SIGNING_POLICY.*GRANT_SIGNING_MANDATE.*owner/s);
  assert.match(routes,/hasRecentStepUp/);assert.match(routes,/Recent MFA verification is required/);
  assert.match(service,/WHERE organization_id=\$1 AND user_id=\$2/);
});
test("routing and signing remain server authoritative and joint policy fails closed",()=>{
  const service=read("server/mvp-closure/service.ts"),client=read("client/src/pages/action-center.tsx");
  assert.match(service,/signingAuthorityFor/);assert.match(service,/signing_policy_unsatisfied/);assert.match(service,/fails closed.*multi-slot ledger/s);
  assert.match(service,/stale_snapshot/);assert.match(service,/stale_contract_version/);assert.match(service,/recentStepUp/);
  assert.match(client,/Tasks never grant authority|work-queue projections/);
});
test("AI candidates cannot create organization, signing, legal, fee or anchor authority",()=>{
  const routes=read("server/organization-authority/routes.ts"),service=read("server/organization-authority/service.ts");
  assert.doesNotMatch(routes,/openai|aiValidation|recommendation/i);assert.doesNotMatch(service,/openai|aiValidation|recommendation/i);
  assert.doesNotMatch(routes,/fee-entitlement|integrity-anchor|platform-terms.*post/i);
});
