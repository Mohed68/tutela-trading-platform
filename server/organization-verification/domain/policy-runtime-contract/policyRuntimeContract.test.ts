import assert from "node:assert/strict";
import test from "node:test";
import * as evaluationInput from "../evaluation-input/index.js";
import {
  createOrganizationVerificationPolicyEvaluationInputInternal,
} from "../evaluation-input/policyEvaluationInput.js";
import {
  createPolicyEvaluationInputFingerprintInternal,
} from "../evaluation-input/ids.js";
import * as policy from "../policy/index.js";
import * as runtime from "./index.js";

type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly path?: string };

function must<T>(result: Result<T>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);
const STARTED_AT = "2026-07-29T10:00:00.000Z";
const COMPLETED_AT = "2026-07-29T10:00:01.000Z";

function policyIdentity() {
  return {
    policySetId: must(
      policy.createOrganizationVerificationPolicySetId(
        "synthetic-policy-set-1",
      ),
    ),
    policySetVersion: must(
      policy.createOrganizationVerificationPolicySetVersion(
        "synthetic-policy-set-version-1",
      ),
    ),
    provenanceReference: must(
      policy.createOrganizationVerificationPolicyProvenanceReference(
        "synthetic-policy-provenance-1",
      ),
    ),
    integrityReference: must(
      policy.createOrganizationVerificationPolicySetIntegrityReference(
        "synthetic-policy-integrity-1",
      ),
    ),
  };
}

function ruleIdentity(id: string, version: string) {
  return {
    ruleId: must(policy.createOrganizationVerificationRuleId(id)),
    ruleVersion: must(
      policy.createOrganizationVerificationRuleVersion(version),
    ),
  };
}

function makePolicySet() {
  const identity = policyIdentity();
  const first = ruleIdentity("synthetic-rule-1", "rule-version-1");
  const second = ruleIdentity("synthetic-rule-2", "rule-version-1");
  return must(
    policy.createOrganizationVerificationPolicySet({
      ...identity,
      policyContractVersion: policy.POLICY_CONTRACT_VERSION,
      name: "Synthetic policy set",
      effectiveFrom: "2026-07-29T00:00:00.000Z",
      rules: [
        { ...second, required: false, evaluationOrder: 2 },
        { ...first, required: true, evaluationOrder: 1 },
      ],
      evaluationContractVersion:
        policy.POLICY_EVALUATION_CONTRACT_VERSION,
      status: "active",
    }),
  );
}

function makeRule(
  ruleId: string,
  ruleVersion: string,
  evaluationOrder: number,
  required: boolean,
) {
  const identity = policyIdentity();
  return must(
    policy.createOrganizationVerificationRule({
      ...identity,
      ...ruleIdentity(ruleId, ruleVersion),
      ruleContractVersion: policy.RULE_CONTRACT_VERSION,
      title: `Synthetic ${ruleId}`,
      normalizedCategory: "organization_verification.synthetic",
      severity: "medium",
      evaluationDisposition: "satisfied",
      reasonCode: `organization_verification.synthetic.${ruleId.replaceAll(
        "-",
        "_",
      )}`,
      required,
      evaluationOrder,
      integrityReference: must(
        policy.createOrganizationVerificationRuleIntegrityReference(
          `${ruleId}-integrity`,
        ),
      ),
    }),
  );
}

function makeRules() {
  return [
    makeRule("synthetic-rule-1", "rule-version-1", 1, true),
    makeRule("synthetic-rule-2", "rule-version-1", 2, false),
  ] as const;
}

function makeImplementation(
  ruleId: string,
  ruleVersion = "rule-version-1",
  policySetVersion = "synthetic-policy-set-version-1",
) {
  const disposition = must(
    policy.parseOrganizationVerificationFindingDisposition("satisfied"),
  );
  return must(
    runtime.createOrganizationVerificationRuleImplementation({
      ...ruleIdentity(ruleId, ruleVersion),
      policySetId: policyIdentity().policySetId,
      policySetVersion: must(
        policy.createOrganizationVerificationPolicySetVersion(policySetVersion),
      ),
      implementationContractVersion:
        runtime.ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_CONTRACT_VERSION,
      implementationVersion: must(
        runtime.createOrganizationVerificationRuleImplementationVersion(
          "implementation-version-1",
        ),
      ),
      implementationDigest: must(
        runtime.createOrganizationVerificationRuleImplementationDigest(
          DIGEST_A,
        ),
      ),
      provenanceReference: must(
        runtime.createOrganizationVerificationRuleImplementationProvenanceReference(
          `${ruleId}-implementation-provenance`,
        ),
      ),
      integrityReference: must(
        runtime.createOrganizationVerificationRuleImplementationIntegrityReference(
          `${ruleId}-implementation-integrity`,
        ),
      ),
      evaluate: () => disposition,
    }),
  );
}

