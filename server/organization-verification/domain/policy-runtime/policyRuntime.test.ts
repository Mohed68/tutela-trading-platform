import assert from "node:assert/strict";
import test from "node:test";
import * as evaluationInput from "../evaluation-input/index.js";
import {
  createPolicyEvaluationInputFingerprintInternal,
} from "../evaluation-input/ids.js";
import {
  createOrganizationVerificationPolicyEvaluationInputInternal,
} from "../evaluation-input/policyEvaluationInput.js";
import * as policy from "../policy/index.js";
import * as contract from "../policy-runtime-contract/index.js";
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
const REQUESTED_AT = "2026-07-29T09:59:00.000Z";
const STARTED_AT = "2026-07-29T10:00:00.000Z";
const FIRST_RESULT_AT = "2026-07-29T10:00:00.400Z";
const SECOND_RESULT_AT = "2026-07-29T10:00:00.800Z";
const COMPLETED_AT = "2026-07-29T10:00:01.000Z";

function policyIdentity(version = "runtime-policy-version-1") {
  return {
    policySetId: must(
      policy.createOrganizationVerificationPolicySetId(
        "runtime-policy-set-1",
      ),
    ),
    policySetVersion: must(
      policy.createOrganizationVerificationPolicySetVersion(version),
    ),
    provenanceReference: must(
      policy.createOrganizationVerificationPolicyProvenanceReference(
        "runtime-policy-provenance-1",
      ),
    ),
    integrityReference: must(
      policy.createOrganizationVerificationPolicySetIntegrityReference(
        "runtime-policy-integrity-1",
      ),
    ),
  };
}

function ruleIdentity(id: string, version = "rule-version-1") {
  return {
    ruleId: must(policy.createOrganizationVerificationRuleId(id)),
    ruleVersion: must(
      policy.createOrganizationVerificationRuleVersion(version),
    ),
  };
}

function makePolicySet(version = "runtime-policy-version-1") {
  const identity = policyIdentity(version);
  return must(
    policy.createOrganizationVerificationPolicySet({
      ...identity,
      policyContractVersion: policy.POLICY_CONTRACT_VERSION,
      name: "Synthetic runtime policy",
      effectiveFrom: "2026-07-29T00:00:00.000Z",
      rules: [
        {
          ...ruleIdentity("runtime-rule-revision"),
          required: true,
          evaluationOrder: 2,
        },
        {
          ...ruleIdentity("runtime-rule-satisfied"),
          required: true,
          evaluationOrder: 1,
        },
      ],
      evaluationContractVersion:
        policy.POLICY_EVALUATION_CONTRACT_VERSION,
      status: "active",
    }),
  );
}

