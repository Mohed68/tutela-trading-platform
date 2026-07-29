import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrganizationId,
  createOrganizationProfileFingerprint,
  createOrganizationProfileRevisionId,
  createOrganizationProfileRevisionSequence,
  parseActorAuthorityReference,
} from "../../../organization-registry/index.js";
import {
  attachDraftToRecord,
  createAttemptForRevision,
  createCompletionReference,
  createCorrelationId,
  createDraftForRecord,
  createDraftVersion,
  createOrganizationEvidenceReferenceId,
  createOrganizationVerificationAttemptId,
  createOrganizationVerificationDraftId,
  createOrganizationVerificationRecord,
  createOrganizationVerificationRecordId,
  createOrganizationVerificationRevisionId,
  createSnapshotFingerprint,
  createSnapshotId,
  createSubmissionIdempotencyKey,
  createVerificationAttemptSequence,
  createVerificationRevisionSequence,
  submitDraftToRevision,
  transitionAttemptProcess,
  type CoreDomainResult,
} from "../index.js";
import {
  createDecisionEngineVersion,
  createDecisionIntegrityReference,
  createOrganizationVerificationDecisionId,
  type DecisionDomainResult,
} from "../decision/index.js";
import * as bindingContract from "../decision-trust-integration-contract/index.js";
import * as evaluationInput from "../evaluation-input/index.js";
import { createPolicyEvaluationInputFingerprintInternal } from "../evaluation-input/ids.js";
import * as policy from "../policy/index.js";
import {
  createOrganizationVerificationPolicyEvaluationCompletionInternal,
  policyEvaluationClassification,
} from "../policy/policyEvaluationCompletion.js";
import * as runtimeContract from "../policy-runtime-contract/index.js";
import * as policyRuntime from "../policy-runtime/index.js";
import { createOrganizationVerificationPolicyEvaluationExecutionInternal } from "../policy-runtime/policyEvaluationExecution.js";
import {
  createDecisionApplicability,
  createDecisionApplicabilityId,
  createTrustStatusIntegrityReference,
  createTrustStatusProjectionId,
  createTrustStatusProvenanceReference,
  DECISION_APPLICABILITY_VERSION,
  TRUST_STATUS_DERIVER_VERSION,
  TRUST_STATUS_SOURCE_FACTS_VERSION,
  type TrustStatusDomainResult,
} from "../trust-status/index.js";
import * as integration from "./index.js";

type Result<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code: string }>;

function must<T>(result: Result<T>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function coreValue<T>(result: CoreDomainResult<T>): T {
  return must(result);
}

function decisionValue<T>(result: DecisionDomainResult<T>): T {
  return must(result);
}

function trustValue<T>(result: TrustStatusDomainResult<T>): T {
  return must(result);
}

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);
const COMPLETION_ID = "integration-completion-1";
const RUNTIME_COMPLETED_AT = "2026-08-20T10:01:00.000Z";
const EXECUTION_STARTED_AT = "2026-08-20T10:02:00.000Z";
const INPUT_BOUND_AT = "2026-08-20T10:02:00.000Z";
const DECIDED_AT = "2026-08-20T10:03:00.000Z";
const DECISION_BOUND_AT = "2026-08-20T10:04:00.000Z";
const APPLICABILITY_AT = "2026-08-20T10:05:00.000Z";
const DERIVATION_AT = "2026-08-20T10:06:00.000Z";
const TRUST_BOUND_AT = "2026-08-20T10:07:00.000Z";
const EXECUTION_COMPLETED_AT = "2026-08-20T10:08:00.000Z";

