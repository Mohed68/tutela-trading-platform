import assert from "node:assert/strict";
import test from "node:test";
import {
  REGISTRY_CONTRACT_VERSION,
  createOrganizationId,
  createOrganizationProfileFingerprint,
  createOrganizationProfileRevisionId,
} from "../../../organization-registry/index.js";
import {
  createOrganizationEvidenceReferenceId,
  createCorrelationId,
  createOrganizationVerificationAttemptId,
  createOrganizationVerificationRecordId,
  createOrganizationVerificationRevisionId,
  createSnapshotFingerprint,
  createSnapshotId,
} from "../index.js";
import * as policySurface from "./index.js";
import {
  ORGANIZATION_VERIFICATION_FINDING_DISPOSITIONS,
  ORGANIZATION_VERIFICATION_FINDING_SEVERITIES,
  POLICY_CONTRACT_VERSION,
  POLICY_EVALUATION_CONTEXT_VERSION,
  POLICY_EVALUATION_CONTRACT_VERSION,
  RULE_CONTRACT_VERSION,
  adaptPolicyEvaluationCompletionToNormalizedEvaluation,
  completeOrganizationVerificationPolicyEvaluation,
  createOrganizationVerificationFinding,
  createOrganizationVerificationFindingId,
  createOrganizationVerificationFindingIntegrityReference,
  createOrganizationVerificationPolicyCategory,
  createOrganizationVerificationPolicyEvaluationCompletionId,
  createOrganizationVerificationPolicyEvaluationInput,
  createOrganizationVerificationPolicyEvaluationIntegrityReference,
  createOrganizationVerificationPolicyProvenanceReference,
  createOrganizationVerificationPolicySet,
  createOrganizationVerificationPolicySetId,
  createOrganizationVerificationPolicySetIntegrityReference,
  createOrganizationVerificationPolicySetVersion,
  createOrganizationVerificationReasonCode,
  createOrganizationVerificationRule,
  createOrganizationVerificationRuleEvaluationIntegrityReference,
  createOrganizationVerificationRuleEvaluationResult,
  createOrganizationVerificationRuleId,
  createOrganizationVerificationRuleIntegrityReference,
  createOrganizationVerificationRuleVersion,
  parseOrganizationVerificationFindingDisposition,
  parseOrganizationVerificationFindingSeverity,
  type OrganizationVerificationFinding,
  type OrganizationVerificationFindingDisposition,
  type OrganizationVerificationPolicyEvaluationCompletion,
  type OrganizationVerificationPolicyEvaluationInput,
  type OrganizationVerificationPolicySet,
  type OrganizationVerificationRule,
  type OrganizationVerificationRuleEvaluationResult,
  type PolicyDomainFailureCode,
  type PolicyDomainResult,
} from "./index.js";

function value<T>(result: {
  readonly ok: boolean;
  readonly value?: T;
  readonly code?: string;
}): T {
  assert.equal(result.ok, true, result.code);
  if (!result.ok || result.value === undefined) throw new Error(result.code);
  return result.value;
}

function failure<T>(
  result: PolicyDomainResult<T>,
  code: PolicyDomainFailureCode,
): void {
  assert.equal(result.ok, false);
  if (result.ok) throw new Error(`expected ${code}`);
  assert.equal(result.code, code);
}

const IDs = Object.freeze({
  organizationId: value(createOrganizationId("org-synthetic-1")),
  recordId: value(createOrganizationVerificationRecordId("record-synthetic-1")),
  revisionId: value(
    createOrganizationVerificationRevisionId("revision-synthetic-1"),
  ),
  attemptId: value(
    createOrganizationVerificationAttemptId("attempt-synthetic-1"),
  ),
  snapshotId: value(createSnapshotId("snapshot-synthetic-1")),
  snapshotFingerprint: value(
    createSnapshotFingerprint("snapshot-fingerprint-synthetic-1"),
  ),
  profileRevisionId: value(
    createOrganizationProfileRevisionId("profile-revision-synthetic-1"),
  ),
  profileFingerprint: value(
    createOrganizationProfileFingerprint("profile-fingerprint-synthetic-1"),
  ),
  evidenceReference: value(
    createOrganizationEvidenceReferenceId("evidence-synthetic-1"),
  ),
  correlationId: value(createCorrelationId("correlation-synthetic-1")),
  policySetId: value(
    createOrganizationVerificationPolicySetId("policy-set-synthetic-1"),
  ),
  policySetVersion: value(
    createOrganizationVerificationPolicySetVersion("policy-set-version-1"),
  ),
  policyProvenance: value(
    createOrganizationVerificationPolicyProvenanceReference(
      "policy-provenance-synthetic-1",
    ),
  ),
  policyIntegrity: value(
    createOrganizationVerificationPolicyEvaluationIntegrityReference(
      "policy-integrity-synthetic-1",
    ),
  ),
  policySetIntegrity: value(
    createOrganizationVerificationPolicySetIntegrityReference(
      "policy-set-integrity-synthetic-1",
    ),
  ),
});

function disposition(
  literal:
    | "satisfied"
    | "informational"
    | "revision_required"
    | "manual_review_required"
    | "rejection_required"
    | "evaluation_error",
): OrganizationVerificationFindingDisposition {
  return value(parseOrganizationVerificationFindingDisposition(literal));
}

