import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

test("Activity Eligibility remains an independent authority boundary", () => {
  const files = [
    "server/activity-eligibility/contracts.ts",
    "server/activity-eligibility/ports.ts",
    "server/activity-eligibility/index.ts",
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(
      source,
      /from ["'][^"']*(?:organization-verification|trust-status|organization-participation-eligibility|offer-publication-eligibility|server\/verification|trading-flow)/,
    );
    assert.doesNotMatch(source, /database|postgres|routes?|controllers?|marketplace/i);
  }
});

test("Activity Eligibility owns no Organization Trust, Participation, or Publication result", () => {
  const source = read("server/activity-eligibility/contracts.ts");
  assert.match(source, /ActivityEligibilityOutcome/);
  assert.doesNotMatch(source, /OrganizationParticipationEligibilityResult/);
  assert.doesNotMatch(source, /OfferPublicationEligibilityResult/);
  assert.doesNotMatch(source, /OrganizationVerificationTrustStatus/);
});

test("evidence provider adapters cannot enter authority layers", () => {
  for (const file of [
    "contracts.ts",
    "ports.ts",
    "localPlatformEvidenceProvider.ts",
    "index.ts",
  ]) {
    const source = read(`server/evidence-provider/${file}`);
    assert.doesNotMatch(
      source,
      /from ["'][^"']*(?:organization-verification|trust-status|activity-eligibility|organization-participation-eligibility|offer-publication-eligibility|verification\/engine|trading-flow)/,
    );
    assert.doesNotMatch(
      source,
      /(?:OrganizationVerificationDecision|TrustStatus|ActivityEligibilityResult|ParticipationEligibilityResult|PublicationEligibilityResult)/,
    );
  }
});

test("authority domains cannot import evidence provider adapters", () => {
  const roots = [
    "server/organization-verification/domain",
    "server/activity-eligibility",
    "server/organization-participation-eligibility",
    "server/offer-publication-eligibility",
    "server/trading-flow",
  ];
  for (const relativeRoot of roots) {
    const absoluteRoot = path.join(root, relativeRoot);
    for (const entry of fs.readdirSync(absoluteRoot, { recursive: true })) {
      if (
        typeof entry !== "string" ||
        !entry.endsWith(".ts") ||
        entry.endsWith(".test.ts")
      ) continue;
      const source = fs.readFileSync(path.join(absoluteRoot, entry), "utf8");
      assert.doesNotMatch(
        source,
        /from ["'][^"']*localPlatformEvidenceProvider|createLocalPlatformEvidenceProvider/,
        `${relativeRoot}/${entry}`,
      );
    }
  }
});

test("provider contracts expose evidence but no direct approval authority", () => {
  const contracts = read("server/evidence-provider/contracts.ts");
  const ports = read("server/evidence-provider/ports.ts");
  assert.match(contracts, /ProviderEvidenceEnvelope/);
  assert.doesNotMatch(`${contracts}\n${ports}`, /provider_approved|automatically_approved|goods_guaranteed/);
  assert.doesNotMatch(`${contracts}\n${ports}`, /readonly (?:decision|trust|eligibility|publishable):/);
});

test("production composition requires no external KYB provider", () => {
  const packageJson = read("package.json").toLowerCase();
  const productionSources = [
    read("server/index.ts"),
    read("server/organization-participation-eligibility/productionRuntime.ts"),
    read("server/marketplace/publicMarketplace.ts"),
  ].join("\n");
  for (const provider of ["sumsub", "kyckr", "sgs", "bureau-veritas", "intertek"]) {
    assert.equal(packageJson.includes(provider), false);
    assert.equal(productionSources.toLowerCase().includes(provider), false);
  }
  assert.doesNotMatch(productionSources, /KYB_PROVIDER_(?:KEY|URL)|requireExternalKyb/i);
});

test("Publication Eligibility is not weakened by evidence assurance contracts", () => {
  const publication = read(
    "server/offer-publication-eligibility/publicationEligibility.ts",
  );
  assert.doesNotMatch(publication, /EvidenceAssuranceLevel|ProviderEvidenceEnvelope/);
  assert.match(publication, /participation\.outcome !== "eligible"/);
  assert.match(publication, /verification\.decision !== "approved"/);
});

test("Order and Contract authorities remain untouched by this architecture slice", () => {
  const staged = read("server/trading-flow/service.ts");
  assert.match(staged, /offer_not_publishable/);
  assert.match(staged, /buyer_not_eligible/);
  assert.doesNotMatch(staged, /activity-eligibility|evidence-provider/);
});