function makeCoreChain() {
  const organizationId = must(createOrganizationId("integration-org-1"));
  const profileRevisionId = must(
    createOrganizationProfileRevisionId("integration-profile-revision-1"),
  );
  const profileRevisionSequence = must(
    createOrganizationProfileRevisionSequence(1),
  );
  const profileFingerprint = must(
    createOrganizationProfileFingerprint(
      "integration-profile-fingerprint-1",
    ),
  );
  const authority = must(
    parseActorAuthorityReference({
      actor_id: "integration-actor-1",
      authority_reference_id: "integration-authority-1",
      authority_version: "authority.v1",
      organization_scope: organizationId,
      issued_at: "2026-08-20T08:00:00.000Z",
      delegated_scopes: ["verification.submit"],
    }),
  );
  const initialRecord = coreValue(
    createOrganizationVerificationRecord({
      recordId: coreValue(
        createOrganizationVerificationRecordId("integration-record-1"),
      ),
      organizationId,
      createdAt: "2026-08-20T08:00:00.000Z",
    }),
  );
  const draft = coreValue(
    createDraftForRecord(initialRecord, {
      draftId: coreValue(
        createOrganizationVerificationDraftId("integration-draft-1"),
      ),
      organizationId,
      profileRevisionId,
      profileRevisionSequence,
      profileFingerprint,
      declaredInputs: {
        sections: [
          {
            key: "organization",
            values: [{ key: "name", value: "Integration" }],
          },
        ],
      },
      evidenceReferenceIds: [
        coreValue(
          createOrganizationEvidenceReferenceId("integration-evidence-1"),
        ),
      ],
      draftVersion: coreValue(createDraftVersion(1)),
      at: "2026-08-20T08:10:00.000Z",
      actorAuthorityReference: authority,
    }),
  );
  const submitted = coreValue(
    submitDraftToRevision(
      coreValue(attachDraftToRecord(initialRecord, draft)),
      draft,
      {
        draftId: draft.draftId,
        expectedDraftVersion: draft.draftVersion,
        revisionId: coreValue(
          createOrganizationVerificationRevisionId("integration-revision-1"),
        ),
        revisionSequence: coreValue(createVerificationRevisionSequence(1)),
        profileRevisionId,
        profileRevisionSequence,
        profileFingerprint,
        submissionActorAuthorityReference: authority,
        submittedAt: "2026-08-20T09:00:00.000Z",
        submissionIdempotencyKey: coreValue(
          createSubmissionIdempotencyKey("integration-submission-1"),
        ),
        correlationId: coreValue(
          createCorrelationId("integration-correlation-1"),
        ),
      },
    ),
  );
  const snapshotId = coreValue(createSnapshotId("integration-snapshot-1"));
  const snapshotFingerprint = coreValue(
    createSnapshotFingerprint("integration-snapshot-fingerprint-1"),
  );
  const created = coreValue(
    createAttemptForRevision(submitted.record, submitted.revision, {
      attemptId: coreValue(
        createOrganizationVerificationAttemptId("integration-attempt-1"),
      ),
      sequence: coreValue(createVerificationAttemptSequence(1)),
      snapshotId,
      snapshotFingerprint,
      createdAt: "2026-08-20T09:50:00.000Z",
      correlationId: coreValue(
        createCorrelationId("integration-correlation-1"),
      ),
    }),
  );
  const queued = coreValue(
    transitionAttemptProcess(created.attempt, {
      nextState: "queued",
      at: "2026-08-20T09:51:00.000Z",
    }),
  );
  const running = coreValue(
    transitionAttemptProcess(queued, {
      nextState: "running",
      at: "2026-08-20T09:52:00.000Z",
    }),
  );
  const attempt = coreValue(
    transitionAttemptProcess(running, {
      nextState: "completed",
      at: RUNTIME_COMPLETED_AT,
      completionReference: coreValue(createCompletionReference(COMPLETION_ID)),
    }),
  );
  return {
    organizationId,
    record: created.record,
    revision: submitted.revision,
    attempt,
    snapshotId,
    snapshotFingerprint,
  };
}