function makeImplementationSet(
  overrides: Partial<
    runtime.CreateOrganizationVerificationRuleImplementationSetInput
  > = {},
) {
  const policySet = makePolicySet();
  return runtime.createOrganizationVerificationRuleImplementationSet({
    implementationSetId: must(
      runtime.createOrganizationVerificationRuleImplementationSetId(
        "synthetic-implementation-set-1",
      ),
    ),
    implementationSetVersion: must(
      runtime.createOrganizationVerificationRuleImplementationSetVersion(
        "synthetic-implementation-set-version-1",
      ),
    ),
    implementationSetContractVersion:
      runtime.ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_SET_CONTRACT_VERSION,
    policySet,
    rules: makeRules(),
    implementations: [
      makeImplementation("synthetic-rule-2"),
      makeImplementation("synthetic-rule-1"),
    ],
    provenanceReference: must(
      runtime.createOrganizationVerificationRuleImplementationProvenanceReference(
        "synthetic-set-provenance",
      ),
    ),
    integrityReference: must(
      runtime.createOrganizationVerificationRuleImplementationIntegrityReference(
        "synthetic-set-integrity",
      ),
    ),
    ...overrides,
  });
}

function makeEvaluationInput() {
  const identity = policyIdentity();
  return createOrganizationVerificationPolicyEvaluationInputInternal({
    policyEvaluationInputId: must(
      evaluationInput.createOrganizationVerificationPolicyEvaluationInputId(
        "synthetic-input-1",
      ),
    ),
    policyEvaluationInputVersion: must(
      evaluationInput.createOrganizationVerificationPolicyEvaluationInputVersion(
        "synthetic-input-version-1",
      ),
    ),
    inputContractVersion:
      evaluationInput.POLICY_EVALUATION_INPUT_CONTRACT_VERSION,
    inputBuilderVersion:
      evaluationInput.POLICY_EVALUATION_INPUT_BUILDER_VERSION,
    projectionBinding: Object.freeze({
      evaluationProjectionId: "synthetic-projection-1" as never,
      evaluationProjectionVersion: "synthetic-projection-version-1" as never,
      projectionContractVersion:
        "organization_verification.evaluation_projection.v1" as never,
      projectionSchemaVersion:
        "organization_verification.evaluation_projection_schema.v1" as never,
      projectionFingerprint: DIGEST_A as never,
      sourceSnapshotId: "synthetic-snapshot-1" as never,
      sourceSnapshotFingerprint: DIGEST_B as never,
      organizationId: "synthetic-organization-1" as never,
      recordId: "synthetic-record-1" as never,
      revisionId: "synthetic-revision-1" as never,
      profileRevisionId: "synthetic-profile-revision-1" as never,
      attemptId: "synthetic-attempt-1" as never,
    }),
    policySetBinding: Object.freeze({
      ...identity,
      policyContractVersion: policy.POLICY_CONTRACT_VERSION,
    }),
    evaluationContext: Object.freeze({
      contextContractVersion:
        evaluationInput.EVALUATION_CONTEXT_CONTRACT_VERSION,
      requestedAt: STARTED_AT,
      effectiveAt: STARTED_AT,
      executionReference: must(
        evaluationInput.createOrganizationVerificationEvaluationExecutionReference(
          "synthetic-execution-reference-1",
        ),
      ),
      attemptId: "synthetic-attempt-1" as never,
      organizationId: "synthetic-organization-1" as never,
      recordId: "synthetic-record-1" as never,
      revisionId: "synthetic-revision-1" as never,
      profileRevisionId: "synthetic-profile-revision-1" as never,
      evaluationProjectionId: "synthetic-projection-1" as never,
      evaluationProjectionFingerprint: DIGEST_A as never,
      sourceSnapshotId: "synthetic-snapshot-1" as never,
      sourceSnapshotFingerprint: DIGEST_B as never,
      provenanceReference: must(
        evaluationInput.createOrganizationVerificationEvaluationProvenanceReference(
          "synthetic-input-provenance-1",
        ),
      ),
      correlationReference: must(
        evaluationInput.createOrganizationVerificationEvaluationCorrelationReference(
          "synthetic-input-correlation-1",
        ),
      ),
      integrityReference: must(
        evaluationInput.createOrganizationVerificationEvaluationIntegrityReference(
          "synthetic-input-integrity-1",
        ),
      ),
    }),
    evaluationScope: Object.freeze({
      scopeContractVersion: evaluationInput.EVALUATION_SCOPE_CONTRACT_VERSION,
      capability:
        evaluationInput.ORGANIZATION_VERIFICATION_EVALUATION_CAPABILITY,
      authorizedProjectionSections: Object.freeze([
        "registry_facts",
        "submission_facts",
        "evidence_facts",
      ]),
      authorizedEvidenceCategories: Object.freeze([
        "legal.identity" as never,
      ]),
      authorizedDeclaredFactSections: Object.freeze(["organization"]),
      provenanceReference: must(
        evaluationInput.createOrganizationVerificationEvaluationProvenanceReference(
          "synthetic-scope-provenance-1",
        ),
      ),
      integrityReference: must(
        evaluationInput.createOrganizationVerificationEvaluationIntegrityReference(
          "synthetic-scope-integrity-1",
        ),
      ),
    }),
    factSurface: Object.freeze({
      registryFacts: Object.freeze({
        profileRevisionSequence: 1 as never,
        profileFingerprint: "synthetic-profile-fingerprint-1" as never,
        legalIdentity: Object.freeze({
          legalName: "Synthetic Entity",
          tradingNames: Object.freeze(["Synthetic Trading"]),
          registrationJurisdiction: "ZZ",
          registrationIdentifiers: Object.freeze([
            Object.freeze({ scheme: "synthetic", value: "SYN-1" }),
          ]),
        }),
        organizationType: "synthetic",
        jurisdiction: "ZZ",
        declaredActivities: Object.freeze([
          Object.freeze({ code: "synthetic.activity" }),
        ]),
      }),
      submissionFacts: Object.freeze({
        revisionSequence: 1 as never,
        submittedAt: "2026-07-29T09:00:00.000Z",
        declaredSections: Object.freeze([
          Object.freeze({
            key: "organization",
            values: Object.freeze([
              Object.freeze({ key: "statement", value: "synthetic" }),
            ]),
          }),
        ]),
      }),
      evidenceFacts: Object.freeze([
        Object.freeze({
          evidenceReferenceId: "synthetic-evidence-1" as never,
          evidenceReferenceVersion: "synthetic-evidence-version-1" as never,
          revisionEvidenceReferenceId:
            "synthetic-revision-evidence-1" as never,
          evidenceKind: "corporate.registration" as never,
          category: "legal.identity" as never,
          sourceAuthority: "customer.submission" as never,
          contentDigest: DIGEST_A as never,
          capturedAt: "2026-07-29T08:00:00.000Z",
          attributes: Object.freeze([
            Object.freeze({ key: "country", value: "ZZ" }),
          ]),
        }),
      ]),
    }),
    createdAt: STARTED_AT,
    inputFingerprint: createPolicyEvaluationInputFingerprintInternal(DIGEST_A),
  });
}

