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
  decideOrganizationVerification,
  type DecisionDomainResult,
  type OrganizationVerificationDecision,
} from "../decision/index.js";
import * as evaluationInput from "../evaluation-input/index.js";
import { createPolicyEvaluationInputFingerprintInternal } from "../evaluation-input/ids.js";
import { createOrganizationVerificationPolicyEvaluationInputInternal } from "../evaluation-input/policyEvaluationInput.js";
import * as policy from "../policy/index.js";
import * as runtimeContract from "../policy-runtime-contract/index.js";
import * as runtime from "../policy-runtime/index.js";
import {
  createDecisionApplicability,
  createDecisionApplicabilityId,
  createOrganizationVerificationTrustStatusSourceFacts,
  createTrustStatusIntegrityReference,
  createTrustStatusProjectionId,
  createTrustStatusProvenanceReference,
  deriveOrganizationVerificationTrustStatus,
  DECISION_APPLICABILITY_VERSION,
  TRUST_STATUS_DERIVER_VERSION,
  TRUST_STATUS_SOURCE_FACTS_VERSION,
  type OrganizationVerificationTrustStatus,
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
const COMPLETION_ID = "binding-completion-1";
const COMPLETED_AT = "2026-08-10T10:01:00.000Z";
const INPUT_BOUND_AT = "2026-08-10T10:02:00.000Z";
const DECIDED_AT = "2026-08-10T10:03:00.000Z";
const DECISION_BOUND_AT = "2026-08-10T10:04:00.000Z";
const APPLICABILITY_AT = "2026-08-10T10:05:00.000Z";
const DERIVATION_AT = "2026-08-10T10:06:00.000Z";
const TRUST_BOUND_AT = "2026-08-10T10:07:00.000Z";

function makeCoreChain() {
  const organizationId = must(createOrganizationId("binding-org-1"));
  const profileRevisionId = must(
    createOrganizationProfileRevisionId("binding-profile-revision-1"),
  );
  const profileRevisionSequence = must(
    createOrganizationProfileRevisionSequence(1),
  );
  const profileFingerprint = must(
    createOrganizationProfileFingerprint("binding-profile-fingerprint-1"),
  );
  const authority = must(
    parseActorAuthorityReference({
      actor_id: "binding-actor-1",
      authority_reference_id: "binding-authority-1",
      authority_version: "authority.v1",
      organization_scope: organizationId,
      issued_at: "2026-08-10T08:00:00.000Z",
      delegated_scopes: ["verification.submit"],
    }),
  );
  const initialRecord = coreValue(
    createOrganizationVerificationRecord({
      recordId: coreValue(
        createOrganizationVerificationRecordId("binding-record-1"),
      ),
      organizationId,
      createdAt: "2026-08-10T08:00:00.000Z",
    }),
  );
  const draft = coreValue(
    createDraftForRecord(initialRecord, {
      draftId: coreValue(
        createOrganizationVerificationDraftId("binding-draft-1"),
      ),
      organizationId,
      profileRevisionId,
      profileRevisionSequence,
      profileFingerprint,
      declaredInputs: {
        sections: [
          { key: "organization", values: [{ key: "name", value: "Binding" }] },
        ],
      },
      evidenceReferenceIds: [
        coreValue(createOrganizationEvidenceReferenceId("binding-evidence-1")),
      ],
      draftVersion: coreValue(createDraftVersion(1)),
      at: "2026-08-10T08:10:00.000Z",
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
          createOrganizationVerificationRevisionId("binding-revision-1"),
        ),
        revisionSequence: coreValue(createVerificationRevisionSequence(1)),
        profileRevisionId,
        profileRevisionSequence,
        profileFingerprint,
        submissionActorAuthorityReference: authority,
        submittedAt: "2026-08-10T09:00:00.000Z",
        submissionIdempotencyKey: coreValue(
          createSubmissionIdempotencyKey("binding-submission-1"),
        ),
        correlationId: coreValue(createCorrelationId("binding-correlation-1")),
      },
    ),
  );
  const snapshotId = coreValue(createSnapshotId("binding-snapshot-1"));
  const snapshotFingerprint = coreValue(
    createSnapshotFingerprint("binding-snapshot-fingerprint-1"),
  );
  const created = coreValue(
    createAttemptForRevision(submitted.record, submitted.revision, {
      attemptId: coreValue(
        createOrganizationVerificationAttemptId("binding-attempt-1"),
      ),
      sequence: coreValue(createVerificationAttemptSequence(1)),
      snapshotId,
      snapshotFingerprint,
      createdAt: "2026-08-10T09:50:00.000Z",
      correlationId: coreValue(createCorrelationId("binding-correlation-1")),
    }),
  );
  const queued = coreValue(
    transitionAttemptProcess(created.attempt, {
      nextState: "queued",
      at: "2026-08-10T09:51:00.000Z",
    }),
  );
  const running = coreValue(
    transitionAttemptProcess(queued, {
      nextState: "running",
      at: "2026-08-10T09:52:00.000Z",
    }),
  );
  const attempt = coreValue(
    transitionAttemptProcess(running, {
      nextState: "completed",
      at: COMPLETED_AT,
      completionReference: coreValue(createCompletionReference(COMPLETION_ID)),
    }),
  );
  return {
    organizationId,
    profileRevisionId,
    profileRevisionSequence,
    profileFingerprint,
    record: created.record,
    revision: submitted.revision,
    attempt,
    snapshotId,
    snapshotFingerprint,
  };
}