function makeRuntimeExecution(chain = makeCoreChain()) {
  const policySetId = must(
    policy.createOrganizationVerificationPolicySetId(
      "integration-policy-set-1",
    ),
  );
  const policySetVersion = must(
    policy.createOrganizationVerificationPolicySetVersion(
      "integration-policy-version-1",
    ),
  );
  const correlationId = coreValue(
    createCorrelationId("integration-correlation-1"),
  );
  const completion = createOrganizationVerificationPolicyEvaluationCompletionInternal(
    {
      evaluationCompletionId: must(
        policy.createOrganizationVerificationPolicyEvaluationCompletionId(
          COMPLETION_ID,
        ),
      ),
      policySetId,
      policySetVersion,
      policyContractVersion: policy.POLICY_EVALUATION_CONTRACT_VERSION,
      organizationId: chain.organizationId,
      recordId: chain.record.recordId,
      revisionId: chain.revision.revisionId,
      attemptId: chain.attempt.attemptId,
      snapshotId: chain.snapshotId,
      snapshotFingerprint: chain.snapshotFingerprint,
      ruleResults: [],
      findingSummary: {
        ruleResultCount: 0,
        findingCount: 0,
        categorySummaries: [],
      },
      evaluationStartedAt: "2026-08-20T10:00:00.000Z",
      evaluationCompletedAt: RUNTIME_COMPLETED_AT,
      completionIntegrityValid: true,
      completionComplete: true,
      classification: policyEvaluationClassification("approval_ready"),
      provenanceReference: must(
        policy.createOrganizationVerificationPolicyProvenanceReference(
          "integration-completion-provenance",
        ),
      ),
      correlationId,
      integrityReference: must(
        policy.createOrganizationVerificationPolicyEvaluationIntegrityReference(
          "integration-completion-integrity",
        ),
      ),
    },
  );
  const execution = createOrganizationVerificationPolicyEvaluationExecutionInternal(
    {
      executionId: must(
        runtimeContract.createOrganizationVerificationExecutionId(
          "integration-runtime-execution-1",
        ),
      ),
      executionContractVersion:
        policyRuntime.ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTION_CONTRACT_VERSION,
      executorVersion:
        policyRuntime.ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTOR_VERSION,
      policyEvaluationInputId: must(
        evaluationInput.createOrganizationVerificationPolicyEvaluationInputId(
          "integration-input-1",
        ),
      ),
      policyEvaluationInputVersion: must(
        evaluationInput.createOrganizationVerificationPolicyEvaluationInputVersion(
          "integration-input-version-1",
        ),
      ),
      policyEvaluationInputFingerprint:
        createPolicyEvaluationInputFingerprintInternal(DIGEST_A),
      policySetId,
      policySetVersion,
      policySetFingerprint: must(
        runtimeContract.createOrganizationVerificationPolicySetFingerprint(
          DIGEST_A,
        ),
      ),
      implementationSetId: must(
        runtimeContract.createOrganizationVerificationRuleImplementationSetId(
          "integration-implementation-set-1",
        ),
      ),
      implementationSetVersion: must(
        runtimeContract.createOrganizationVerificationRuleImplementationSetVersion(
          "integration-implementation-set-version-1",
        ),
      ),
      implementationSetFingerprint: must(
        runtimeContract.createOrganizationVerificationRuleImplementationSetFingerprint(
          DIGEST_B,
        ),
      ),
      executionArtifactsFingerprint: must(
        runtimeContract.createOrganizationVerificationExecutionArtifactsFingerprint(
          DIGEST_A,
        ),
      ),
      startedAt: "2026-08-20T10:00:00.000Z",
      completedAt: RUNTIME_COMPLETED_AT,
      provenanceReference: must(
        runtimeContract.createOrganizationVerificationExecutionArtifactProvenanceReference(
          "integration-runtime-provenance",
        ),
      ),
      integrityReference: must(
        runtimeContract.createOrganizationVerificationExecutionArtifactIntegrityReference(
          "integration-runtime-integrity",
        ),
      ),
      ruleExecutions: [],
      findings: [],
      completion,
      executionFingerprint: must(
        policyRuntime.createOrganizationVerificationPolicyRuntimeExecutionFingerprint(
          DIGEST_B,
        ),
      ),
    },
  );
  return { chain, execution };
}