function makeArtifactsInput(
  overrides: Partial<runtime.CreateOrganizationVerificationExecutionArtifactsInput> = {},
): runtime.CreateOrganizationVerificationExecutionArtifactsInput {
  const implementationSet = must(makeImplementationSet());
  const provenanceReference = must(
    runtime.createOrganizationVerificationExecutionArtifactProvenanceReference(
      "synthetic-execution-provenance",
    ),
  );
  const integrityReference = must(
    runtime.createOrganizationVerificationExecutionArtifactIntegrityReference(
      "synthetic-execution-integrity",
    ),
  );
  return {
    executionArtifactsContractVersion:
      runtime.ORGANIZATION_VERIFICATION_EXECUTION_ARTIFACTS_CONTRACT_VERSION,
    evaluationInput: makeEvaluationInput(),
    implementationSet,
    executionId: must(
      runtime.createOrganizationVerificationExecutionId(
        "synthetic-execution-1",
      ),
    ),
    startedAt: STARTED_AT,
    completedAt: COMPLETED_AT,
    provenanceReference,
    integrityReference,
    ruleResults: implementationSet.bindings.map((binding, index) => ({
      ruleId: binding.rule.ruleId,
      ruleVersion: binding.rule.ruleVersion,
      ruleResultId: must(
        runtime.createOrganizationVerificationRuleResultId(
          `synthetic-rule-result-${index + 1}`,
        ),
      ),
      evaluatedAt: COMPLETED_AT,
      provenanceReference,
      integrityReference,
    })),
    findings: [],
    completion: {
      completionId: must(
        policy.createOrganizationVerificationPolicyEvaluationCompletionId(
          "synthetic-completion-1",
        ),
      ),
      completedAt: COMPLETED_AT,
      provenanceReference,
      integrityReference,
    },
    ...overrides,
  };
}