function makePolicySet() {
  return must(
    policy.createOrganizationVerificationPolicySet({
      policySetId: must(
        policy.createOrganizationVerificationPolicySetId(
          "binding-policy-set-1",
        ),
      ),
      policySetVersion: must(
        policy.createOrganizationVerificationPolicySetVersion(
          "binding-policy-version-1",
        ),
      ),
      policyContractVersion: policy.POLICY_CONTRACT_VERSION,
      name: "Synthetic binding policy",
      effectiveFrom: "2026-08-10T00:00:00.000Z",
      rules: [
        {
          ruleId: must(
            policy.createOrganizationVerificationRuleId("binding-rule-1"),
          ),
          ruleVersion: must(
            policy.createOrganizationVerificationRuleVersion(
              "binding-rule-version-1",
            ),
          ),
          required: true,
          evaluationOrder: 1,
        },
      ],
      evaluationContractVersion:
        policy.POLICY_EVALUATION_CONTRACT_VERSION,
      status: "active",
      provenanceReference: must(
        policy.createOrganizationVerificationPolicyProvenanceReference(
          "binding-policy-provenance",
        ),
      ),
      integrityReference: must(
        policy.createOrganizationVerificationPolicySetIntegrityReference(
          "binding-policy-integrity",
        ),
      ),
    }),
  );
}

function makeRule(policySet = makePolicySet()) {
  return must(
    policy.createOrganizationVerificationRule({
      policySetId: policySet.policySetId,
      policySetVersion: policySet.policySetVersion,
      policyContractVersion: policySet.policyContractVersion,
      provenanceReference: policySet.provenanceReference,
      ruleId: policySet.rules[0]!.ruleId,
      ruleVersion: policySet.rules[0]!.ruleVersion,
      ruleContractVersion: policy.RULE_CONTRACT_VERSION,
      title: "Synthetic binding rule",
      normalizedCategory: "organization_verification.synthetic",
      severity: "low",
      evaluationDisposition: "satisfied",
      reasonCode: "organization_verification.synthetic.binding_satisfied",
      required: true,
      evaluationOrder: 1,
      integrityReference: must(
        policy.createOrganizationVerificationRuleIntegrityReference(
          "binding-rule-integrity",
        ),
      ),
    }),
  );
}