function makeExecutionInput(
  fixture = makeRuntimeExecution(),
  options: Readonly<{
    inputBindingArtifacts?: Partial<bindingContract.OrganizationVerificationDecisionTrustInputBindingArtifacts>;
    decisionContext?: Record<string, unknown>;
    trustSourceFactsArtifacts?: Record<string, unknown>;
    trustDerivationContext?: Record<string, unknown>;
    bindingArtifacts?: Record<string, unknown>;
    executionArtifacts?: Record<string, unknown>;
    existingExecution?: integration.OrganizationVerificationDecisionTrustIntegrationExecution;
  }> = {},
): integration.ExecuteOrganizationVerificationDecisionTrustIntegrationInput {
  const { chain, execution } = fixture;
  const decisionId = decisionValue(
    createOrganizationVerificationDecisionId("integration-decision-1"),
  );
  const projectionId = trustValue(
    createTrustStatusProjectionId("integration-trust-projection-1"),
  );
  const inputBindingArtifacts: bindingContract.OrganizationVerificationDecisionTrustInputBindingArtifacts =
    {
      bindingId: must(
        bindingContract.createOrganizationVerificationDecisionTrustBindingId(
          "integration-binding-1",
        ),
      ),
      bindingContractVersion:
        bindingContract.ORGANIZATION_VERIFICATION_DECISION_TRUST_BINDING_CONTRACT_VERSION,
      runtimeExecutionId: execution.executionId,
      runtimeExecutionContractVersion: execution.executionContractVersion,
      runtimeExecutorVersion: execution.executorVersion,
      runtimeExecutionFingerprint: execution.executionFingerprint,
      policyEvaluationInputId: execution.policyEvaluationInputId,
      policyEvaluationInputVersion: execution.policyEvaluationInputVersion,
      policyEvaluationInputFingerprint:
        execution.policyEvaluationInputFingerprint,
      organizationId: execution.completion.organizationId,
      recordId: execution.completion.recordId,
      revisionId: execution.completion.revisionId,
      attemptId: execution.completion.attemptId,
      snapshotId: execution.completion.snapshotId,
      snapshotFingerprint: execution.completion.snapshotFingerprint,
      policySetId: execution.policySetId,
      policySetVersion: execution.policySetVersion,
      policyEvaluationCompletionId:
        execution.completion.evaluationCompletionId,
      boundAt: INPUT_BOUND_AT,
      provenanceReference: must(
        bindingContract.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
          "integration-input-binding-provenance",
        ),
      ),
      integrityReference: must(
        bindingContract.createOrganizationVerificationDecisionTrustBindingIntegrityReference(
          "integration-input-binding-integrity",
        ),
      ),
      ...options.inputBindingArtifacts,
    };
  const decisionContext = {
    decisionId,
    decisionEngineVersion: decisionValue(
      createDecisionEngineVersion("integration-decision-engine-v1"),
    ),
    decidedAt: DECIDED_AT,
    integrityReference: decisionValue(
      createDecisionIntegrityReference("integration-decision-integrity"),
    ),
    record: chain.record,
    revision: chain.revision,
    attempt: chain.attempt,
    ...options.decisionContext,
  };
  const trustSourceFactsArtifacts = {
    sourceFactsVersion: TRUST_STATUS_SOURCE_FACTS_VERSION,
    sourceFactsComplete: true,
    sourceFactsIntegrityValid: true,
    organizationId: chain.organizationId,
    recordId: chain.record.recordId,
    currentVerificationRevisionId: chain.revision.revisionId,
    authoritativeDecisionId: decisionId,
    authoritativeAttemptId: chain.attempt.attemptId,
    authoritativeSnapshotId: chain.snapshotId,
    authoritativeSnapshotFingerprint: chain.snapshotFingerprint,
    decisionApplicability: trustValue(
      createDecisionApplicability({
        applicabilityId: trustValue(
          createDecisionApplicabilityId("integration-applicability-1"),
        ),
        version: DECISION_APPLICABILITY_VERSION,
        decisionId,
        effectiveAt: APPLICABILITY_AT,
        provenanceReference: trustValue(
          createTrustStatusProvenanceReference(
            "integration-applicability-provenance",
          ),
        ),
        correlationId: execution.completion.correlationId,
        integrityReference: trustValue(
          createTrustStatusIntegrityReference(
            "integration-applicability-integrity",
          ),
        ),
        applicable: true,
        superseded: false,
        expired: false,
        invalidated: false,
      }),
    ),
    derivationAsOf: DERIVATION_AT,
    provenanceReference: trustValue(
      createTrustStatusProvenanceReference(
        "integration-source-facts-provenance",
      ),
    ),
    correlationId: execution.completion.correlationId,
    integrityReference: trustValue(
      createTrustStatusIntegrityReference(
        "integration-source-facts-integrity",
      ),
    ),
    ...options.trustSourceFactsArtifacts,
  };
  const trustDerivationContext = {
    projectionId,
    deriverVersion: TRUST_STATUS_DERIVER_VERSION,
    derivedAt: DERIVATION_AT,
    integrityReference: trustValue(
      createTrustStatusIntegrityReference(
        "integration-trust-projection-integrity",
      ),
    ),
    ...options.trustDerivationContext,
  };
  const bindingArtifacts = {
    decision: {
      decisionId,
      boundAt: DECISION_BOUND_AT,
      provenanceReference: must(
        bindingContract.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
          "integration-decision-binding-provenance",
        ),
      ),
      integrityReference: must(
        bindingContract.createOrganizationVerificationDecisionTrustBindingIntegrityReference(
          "integration-decision-binding-integrity",
        ),
      ),
    },
    trust: {
      projectionId,
      sourceDecisionId: decisionId,
      boundAt: TRUST_BOUND_AT,
      provenanceReference: must(
        bindingContract.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
          "integration-trust-binding-provenance",
        ),
      ),
      integrityReference: must(
        bindingContract.createOrganizationVerificationDecisionTrustBindingIntegrityReference(
          "integration-trust-binding-integrity",
        ),
      ),
    },
    ...options.bindingArtifacts,
  };
  const executionArtifacts = {
    executionId: must(
      integration.createOrganizationVerificationDecisionTrustIntegrationExecutionId(
        "integration-execution-1",
      ),
    ),
    executionContractVersion:
      integration.ORGANIZATION_VERIFICATION_DECISION_TRUST_INTEGRATION_EXECUTION_CONTRACT_VERSION,
    startedAt: EXECUTION_STARTED_AT,
    completedAt: EXECUTION_COMPLETED_AT,
    provenanceReference: must(
      integration.createOrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference(
        "integration-execution-provenance",
      ),
    ),
    integrityReference: must(
      integration.createOrganizationVerificationDecisionTrustIntegrationExecutionIntegrityReference(
        "integration-execution-integrity",
      ),
    ),
    ...options.executionArtifacts,
  };
  return {
    policyRuntimeExecution: execution,
    inputBindingArtifacts,
    decisionContext,
    trustSourceFactsArtifacts,
    trustDerivationContext,
    bindingArtifacts,
    executionArtifacts,
    ...(options.existingExecution
      ? { existingExecution: options.existingExecution }
      : {}),
  } as integration.ExecuteOrganizationVerificationDecisionTrustIntegrationInput;
}

