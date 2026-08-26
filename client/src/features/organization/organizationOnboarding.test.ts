import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CurrentOrganizationContextDto } from "@shared/organizationOnboarding";
import {
  organizationVerificationLabel,
  shouldRequireOrganizationSetup,
} from "./organizationOnboarding.js";

const setupRequired: CurrentOrganizationContextDto = Object.freeze({
  state: "setup_required",
  organization: null,
});

function organization(
  phase: "not_started" | "in_progress" | "completed" | "unavailable",
  canonicalTrustStatus: string | null,
): CurrentOrganizationContextDto {
  return Object.freeze({
    state: "available" as const,
    organization: Object.freeze({
      organizationId: "organization-1",
      profileRevisionId: "profile-1",
      displayName: "Acme Commodities",
      jurisdiction: "SA",
      registrationIdentifiers: Object.freeze([
        Object.freeze({ scheme: "company_registration_number", value: "123" }),
      ]),
      lifecycle: "active",
      membership: Object.freeze({
        membershipId: "membership-1",
        role: "owner" as const,
        status: "active" as const,
      }),
      verification: Object.freeze({ phase, canonicalTrustStatus }),
    }),
  });
}

test("an authenticated production user without an Organization requires setup", () => {
  assert.equal(
    shouldRequireOrganizationSetup({
      authenticated: true,
      demoMode: false,
      context: setupRequired,
    }),
    true,
  );
  assert.equal(
    shouldRequireOrganizationSetup({
      authenticated: true,
      demoMode: true,
      context: setupRequired,
    }),
    false,
  );
  assert.equal(
    shouldRequireOrganizationSetup({
      authenticated: false,
      demoMode: false,
      context: setupRequired,
    }),
    false,
  );
});

test("Organization verification copy comes only from canonical phase and Trust", () => {
  assert.equal(
    organizationVerificationLabel(organization("not_started", null)),
    "Verification not started",
  );
  assert.equal(
    organizationVerificationLabel(organization("in_progress", null)),
    "Verification in progress",
  );
  assert.equal(
    organizationVerificationLabel(organization("completed", "trusted")),
    "Verified",
  );
  assert.equal(
    organizationVerificationLabel(
      organization("completed", "unestablished"),
    ),
    "Verification review required",
  );
  assert.equal(
    organizationVerificationLabel(organization("completed", null)),
    "Verification status unavailable",
  );
});

test("header keeps personal identity separate from Organization context", () => {
  const source = readFileSync(
    new URL("../../components/navigation/AppHeader.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /authenticatedIdentityPresentation\(user\)/);
  assert.match(source, /organization\.displayName/);
  assert.match(source, /organization\.membership\.role/);
  assert.match(source, /organizationVerificationLabel\(organizationContext\)/);
  assert.doesNotMatch(source, /identity\s*=\s*organization/);
});

test("setup posts the complete existing Registry contract surface", () => {
  const source = readFileSync(
    new URL("../../pages/organization-setup.tsx", import.meta.url),
    "utf8",
  );
  for (const field of [
    "legalName",
    "organizationType",
    "jurisdiction",
    "registrationIdentifiers",
    "declaredActivities",
  ]) {
    assert.match(source, new RegExp(field));
  }
  assert.match(source, /POST", "\/api\/organizations"/);
  assert.doesNotMatch(
    source,
    /createOrganizationVerificationDecision|deriveOrganizationVerificationTrustStatus|eligibilityFingerprint/,
  );
});

test("verification route delegates Evidence and execution to canonical production endpoints", () => {
  const source = readFileSync(
    new URL("../../pages/verification.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /\/api\/organizations\/\$\{encodeURIComponent\(organization\.organizationId\)\}\/profile-revisions\/\$\{encodeURIComponent\(organization\.profileRevisionId\)\}\/evidence/,
  );
  assert.match(
    source,
    /\/api\/organizations\/\$\{encodeURIComponent\(organization\.organizationId\)\}\/profile-revisions\/\$\{encodeURIComponent\(organization\.profileRevisionId\)\}\/verification/,
  );
  assert.match(source, /result\.replayFingerprint/);
  assert.match(source, /queryKey: \["\/api\/organizations\/current"\]/);
  assert.doesNotMatch(
    source,
    /\/api\/verification\/documents|\/api\/verification\/pending|KybWizard|useKybStatus/,
  );
});

test("verification UI cannot manufacture Trust or bypass owner authority", () => {
  const page = readFileSync(
    new URL("../../pages/verification.tsx", import.meta.url),
    "utf8",
  );
  const service = readFileSync(
    new URL(
      "../../../../server/trade-trust-application/applicationService.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /organization\?\.membership\.role === "owner"/);
  assert.match(page, /Organization setup required/);
  assert.match(page, /isDemo\(\)/);
  assert.doesNotMatch(
    page,
    /users\.verified|kybStatus|createOrganizationVerificationDecision|deriveOrganizationVerificationTrustStatus/,
  );
  assert.match(service, /executeProductionOrganizationVerification/);
  assert.match(service, /execution\.replayExecution\.replayFingerprint/);
  assert.match(service, /repository\.isActiveOwner/);
});

test("verification page presents Registry identity and Replay-derived canonical status", () => {
  const page = readFileSync(
    new URL("../../pages/verification.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /organization\.displayName/);
  assert.match(page, /organization\.jurisdiction/);
  assert.match(page, /organization\?\.registrationIdentifiers\[0\]/);
  assert.match(page, /organizationVerificationLabel\(context\)/);
  assert.match(page, /Verification and eligibility are separate/);
});