function makeRuntimeExecution(chain = makeCoreChain()) {
  const policySet = makePolicySet();
  const rule = makeRule(policySet);
  const input = createOrganizationVerificationPolicyEvaluationInputInternal({
    policyEvaluationInputId: must(
      evaluationInput.createOrganizationVerificationPolicyEvaluationInputId(
        "binding-input-1",
      ),
    ),
    policyEvaluationInputVersion: must(
      evaluationInput.createOrganizationVerificationPolicyEvaluationInputVersion(
        "binding-input-version-1",
      ),
    ),
    inputContractVersion:
      evaluationInput.POLICY_EVALUATION_INPUT_CONTRACT_VERSION,
    inputBuilderVersion:
      evaluationInput.POLICY_EVALUATION_INPUT_BUILDER_VERSION,
    projectionBinding: Object.freeze({
      evaluationProjectionId: "binding-projection-1" as never,
      evaluationProjectionVersion: "binding-projection-version-1" as never,
      projectionContractVersion:
        "organization_verification.evaluation_projection.v1" as never,
      projectionSchemaVersion:
        "organization_verification.evaluation_projection_schema.v1" as never,
      projectionFingerprint: DIGEST_A as never,
      sourceSnapshotId: chain.snapshotId,
      sourceSnapshotFingerprint: chain.snapshotFingerprint,
      organizationId: chain.organizationId,
      recordId: chain.record.recordId,
      revisionId: chain.revision.revisionId,
      profileRevisionId: chain.profileRevisionId,
      attemptId: chain.attempt.attemptId,
    }),
    policySetBinding: Object.freeze({
      policySetId: policySet.policySetId,
      policySetVersion: policySet.policySetVersion,
      policyContractVersion: policySet.policyContractVersion,
      provenanceReference: policySet.provenanceReference,
      integrityReference: policySet.integrityReference,
    }),
    evaluationContext: Object.freeze({
      contextContractVersion:
        evaluationInput.EVALUATION_CONTEXT_CONTRACT_VERSION,
      requestedAt: "2026-08-10T09:59:00.000Z",
      effectiveAt: "2026-08-10T09:59:00.000Z",
      executionReference: must(
        evaluationInput.createOrganizationVerificationEvaluationExecutionReference(
          "binding-execution-reference",
        ),
      ),
      attemptId: chain.attempt.attemptId,
      organizationId: chain.organizationId,
      recordId: chain.record.recordId,
      revisionId: chain.revision.revisionId,
      profileRevisionId: chain.profileRevisionId,
      evaluationProjectionId: "binding-projection-1" as never,
      evaluationProjectionFingerprint: DIGEST_A as never,
      sourceSnapshotId: chain.snapshotId,
      sourceSnapshotFingerprint: chain.snapshotFingerprint,
      provenanceReference: must(
        evaluationInput.createOrganizationVerificationEvaluationProvenanceReference(
          "binding-input-provenance",
        ),
      ),
      correlationReference: must(
        evaluationInput.createOrganizationVerificationEvaluationCorrelationReference(
          "binding-correlation-1",
        ),
      ),
      integrityReference: must(
        evaluationInput.createOrganizationVerificationEvaluationIntegrityReference(
          "binding-input-integrity",
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
      authorizedEvidenceCategories: Object.freeze(["legal.identity" as never]),
      authorizedDeclaredFactSections: Object.freeze(["organization"]),
      provenanceReference: must(
        evaluationInput.createOrganizationVerificationEvaluationProvenanceReference(
          "binding-scope-provenance",
        ),
      ),
      integrityReference: must(
        evaluationInput.createOrganizationVerificationEvaluationIntegrityReference(
          "binding-scope-integrity",
        ),
      ),
    }),
    factSurface: Object.freeze({
      registryFacts: Object.freeze({
        profileRevisionSequence: chain.profileRevisionSequence,
        profileFingerprint: chain.profileFingerprint,
        legalIdentity: Object.freeze({
          legalName: "Synthetic Binding Entity",
          tradingNames: Object.freeze([]),
          registrationJurisdiction: "ZZ",
          registrationIdentifiers: Object.freeze([
            Object.freeze({ scheme: "synthetic", value: "BIND-1" }),
          ]),
        }),
        organizationType: "synthetic",
        jurisdiction: "ZZ",
        declaredActivities: Object.freeze([
          Object.freeze({ code: "synthetic.binding" }),
        ]),
      }),
      submissionFacts: Object.freeze({
        revisionSequence: chain.revision.sequence,
        submittedAt: chain.revision.submittedAt,
        declaredSections: Object.freeze([
          Object.freeze({
            key: "organization",
            values: Object.freeze([
              Object.freeze({ key: "name", value: "Binding" }),
            ]),
          }),
        ]),
      }),
      evidenceFacts: Object.freeze([
        Object.freeze({
          evidenceReferenceId: "binding-evidence-input-1" as never,
          evidenceReferenceVersion: "binding-evidence-version-1" as never,
          revisionEvidenceReferenceId:
            chain.revision.evidenceReferenceIds[0]!,
          evidenceKind: "corporate.registration" as never,
          category: "legal.identity" as never,
          sourceAuthority: "customer.submission" as never,
          contentDigest: DIGEST_B as never,
          capturedAt: "2026-08-10T08:30:00.000Z",
          attributes: Object.freeze([]),
        }),
      ]),
    }),
    createdAt: "2026-08-10T09:59:00.000Z",
    inputFingerprint: createPolicyEvaluationInputFingerprintInternal(DIGEST_A),
  });
  const implementation = must(
    runtimeContract.createOrganizationVerificationRuleImplementation({
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      policySetId: rule.policySetId,
      policySetVersion: rule.policySetVersion,
      implementationContractVersion:
        runtimeContract.ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_CONTRACT_VERSION,
      implementationVersion: must(
        runtimeContract.createOrganizationVerificationRuleImplementationVersion(
          "binding-implementation-version-1",
        ),
      ),
      implementationDigest: must(
        runtimeContract.createOrganizationVerificationRuleImplementationDigest(
          DIGEST_A,
        ),
      ),
      provenanceReference: must(
        runtimeContract.createOrganizationVerificationRuleImplementationProvenanceReference(
          "binding-implementation-provenance",
        ),
      ),
      integrityReference: must(
        runtimeContract.createOrganizationVerificationRuleImplementationIntegrityReference(
          "binding-implementation-integrity",
        ),
      ),
      evaluate: () =>
        must(
          policy.parseOrganizationVerificationFindingDisposition("satisfied"),
        ),
    }),
  );
  const implementationSet = must(
    runtimeContract.createOrganizationVerificationRuleImplementationSet({
      implementationSetId: must(
        runtimeContract.createOrganizationVerificationRuleImplementationSetId(
          "binding-implementation-set-1",
        ),
      ),
      implementationSetVersion: must(
        runtimeContract.createOrganizationVerificationRuleImplementationSetVersion(
          "binding-implementation-set-version-1",
        ),
      ),
      implementationSetContractVersion:
        runtimeContract.ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_SET_CONTRACT_VERSION,
      policySet,
      rules: [rule],
      implementations: [implementation],
      provenanceReference: implementation.provenanceReference,
      integrityReference: implementation.integrityReference,
    }),
  );
  const provenanceReference = must(
    runtimeContract.createOrganizationVerificationExecutionArtifactProvenanceReference(
      "binding-runtime-provenance",
    ),
  );
  const integrityReference = must(
    runtimeContract.createOrganizationVerificationExecutionArtifactIntegrityReference(
      "binding-runtime-integrity",
    ),
  );
  const artifacts = must(
    runtimeContract.createOrganizationVerificationExecutionArtifacts({
      executionArtifactsContractVersion:
        runtimeContract.ORGANIZATION_VERIFICATION_EXECUTION_ARTIFACTS_CONTRACT_VERSION,
      evaluationInput: input,
      implementationSet,
      executionId: must(
        runtimeContract.createOrganizationVerificationExecutionId(
          "binding-runtime-execution-1",
        ),
      ),
      startedAt: "2026-08-10T10:00:00.000Z",
      completedAt: COMPLETED_AT,
      provenanceReference,
      integrityReference,
      ruleResults: [
        {
          ruleId: rule.ruleId,
          ruleVersion: rule.ruleVersion,
          ruleResultId: must(
            runtimeContract.createOrganizationVerificationRuleResultId(
              "binding-rule-result-1",
            ),
          ),
          evaluatedAt: "2026-08-10T10:00:30.000Z",
          provenanceReference,
          integrityReference,
        },
      ],
      findings: [],
      completion: {
        completionId: must(
          policy.createOrganizationVerificationPolicyEvaluationCompletionId(
            COMPLETION_ID,
          ),
        ),
        completedAt: COMPLETED_AT,
        provenanceReference,
        integrityReference,
      },
    }),
  );
  const execution = must(
    runtime.executeOrganizationVerificationPolicyEvaluation({
      evaluationInput: input,
      policySet,
      implementationSet,
      executionArtifacts: artifacts,
    }),
  );
  return { chain, execution };
}

function makeDecision(
  fixture: ReturnType<typeof makeRuntimeExecution>,
  suffix = "1",
): OrganizationVerificationDecision {
  const normalized = must(
    policy.adaptPolicyEvaluationCompletionToNormalizedEvaluation(
      fixture.execution.completion,
    ),
  );
  return decisionValue(
    decideOrganizationVerification(normalized, {
      decisionId: decisionValue(
        createOrganizationVerificationDecisionId(`binding-decision-${suffix}`),
      ),
      decisionEngineVersion: decisionValue(
        createDecisionEngineVersion("binding-decision-engine-v1"),
      ),
      decidedAt: DECIDED_AT,
      integrityReference: decisionValue(
        createDecisionIntegrityReference(`binding-decision-integrity-${suffix}`),
      ),
      record: fixture.chain.record,
      revision: fixture.chain.revision,
      attempt: fixture.chain.attempt,
    }),
  );
}

function makeTrustStatus(
  decision: OrganizationVerificationDecision,
  suffix = "1",
): OrganizationVerificationTrustStatus {
  const sourceFacts = trustValue(
    createOrganizationVerificationTrustStatusSourceFacts({
      sourceFactsVersion: TRUST_STATUS_SOURCE_FACTS_VERSION,
      sourceFactsComplete: true,
      sourceFactsIntegrityValid: true,
      organizationId: decision.organizationId,
      recordId: decision.recordId,
      currentVerificationRevisionId: decision.revisionId,
      authoritativeDecisionId: decision.decisionId,
      authoritativeAttemptId: decision.attemptId,
      authoritativeSnapshotId: decision.snapshotId,
      authoritativeSnapshotFingerprint: decision.snapshotFingerprint,
      decision,
      decisionApplicability: trustValue(
        createDecisionApplicability({
          applicabilityId: trustValue(
            createDecisionApplicabilityId(`binding-applicability-${suffix}`),
          ),
          version: DECISION_APPLICABILITY_VERSION,
          decisionId: decision.decisionId,
          effectiveAt: APPLICABILITY_AT,
          provenanceReference: trustValue(
            createTrustStatusProvenanceReference(
              `binding-applicability-provenance-${suffix}`,
            ),
          ),
          correlationId: decision.correlationId,
          integrityReference: trustValue(
            createTrustStatusIntegrityReference(
              `binding-applicability-integrity-${suffix}`,
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
          `binding-source-provenance-${suffix}`,
        ),
      ),
      correlationId: decision.correlationId,
      integrityReference: trustValue(
        createTrustStatusIntegrityReference(
          `binding-source-integrity-${suffix}`,
        ),
      ),
    }),
  );
  return trustValue(
    deriveOrganizationVerificationTrustStatus(sourceFacts, {
      projectionId: trustValue(
        createTrustStatusProjectionId(`binding-trust-${suffix}`),
      ),
      deriverVersion: TRUST_STATUS_DERIVER_VERSION,
      derivedAt: DERIVATION_AT,
      integrityReference: trustValue(
        createTrustStatusIntegrityReference(
          `binding-projection-integrity-${suffix}`,
        ),
      ),
    }),
  );
}

function makeInputArtifacts(
  execution: runtime.OrganizationVerificationPolicyEvaluationExecution,
  override: Partial<integration.OrganizationVerificationDecisionTrustInputBindingArtifacts> = {},
): integration.OrganizationVerificationDecisionTrustInputBindingArtifacts {
  return {
    bindingId: must(
      integration.createOrganizationVerificationDecisionTrustBindingId(
        "binding-envelope-1",
      ),
    ),
    bindingContractVersion:
      integration.ORGANIZATION_VERIFICATION_DECISION_TRUST_BINDING_CONTRACT_VERSION,
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
      integration.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
        "binding-input-provenance",
      ),
    ),
    integrityReference: must(
      integration.createOrganizationVerificationDecisionTrustBindingIntegrityReference(
        "binding-input-integrity",
      ),
    ),
    ...override,
  };
}

function makeInputBinding(
  fixture = makeRuntimeExecution(),
  override: Partial<integration.OrganizationVerificationDecisionTrustInputBindingArtifacts> = {},
) {
  return must(
    integration.createOrganizationVerificationDecisionTrustIntegrationInputBinding(
      {
        runtimeExecution: fixture.execution,
        artifacts: makeInputArtifacts(fixture.execution, override),
      },
    ),
  );
}

function makeBindingArtifacts(
  decision?: OrganizationVerificationDecision,
  trustStatus?: OrganizationVerificationTrustStatus,
): integration.OrganizationVerificationDecisionTrustBindingArtifacts {
  return {
    ...(decision
      ? {
          decision: {
            decisionId: decision.decisionId,
            boundAt: DECISION_BOUND_AT,
            provenanceReference: must(
              integration.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
                "binding-decision-provenance",
              ),
            ),
            integrityReference: must(
              integration.createOrganizationVerificationDecisionTrustBindingIntegrityReference(
                "binding-decision-integrity",
              ),
            ),
          },
        }
      : {}),
    ...(decision && trustStatus
      ? {
          trust: {
            projectionId: trustStatus.projectionId,
            sourceDecisionId: decision.decisionId,
            boundAt: TRUST_BOUND_AT,
            provenanceReference: must(
              integration.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
                "binding-trust-provenance",
              ),
            ),
            integrityReference: must(
              integration.createOrganizationVerificationDecisionTrustBindingIntegrityReference(
                "binding-trust-integrity",
              ),
            ),
          },
        }
      : {}),
  };
}

function completeFixture() {
  const runtimeFixture = makeRuntimeExecution();
  const inputBinding = makeInputBinding(runtimeFixture);
  const decision = makeDecision(runtimeFixture);
  const trustStatus = makeTrustStatus(decision);
  const binding = must(
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding,
      decision,
      trustStatus,
      artifacts: makeBindingArtifacts(decision, trustStatus),
    }),
  );
  return { runtimeFixture, inputBinding, decision, trustStatus, binding };
}