function execute(
  input = makeExecutionInput(),
): integration.OrganizationVerificationDecisionTrustIntegrationExecution {
  return must(
    integration.executeOrganizationVerificationDecisionTrustIntegration(input),
  );
}

test("executes the complete authentic Runtime-to-Decision-to-Trust flow", () => {
  const input = makeExecutionInput();
  const result =
    integration.executeOrganizationVerificationDecisionTrustIntegration(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    result.value.inputBinding.runtimeExecution,
    input.policyRuntimeExecution,
  );
  assert.equal(
    String(result.value.decision.evaluationCompletionId),
    String(input.policyRuntimeExecution.completion.evaluationCompletionId),
  );
  assert.equal(result.value.decision.outcome, "approved");
  assert.equal(result.value.trustStatus.status, "trusted");
  assert.equal(
    result.value.trustStatus.sourceDecisionId,
    result.value.decision.decisionId,
  );
  assert.equal(result.value.binding.decision, result.value.decision);
  assert.equal(result.value.binding.trustStatus, result.value.trustStatus);
});

test("preserves the exact Runtime, Evaluation Input, Policy, and Completion chain", () => {
  const input = makeExecutionInput();
  const output = execute(input);
  const binding = output.inputBinding;
  assert.equal(binding.runtimeExecutionId, input.policyRuntimeExecution.executionId);
  assert.equal(
    binding.runtimeExecutionContractVersion,
    input.policyRuntimeExecution.executionContractVersion,
  );
  assert.equal(
    binding.runtimeExecutionFingerprint,
    input.policyRuntimeExecution.executionFingerprint,
  );
  assert.equal(
    binding.policyEvaluationInputId,
    input.policyRuntimeExecution.policyEvaluationInputId,
  );
  assert.equal(
    binding.policyEvaluationInputVersion,
    input.policyRuntimeExecution.policyEvaluationInputVersion,
  );
  assert.equal(
    binding.policyEvaluationInputFingerprint,
    input.policyRuntimeExecution.policyEvaluationInputFingerprint,
  );
  assert.equal(binding.policySetId, input.policyRuntimeExecution.policySetId);
  assert.equal(
    binding.policyEvaluationCompletionId,
    input.policyRuntimeExecution.completion.evaluationCompletionId,
  );
});