function makeRule(
  suffix: string,
  ruleDisposition: Parameters<typeof disposition>[0],
  evaluationOrder: number,
  required = true,
): OrganizationVerificationRule {
  return value(
    createOrganizationVerificationRule({
      ruleId: value(
        createOrganizationVerificationRuleId(`rule-synthetic-${suffix}`),
      ),
      ruleVersion: value(
        createOrganizationVerificationRuleVersion(`rule-version-${suffix}`),
      ),
      policySetId: IDs.policySetId,
      policySetVersion: IDs.policySetVersion,
      ruleContractVersion: RULE_CONTRACT_VERSION,
      title: `Synthetic ${suffix}`,
      normalizedCategory: `organization_verification.synthetic_${suffix}`,
      severity: ruleDisposition === "satisfied" ? "low" : "high",
      evaluationDisposition: ruleDisposition,
      reasonCode: `organization_verification.synthetic_${suffix}.fixture_result`,
      required,
      evaluationOrder,
      provenanceReference: IDs.policyProvenance,
      integrityReference: value(
        createOrganizationVerificationRuleIntegrityReference(
          `rule-integrity-${suffix}`,
        ),
      ),
    }),
  );
}

function makePolicySet(
  rules: readonly OrganizationVerificationRule[],
  overrides: Partial<Parameters<typeof createOrganizationVerificationPolicySet>[0]> = {},
): OrganizationVerificationPolicySet {
  return value(
    createOrganizationVerificationPolicySet({
      policySetId: IDs.policySetId,
      policySetVersion: IDs.policySetVersion,
      policyContractVersion: POLICY_CONTRACT_VERSION,
      name: "Synthetic policy set",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      rules: rules.map((rule) => ({
        ruleId: rule.ruleId,
        ruleVersion: rule.ruleVersion,
        required: rule.required,
        evaluationOrder: rule.evaluationOrder,
      })),
      evaluationContractVersion: POLICY_EVALUATION_CONTRACT_VERSION,
      provenanceReference: IDs.policyProvenance,
      integrityReference: IDs.policySetIntegrity,
      applicabilityMetadata: { jurisdictionCodes: ["SA"] },
      status: "active",
      ...overrides,
    }),
  );
}

type EvaluationOverrides = Partial<
  Parameters<typeof createOrganizationVerificationPolicyEvaluationInput>[0]
>;

function makeEvaluationInput(
  overrides: EvaluationOverrides = {},
): OrganizationVerificationPolicyEvaluationInput {
  return value(
    createOrganizationVerificationPolicyEvaluationInput({
      organizationId: IDs.organizationId,
      recordId: IDs.recordId,
      revisionId: IDs.revisionId,
      attemptId: IDs.attemptId,
      snapshotId: IDs.snapshotId,
      snapshotFingerprint: IDs.snapshotFingerprint,
      policySetId: IDs.policySetId,
      policySetVersion: IDs.policySetVersion,
      evaluationContextVersion: POLICY_EVALUATION_CONTEXT_VERSION,
      semanticEvidenceReferences: [IDs.evidenceReference],
      registryProjection: {
        profileRevisionId: IDs.profileRevisionId,
        profileFingerprint: IDs.profileFingerprint,
        registryContractVersion: REGISTRY_CONTRACT_VERSION,
        organizationType: "synthetic_company",
        jurisdiction: "SA",
        declaredActivityCodes: ["synthetic_activity"],
      },
      evaluationRequestedAt: "2026-02-01T00:00:00.000Z",
      provenanceReference: IDs.policyProvenance,
      correlationId: IDs.correlationId,
      integrityReference: IDs.policyIntegrity,
      inputComplete: true,
      inputIntegrityValid: true,
      ...overrides,
    }),
  );
}

function makeFinding(
  rule: OrganizationVerificationRule,
  evaluationInput: OrganizationVerificationPolicyEvaluationInput,
  suffix: string,
  findingDisposition: OrganizationVerificationFindingDisposition =
    rule.evaluationDisposition,
  overrides: Partial<
    Parameters<typeof createOrganizationVerificationFinding>[0]
  > = {},
): OrganizationVerificationFinding {
  return value(
    createOrganizationVerificationFinding(
      {
        findingId: value(
          createOrganizationVerificationFindingId(
            `finding-synthetic-${suffix}`,
          ),
        ),
        policySetId: rule.policySetId,
        policySetVersion: rule.policySetVersion,
        ruleId: rule.ruleId,
        ruleVersion: rule.ruleVersion,
        organizationId: evaluationInput.organizationId,
        recordId: evaluationInput.recordId,
        revisionId: evaluationInput.revisionId,
        attemptId: evaluationInput.attemptId,
        snapshotId: evaluationInput.snapshotId,
        snapshotFingerprint: evaluationInput.snapshotFingerprint,
        reasonCode: rule.reasonCode,
        severity: rule.severity,
        disposition: findingDisposition,
        normalizedCategory: rule.normalizedCategory,
        evaluatedAt: "2026-02-01T00:02:00.000Z",
        provenanceReference: IDs.policyProvenance,
        evidenceReferenceIds: [IDs.evidenceReference],
        correlationId: evaluationInput.correlationId,
        integrityReference: value(
          createOrganizationVerificationFindingIntegrityReference(
            `finding-integrity-${suffix}`,
          ),
        ),
        attributes: [{ key: "fixture_code", value: suffix }],
        ...overrides,
      },
      { rule, evaluationInput },
    ),
  );
}