test("accepts an authentic Runtime execution and preserves its exact chain", () => {
  const fixture = makeRuntimeExecution();
  const binding = makeInputBinding(fixture);
  assert.equal(binding.runtimeExecution, fixture.execution);
  assert.equal(binding.runtimeExecutionId, fixture.execution.executionId);
  assert.equal(
    binding.runtimeExecutionFingerprint,
    fixture.execution.executionFingerprint,
  );
  assert.equal(
    binding.policyEvaluationInputId,
    fixture.execution.policyEvaluationInputId,
  );
  assert.equal(
    binding.policyEvaluationInputFingerprint,
    fixture.execution.policyEvaluationInputFingerprint,
  );
  assert.equal(
    binding.policyEvaluationCompletionId,
    fixture.execution.completion.evaluationCompletionId,
  );
});

test("rejects fake and object-spread Runtime executions", () => {
  const fixture = makeRuntimeExecution();
  for (const fake of [
    {},
    { ...fixture.execution },
    Object.freeze({ ...fixture.execution }),
  ]) {
    const result =
      integration.createOrganizationVerificationDecisionTrustIntegrationInputBinding(
        {
          runtimeExecution: fake as never,
          artifacts: makeInputArtifacts(fixture.execution),
        },
      );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "unauthentic_runtime_execution");
  }
});

