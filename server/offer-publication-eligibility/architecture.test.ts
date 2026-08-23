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

const gateFiles = [
  "server/offer-publication-eligibility/publicationEligibility.ts",
  "server/offer-publication-eligibility/ports.ts",
  "server/offer-publication-eligibility/index.ts",
];

test("Publication Eligibility is derived and owns no persistence or infrastructure", () => {
  for (const file of gateFiles) {
    const content = source(file);
    assert.doesNotMatch(content, /(?:from|import\()\s*["'][^"']*(?:db|storage|repository|infrastructure)/i);
    assert.doesNotMatch(content, /\b(?:INSERT|UPDATE|DELETE|SELECT)\b/);
    assert.doesNotMatch(content, /process\.env|Date\.now\(|new Date\(|Math\.random\(|randomUUID\(/);
  }
});

test("Publication Eligibility composes authorities without deriving Trust or verification rules", () => {
  const gate = source(
    "server/offer-publication-eligibility/publicationEligibility.ts",
  );
  assert.match(gate, /isOrganizationParticipationEligibilityResult/);
  assert.match(gate, /isAuthoritativeOfferVerificationEligibility/);
  assert.doesNotMatch(gate, /organization-verification|trust-status|deriveOrganizationVerificationTrustStatus/);
  assert.doesNotMatch(gate, /runTechnicalValidation|runCommercialValidation|decideVerification/);
});

test("legacy booleans are absent from the production publication path", () => {
  const activePath = [
    source("server/marketplace/publicMarketplace.ts"),
    source("server/filters/publicOffers.ts"),
    source("client/src/hooks/useVisibleOffers.ts"),
  ].join("\n");
  assert.doesNotMatch(activePath, /sellerOrgVerified|seller_org_verified/);
  assert.doesNotMatch(activePath, /offer\.verified|verified:\s*true/);
  assert.doesNotMatch(activePath, /status\s*===?\s*["']active["']/);
});

test("Marketplace consumes the authentic Publication Eligibility result", () => {
  const marketplace = source("server/marketplace/publicMarketplace.ts");
  assert.match(marketplace, /evaluateOfferPublicationEligibility/);
  assert.match(marketplace, /isOfferPublicationEligibilityResult/);
  assert.match(marketplace, /outcome\s*!==\s*"publishable"/);
  assert.doesNotMatch(marketplace, /offer_verification_attempts|offer_submission_revisions/);
});

test("controllers cannot manufacture Publication Eligibility", () => {
  for (const file of ["server/routes.ts", "server/drafts/routes.ts"]) {
    const routes = source(file);
    assert.doesNotMatch(routes, /offer-publication-eligibility/);
    assert.doesNotMatch(routes, /evaluateOfferPublicationEligibility/);
    assert.doesNotMatch(routes, /publicationEligibilityFingerprint/);
  }
});

test("Offer Verification read model remains independent from publication", () => {
  const verification = [
    source("server/verification/eligibilityReadModel.ts"),
    source("server/verification/eligibilityReadRepository.ts"),
  ].join("\n");
  assert.doesNotMatch(verification, /marketplace|publication/);
  assert.doesNotMatch(verification, /sellerOrgVerified|seller_org_verified/);
  assert.match(verification, /processState !== "completed"/);
  assert.match(verification, /decision === "approved"/);
});

test("Publication capability contains no Order, Contract, payment, or external compliance authority", () => {
  for (const file of gateFiles) {
    const content = source(file);
    assert.doesNotMatch(
      content,
      /(?:from|import\()\s*["'][^"']*(?:orders?|contracts?|payments?|escrow|blockchain|sanctions?|aml|openai)/i,
    );
  }
});

test("the runtime consumes authoritative Organization Participation persistence", () => {
  const marketplace = source("server/marketplace/publicMarketplace.ts");
  const runtime = source(
    "server/organization-participation-eligibility/postgresRuntime.ts",
  );
  const composition = source(
    "server/organization-participation-eligibility/productionRuntime.ts",
  );
  assert.match(
    composition,
    /createPostgresMarketplaceOrganizationParticipationEligibilityAdapter/,
  );
  assert.match(
    composition,
    /createPostgresOrganizationVerificationPersistenceAdapter/,
  );
  assert.doesNotMatch(marketplace, /unavailableOrganizationParticipation/);
  assert.match(runtime, /createOrganizationVerificationReplayRequest/);
  assert.match(runtime, /replayOrganizationVerificationWorkflow/);
  assert.match(runtime, /status:\s*"unavailable"/);
  assert.doesNotMatch(marketplace, /users\.verified|kybStatus|verificationLevel/);
  assert.doesNotMatch(runtime, /users\.verified|kybStatus|verificationLevel/);
  assert.doesNotMatch(composition, /users\.verified|kybStatus|verificationLevel/);
});