test("authenticates and freezes a synthetic Rule Implementation", () => {
  const implementation = makeImplementation("synthetic-rule-1");
  assert.equal(
    runtime.isOrganizationVerificationRuleImplementation(implementation),
    true,
  );
  assert.equal(Object.isFrozen(implementation), true);
});

test("rejects a fake Rule Implementation even when its visible fields match", () => {
  const implementation = makeImplementation("synthetic-rule-1");
  assert.equal(
    runtime.isOrganizationVerificationRuleImplementation({
      ...implementation,
    }),
    false,
  );
});

test("keeps Rule metadata separate from its executable implementation", () => {
  const rule = makeRules()[0];
  const implementation = makeImplementation("synthetic-rule-1");
  assert.equal("evaluate" in rule, false);
  assert.equal("reasonCode" in implementation, false);
});

test("defines a pure evaluator that receives only the adapted fact view", () => {
  let receivedKeys: readonly string[] = [];
  const disposition = must(
    policy.parseOrganizationVerificationFindingDisposition("satisfied"),
  );
  const base = makeImplementation("synthetic-rule-1");
  const implementation = must(
    runtime.createOrganizationVerificationRuleImplementation({
      ...base,
      evaluate: (factView) => {
        receivedKeys = Object.keys(factView).sort();
        return disposition;
      },
    }),
  );
  const factView = must(
    runtime.adaptOrganizationVerificationEvaluationInputToPolicyEvaluationFactView(
      makeEvaluationInput(),
    ),
  );
  assert.equal(implementation.evaluate(factView), disposition);
  assert.deepEqual(receivedKeys, [
    "evidenceFacts",
    "registryFacts",
    "submissionFacts",
  ]);
  assert.equal("projectionBinding" in factView, false);
  assert.equal("evaluationContext" in factView, false);
});

test("binds every Rule ID and version exactly once", () => {
  const result = makeImplementationSet();
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.value.bindings.map((binding) => [
      binding.rule.ruleId,
      binding.rule.ruleVersion,
    ]),
    [
      ["synthetic-rule-1", "rule-version-1"],
      ["synthetic-rule-2", "rule-version-1"],
    ],
  );
});

test("rejects a missing Rule Implementation", () => {
  const result = makeImplementationSet({
    implementations: [makeImplementation("synthetic-rule-1")],
  });
  assert.deepEqual(result, {
    ok: false,
    code: "missing_rule_implementation",
  });
});

test("rejects an extra Rule Implementation", () => {
  const result = makeImplementationSet({
    implementations: [
      makeImplementation("synthetic-rule-1"),
      makeImplementation("synthetic-rule-2"),
      makeImplementation("synthetic-rule-extra"),
    ],
  });
  assert.deepEqual(result, {
    ok: false,
    code: "extra_rule_implementation",
  });
});