test("rejects every explicit Runtime and Evaluation Input continuity mismatch", () => {
  const fixture = makeRuntimeExecution();
  const cases: Array<
    [
      Partial<integration.OrganizationVerificationDecisionTrustInputBindingArtifacts>,
      string,
    ]
  > = [
    [{ runtimeExecutionId: "other" as never }, "runtime_execution_mismatch"],
    [
      { runtimeExecutionFingerprint: `sha256:${"f".repeat(64)}` as never },
      "runtime_execution_mismatch",
    ],
    [{ policyEvaluationInputId: "other" as never }, "evaluation_input_mismatch"],
    [
      { policyEvaluationInputVersion: "other" as never },
      "evaluation_input_mismatch",
    ],
    [
      { policyEvaluationInputFingerprint: DIGEST_B as never },
      "evaluation_input_mismatch",
    ],
  ];
  for (const [override, code] of cases) {
    const result =
      integration.createOrganizationVerificationDecisionTrustIntegrationInputBinding(
        {
          runtimeExecution: fixture.execution,
          artifacts: makeInputArtifacts(fixture.execution, override),
        },
      );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
  }
});

test("rejects Organization, Revision, Attempt, and Completion mismatches", () => {
  const fixture = makeRuntimeExecution();
  const cases: Array<
    [
      Partial<integration.OrganizationVerificationDecisionTrustInputBindingArtifacts>,
      string,
    ]
  > = [
    [{ organizationId: "other" as never }, "organization_id_mismatch"],
    [{ revisionId: "other" as never }, "verification_revision_id_mismatch"],
    [{ attemptId: "other" as never }, "attempt_id_mismatch"],
    [
      { policyEvaluationCompletionId: "other" as never },
      "completion_mismatch",
    ],
  ];
  for (const [override, code] of cases) {
    const result =
      integration.createOrganizationVerificationDecisionTrustIntegrationInputBinding(
        {
          runtimeExecution: fixture.execution,
          artifacts: makeInputArtifacts(fixture.execution, override),
        },
      );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
  }
});