function makeResult(
  rule: OrganizationVerificationRule,
  evaluationInput: OrganizationVerificationPolicyEvaluationInput,
  suffix: string,
  overrides: Partial<
    Parameters<typeof createOrganizationVerificationRuleEvaluationResult>[0]
  > = {},
): OrganizationVerificationRuleEvaluationResult {
  const findings =
    rule.evaluationDisposition === "revision_required" ||
    rule.evaluationDisposition === "manual_review_required" ||
    rule.evaluationDisposition === "rejection_required"
      ? [makeFinding(rule, evaluationInput, suffix)]
      : rule.evaluationDisposition === "informational"
        ? [
            makeFinding(
              rule,
              evaluationInput,
              suffix,
              disposition("informational"),
            ),
          ]
        : [];
  return value(
    createOrganizationVerificationRuleEvaluationResult({
      rule,
      evaluationInput,
      disposition: rule.evaluationDisposition,
      evaluationStartedAt: "2026-02-01T00:01:00.000Z",
      evaluationCompletedAt: "2026-02-01T00:03:00.000Z",
      resultComplete: true,
      resultIntegrityValid: true,
      findings,
      provenanceReference: IDs.policyProvenance,
      correlationId: evaluationInput.correlationId,
      integrityReference: value(
        createOrganizationVerificationRuleEvaluationIntegrityReference(
          `result-integrity-${suffix}`,
        ),
      ),
      ...overrides,
    }),
  );
}

interface Scenario {
  readonly rules: readonly OrganizationVerificationRule[];
  readonly policySet: OrganizationVerificationPolicySet;
  readonly evaluationInput: OrganizationVerificationPolicyEvaluationInput;
  readonly results: readonly OrganizationVerificationRuleEvaluationResult[];
}

function makeScenario(
  dispositions: readonly Parameters<typeof disposition>[0][],
): Scenario {
  const rules = dispositions.map((entry, index) =>
    makeRule(`${index + 1}_${entry}`, entry, index + 1),
  );
  const policySet = makePolicySet(rules);
  const evaluationInput = makeEvaluationInput();
  const results = rules.map((rule, index) =>
    makeResult(rule, evaluationInput, `${index + 1}_${rule.evaluationDisposition}`),
  );
  return { rules, policySet, evaluationInput, results };
}

function complete(
  scenario: Scenario,
  overrides: Partial<
    Parameters<typeof completeOrganizationVerificationPolicyEvaluation>[0]
  > = {},
): PolicyDomainResult<OrganizationVerificationPolicyEvaluationCompletion> {
  return completeOrganizationVerificationPolicyEvaluation({
    evaluationCompletionId: value(
      createOrganizationVerificationPolicyEvaluationCompletionId(
        "policy-completion-synthetic-1",
      ),
    ),
    policySet: scenario.policySet,
    evaluationInput: scenario.evaluationInput,
    ruleResults: scenario.results,
    evaluationStartedAt: "2026-02-01T00:00:30.000Z",
    evaluationCompletedAt: "2026-02-01T00:04:00.000Z",
    completionComplete: true,
    completionIntegrityValid: true,
    provenanceReference: IDs.policyProvenance,
    correlationId: IDs.correlationId,
    integrityReference: IDs.policyIntegrity,
    ...overrides,
  });
}

test("1 valid exact Policy Set creation", () => {
  const set = makePolicySet([makeRule("valid_set", "satisfied", 1)]);
  assert.equal(set.policyContractVersion, POLICY_CONTRACT_VERSION);
  assert.equal(set.status, "active");
  assert.ok(Object.isFrozen(set));
  assert.ok(Object.isFrozen(set.rules));
});

test("2 invalid Policy Set ID rejection", () => {
  failure(createOrganizationVerificationPolicySetId(" "), "invalid_policy_set_id");
});

for (const [index, pointer] of ["latest", "current", "head", "default"].entries()) {
  test(`${3 + index} mutable policy pointer ${pointer} rejection`, () => {
    failure(
      createOrganizationVerificationPolicySetVersion(pointer),
      "invalid_policy_set_version",
    );
  });
}

test("7 exact Policy Set version enforcement", () => {
  failure(
    createOrganizationVerificationPolicySet(
      {
        ...makePolicySet([makeRule("exact", "satisfied", 1)]),
        policyContractVersion: "organization_verification.policy_set.v2",
      } as never,
    ),
    "unsupported_policy_contract_version",
  );
});

test("8 valid Rule construction", () => {
  const rule = makeRule("valid_rule", "revision_required", 1);
  assert.equal(rule.ruleContractVersion, RULE_CONTRACT_VERSION);
  assert.ok(Object.isFrozen(rule));
});