test("rejects duplicate Rule Implementations", () => {
  const duplicate = makeImplementation("synthetic-rule-1");
  const result = makeImplementationSet({
    implementations: [
      duplicate,
      duplicate,
      makeImplementation("synthetic-rule-2"),
    ],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "duplicate_rule_implementation");
});

test("rejects a Rule Implementation version mismatch", () => {
  const result = makeImplementationSet({
    implementations: [
      makeImplementation("synthetic-rule-1", "rule-version-2"),
      makeImplementation("synthetic-rule-2"),
    ],
  });
  assert.deepEqual(result, {
    ok: false,
    code: "rule_implementation_version_mismatch",
  });
});

test("rejects a Rule Implementation Policy Set mismatch", () => {
  const result = makeImplementationSet({
    implementations: [
      makeImplementation(
        "synthetic-rule-1",
        "rule-version-1",
        "wrong-policy-version",
      ),
      makeImplementation("synthetic-rule-2"),
    ],
  });
  assert.deepEqual(result, {
    ok: false,
    code: "rule_implementation_policy_mismatch",
  });
});

test("orders implementations deterministically by Policy evaluation order", () => {
  const first = must(makeImplementationSet());
  const second = must(
    makeImplementationSet({
      implementations: [
        makeImplementation("synthetic-rule-1"),
        makeImplementation("synthetic-rule-2"),
      ],
    }),
  );
  assert.deepEqual(
    first.bindings.map((binding) => binding.rule.ruleId),
    second.bindings.map((binding) => binding.rule.ruleId),
  );
  assert.equal(
    first.implementationSetFingerprint,
    second.implementationSetFingerprint,
  );
});

test("fingerprints an authentic Policy Set deterministically", () => {
  const first = must(
    runtime.fingerprintOrganizationVerificationPolicySet(makePolicySet()),
  );
  const second = must(
    runtime.fingerprintOrganizationVerificationPolicySet(makePolicySet()),
  );
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("rejects a fake Policy Set and a mismatched expected fingerprint", () => {
  const policySet = makePolicySet();
  assert.deepEqual(
    runtime.fingerprintOrganizationVerificationPolicySet({ ...policySet }),
    { ok: false, code: "unauthentic_policy_set" },
  );
  const result = makeImplementationSet({
    expectedPolicySetFingerprint: must(
      runtime.createOrganizationVerificationPolicySetFingerprint(DIGEST_B),
    ),
  });
  assert.deepEqual(result, {
    ok: false,
    code: "policy_set_fingerprint_mismatch",
  });
});

test("authenticates and fingerprints the immutable Implementation Set", () => {
  const implementationSet = must(makeImplementationSet());
  assert.equal(
    runtime.isOrganizationVerificationRuleImplementationSet(
      implementationSet,
    ),
    true,
  );
  assert.equal(Object.isFrozen(implementationSet), true);
  assert.match(
    implementationSet.implementationSetFingerprint,
    /^[a-f0-9]{64}$/,
  );
});

test("rejects a mismatched expected Implementation Set fingerprint", () => {
  const result = makeImplementationSet({
    expectedImplementationSetFingerprint: must(
      runtime.createOrganizationVerificationRuleImplementationSetFingerprint(
        DIGEST_B,
      ),
    ),
  });
  assert.deepEqual(result, {
    ok: false,
    code: "implementation_set_fingerprint_mismatch",
  });
});

test("rejects a fake Implementation Set", () => {
  const implementationSet = must(makeImplementationSet());
  assert.equal(
    runtime.isOrganizationVerificationRuleImplementationSet({
      ...implementationSet,
    }),
    false,
  );
});

test("adapts only the approved Evaluation Input fact surface", () => {
  const input = makeEvaluationInput();
  const factView = must(
    runtime.adaptOrganizationVerificationEvaluationInputToPolicyEvaluationFactView(
      input,
    ),
  );
  assert.deepEqual(factView, input.factSurface);
  assert.notEqual(factView, input.factSurface);
  assert.equal(Object.isFrozen(factView), true);
  assert.equal(Object.isFrozen(factView.registryFacts), true);
});

test("does not infer missing facts in the adapter", () => {
  const source = makeEvaluationInput();
  const input = createOrganizationVerificationPolicyEvaluationInputInternal({
    ...source,
    factSurface: Object.freeze({}),
  });
  const factView = must(
    runtime.adaptOrganizationVerificationEvaluationInputToPolicyEvaluationFactView(
      input,
    ),
  );
  assert.deepEqual(factView, {});
});

test("rejects an unauthentic Evaluation Input", () => {
  const input = makeEvaluationInput();
  const result =
    runtime.adaptOrganizationVerificationEvaluationInputToPolicyEvaluationFactView(
      { ...input },
    );
  assert.deepEqual(result, {
    ok: false,
    code: "unauthentic_policy_evaluation_input",
  });
});

test("supplies all execution identifiers, references, and timestamps explicitly", () => {
  const artifacts = must(
    runtime.createOrganizationVerificationExecutionArtifacts(
      makeArtifactsInput(),
    ),
  );
  assert.equal(
    runtime.isOrganizationVerificationExecutionArtifacts(artifacts),
    true,
  );
  assert.equal(artifacts.executionId, "synthetic-execution-1");
  assert.equal(artifacts.ruleResults.length, 2);
  assert.equal(artifacts.completion.completionId, "synthetic-completion-1");
  assert.equal(artifacts.startedAt, STARTED_AT);
  assert.equal(artifacts.completedAt, COMPLETED_AT);
});

test("rejects an object-spread impersonation of Execution Artifacts", () => {
  const artifacts = must(
    runtime.createOrganizationVerificationExecutionArtifacts(
      makeArtifactsInput(),
    ),
  );
  assert.equal(
    runtime.isOrganizationVerificationExecutionArtifacts({ ...artifacts }),
    false,
  );
});

test("rejects missing Execution IDs", () => {
  const result = runtime.createOrganizationVerificationExecutionArtifacts(
    makeArtifactsInput({ executionId: "" as never }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "missing_execution_artifact");
});

test("rejects missing integrity references", () => {
  const result = runtime.createOrganizationVerificationExecutionArtifacts(
    makeArtifactsInput({ integrityReference: "" as never }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "missing_execution_artifact");
});

test("rejects missing Rule Result IDs", () => {
  const input = makeArtifactsInput();
  const result = runtime.createOrganizationVerificationExecutionArtifacts({
    ...input,
    ruleResults: [
      { ...input.ruleResults[0]!, ruleResultId: "" as never },
      input.ruleResults[1]!,
    ],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "missing_execution_artifact");
});

test("rejects missing Rule Result artifacts", () => {
  const input = makeArtifactsInput();
  const result = runtime.createOrganizationVerificationExecutionArtifacts({
    ...input,
    ruleResults: [input.ruleResults[0]!],
  });
  assert.deepEqual(result, {
    ok: false,
    code: "missing_execution_artifact",
    path: "ruleResults",
  });
});

test("rejects duplicate Rule Result IDs", () => {
  const input = makeArtifactsInput();
  const result = runtime.createOrganizationVerificationExecutionArtifacts({
    ...input,
    ruleResults: [
      input.ruleResults[0]!,
      {
        ...input.ruleResults[1]!,
        ruleResultId: input.ruleResults[0]!.ruleResultId,
      },
    ],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "duplicate_execution_artifact");
});

test("rejects hidden or invalid chronology instead of reading a clock", () => {
  const result = runtime.createOrganizationVerificationExecutionArtifacts(
    makeArtifactsInput({
      startedAt: COMPLETED_AT,
      completedAt: STARTED_AT,
    }),
  );
  assert.deepEqual(result, {
    ok: false,
    code: "invalid_execution_artifact_chronology",
  });
});

test("creates no identifiers or timestamps implicitly", () => {
  const publicNames = Object.keys(runtime);
  assert.equal(
    publicNames.some((name) => /random|uuid|nanoid|clock|now/i.test(name)),
    false,
  );
});

test("protects internal construction and canonicalization from public exports", () => {
  const publicNames = Object.keys(runtime);
  for (const forbidden of [
    "fingerprintInternal",
    "runtimeContractSuccess",
    "runtimeContractFailure",
    "ruleImplementationSeal",
    "ruleImplementationSetSeal",
    "executionArtifactsSeal",
  ]) {
    assert.equal(publicNames.includes(forbidden), false);
  }
});