test("completion binding fingerprint is deterministic and caller-order independent", () => {
  const fixture = makeRuntimeExecution();
  const artifacts = makeInputArtifacts(fixture.execution);
  const reordered = {
    integrityReference: artifacts.integrityReference,
    provenanceReference: artifacts.provenanceReference,
    boundAt: artifacts.boundAt,
    policyEvaluationCompletionId: artifacts.policyEvaluationCompletionId,
    policySetVersion: artifacts.policySetVersion,
    policySetId: artifacts.policySetId,
    snapshotFingerprint: artifacts.snapshotFingerprint,
    snapshotId: artifacts.snapshotId,
    attemptId: artifacts.attemptId,
    revisionId: artifacts.revisionId,
    recordId: artifacts.recordId,
    organizationId: artifacts.organizationId,
    policyEvaluationInputFingerprint:
      artifacts.policyEvaluationInputFingerprint,
    policyEvaluationInputVersion: artifacts.policyEvaluationInputVersion,
    policyEvaluationInputId: artifacts.policyEvaluationInputId,
    runtimeExecutionFingerprint: artifacts.runtimeExecutionFingerprint,
    runtimeExecutorVersion: artifacts.runtimeExecutorVersion,
    runtimeExecutionContractVersion:
      artifacts.runtimeExecutionContractVersion,
    runtimeExecutionId: artifacts.runtimeExecutionId,
    bindingContractVersion: artifacts.bindingContractVersion,
    bindingId: artifacts.bindingId,
  };
  const first = must(
    integration.createOrganizationVerificationDecisionTrustIntegrationInputBinding(
      { runtimeExecution: fixture.execution, artifacts },
    ),
  );
  const second = must(
    integration.createOrganizationVerificationDecisionTrustIntegrationInputBinding(
      { runtimeExecution: fixture.execution, artifacts: reordered },
    ),
  );
  assert.equal(
    first.completionBindingFingerprint,
    second.completionBindingFingerprint,
  );
});

test("semantic completion-binding changes alter its scoped fingerprint", () => {
  const fixture = makeRuntimeExecution();
  const first = makeInputBinding(fixture);
  const second = makeInputBinding(fixture, {
    provenanceReference: must(
      integration.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
        "binding-input-provenance-changed",
      ),
    ),
  });
  assert.notEqual(
    first.completionBindingFingerprint,
    second.completionBindingFingerprint,
  );
});

test("expected completion fingerprint mismatch fails closed", () => {
  const fixture = makeRuntimeExecution();
  const result =
    integration.createOrganizationVerificationDecisionTrustIntegrationInputBinding(
      {
        runtimeExecution: fixture.execution,
        artifacts: makeInputArtifacts(fixture.execution, {
          expectedCompletionBindingFingerprint: must(
            integration.createCompletionBindingFingerprint(
              `sha256:${"f".repeat(64)}`,
            ),
          ),
        }),
      },
    );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "completion_binding_fingerprint_mismatch");
  }
});

test("input binding is authenticated, immutable, spread-resistant, and idempotent", () => {
  const fixture = makeRuntimeExecution();
  const first = makeInputBinding(fixture);
  assert.equal(
    integration.isOrganizationVerificationDecisionTrustIntegrationInputBinding(
      first,
    ),
    true,
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(
    integration.isOrganizationVerificationDecisionTrustIntegrationInputBinding(
      { ...first },
    ),
    false,
  );
  const retry = must(
    integration.createOrganizationVerificationDecisionTrustIntegrationInputBinding(
      {
        runtimeExecution: fixture.execution,
        artifacts: makeInputArtifacts(fixture.execution),
        existingBinding: first,
      },
    ),
  );
  assert.equal(retry, first);
});

test("conflicting existing input binding fails closed", () => {
  const fixture = makeRuntimeExecution();
  const existing = makeInputBinding(fixture);
  const result =
    integration.createOrganizationVerificationDecisionTrustIntegrationInputBinding(
      {
        runtimeExecution: fixture.execution,
        artifacts: makeInputArtifacts(fixture.execution, {
          provenanceReference: must(
            integration.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
              "binding-conflict",
            ),
          ),
        }),
        existingBinding: existing,
      },
    );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "conflicting_binding");
});

test("binds an authentic exact Decision without constructing one", () => {
  const runtimeFixture = makeRuntimeExecution();
  const inputBinding = makeInputBinding(runtimeFixture);
  const decision = makeDecision(runtimeFixture);
  const binding = must(
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding,
      decision,
      artifacts: makeBindingArtifacts(decision),
    }),
  );
  assert.equal(binding.decision, decision);
  assert.equal(binding.decisionEvidence?.decisionId, decision.decisionId);
  assert.match(binding.decisionBindingFingerprint ?? "", /^sha256:[a-f0-9]{64}$/);
});