test("preserves Organization, Revision, Attempt, and Snapshot continuity", () => {
  const output = execute();
  assert.equal(output.decision.organizationId, output.inputBinding.organizationId);
  assert.equal(output.decision.revisionId, output.inputBinding.revisionId);
  assert.equal(output.decision.attemptId, output.inputBinding.attemptId);
  assert.equal(output.decision.snapshotId, output.inputBinding.snapshotId);
  assert.equal(
    output.decision.snapshotFingerprint,
    output.inputBinding.snapshotFingerprint,
  );
  assert.equal(output.trustStatus.sourceRevisionId, output.decision.revisionId);
  assert.equal(output.trustStatus.sourceAttemptId, output.decision.attemptId);
  assert.equal(output.trustStatus.sourceSnapshotId, output.decision.snapshotId);
});

test("obtains Completion only from Runtime execution and ignores a fake extra path", () => {
  const input = makeExecutionInput();
  const first = execute(input);
  const withFakeStandaloneCompletion = {
    ...input,
    completion: Object.freeze({ classification: "rejection_required" }),
  };
  const second = execute(withFakeStandaloneCompletion);
  assert.equal(second.decision.outcome, "approved");
  assert.equal(second.executionFingerprint, first.executionFingerprint);
  assert.equal("completion" in integration, false);
});

test("rejects fake, spread, and frozen structural Runtime executions", () => {
  const input = makeExecutionInput();
  for (const fake of [
    {},
    { ...input.policyRuntimeExecution },
    Object.freeze({ ...input.policyRuntimeExecution }),
  ]) {
    const result =
      integration.executeOrganizationVerificationDecisionTrustIntegration({
        ...input,
        policyRuntimeExecution: fake as never,
      });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "execution");
      assert.equal(result.code, "unauthentic_runtime_execution");
    }
  }
});

test("rejects every source identity and fingerprint mismatch fail-closed", () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ organizationId: "other" }, "organization_id_mismatch"],
    [{ revisionId: "other" }, "verification_revision_id_mismatch"],
    [{ attemptId: "other" }, "attempt_id_mismatch"],
    [{ snapshotId: "other" }, "snapshot_id_mismatch"],
    [{ snapshotFingerprint: "other" }, "snapshot_fingerprint_mismatch"],
    [{ policyEvaluationInputId: "other" }, "evaluation_input_mismatch"],
    [{ policyEvaluationInputVersion: "other" }, "evaluation_input_mismatch"],
    [{ policyEvaluationInputFingerprint: DIGEST_B }, "evaluation_input_mismatch"],
    [{ policySetId: "other" }, "policy_set_mismatch"],
    [{ policySetVersion: "other" }, "policy_set_mismatch"],
    [{ runtimeExecutionId: "other" }, "runtime_execution_mismatch"],
    [
      { runtimeExecutionFingerprint: `sha256:${"f".repeat(64)}` },
      "runtime_execution_mismatch",
    ],
    [{ policyEvaluationCompletionId: "other" }, "completion_mismatch"],
  ];
  for (const [override, expected] of cases) {
    const result =
      integration.executeOrganizationVerificationDecisionTrustIntegration(
        makeExecutionInput(undefined, {
          inputBindingArtifacts: override as never,
        }),
      );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "binding");
      assert.equal(result.code, expected);
    }
  }
});

test("Decision failures remain frozen Decision failures", () => {
  const result =
    integration.executeOrganizationVerificationDecisionTrustIntegration(
      makeExecutionInput(undefined, {
        decisionContext: {
          decidedAt: "not-a-timestamp",
        },
      }),
    );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stage, "decision");
    assert.equal(result.code, "invalid_decision_timestamp");
  }
});

test("fake existing Decision is rejected by the frozen Decision authority", () => {
  const result =
    integration.executeOrganizationVerificationDecisionTrustIntegration(
      makeExecutionInput(undefined, {
        decisionContext: {
          existingDecision: Object.freeze({
            decisionId: "integration-decision-1",
          }),
        },
      }),
    );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stage, "decision");
    assert.equal(result.code, "decision_context_invalid");
  }
});