function makeRule(
  ruleId: string,
  evaluationOrder: number,
  disposition: "satisfied" | "revision_required",
) {
  const identity = policyIdentity();
  return must(
    policy.createOrganizationVerificationRule({
      ...identity,
      ...ruleIdentity(ruleId),
      ruleContractVersion: policy.RULE_CONTRACT_VERSION,
      title: `Synthetic ${ruleId}`,
      normalizedCategory: "organization_verification.synthetic",
      severity: disposition === "satisfied" ? "low" : "medium",
      evaluationDisposition: disposition,
      reasonCode: `organization_verification.synthetic.${ruleId.replaceAll(
        "-",
        "_",
      )}`,
      required: true,
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
    makeRule("runtime-rule-satisfied", 1, "satisfied"),
    makeRule("runtime-rule-revision", 2, "revision_required"),
  ] as const;
}

function makeImplementation(
  ruleId: string,
  disposition: "satisfied" | "revision_required",
  onEvaluate?: () => void,
) {
  const parsedDisposition = must(
    policy.parseOrganizationVerificationFindingDisposition(disposition),
  );
  return must(
    contract.createOrganizationVerificationRuleImplementation({
      ...ruleIdentity(ruleId),
      policySetId: policyIdentity().policySetId,
      policySetVersion: policyIdentity().policySetVersion,
      implementationContractVersion:
        contract.ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_CONTRACT_VERSION,
      implementationVersion: must(
        contract.createOrganizationVerificationRuleImplementationVersion(
          "runtime-implementation-version-1",
        ),
      ),
      implementationDigest: must(
        contract.createOrganizationVerificationRuleImplementationDigest(
          DIGEST_A,
        ),
      ),
      provenanceReference: must(
        contract.createOrganizationVerificationRuleImplementationProvenanceReference(
          `${ruleId}-implementation-provenance`,
        ),
      ),
      integrityReference: must(
        contract.createOrganizationVerificationRuleImplementationIntegrityReference(
          `${ruleId}-implementation-integrity`,
        ),
      ),
      evaluate: () => {
        onEvaluate?.();
        return parsedDisposition;
      },
    }),
  );
}

function makeImplementationSet(
  implementations = [
    makeImplementation("runtime-rule-revision", "revision_required"),
    makeImplementation("runtime-rule-satisfied", "satisfied"),
  ],
) {
  return must(
    contract.createOrganizationVerificationRuleImplementationSet({
      implementationSetId: must(
        contract.createOrganizationVerificationRuleImplementationSetId(
          "runtime-implementation-set-1",
        ),
      ),
      implementationSetVersion: must(
        contract.createOrganizationVerificationRuleImplementationSetVersion(
          "runtime-implementation-set-version-1",
        ),
      ),
      implementationSetContractVersion:
        contract.ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_SET_CONTRACT_VERSION,
      policySet: makePolicySet(),
      rules: makeRules(),
      implementations,
      provenanceReference: must(
        contract.createOrganizationVerificationRuleImplementationProvenanceReference(
          "runtime-set-provenance",
        ),
      ),
      integrityReference: must(
        contract.createOrganizationVerificationRuleImplementationIntegrityReference(
          "runtime-set-integrity",
        ),
      ),
    }),
  );
}

function makeEvaluationInput(
  options: Readonly<{
    policyVersion?: string;
    requestedAt?: string;
    legalName?: string;
  }> = {},
) {
  const identity = policyIdentity(
    options.policyVersion ?? "runtime-policy-version-1",
  );
  return createOrganizationVerificationPolicyEvaluationInputInternal({
    policyEvaluationInputId: must(
      evaluationInput.createOrganizationVerificationPolicyEvaluationInputId(
        "runtime-input-1",
      ),
    ),
    policyEvaluationInputVersion: must(
      evaluationInput.createOrganizationVerificationPolicyEvaluationInputVersion(
        "runtime-input-version-1",
      ),
    ),
    inputContractVersion:
      evaluationInput.POLICY_EVALUATION_INPUT_CONTRACT_VERSION,
    inputBuilderVersion:
      evaluationInput.POLICY_EVALUATION_INPUT_BUILDER_VERSION,
    projectionBinding: Object.freeze({
      evaluationProjectionId: "runtime-projection-1" as never,
      evaluationProjectionVersion: "runtime-projection-version-1" as never,
      projectionContractVersion:
        "organization_verification.evaluation_projection.v1" as never,
      projectionSchemaVersion:
        "organization_verification.evaluation_projection_schema.v1" as never,
      projectionFingerprint: DIGEST_A as never,
      sourceSnapshotId: "runtime-snapshot-1" as never,
      sourceSnapshotFingerprint: DIGEST_B as never,
      organizationId: "runtime-organization-1" as never,
      recordId: "runtime-record-1" as never,
      revisionId: "runtime-revision-1" as never,
      profileRevisionId: "runtime-profile-revision-1" as never,
      attemptId: "runtime-attempt-1" as never,
    }),
    policySetBinding: Object.freeze({
      ...identity,
      policyContractVersion: policy.POLICY_CONTRACT_VERSION,
    }),
    evaluationContext: Object.freeze({
      contextContractVersion:
        evaluationInput.EVALUATION_CONTEXT_CONTRACT_VERSION,
      requestedAt: options.requestedAt ?? REQUESTED_AT,
      effectiveAt: options.requestedAt ?? REQUESTED_AT,
      executionReference: must(
        evaluationInput.createOrganizationVerificationEvaluationExecutionReference(
          "runtime-input-execution-reference",
        ),
      ),
      attemptId: "runtime-attempt-1" as never,
      organizationId: "runtime-organization-1" as never,
      recordId: "runtime-record-1" as never,
      revisionId: "runtime-revision-1" as never,
      profileRevisionId: "runtime-profile-revision-1" as never,
      evaluationProjectionId: "runtime-projection-1" as never,
      evaluationProjectionFingerprint: DIGEST_A as never,
      sourceSnapshotId: "runtime-snapshot-1" as never,
      sourceSnapshotFingerprint: DIGEST_B as never,
      provenanceReference: must(
        evaluationInput.createOrganizationVerificationEvaluationProvenanceReference(
          "runtime-input-provenance",
        ),
      ),
      correlationReference: must(
        evaluationInput.createOrganizationVerificationEvaluationCorrelationReference(
          "runtime-correlation-1",
        ),
      ),
      integrityReference: must(
        evaluationInput.createOrganizationVerificationEvaluationIntegrityReference(
          "runtime-input-integrity",
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
          "runtime-scope-provenance",
        ),
      ),
      integrityReference: must(
        evaluationInput.createOrganizationVerificationEvaluationIntegrityReference(
          "runtime-scope-integrity",
        ),
      ),
    }),
    factSurface: Object.freeze({
      registryFacts: Object.freeze({
        profileRevisionSequence: 1 as never,
        profileFingerprint: "runtime-profile-fingerprint" as never,
        legalIdentity: Object.freeze({
          legalName: options.legalName ?? "Synthetic Runtime Entity",
          tradingNames: Object.freeze(["Synthetic Runtime Trading"]),
          registrationJurisdiction: "ZZ",
          registrationIdentifiers: Object.freeze([
            Object.freeze({ scheme: "synthetic", value: "RUN-1" }),
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
          evidenceReferenceId: "runtime-evidence-1" as never,
          evidenceReferenceVersion: "runtime-evidence-version-1" as never,
          revisionEvidenceReferenceId:
            "runtime-revision-evidence-1" as never,
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
    createdAt: REQUESTED_AT,
    inputFingerprint: createPolicyEvaluationInputFingerprintInternal(DIGEST_A),
  });
}

function artifactReferences() {
  return {
    provenanceReference: must(
      contract.createOrganizationVerificationExecutionArtifactProvenanceReference(
        "runtime-artifact-provenance",
      ),
    ),
    integrityReference: must(
      contract.createOrganizationVerificationExecutionArtifactIntegrityReference(
        "runtime-artifact-integrity",
      ),
    ),
  };
}

function makeExecutionArtifacts(
  input = makeEvaluationInput(),
  implementationSet = makeImplementationSet(),
  options: Readonly<{
    executionId?: string;
    startedAt?: string;
    completedAt?: string;
    reverseFindings?: boolean;
    reverseResults?: boolean;
    omitRevisionFinding?: boolean;
  }> = {},
) {
  const references = artifactReferences();
  const results = implementationSet.bindings.map((binding, index) => ({
    ruleId: binding.rule.ruleId,
    ruleVersion: binding.rule.ruleVersion,
    ruleResultId: must(
      contract.createOrganizationVerificationRuleResultId(
        `runtime-rule-result-${index + 1}`,
      ),
    ),
    evaluatedAt: index === 0 ? FIRST_RESULT_AT : SECOND_RESULT_AT,
    ...references,
  }));
  const findings = implementationSet.bindings
    .filter(
      (binding) =>
        !options.omitRevisionFinding ||
        binding.rule.ruleId !== "runtime-rule-revision",
    )
    .map((binding, index) => ({
      ruleId: binding.rule.ruleId,
      ruleVersion: binding.rule.ruleVersion,
      findingId: must(
        policy.createOrganizationVerificationFindingId(
          `runtime-finding-${index + 1}`,
        ),
      ),
      recordedAt: index === 0 ? FIRST_RESULT_AT : SECOND_RESULT_AT,
      ...references,
    }));
  const result = contract.createOrganizationVerificationExecutionArtifacts({
    executionArtifactsContractVersion:
      contract.ORGANIZATION_VERIFICATION_EXECUTION_ARTIFACTS_CONTRACT_VERSION,
    evaluationInput: input,
    implementationSet,
    executionId: must(
      contract.createOrganizationVerificationExecutionId(
        options.executionId ?? "runtime-execution-1",
      ),
    ),
    startedAt: options.startedAt ?? STARTED_AT,
    completedAt: options.completedAt ?? COMPLETED_AT,
    ...references,
    ruleResults: options.reverseResults ? [...results].reverse() : results,
    findings: options.reverseFindings ? [...findings].reverse() : findings,
    completion: {
      completionId: must(
        policy.createOrganizationVerificationPolicyEvaluationCompletionId(
          "runtime-completion-1",
        ),
      ),
      completedAt: options.completedAt ?? COMPLETED_AT,
      ...references,
    },
  });
  return must(result);
}

function makeExecutionInput(
  options: Readonly<{
    evaluationInput?: ReturnType<typeof makeEvaluationInput>;
    policySet?: ReturnType<typeof makePolicySet>;
    implementationSet?: ReturnType<typeof makeImplementationSet>;
    executionArtifacts?: ReturnType<typeof makeExecutionArtifacts>;
  }> = {},
): runtime.ExecuteOrganizationVerificationPolicyEvaluationInput {
  const input = options.evaluationInput ?? makeEvaluationInput();
  const implementationSet =
    options.implementationSet ?? makeImplementationSet();
  return {
    evaluationInput: input,
    policySet: options.policySet ?? makePolicySet(),
    implementationSet,
    executionArtifacts:
      options.executionArtifacts ??
      makeExecutionArtifacts(input, implementationSet),
  };
}

test("executes a successful synthetic multi-Rule Policy", () => {
  const result = runtime.executeOrganizationVerificationPolicyEvaluation(
    makeExecutionInput(),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.ruleExecutions.length, 2);
  assert.equal(result.value.findings.length, 2);
  assert.equal(
    result.value.completion.classification,
    "revision_required",
  );
});

test("executes every bound Rule exactly once in deterministic order", () => {
  const calls: string[] = [];
  const implementationSet = makeImplementationSet([
    makeImplementation("runtime-rule-revision", "revision_required", () =>
      calls.push("runtime-rule-revision"),
    ),
    makeImplementation("runtime-rule-satisfied", "satisfied", () =>
      calls.push("runtime-rule-satisfied"),
    ),
  ]);
  const result = runtime.executeOrganizationVerificationPolicyEvaluation(
    makeExecutionInput({ implementationSet }),
  );
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    "runtime-rule-satisfied",
    "runtime-rule-revision",
  ]);
});

test("caller Rule, Result, and Finding order does not alter execution", () => {
  const input = makeEvaluationInput();
  const implementationSet = makeImplementationSet([
    makeImplementation("runtime-rule-satisfied", "satisfied"),
    makeImplementation("runtime-rule-revision", "revision_required"),
  ]);
  const canonical = runtime.executeOrganizationVerificationPolicyEvaluation({
    evaluationInput: input,
    policySet: makePolicySet(),
    implementationSet,
    executionArtifacts: makeExecutionArtifacts(input, implementationSet),
  });
  const reversed = runtime.executeOrganizationVerificationPolicyEvaluation({
    evaluationInput: input,
    policySet: makePolicySet(),
    implementationSet,
    executionArtifacts: makeExecutionArtifacts(input, implementationSet, {
      reverseFindings: true,
      reverseResults: true,
    }),
  });
  assert.equal(canonical.ok, true);
  assert.equal(reversed.ok, true);
  if (!canonical.ok || !reversed.ok) return;
  assert.equal(
    canonical.value.executionFingerprint,
    reversed.value.executionFingerprint,
  );
  assert.deepEqual(canonical.value.ruleExecutions, reversed.value.ruleExecutions);
  assert.deepEqual(canonical.value.findings, reversed.value.findings);
});

test("preserves exact Rule ID and version bindings", () => {
  const execution = must(
    runtime.executeOrganizationVerificationPolicyEvaluation(
      makeExecutionInput(),
    ),
  );
  assert.deepEqual(
    execution.ruleExecutions.map((entry) => [
      entry.result.ruleId,
      entry.result.ruleVersion,
    ]),
    [
      ["runtime-rule-satisfied", "rule-version-1"],
      ["runtime-rule-revision", "rule-version-1"],
    ],
  );
});

test("missing, extra, duplicate, and version-mismatched implementations fail closed", () => {
  const base = [
    makeImplementation("runtime-rule-satisfied", "satisfied"),
    makeImplementation("runtime-rule-revision", "revision_required"),
  ];
  const createSet = (
    implementations: readonly contract.OrganizationVerificationRuleImplementation[],
  ) =>
    contract.createOrganizationVerificationRuleImplementationSet({
      implementationSetId: must(
        contract.createOrganizationVerificationRuleImplementationSetId(
          "runtime-validation-set",
        ),
      ),
      implementationSetVersion: must(
        contract.createOrganizationVerificationRuleImplementationSetVersion(
          "runtime-validation-set-version",
        ),
      ),
      implementationSetContractVersion:
        contract.ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_SET_CONTRACT_VERSION,
      policySet: makePolicySet(),
      rules: makeRules(),
      implementations,
      provenanceReference: must(
        contract.createOrganizationVerificationRuleImplementationProvenanceReference(
          "runtime-validation-provenance",
        ),
      ),
      integrityReference: must(
        contract.createOrganizationVerificationRuleImplementationIntegrityReference(
          "runtime-validation-integrity",
        ),
      ),
    });
  assert.equal(createSet([base[0]!]).ok, false);
  assert.equal(
    createSet([
      ...base,
      makeImplementation("runtime-rule-extra", "satisfied"),
    ]).ok,
    false,
  );
  assert.equal(createSet([base[0]!, base[0]!, base[1]!]).ok, false);
  const wrongVersion = {
    ...base[0],
    ruleVersion: must(
      policy.createOrganizationVerificationRuleVersion("rule-version-2"),
    ),
  };
  assert.equal(createSet([wrongVersion as never, base[1]!]).ok, false);
});

test("rejects an authentic but mismatched Policy Set", () => {
  const result = runtime.executeOrganizationVerificationPolicyEvaluation(
    makeExecutionInput({ policySet: makePolicySet("wrong-policy-version") }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "evaluation_input_policy_mismatch");
  }
});

test("rejects fake Evaluation Input, Policy Set, Implementation Set, and Artifacts", () => {
  const valid = makeExecutionInput();
  const cases = [
    {
      ...valid,
      evaluationInput: { ...valid.evaluationInput } as never,
      expected: "unauthentic_evaluation_input",
    },
    {
      ...valid,
      policySet: { ...valid.policySet } as never,
      expected: "unauthentic_policy_set",
    },
    {
      ...valid,
      implementationSet: { ...valid.implementationSet } as never,
      expected: "unauthentic_rule_implementation_set",
    },
    {
      ...valid,
      executionArtifacts: { ...valid.executionArtifacts } as never,
      expected: "unauthentic_execution_artifacts",
    },
  ];
  for (const candidate of cases) {
    const result = runtime.executeOrganizationVerificationPolicyEvaluation(
      candidate,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, candidate.expected);
  }
});

test("validates exact Execution Artifact binding", () => {
  const valid = makeExecutionInput();
  const otherInput = makeEvaluationInput();
  const conflicting = createOrganizationVerificationPolicyEvaluationInputInternalForConflict(
    otherInput,
  );
  const result = runtime.executeOrganizationVerificationPolicyEvaluation({
    ...valid,
    evaluationInput: conflicting,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "execution_artifacts_mismatch");
});

function createOrganizationVerificationPolicyEvaluationInputInternalForConflict(
  source: ReturnType<typeof makeEvaluationInput>,
) {
  return createOrganizationVerificationPolicyEvaluationInputInternal({
    ...source,
    policyEvaluationInputId: must(
      evaluationInput.createOrganizationVerificationPolicyEvaluationInputId(
        "runtime-input-conflict",
      ),
    ),
  });
}

test("rejects execution chronology before invoking a Rule", () => {
  let calls = 0;
  const implementationSet = makeImplementationSet([
    makeImplementation("runtime-rule-satisfied", "satisfied", () => {
      calls += 1;
    }),
    makeImplementation("runtime-rule-revision", "revision_required", () => {
      calls += 1;
    }),
  ]);
  const input = makeEvaluationInput({
    requestedAt: "2026-07-29T10:00:00.500Z",
  });
  const artifacts = makeExecutionArtifacts(input, implementationSet);
  const result = runtime.executeOrganizationVerificationPolicyEvaluation({
    evaluationInput: input,
    policySet: makePolicySet(),
    implementationSet,
    executionArtifacts: artifacts,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "invalid_execution_chronology");
  assert.equal(calls, 0);
});

test("keeps thrown Rule failures separate from Findings", () => {
  const failing = makeImplementation("runtime-rule-satisfied", "satisfied");
  const throwing = must(
    contract.createOrganizationVerificationRuleImplementation({
      ...failing,
      evaluate: () => {
        throw new Error("synthetic failure");
      },
    }),
  );
  const implementationSet = makeImplementationSet([
    throwing,
    makeImplementation("runtime-rule-revision", "revision_required"),
  ]);
  const result = runtime.executeOrganizationVerificationPolicyEvaluation(
    makeExecutionInput({ implementationSet }),
  );
  assert.deepEqual(result, {
    ok: false,
    code: "rule_execution_failure",
    path: "rules.0",
  });
  assert.equal("findings" in result, false);
});

test("keeps invalid Rule dispositions separate from Findings", () => {
  const implementation = makeImplementation(
    "runtime-rule-satisfied",
    "revision_required",
  );
  const implementationSet = makeImplementationSet([
    implementation,
    makeImplementation("runtime-rule-revision", "revision_required"),
  ]);
  const result = runtime.executeOrganizationVerificationPolicyEvaluation(
    makeExecutionInput({ implementationSet }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "rule_execution_contract_failure");
  }
  assert.equal("findings" in result, false);
});

test("creates Findings only through frozen Policy authority", () => {
  const execution = must(
    runtime.executeOrganizationVerificationPolicyEvaluation(
      makeExecutionInput(),
    ),
  );
  assert.equal(execution.findings.length, 2);
  assert.deepEqual(
    execution.findings.map((finding) => finding.findingId),
    ["runtime-finding-1", "runtime-finding-2"],
  );
  assert.equal(Object.isFrozen(execution.findings[0]), true);
});

test("creates immutable Rule Evaluation Results with explicit IDs", () => {
  const execution = must(
    runtime.executeOrganizationVerificationPolicyEvaluation(
      makeExecutionInput(),
    ),
  );
  assert.deepEqual(
    execution.ruleExecutions.map((entry) => entry.ruleResultId),
    ["runtime-rule-result-1", "runtime-rule-result-2"],
  );
  assert.equal(Object.isFrozen(execution.ruleExecutions[0]?.result), true);
});

test("creates Policy Evaluation Completion through frozen aggregation", () => {
  const execution = must(
    runtime.executeOrganizationVerificationPolicyEvaluation(
      makeExecutionInput(),
    ),
  );
  assert.equal(
    execution.completion.evaluationCompletionId,
    "runtime-completion-1",
  );
  assert.equal(execution.completion.findingSummary.findingCount, 2);
  assert.equal(execution.completion.ruleResults.length, 2);
  assert.equal(Object.isFrozen(execution.completion), true);
});

test("preserves frozen aggregation precedence unchanged", () => {
  const execution = must(
    runtime.executeOrganizationVerificationPolicyEvaluation(
      makeExecutionInput(),
    ),
  );
  assert.equal(execution.completion.classification, "revision_required");
  assert.equal(execution.ruleExecutions[0]?.result.disposition, "satisfied");
  assert.equal(
    execution.ruleExecutions[1]?.result.disposition,
    "revision_required",
  );
});

test("fails closed when an authority disposition lacks its required Finding", () => {
  const input = makeEvaluationInput();
  const implementationSet = makeImplementationSet();
  const executionArtifacts = makeExecutionArtifacts(input, implementationSet, {
    omitRevisionFinding: true,
  });
  const result = runtime.executeOrganizationVerificationPolicyEvaluation({
    evaluationInput: input,
    policySet: makePolicySet(),
    implementationSet,
    executionArtifacts,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "rule_result_construction_failure");
    assert.equal(result.cause, "contradictory_finding_disposition");
  }
});

test("orders Rule Results and Findings canonically", () => {
  const input = makeEvaluationInput();
  const implementationSet = makeImplementationSet();
  const execution = must(
    runtime.executeOrganizationVerificationPolicyEvaluation({
      evaluationInput: input,
      policySet: makePolicySet(),
      implementationSet,
      executionArtifacts: makeExecutionArtifacts(input, implementationSet, {
        reverseFindings: true,
        reverseResults: true,
      }),
    }),
  );
  assert.deepEqual(
    execution.ruleExecutions.map((entry) => entry.result.ruleId),
    ["runtime-rule-satisfied", "runtime-rule-revision"],
  );
  assert.deepEqual(
    execution.findings.map((finding) => finding.ruleId),
    ["runtime-rule-satisfied", "runtime-rule-revision"],
  );
});

test("produces a deterministic canonical execution fingerprint", () => {
  const first = must(
    runtime.executeOrganizationVerificationPolicyEvaluation(
      makeExecutionInput(),
    ),
  );
  const second = must(
    runtime.executeOrganizationVerificationPolicyEvaluation(
      makeExecutionInput(),
    ),
  );
  assert.equal(first.executionFingerprint, second.executionFingerprint);
  assert.match(first.executionFingerprint, /^[a-f0-9]{64}$/);
});

test("a semantic execution change alters the fingerprint", () => {
  const first = must(
    runtime.executeOrganizationVerificationPolicyEvaluation(
      makeExecutionInput(),
    ),
  );
  const input = makeEvaluationInput();
  const implementationSet = makeImplementationSet();
  const second = must(
    runtime.executeOrganizationVerificationPolicyEvaluation({
      evaluationInput: input,
      policySet: makePolicySet(),
      implementationSet,
      executionArtifacts: makeExecutionArtifacts(input, implementationSet, {
        executionId: "runtime-execution-2",
      }),
    }),
  );
  assert.notEqual(first.executionFingerprint, second.executionFingerprint);
});

test("rejects an expected execution fingerprint mismatch", () => {
  const result = runtime.executeOrganizationVerificationPolicyEvaluation({
    ...makeExecutionInput(),
    expectedExecutionFingerprint: must(
      runtime.createOrganizationVerificationPolicyRuntimeExecutionFingerprint(
        DIGEST_B,
      ),
    ),
  });
  assert.deepEqual(result, {
    ok: false,
    code: "execution_fingerprint_mismatch",
  });
});

test("the execution output is deeply immutable", () => {
  const execution = must(
    runtime.executeOrganizationVerificationPolicyEvaluation(
      makeExecutionInput(),
    ),
  );
  assert.equal(Object.isFrozen(execution), true);
  assert.equal(Object.isFrozen(execution.ruleExecutions), true);
  assert.equal(Object.isFrozen(execution.ruleExecutions[0]), true);
  assert.equal(Object.isFrozen(execution.findings), true);
  assert.equal(Object.isFrozen(execution.completion.ruleResults), true);
});

test("caller collection mutation cannot alter an Execution", () => {
  const implementations = [
    makeImplementation("runtime-rule-revision", "revision_required"),
    makeImplementation("runtime-rule-satisfied", "satisfied"),
  ];
  const implementationSet = makeImplementationSet(implementations);
  implementations.reverse();
  const execution = must(
    runtime.executeOrganizationVerificationPolicyEvaluation(
      makeExecutionInput({ implementationSet }),
    ),
  );
  assert.deepEqual(
    execution.ruleExecutions.map((entry) => entry.result.ruleId),
    ["runtime-rule-satisfied", "runtime-rule-revision"],
  );
});

test("object spread cannot impersonate an Execution", () => {
  const execution = must(
    runtime.executeOrganizationVerificationPolicyEvaluation(
      makeExecutionInput(),
    ),
  );
  assert.equal(
    runtime.isOrganizationVerificationPolicyEvaluationExecution(execution),
    true,
  );
  assert.equal(
    runtime.isOrganizationVerificationPolicyEvaluationExecution({
      ...execution,
    }),
    false,
  );
});

test("does not mutate any supplied input contract", () => {
  const executionInput = makeExecutionInput();
  const before = JSON.stringify(executionInput);
  const result = runtime.executeOrganizationVerificationPolicyEvaluation(
    executionInput,
  );
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(executionInput), before);
});

test("emits no Decision, Trust, Workflow, or Attempt transition", () => {
  const execution = must(
    runtime.executeOrganizationVerificationPolicyEvaluation(
      makeExecutionInput(),
    ),
  );
  const serialized = JSON.stringify(execution);
  for (const forbidden of [
    "decision",
    "trustStatus",
    "eligibility",
    "workflow",
    "attemptProcessState",
    "transitionAttempt",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("public exports exclude seals, constructors, canonicalization, and infrastructure", () => {
  const publicNames = Object.keys(runtime);
  assert.deepEqual(publicNames.sort(), [
    "ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTION_CONTRACT_VERSION",
    "ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTOR_VERSION",
    "createOrganizationVerificationPolicyRuntimeExecutionFingerprint",
    "executeOrganizationVerificationPolicyEvaluation",
    "isOrganizationVerificationPolicyEvaluationExecution",
  ]);
  for (const forbidden of [
    "policyRuntimeExecutionSeal",
    "createOrganizationVerificationPolicyEvaluationExecutionInternal",
    "fingerprintPolicyRuntimeExecutionInternal",
    "adaptAuthenticatedEvaluationInputToFrozenPolicyInput",
    "policyRuntimeFailure",
    "policyRuntimeSuccess",
  ]) {
    assert.equal(publicNames.includes(forbidden), false);
  }
});