test("rejects fake Decision and exact Decision-chain mismatches", () => {
  const fixture = completeFixture();
  const fake = { ...fixture.decision };
  const fakeResult =
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: fixture.inputBinding,
      decision: fake as never,
      artifacts: makeBindingArtifacts(fixture.decision),
    });
  assert.equal(fakeResult.ok, false);
  if (!fakeResult.ok) assert.equal(fakeResult.code, "unauthentic_decision");

  const otherDecision = makeDecision(fixture.runtimeFixture, "other");
  const mismatch =
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: fixture.inputBinding,
      decision: otherDecision,
      artifacts: makeBindingArtifacts(fixture.decision),
    });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.code, "decision_mismatch");
});

test("decision binding fingerprint is deterministic and semantic changes alter it", () => {
  const fixture = completeFixture();
  const first = must(
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: fixture.inputBinding,
      decision: fixture.decision,
      artifacts: makeBindingArtifacts(fixture.decision),
    }),
  );
  const changedArtifacts = makeBindingArtifacts(fixture.decision);
  const changed = must(
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: fixture.inputBinding,
      decision: fixture.decision,
      artifacts: {
        decision: {
          ...changedArtifacts.decision!,
          integrityReference: must(
            integration.createOrganizationVerificationDecisionTrustBindingIntegrityReference(
              "binding-decision-integrity-changed",
            ),
          ),
        },
      },
    }),
  );
  assert.notEqual(
    first.decisionBindingFingerprint,
    changed.decisionBindingFingerprint,
  );
});

test("binds Trust only through an authentic exact Decision", () => {
  const fixture = completeFixture();
  assert.equal(fixture.binding.decision, fixture.decision);
  assert.equal(fixture.binding.trustStatus, fixture.trustStatus);
  assert.equal(
    fixture.binding.trustEvidence?.sourceDecisionId,
    fixture.decision.decisionId,
  );
  assert.match(fixture.binding.trustBindingFingerprint ?? "", /^sha256:[a-f0-9]{64}$/);
});

test("rejects fake Trust Status, standalone Trust, and exact Trust mismatches", () => {
  const fixture = completeFixture();
  const fakeResult =
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: fixture.inputBinding,
      decision: fixture.decision,
      trustStatus: { ...fixture.trustStatus } as never,
      artifacts: makeBindingArtifacts(fixture.decision, fixture.trustStatus),
    });
  assert.equal(fakeResult.ok, false);
  if (!fakeResult.ok) {
    assert.equal(fakeResult.code, "unauthentic_trust_status");
  }

  const standalone =
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: fixture.inputBinding,
      trustStatus: fixture.trustStatus,
      artifacts: { trust: makeBindingArtifacts(fixture.decision, fixture.trustStatus).trust },
    });
  assert.equal(standalone.ok, false);

  const otherTrust = makeTrustStatus(fixture.decision, "other");
  const mismatch =
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: fixture.inputBinding,
      decision: fixture.decision,
      trustStatus: otherTrust,
      artifacts: makeBindingArtifacts(fixture.decision, fixture.trustStatus),
    });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.code, "trust_status_mismatch");
});

test("trust binding fingerprint is deterministic and semantic changes alter it", () => {
  const fixture = completeFixture();
  const retry = must(
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: fixture.inputBinding,
      decision: fixture.decision,
      trustStatus: fixture.trustStatus,
      artifacts: makeBindingArtifacts(fixture.decision, fixture.trustStatus),
    }),
  );
  assert.equal(
    retry.trustBindingFingerprint,
    fixture.binding.trustBindingFingerprint,
  );

  const artifacts = makeBindingArtifacts(fixture.decision, fixture.trustStatus);
  const changed = must(
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: fixture.inputBinding,
      decision: fixture.decision,
      trustStatus: fixture.trustStatus,
      artifacts: {
        decision: artifacts.decision,
        trust: {
          ...artifacts.trust!,
          integrityReference: must(
            integration.createOrganizationVerificationDecisionTrustBindingIntegrityReference(
              "binding-trust-integrity-changed",
            ),
          ),
        },
      },
    }),
  );
  assert.notEqual(
    changed.trustBindingFingerprint,
    fixture.binding.trustBindingFingerprint,
  );
});

test("complete envelope is deeply immutable, authenticated, and spread-resistant", () => {
  const fixture = completeFixture();
  assert.equal(
    integration.isOrganizationVerificationDecisionTrustIntegrationBinding(
      fixture.binding,
    ),
    true,
  );
  assert.equal(Object.isFrozen(fixture.binding), true);
  assert.equal(Object.isFrozen(fixture.binding.inputBinding), true);
  assert.equal(Object.isFrozen(fixture.binding.decision), true);
  assert.equal(Object.isFrozen(fixture.binding.trustStatus), true);
  assert.equal(Object.isFrozen(fixture.binding.decisionEvidence), true);
  assert.equal(Object.isFrozen(fixture.binding.trustEvidence), true);
  assert.equal(
    integration.isOrganizationVerificationDecisionTrustIntegrationBinding({
      ...fixture.binding,
    }),
    false,
  );
});