test("9 duplicate Rule reference rejection", () => {
  const rule = makeRule("duplicate", "satisfied", 1);
  const input = {
    ...makePolicySet([rule]),
    rules: [
      { ruleId: rule.ruleId, ruleVersion: rule.ruleVersion, required: true, evaluationOrder: 1 },
      { ruleId: rule.ruleId, ruleVersion: rule.ruleVersion, required: true, evaluationOrder: 2 },
    ],
  };
  failure(
    createOrganizationVerificationPolicySet(input),
    "duplicate_rule_reference",
  );
});

test("10 Rule and Policy Set mismatch rejection", () => {
  const rule = makeRule("mismatch", "satisfied", 1);
  const otherEvaluation = makeEvaluationInput({
    policySetVersion: value(
      createOrganizationVerificationPolicySetVersion("other-policy-version"),
    ),
  });
  failure(
    createOrganizationVerificationRuleEvaluationResult({
      rule,
      evaluationInput: otherEvaluation,
      disposition: rule.evaluationDisposition,
      evaluationStartedAt: "2026-02-01T00:01:00.000Z",
      evaluationCompletedAt: "2026-02-01T00:03:00.000Z",
      resultComplete: true,
      resultIntegrityValid: true,
      findings: [],
      provenanceReference: IDs.policyProvenance,
      correlationId: otherEvaluation.correlationId,
      integrityReference: value(
        createOrganizationVerificationRuleEvaluationIntegrityReference("mismatch"),
      ),
    }),
    "policy_set_rule_mismatch",
  );
});

test("11 valid Reason Code acceptance", () => {
  assert.equal(
    value(
      createOrganizationVerificationReasonCode(
        "organization_verification.identity.synthetic_missing",
      ),
    ),
    "organization_verification.identity.synthetic_missing",
  );
});

for (const [index, invalid] of [
  "identity.missing",
  "organization_verification.Identity.missing",
  "organization verification.identity.missing",
  "free form sentence",
].entries()) {
  test(`${12 + index} invalid Reason Code rejection`, () => {
    failure(createOrganizationVerificationReasonCode(invalid), "invalid_reason_code");
  });
}

test("16 valid Finding construction", () => {
  const rule = makeRule("finding", "revision_required", 1);
  const finding = makeFinding(rule, makeEvaluationInput(), "valid");
  assert.equal(finding.ruleId, rule.ruleId);
  assert.ok(Object.isFrozen(finding));
});

test("17 Finding policy identity mismatch rejection", () => {
  const rule = makeRule("finding_policy", "revision_required", 1);
  const evaluation = makeEvaluationInput();
  const result = createOrganizationVerificationFinding(
    {
      ...makeFinding(rule, evaluation, "policy_source"),
      policySetVersion: value(
        createOrganizationVerificationPolicySetVersion("wrong-version"),
      ),
    },
    { rule, evaluationInput: evaluation },
  );
  failure(result, "finding_policy_mismatch");
});

test("18 Finding Rule mismatch rejection", () => {
  const rule = makeRule("finding_rule", "revision_required", 1);
  const evaluation = makeEvaluationInput();
  const result = createOrganizationVerificationFinding(
    {
      ...makeFinding(rule, evaluation, "rule_source"),
      ruleId: value(createOrganizationVerificationRuleId("wrong-rule")),
    },
    { rule, evaluationInput: evaluation },
  );
  failure(result, "finding_rule_mismatch");
});

test("19 Finding Snapshot mismatch rejection", () => {
  const rule = makeRule("finding_snapshot", "revision_required", 1);
  const evaluation = makeEvaluationInput();
  const result = createOrganizationVerificationFinding(
    {
      ...makeFinding(rule, evaluation, "snapshot_source"),
      snapshotId: value(createSnapshotId("wrong-snapshot")),
    },
    { rule, evaluationInput: evaluation },
  );
  failure(result, "snapshot_id_mismatch");
});

test("20 Finding deep immutability", () => {
  const rule = makeRule("immutable_finding", "revision_required", 1);
  const evaluation = makeEvaluationInput();
  const attributes = [{ key: "fixture", value: "before" }] as Array<{
    key: string;
    value: string;
  }>;
  const finding = makeFinding(rule, evaluation, "immutable", rule.evaluationDisposition, {
    attributes,
  });
  attributes[0].value = "after";
  attributes.push({ key: "late", value: "late" });
  assert.deepEqual(finding.attributes, [{ key: "fixture", value: "before" }]);
  assert.ok(Object.isFrozen(finding.attributes[0]));
});

test("21 exact severity vocabulary", () => {
  assert.deepEqual(ORGANIZATION_VERIFICATION_FINDING_SEVERITIES, [
    "informational",
    "low",
    "medium",
    "high",
    "critical",
  ]);
  failure(
    parseOrganizationVerificationFindingSeverity("rejected"),
    "invalid_finding_severity",
  );
});

test("22 exact disposition vocabulary", () => {
  assert.deepEqual(ORGANIZATION_VERIFICATION_FINDING_DISPOSITIONS, [
    "satisfied",
    "informational",
    "revision_required",
    "manual_review_required",
    "rejection_required",
    "evaluation_error",
  ]);
  failure(
    parseOrganizationVerificationFindingDisposition("approved"),
    "unsupported_finding_disposition",
  );
});

