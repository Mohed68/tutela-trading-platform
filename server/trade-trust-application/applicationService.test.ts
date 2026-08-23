import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMinimumTradeTrustOrganizationPolicyBundle } from "../trade-trust-policy/organizationVerificationPolicy.js";

const root=resolve(import.meta.dirname,"../..");
const source=(path:string)=>readFileSync(resolve(root,path),"utf8");

test("production policy exposes real conditional PASS and configured FAIL outcomes",()=>{
  const bundle=createMinimumTradeTrustOrganizationPolicyBundle();
  assert.equal(bundle.rules.every(rule=>rule.evaluationDisposition!=="satisfied"),true);
  assert.equal(bundle.implementationSet.bindings.every(binding=>typeof binding.implementation.evaluate==="function"),true);
  assert.equal(JSON.stringify(bundle).includes("synthetic"),false);
});

test("Organization registration is atomic and the one-Organization rule is launch policy only",()=>{
  const repository=source("server/trade-trust-application/postgresRepository.ts");
  const migration=source("migrations/0016_production_trust_runtime.sql");
  assert.match(repository,/BEGIN[\s\S]*organization_registry_profile_revisions[\s\S]*organization_memberships[\s\S]*COMMIT/);
  assert.match(repository,/role='owner' AND status='active'/);
  assert.doesNotMatch(migration,/UNIQUE\s*\(\s*user_id\s*\)/i);
});

test("owner Membership authorizes commands but manufactures no Trust or Eligibility",()=>{
  const service=source("server/trade-trust-application/applicationService.ts");
  assert.match(service,/isActiveOwner/);
  assert.match(service,/executeProductionOrganizationVerification/);
  assert.doesNotMatch(service,/createOrganizationVerificationDecision\s*\(/);
  assert.doesNotMatch(service,/deriveOrganizationVerificationTrustStatus\s*\(/);
  assert.doesNotMatch(service,/createOrganizationParticipationEligibilityResult/);
});

test("Verification uses Application Service and authoritative Replay",()=>{
  const runtime=source("server/trade-trust-application/organizationVerificationOrchestrator.ts");
  assert.match(runtime,/createOrganizationVerificationApplicationService/);
  assert.match(runtime,/replayOrganizationVerificationWorkflow/);
  assert.match(runtime,/replayExecution\.reconstructedWorkflowExecution/);
  assert.doesNotMatch(runtime,/\.implementation\.evaluate\s*\(/);
  assert.match(runtime,/requestedStep:"complete_policy"/);
  assert.doesNotMatch(runtime,/workflowRuntime\.test|buildRuntimeFixture|synthetic/i);
});

test("platform Evidence and Offer binding are immutable and legacy flags cannot bypass",()=>{
  const migration=source("migrations/0016_production_trust_runtime.sql");
  const eligibility=source("server/verification/eligibilityReadRepository.ts");
  const app=source("server/trade-trust-application/applicationService.ts");
  assert.match(migration,/reject_platform_submitted_evidence_mutation/);
  assert.match(migration,/offer_verification_evidence_bindings/);
  assert.match(eligibility,/persisted_evidence_fingerprint/);
  assert.doesNotMatch(app,/users\.verified|kyb_status|verification_level/i);
});

test("controllers translate requests and delegate authority",()=>{
  const routes=source("server/trade-trust-application/routes.ts");
  assert.match(routes,/service\.createOrganization/);
  assert.match(routes,/service\.initiateOrganizationVerification/);
  assert.match(routes,/service\.evaluateTradeParticipation/);
  assert.doesNotMatch(routes,/createOrganizationVerificationDecision|deriveOrganizationVerificationTrustStatus|createOrganizationParticipationEligibilityResult/);
});