test("caller artifact mutation cannot alter an authenticated binding", () => {
  const fixture = makeRuntimeExecution();
  const artifacts = makeInputArtifacts(fixture.execution);
  const binding = must(
    integration.createOrganizationVerificationDecisionTrustIntegrationInputBinding(
      { runtimeExecution: fixture.execution, artifacts },
    ),
  );
  const originalFingerprint = binding.completionBindingFingerprint;
  const originalProvenance = binding.provenanceReference;
  Object.assign(artifacts, {
    boundAt: "2030-01-01T00:00:00.000Z",
    provenanceReference: must(
      integration.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
        "mutated-caller-provenance",
      ),
    ),
  });
  assert.equal(binding.completionBindingFingerprint, originalFingerprint);
  assert.equal(binding.provenanceReference, originalProvenance);
  assert.equal(binding.boundAt, INPUT_BOUND_AT);
});

test("complete envelope retry is idempotent and conflicts fail closed", () => {
  const fixture = completeFixture();
  const retry = must(
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: fixture.inputBinding,
      decision: fixture.decision,
      trustStatus: fixture.trustStatus,
      artifacts: makeBindingArtifacts(fixture.decision, fixture.trustStatus),
      existingBinding: fixture.binding,
    }),
  );
  assert.equal(retry, fixture.binding);

  const conflict =
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: fixture.inputBinding,
      decision: fixture.decision,
      artifacts: makeBindingArtifacts(fixture.decision),
      existingBinding: fixture.binding,
    });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.code, "conflicting_binding");
});

test("invalid explicit chronology and missing artifacts fail closed", () => {
  const fixture = completeFixture();
  const earlyInput =
    integration.createOrganizationVerificationDecisionTrustIntegrationInputBinding(
      {
        runtimeExecution: fixture.runtimeFixture.execution,
        artifacts: makeInputArtifacts(fixture.runtimeFixture.execution, {
          boundAt: "2026-08-10T09:00:00.000Z",
        }),
      },
    );
  assert.equal(earlyInput.ok, false);
  if (!earlyInput.ok) {
    assert.equal(earlyInput.code, "invalid_binding_chronology");
  }
  const missing =
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: fixture.inputBinding,
      decision: fixture.decision,
      artifacts: {},
    });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, "invalid_binding_artifacts");
});

test("expected Decision and Trust binding fingerprint mismatches fail closed", () => {
  const fixture = completeFixture();
  const wrongDecision = must(
    integration.createDecisionBindingFingerprint(`sha256:${"f".repeat(64)}`),
  );
  const decisionArtifacts = makeBindingArtifacts(fixture.decision);
  const decisionResult =
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: fixture.inputBinding,
      decision: fixture.decision,
      artifacts: {
        decision: {
          ...decisionArtifacts.decision!,
          expectedDecisionBindingFingerprint: wrongDecision,
        },
      },
    });
  assert.equal(decisionResult.ok, false);
  if (!decisionResult.ok) {
    assert.equal(decisionResult.code, "decision_binding_fingerprint_mismatch");
  }

  const allArtifacts = makeBindingArtifacts(
    fixture.decision,
    fixture.trustStatus,
  );
  const trustResult =
    integration.createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: fixture.inputBinding,
      decision: fixture.decision,
      trustStatus: fixture.trustStatus,
      artifacts: {
        decision: allArtifacts.decision,
        trust: {
          ...allArtifacts.trust!,
          expectedTrustBindingFingerprint: must(
            integration.createTrustBindingFingerprint(
              `sha256:${"f".repeat(64)}`,
            ),
          ),
        },
      },
    });
  assert.equal(trustResult.ok, false);
  if (!trustResult.ok) {
    assert.equal(trustResult.code, "trust_binding_fingerprint_mismatch");
  }
});

test("public exports are narrow and exclude construction and seal internals", () => {
  assert.deepEqual(Object.keys(integration).sort(), [
    "ORGANIZATION_VERIFICATION_DECISION_TRUST_BINDING_CONTRACT_VERSION",
    "createCompletionBindingFingerprint",
    "createDecisionBindingFingerprint",
    "createOrganizationVerificationDecisionTrustBindingId",
    "createOrganizationVerificationDecisionTrustBindingIntegrityReference",
    "createOrganizationVerificationDecisionTrustBindingProvenanceReference",
    "createOrganizationVerificationDecisionTrustIntegrationBinding",
    "createOrganizationVerificationDecisionTrustIntegrationInputBinding",
    "createTrustBindingFingerprint",
    "isOrganizationVerificationDecisionTrustIntegrationBinding",
    "isOrganizationVerificationDecisionTrustIntegrationInputBinding",
  ]);
  for (const forbidden of [
    "integrationBindingSeal",
    "integrationInputBindingSeal",
    "fingerprintDecisionTrustBindingInternal",
    "bindingSuccess",
    "bindingFailure",
    "decideOrganizationVerification",
    "deriveOrganizationVerificationTrustStatus",
  ]) {
    assert.equal(forbidden in integration, false);
  }
});

test("binding vocabulary contains no downstream authority", () => {
  const fixture = completeFixture();
  const serialized = JSON.stringify(fixture.binding);
  for (const forbidden of [
    "eligibility",
    "marketplace",
    "workflow",
    "user",
    "permission",
  ]) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false);
  }
  assert.equal(
    "findings" in fixture.binding ||
      "ruleResults" in fixture.binding ||
      "ruleExecutions" in fixture.binding,
    false,
  );
});