for (const [index, entry] of ORGANIZATION_VERIFICATION_FINDING_DISPOSITIONS.entries()) {
  test(`${23 + index} authentic ${entry} Rule result`, () => {
    const scenario = makeScenario([entry]);
    assert.equal(scenario.results[0].disposition, entry);
    assert.ok(Object.isFrozen(scenario.results[0]));
    assert.ok(Object.isFrozen(scenario.results[0].findings));
  });
}

test("29 incomplete Rule result rejection", () => {
  const rule = makeRule("incomplete", "satisfied", 1);
  const evaluationInput = makeEvaluationInput();
  failure(
    createOrganizationVerificationRuleEvaluationResult({
      rule,
      evaluationInput,
      disposition: rule.evaluationDisposition,
      evaluationStartedAt: "2026-02-01T00:01:00.000Z",
      evaluationCompletedAt: "2026-02-01T00:03:00.000Z",
      resultComplete: false,
      resultIntegrityValid: true,
      findings: [],
      provenanceReference: IDs.policyProvenance,
      correlationId: IDs.correlationId,
      integrityReference: value(
        createOrganizationVerificationRuleEvaluationIntegrityReference("incomplete"),
      ),
    }),
    "rule_result_incomplete",
  );
});

test("30 integrity-invalid Rule result rejection", () => {
  const rule = makeRule("integrity", "satisfied", 1);
  const evaluationInput = makeEvaluationInput();
  failure(
    createOrganizationVerificationRuleEvaluationResult({
      rule,
      evaluationInput,
      disposition: rule.evaluationDisposition,
      evaluationStartedAt: "2026-02-01T00:01:00.000Z",
      evaluationCompletedAt: "2026-02-01T00:03:00.000Z",
      resultComplete: true,
      resultIntegrityValid: false,
      findings: [],
      provenanceReference: IDs.policyProvenance,
      correlationId: IDs.correlationId,
      integrityReference: value(
        createOrganizationVerificationRuleEvaluationIntegrityReference("invalid"),
      ),
    }),
    "rule_result_integrity_invalid",
  );
});

test("31 arbitrary object cannot impersonate Rule result", () => {
  const scenario = makeScenario(["satisfied"]);
  failure(
    complete(scenario, {
      ruleResults: [{ ...scenario.results[0] }] as never,
    }),
    "rule_result_integrity_invalid",
  );
});

test("32 required Rule missing", () => {
  const scenario = makeScenario(["satisfied", "satisfied"]);
  failure(
    complete(scenario, { ruleResults: [scenario.results[0]] }),
    "required_rule_missing",
  );
});

test("33 unauthorized Rule result present", () => {
  const scenario = makeScenario(["satisfied"]);
  const unauthorizedRule = makeRule("unauthorized", "satisfied", 99);
  const unauthorized = makeResult(
    unauthorizedRule,
    scenario.evaluationInput,
    "unauthorized",
  );
  failure(
    complete(scenario, {
      ruleResults: [...scenario.results, unauthorized],
    }),
    "unauthorized_rule_result",
  );
});

test("34 duplicate Rule result rejection", () => {
  const scenario = makeScenario(["satisfied"]);
  failure(
    complete(scenario, {
      ruleResults: [scenario.results[0], scenario.results[0]],
    }),
    "duplicate_rule_result",
  );
});

test("35 conflicting Rule result rejection", () => {
  const scenario = makeScenario(["satisfied"]);
  const alternateRule = value(
    createOrganizationVerificationRule({
      ...scenario.rules[0],
      ruleVersion: value(
        createOrganizationVerificationRuleVersion("conflicting-version"),
      ),
    }),
  );
  const conflicting = makeResult(
    alternateRule,
    scenario.evaluationInput,
    "conflicting",
  );
  failure(
    complete(scenario, { ruleResults: [conflicting] }),
    "conflicting_rule_result",
  );
});

test("36 exact deterministic Rule order", () => {
  const scenario = makeScenario(["satisfied", "revision_required"]);
  const completion = value(
    complete(scenario, { ruleResults: [...scenario.results].reverse() }),
  );
  assert.deepEqual(
    completion.ruleResults.map((result) => result.ruleId),
    scenario.rules.map((rule) => rule.ruleId),
  );
});

test("37 Policy Evaluation Completion deep immutability", () => {
  const completion = value(complete(makeScenario(["satisfied"])));
  assert.ok(Object.isFrozen(completion));
  assert.ok(Object.isFrozen(completion.ruleResults));
  assert.ok(Object.isFrozen(completion.findingSummary));
  assert.ok(Object.isFrozen(completion.findingSummary.categorySummaries));
  assert.ok(
    Object.isFrozen(
      completion.findingSummary.categorySummaries[0].dispositions,
    ),
  );
});

test("38 arbitrary object cannot impersonate Policy completion", () => {
  const completion = value(complete(makeScenario(["satisfied"])));
  failure(
    adaptPolicyEvaluationCompletionToNormalizedEvaluation({
      ...completion,
    } as never),
    "normalized_evaluation_adapter_failure",
  );
});

