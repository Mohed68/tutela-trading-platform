import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function source(relativePath: string): string {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

const membershipFiles = [
  "server/organization-membership/membership.ts",
  "server/organization-membership/ports.ts",
  "server/organization-membership/index.ts",
];
const eligibilityFiles = [
  "server/organization-participation-eligibility/eligibilityContracts.ts",
  "server/organization-participation-eligibility/eligibilityPorts.ts",
  "server/organization-participation-eligibility/eligibilityService.ts",
  "server/organization-participation-eligibility/index.ts",
];

test("Eligibility has no infrastructure, database, route, or provider dependency", () => {
  for (const file of eligibilityFiles) {
    const content = source(file);
    assert.doesNotMatch(content, /\/infrastructure\//);
    assert.doesNotMatch(content, /(?:from|import\()\s*["'][^"']*(?:db|storage|routes|provider)/i);
    assert.doesNotMatch(content, /\b(?:pg|drizzle|sql|fetch)\b/i);
    assert.doesNotMatch(content, /process\.env|DATABASE_URL/);
  }
});

test("Eligibility consumes Replay authority and never executes Verification Runtime", () => {
  const service = source(
    "server/organization-participation-eligibility/eligibilityService.ts",
  );
  assert.match(service, /isOrganizationVerificationReplayExecution/);
  assert.doesNotMatch(service, /workflow-runtime|executeOrganizationVerification|executeOneWorkflowStep/);
  assert.doesNotMatch(service, /deriveOrganizationVerificationTrustStatus/);
  assert.doesNotMatch(service, /domain\/trust-status/);
});

test("Membership does not own Organization Verification or Trust", () => {
  for (const file of membershipFiles) {
    const content = source(file);
    assert.doesNotMatch(content, /organization-verification|trust-status|eligibility/i);
  }
});

test("Eligibility remains distinct from Trust and owns its own vocabulary", () => {
  const contracts = source(
    "server/organization-participation-eligibility/eligibilityContracts.ts",
  );
  assert.match(contracts, /"eligible"/);
  assert.match(contracts, /"ineligible"/);
  assert.match(contracts, /organization_not_trusted/);
  assert.doesNotMatch(contracts, /trusted\s*=\s*eligible|eligible\s*=\s*trusted/);
});

test("legacy User KYB and verification flags cannot influence Eligibility", () => {
  for (const file of eligibilityFiles) {
    const content = source(file);
    assert.doesNotMatch(
      content,
      /kyb|users\.verified|sellerOrgVerified|verificationLevel|businessRegistrationStatus/i,
    );
  }
});

test("Eligibility has no mutable persistence authority or hidden nondeterminism", () => {
  for (const file of eligibilityFiles) {
    const content = source(file);
    assert.doesNotMatch(content, /\b(?:insert|delete|persist|save)\s*\(/i);
    assert.doesNotMatch(content, /Date\.now\(|new Date\(|Math\.random\(|randomUUID\(/);
  }
});

test("controllers do not manufacture or consume Eligibility before Phase 8F.0B", () => {
  const routes = source("server/routes.ts");
  const draftRoutes = source("server/drafts/routes.ts");
  assert.doesNotMatch(routes, /organization-participation-eligibility/);
  assert.doesNotMatch(draftRoutes, /organization-participation-eligibility/);
});

test("public exports expose no Eligibility result constructor or internal Trust mapper", () => {
  const publicIndex = source(
    "server/organization-participation-eligibility/index.ts",
  );
  assert.doesNotMatch(
    publicIndex,
    /createOrganizationParticipationEligibilityResultInternal/,
  );
  assert.doesNotMatch(publicIndex, /participationReasonForTrustStatusInternal/);
});

test("offer, order, contract, registration, and deployment files remain outside this capability", () => {
  for (const file of eligibilityFiles) {
    const content = source(file);
    assert.doesNotMatch(
      content,
      /(?:\.\.\/)+(?:offers?|orders?|contracts?|registration|render)(?:\/|["'])/i,
    );
  }
});