test("fake existing Trust Status is rejected by the frozen Trust authority", () => {
  const result =
    integration.executeOrganizationVerificationDecisionTrustIntegration(
      makeExecutionInput(undefined, {
        trustDerivationContext: {
          existingProjection: Object.freeze({
            projectionId: "integration-trust-projection-1",
          }),
        },
      }),
    );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stage, "trust_derivation");
    assert.equal(result.code, "conflicting_trust_status_projection");
  }
});

test("Trust source-fact failures remain frozen Trust failures", () => {
  const result =
    integration.executeOrganizationVerificationDecisionTrustIntegration(
      makeExecutionInput(undefined, {
        trustSourceFactsArtifacts: { organizationId: "other" },
      }),
    );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stage, "trust_source_facts");
    assert.equal(result.code, "organization_id_mismatch");
  }
});

test("Decision and Trust artifact mismatches fail in the binding authority", () => {
  const decisionMismatch =
    integration.executeOrganizationVerificationDecisionTrustIntegration(
      makeExecutionInput(undefined, {
        bindingArtifacts: {
          decision: {
            decisionId: "other",
            boundAt: DECISION_BOUND_AT,
            provenanceReference: "binding-provenance",
            integrityReference: "binding-integrity",
          },
        },
      }),
    );
  assert.equal(decisionMismatch.ok, false);
  if (!decisionMismatch.ok) {
    assert.equal(decisionMismatch.stage, "binding");
    assert.equal(decisionMismatch.code, "decision_mismatch");
  }

  const input = makeExecutionInput();
  const trustMismatch =
    integration.executeOrganizationVerificationDecisionTrustIntegration({
      ...input,
      bindingArtifacts: {
        ...input.bindingArtifacts,
        trust: {
          ...input.bindingArtifacts.trust!,
          projectionId: "other" as never,
        },
      },
    });
  assert.equal(trustMismatch.ok, false);
  if (!trustMismatch.ok) {
    assert.equal(trustMismatch.stage, "binding");
    assert.equal(trustMismatch.code, "trust_status_mismatch");
  }
});

test("chronology conflicts fail closed without reading a clock", () => {
  for (const executionArtifacts of [
    { startedAt: "2026-08-20T09:00:00.000Z" },
    { completedAt: "2026-08-20T10:03:30.000Z" },
  ]) {
    const result =
      integration.executeOrganizationVerificationDecisionTrustIntegration(
        makeExecutionInput(undefined, { executionArtifacts }),
      );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "execution");
      assert.equal(result.code, "invalid_execution_chronology");
    }
  }
});

test("Decision, Trust, binding, and execution fingerprints are deterministic", () => {
  const first = execute();
  const second = execute();
  assert.deepEqual(first.decision, second.decision);
  assert.deepEqual(first.trustStatus, second.trustStatus);
  assert.equal(
    first.binding.completionBindingFingerprint,
    second.binding.completionBindingFingerprint,
  );
  assert.equal(
    first.binding.decisionBindingFingerprint,
    second.binding.decisionBindingFingerprint,
  );
  assert.equal(
    first.binding.trustBindingFingerprint,
    second.binding.trustBindingFingerprint,
  );
  assert.equal(first.executionFingerprint, second.executionFingerprint);
});

test("caller property order does not alter the execution fingerprint", () => {
  const input = makeExecutionInput();
  const reordered = {
    ...input,
    executionArtifacts: {
      integrityReference: input.executionArtifacts.integrityReference,
      provenanceReference: input.executionArtifacts.provenanceReference,
      completedAt: input.executionArtifacts.completedAt,
      startedAt: input.executionArtifacts.startedAt,
      executionContractVersion:
        input.executionArtifacts.executionContractVersion,
      executionId: input.executionArtifacts.executionId,
    },
  };
  assert.equal(
    execute(input).executionFingerprint,
    execute(reordered).executionFingerprint,
  );
});

test("semantic execution evidence change alters only integration evidence", () => {
  const first = execute();
  const second = execute(
    makeExecutionInput(undefined, {
      executionArtifacts: {
        provenanceReference: must(
          integration.createOrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference(
            "integration-execution-provenance-changed",
          ),
        ),
      },
    }),
  );
  assert.notEqual(first.executionFingerprint, second.executionFingerprint);
  assert.equal(first.decision.outcome, second.decision.outcome);
  assert.equal(first.trustStatus.status, second.trustStatus.status);
});