const mappingCases = [
  ["satisfied", "approval_ready"],
  ["revision_required", "revision_required"],
  ["manual_review_required", "manual_review_required"],
  ["rejection_required", "rejection_required"],
] as const;
for (const [index, [entry, expected]] of mappingCases.entries()) {
  test(`${39 + index} ${entry} maps to ${expected}`, () => {
    assert.equal(value(complete(makeScenario([entry]))).classification, expected);
  });
}

test("43 evaluation_error produces typed failure", () => {
  failure(
    complete(makeScenario(["evaluation_error"])),
    "policy_evaluation_error",
  );
});

const precedenceCases = [
  [["revision_required", "rejection_required"], "rejection_required"],
  [["revision_required", "manual_review_required"], "manual_review_required"],
  [["satisfied", "revision_required"], "revision_required"],
] as const;
for (const [index, [entries, expected]] of precedenceCases.entries()) {
  test(`${44 + index} deterministic precedence ${expected}`, () => {
    assert.equal(value(complete(makeScenario(entries))).classification, expected);
  });
}

test("47 informational does not alter classification", () => {
  assert.equal(
    value(complete(makeScenario(["satisfied", "informational"]))).classification,
    "approval_ready",
  );
});

test("48 contradiction is rejected rather than prioritized", () => {
  const rule = makeRule("contradiction", "satisfied", 1);
  const evaluation = makeEvaluationInput();
  const finding = makeFinding(
    makeRule("contradiction_authority", "rejection_required", 2),
    evaluation,
    "contradiction",
  );
  failure(
    createOrganizationVerificationRuleEvaluationResult({
      rule,
      evaluationInput: evaluation,
      disposition: rule.evaluationDisposition,
      evaluationStartedAt: "2026-02-01T00:01:00.000Z",
      evaluationCompletedAt: "2026-02-01T00:03:00.000Z",
      resultComplete: true,
      resultIntegrityValid: true,
      findings: [finding],
      provenanceReference: IDs.policyProvenance,
      correlationId: IDs.correlationId,
      integrityReference: value(
        createOrganizationVerificationRuleEvaluationIntegrityReference(
          "contradiction",
        ),
      ),
    }),
    "finding_rule_mismatch",
  );
});

const mismatchCases = [
  [
    "organization",
    {
      organizationId: value(createOrganizationId("org-other")),
    },
    "organization_id_mismatch",
  ],
  [
    "record",
    {
      recordId: value(createOrganizationVerificationRecordId("record-other")),
    },
    "verification_record_id_mismatch",
  ],
  [
    "revision",
    {
      revisionId: value(
        createOrganizationVerificationRevisionId("revision-other"),
      ),
    },
    "verification_revision_id_mismatch",
  ],
  [
    "attempt",
    {
      attemptId: value(
        createOrganizationVerificationAttemptId("attempt-other"),
      ),
    },
    "attempt_id_mismatch",
  ],
  [
    "snapshot",
    {
      snapshotId: value(createSnapshotId("snapshot-other")),
    },
    "snapshot_id_mismatch",
  ],
  [
    "fingerprint",
    {
      snapshotFingerprint: value(
        createSnapshotFingerprint("fingerprint-other"),
      ),
    },
    "snapshot_fingerprint_mismatch",
  ],
] as const;
for (const [index, [label, overrides, expected]] of mismatchCases.entries()) {
  test(`${49 + index} ${label} mismatch rejected`, () => {
    const scenario = makeScenario(["satisfied"]);
    const alternateInput = makeEvaluationInput(overrides);
    const result = makeResult(
      scenario.rules[0],
      alternateInput,
      `mismatch_${label}`,
    );
    failure(
      complete(scenario, { ruleResults: [result] }),
      expected as never,
    );
  });
}

test("55 invalid chronology rejected", () => {
  failure(
    complete(makeScenario(["satisfied"]), {
      evaluationCompletedAt: "2026-01-01T00:00:00.000Z",
    }),
    "invalid_evaluation_chronology",
  );
});

test("56 unknown Policy Set version rejected with no fallback", () => {
  failure(
    createOrganizationVerificationPolicySetVersion("latest"),
    "invalid_policy_set_version",
  );
  failure(
    createOrganizationVerificationPolicySetVersion(" "),
    "invalid_policy_set_version",
  );
});

test("57 deterministic repeated aggregation", () => {
  const scenario = makeScenario(["satisfied", "informational"]);
  assert.deepEqual(value(complete(scenario)), value(complete(scenario)));
});

test("58 identical completion retry is idempotent", () => {
  const scenario = makeScenario(["satisfied"]);
  const first = value(complete(scenario));
  const retry = value(complete(scenario, { existingCompletion: first }));
  assert.equal(retry, first);
});

test("59 duplicate completion identity rejected", () => {
  const scenario = makeScenario(["satisfied"]);
  const first = value(complete(scenario));
  failure(
    complete(scenario, {
      evaluationCompletionId: value(
        createOrganizationVerificationPolicyEvaluationCompletionId(
          "policy-completion-synthetic-2",
        ),
      ),
      existingCompletion: first,
    }),
    "duplicate_policy_evaluation_completion",
  );
});

