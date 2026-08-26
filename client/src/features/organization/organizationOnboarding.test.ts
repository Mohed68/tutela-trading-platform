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
