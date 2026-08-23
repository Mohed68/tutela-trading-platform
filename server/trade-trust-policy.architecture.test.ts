import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("production Trade Trust policy contains no test or synthetic authority", () => {
  const productionFiles = [
    "server/trade-trust-policy/organizationVerificationPolicy.ts",
    "server/trade-trust-policy/productionWiring.ts",
    "server/organization-verification/application/production-evidence-adapter/platformEvidenceAdapter.ts",
    "server/activity-eligibility/minimumTradeActivityPolicy.ts",
    "server/compliance-trigger/contracts.ts",
  ];
  for (const file of productionFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /from ["'][^"']*(?:\.test|test-fixture|fixtures)[^"']*["']/i);
    assert.doesNotMatch(source, /synthetic[_ -](?:rule|authority|evidence)/i);
  }
});

test("Decision, Trust, Activity, Participation, and Publication authorities stay separate", () => {
  const activity = read("server/activity-eligibility/minimumTradeActivityPolicy.ts");
  const organizationPolicy = read("server/trade-trust-policy/organizationVerificationPolicy.ts");
  const compliance = read("server/compliance-trigger/contracts.ts");
  assert.doesNotMatch(activity, /trust-status|participation-eligibility|offer-publication/i);
  assert.doesNotMatch(organizationPolicy, /activity-eligibility|offer-publication|marketplace/i);
  assert.doesNotMatch(compliance, /decisionEngine|trustStatus|publicationEligibility/);
});

test("external evidence providers remain optional evidence sources", () => {
  const activity = read("server/activity-eligibility/minimumTradeActivityPolicy.ts");
  const organizationAdapter = read("server/organization-verification/application/production-evidence-adapter/platformEvidenceAdapter.ts");
  assert.match(activity, /platform_submitted/);
  assert.match(organizationAdapter, /platform_submitted/);
  assert.doesNotMatch(`${activity}\n${organizationAdapter}`, /createKyb|sanctions|pep|aml/i);
});

test("controllers cannot manufacture Trade Trust authority results", () => {
  const routes = read("server/routes.ts");
  assert.doesNotMatch(routes, /createActivityEligibilityResultInternal/);
  assert.doesNotMatch(routes, /createMinimumTradeTrustOrganizationPolicyBundle/);
  assert.doesNotMatch(routes, /evaluateComplianceTrigger/);
  assert.doesNotMatch(routes, /createMinimumTradeTrustProductionWiring/);
});