test("60 conflicting completion identity rejected", () => {
  const scenario = makeScenario(["satisfied"]);
  const first = value(complete(scenario));
  failure(
    complete(scenario, {
      provenanceReference: value(
        createOrganizationVerificationPolicyProvenanceReference(
          "different-provenance",
        ),
      ),
      existingCompletion: first,
    }),
    "conflicting_policy_evaluation_completion",
  );
});

test("61 normalized adapter preserves exact IDs", () => {
  const completion = value(complete(makeScenario(["satisfied"])));
  const normalized = value(
    adaptPolicyEvaluationCompletionToNormalizedEvaluation(completion),
  );
  assert.equal(normalized.recordId, completion.recordId);
  assert.equal(normalized.revisionId, completion.revisionId);
  assert.equal(normalized.attemptId, completion.attemptId);
  assert.equal(normalized.snapshotId, completion.snapshotId);
  assert.equal(normalized.snapshotFingerprint, completion.snapshotFingerprint);
});

test("62 normalized adapter preserves provenance and integrity", () => {
  const completion = value(complete(makeScenario(["revision_required"])));
  const normalized = value(
    adaptPolicyEvaluationCompletionToNormalizedEvaluation(completion),
  );
  assert.equal(
    normalized.policyEvaluationProvenanceReference,
    completion.provenanceReference,
  );
  assert.equal(
    normalized.policyEvaluationIntegrityReference,
    completion.integrityReference,
  );
  assert.ok(Object.isFrozen(normalized.categorySummaries));
});

test("63 normalized adapter never creates Decision", () => {
  const normalized = value(
    adaptPolicyEvaluationCompletionToNormalizedEvaluation(
      value(complete(makeScenario(["satisfied"]))),
    ),
  );
  assert.equal("decisionId" in normalized, false);
  assert.equal("outcome" in normalized, false);
});

test("64 normalized adapter never creates Trust Status", () => {
  const normalized = value(
    adaptPolicyEvaluationCompletionToNormalizedEvaluation(
      value(complete(makeScenario(["satisfied"]))),
    ),
  );
  assert.equal("trustStatus" in normalized, false);
  assert.equal("trusted" in normalized, false);
});

test("65 evaluation_error never falls back to manual_review", () => {
  const result = complete(makeScenario(["evaluation_error"]));
  assert.deepEqual(result, { ok: false, code: "policy_evaluation_error" });
});

const legacyAuthorityNames = [
  "verified",
  "organizationLifecycle",
  "reviewerSelectedStatus",
  "offerVerification",
  "participationEligibility",
] as const;
for (const [index, legacyName] of legacyAuthorityNames.entries()) {
  test(`${66 + index} ${legacyName} has no Policy authority`, () => {
    const evaluation = makeEvaluationInput();
    const completion = value(complete(makeScenario(["satisfied"])));
    assert.equal(legacyName in evaluation, false);
    assert.equal(legacyName in completion, false);
  });
}

test("71 Policy evaluation never mutates Attempt", () => {
  const completion = value(complete(makeScenario(["satisfied"])));
  assert.equal("processState" in completion, false);
  assert.equal("transition" in completion, false);
});

test("72 caller mutation does not alter Policy Set or Evaluation Input", () => {
  const rules = [makeRule("caller_mutation", "satisfied", 1)];
  const references = rules.map((rule) => ({
    ruleId: rule.ruleId,
    ruleVersion: rule.ruleVersion,
    required: true,
    evaluationOrder: 1,
  }));
  const set = makePolicySet(rules, { rules: references });
  references[0].evaluationOrder = 99;
  const evidence = [IDs.evidenceReference];
  const evaluation = makeEvaluationInput({
    semanticEvidenceReferences: evidence,
  });
  evidence.length = 0;
  assert.equal(set.rules[0].evaluationOrder, 1);
  assert.equal(evaluation.semanticEvidenceReferences.length, 1);
});

test("73 public export surface excludes authenticity and internal construction", () => {
  for (const forbidden of [
    "readOrganizationVerificationFinding",
    "readOrganizationVerificationRuleEvaluationResult",
    "readOrganizationVerificationPolicyEvaluationCompletion",
    "createOrganizationVerificationPolicyEvaluationCompletionInternal",
    "policySuccess",
    "policyFailure",
  ]) {
    assert.equal(forbidden in policySurface, false, forbidden);
  }
});

test("74 framework vocabularies exclude Decision and Trust values", () => {
  for (const forbidden of [
    "approved",
    "rejected",
    "trusted",
    "not_trusted",
    "expired",
    "invalidated",
  ]) {
    assert.equal(
      ORGANIZATION_VERIFICATION_FINDING_DISPOSITIONS.includes(forbidden as never),
      false,
    );
  }
});

test("75 severity metadata cannot change classification", () => {
  const rule = makeRule("severity_only", "satisfied", 1);
  const criticalRule = value(
    createOrganizationVerificationRule({
      ...rule,
      severity: "critical",
    }),
  );
  const policySet = makePolicySet([criticalRule]);
  const evaluationInput = makeEvaluationInput();
  const result = makeResult(criticalRule, evaluationInput, "severity_only");
  const completion = value(
    complete({
      rules: [criticalRule],
      policySet,
      evaluationInput,
      results: [result],
    }),
  );
  assert.equal(completion.classification, "approval_ready");
});