test("expected execution fingerprint mismatch fails closed", () => {
  const result =
    integration.executeOrganizationVerificationDecisionTrustIntegration(
      makeExecutionInput(undefined, {
        executionArtifacts: {
          expectedExecutionFingerprint: must(
            integration.createOrganizationVerificationDecisionTrustIntegrationExecutionFingerprint(
              `sha256:${"f".repeat(64)}`,
            ),
          ),
        },
      }),
    );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stage, "execution");
    assert.equal(result.code, "execution_fingerprint_mismatch");
  }
});

test("identical retry is idempotent and conflicting duplicate fails closed", () => {
  const first = execute();
  const retry = execute(
    makeExecutionInput(undefined, { existingExecution: first }),
  );
  assert.equal(retry, first);

  const conflict =
    integration.executeOrganizationVerificationDecisionTrustIntegration(
      makeExecutionInput(undefined, {
        executionArtifacts: {
          provenanceReference: must(
            integration.createOrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference(
              "integration-conflicting-provenance",
            ),
          ),
        },
        existingExecution: first,
      }),
    );
  assert.equal(conflict.ok, false);
  if (!conflict.ok) {
    assert.equal(conflict.stage, "execution");
    assert.equal(conflict.code, "conflicting_execution");
  }
});

test("final execution is deeply immutable, authentic, and spread-resistant", () => {
  const output = execute();
  assert.equal(
    integration.isOrganizationVerificationDecisionTrustIntegrationExecution(
      output,
    ),
    true,
  );
  assert.equal(Object.isFrozen(output), true);
  assert.equal(Object.isFrozen(output.inputBinding), true);
  assert.equal(Object.isFrozen(output.decision), true);
  assert.equal(Object.isFrozen(output.trustStatus), true);
  assert.equal(Object.isFrozen(output.binding), true);
  assert.equal(
    integration.isOrganizationVerificationDecisionTrustIntegrationExecution({
      ...output,
    }),
    false,
  );
  assert.equal(
    integration.isOrganizationVerificationDecisionTrustIntegrationExecution(
      Object.freeze({ ...output }),
    ),
    false,
  );
});

test("explicit artifact mutation cannot alter a completed execution", () => {
  const input = makeExecutionInput();
  const output = execute(input);
  const fingerprint = output.executionFingerprint;
  Object.assign(input.executionArtifacts, {
    completedAt: "2030-01-01T00:00:00.000Z",
  });
  assert.equal(output.executionFingerprint, fingerprint);
  assert.equal(output.completedAt, EXECUTION_COMPLETED_AT);
});

test("public exports are exact and exclude seals, constructors, and helpers", () => {
  assert.deepEqual(Object.keys(integration).sort(), [
    "ORGANIZATION_VERIFICATION_DECISION_TRUST_INTEGRATION_EXECUTION_CONTRACT_VERSION",
    "createOrganizationVerificationDecisionTrustIntegrationExecutionFingerprint",
    "createOrganizationVerificationDecisionTrustIntegrationExecutionId",
    "createOrganizationVerificationDecisionTrustIntegrationExecutionIntegrityReference",
    "createOrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference",
    "executeOrganizationVerificationDecisionTrustIntegration",
    "isOrganizationVerificationDecisionTrustIntegrationExecution",
  ]);
  for (const forbidden of [
    "integrationExecutionSeal",
    "createOrganizationVerificationDecisionTrustIntegrationExecutionInternal",
    "fingerprintDecisionTrustIntegrationExecutionInternal",
    "deriveTrustStatusFromAuthenticDecision",
    "integrationSuccess",
    "integrationFailure",
    "decideOrganizationVerification",
    "deriveOrganizationVerificationTrustStatus",
  ]) {
    assert.equal(forbidden in integration, false);
  }
});

test("execution output contains no Eligibility, Workflow, or permission authority", () => {
  const serialized = JSON.stringify(execute()).toLowerCase();
  for (const forbidden of [
    "eligibility",
    "workflow",
    "allowed_to_trade",
    "allowed_to_publish",
    "marketplace_access",
    "users.verified",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