test("76 exact category and Reason Code factories are capability namespaced", () => {
  assert.equal(
    value(
      createOrganizationVerificationPolicyCategory(
        "organization_verification.synthetic",
      ),
    ),
    "organization_verification.synthetic",
  );
  failure(
    createOrganizationVerificationPolicyCategory("generic.synthetic"),
    "invalid_policy_category",
  );
});

test("77 optional Rule omission is explicit and deterministic", () => {
  const required = makeRule("required_optional_case", "satisfied", 1, true);
  const optional = makeRule("optional_case", "informational", 2, false);
  const policySet = makePolicySet([required, optional]);
  const evaluationInput = makeEvaluationInput();
  const result = makeResult(required, evaluationInput, "required_optional_case");
  const completion = value(
    complete({
      rules: [required, optional],
      policySet,
      evaluationInput,
      results: [result],
    }),
  );
  assert.equal(completion.classification, "approval_ready");
  assert.equal(completion.ruleResults.length, 1);
});

test("78 invalid Finding identity is rejected", () => {
  failure(
    createOrganizationVerificationFindingId(" "),
    "invalid_finding_id",
  );
});

test("79 semantically duplicate Findings are rejected deterministically", () => {
  const rule = makeRule("semantic_duplicate", "revision_required", 1);
  const evaluationInput = makeEvaluationInput();
  const first = makeFinding(
    rule,
    evaluationInput,
    "semantic_duplicate_1",
    rule.evaluationDisposition,
    { attributes: [{ key: "same", value: true }] },
  );
  const second = makeFinding(
    rule,
    evaluationInput,
    "semantic_duplicate_2",
    rule.evaluationDisposition,
    { attributes: [{ key: "same", value: true }] },
  );
  failure(
    createOrganizationVerificationRuleEvaluationResult({
      rule,
      evaluationInput,
      disposition: rule.evaluationDisposition,
      evaluationStartedAt: "2026-02-01T00:01:00.000Z",
      evaluationCompletedAt: "2026-02-01T00:03:00.000Z",
      resultComplete: true,
      resultIntegrityValid: true,
      findings: [first, second],
      provenanceReference: IDs.policyProvenance,
      correlationId: IDs.correlationId,
      integrityReference: value(
        createOrganizationVerificationRuleEvaluationIntegrityReference(
          "semantic-duplicate-result",
        ),
      ),
    }),
    "duplicate_finding",
  );
});

test("80 multiple authority-bearing Findings fail closed", () => {
  const rule = makeRule("authority_conflict", "rejection_required", 1);
  const evaluationInput = makeEvaluationInput();
  const first = makeFinding(
    rule,
    evaluationInput,
    "authority_conflict_1",
    rule.evaluationDisposition,
    { attributes: [{ key: "fact", value: "one" }] },
  );
  const second = makeFinding(
    rule,
    evaluationInput,
    "authority_conflict_2",
    rule.evaluationDisposition,
    { attributes: [{ key: "fact", value: "two" }] },
  );
  failure(
    createOrganizationVerificationRuleEvaluationResult({
      rule,
      evaluationInput,
      disposition: rule.evaluationDisposition,
      evaluationStartedAt: "2026-02-01T00:01:00.000Z",
      evaluationCompletedAt: "2026-02-01T00:03:00.000Z",
      resultComplete: true,
      resultIntegrityValid: true,
      findings: [first, second],
      provenanceReference: IDs.policyProvenance,
      correlationId: IDs.correlationId,
      integrityReference: value(
        createOrganizationVerificationRuleEvaluationIntegrityReference(
          "authority-conflict-result",
        ),
      ),
    }),
    "contradictory_finding_disposition",
  );
});

test("81 incomplete Policy Evaluation Input fails closed", () => {
  failure(
    createOrganizationVerificationPolicyEvaluationInput({
      ...makeEvaluationInput(),
      inputComplete: false,
    }),
    "policy_evaluation_incomplete",
  );
});

test("82 integrity-invalid Policy Evaluation Input fails closed", () => {
  failure(
    createOrganizationVerificationPolicyEvaluationInput({
      ...makeEvaluationInput(),
      inputIntegrityValid: false,
    }),
    "policy_evaluation_integrity_invalid",
  );
});

test("83 Rule result does not retain mutable Finding collection", () => {
  const rule = makeRule("result_copy", "revision_required", 1);
  const evaluationInput = makeEvaluationInput();
  const findings = [makeFinding(rule, evaluationInput, "result_copy")];
  const result = makeResult(rule, evaluationInput, "result_copy", { findings });
  findings.length = 0;
  assert.equal(result.findings.length, 1);
});

test("84 Policy facts expose no raw evidence, provider payload, or storage path", () => {
  const scenario = makeScenario(["revision_required"]);
  const completion = value(complete(scenario));
  for (const candidate of [
    scenario.evaluationInput,
    scenario.results[0].findings[0],
    completion,
  ]) {
    assert.equal("rawEvidence" in candidate, false);
    assert.equal("providerPayload" in candidate, false);
    assert.equal("storagePath" in candidate, false);
  }
});
