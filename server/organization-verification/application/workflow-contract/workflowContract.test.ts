import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrganizationId,
  createOrganizationProfileFingerprint,
  createOrganizationProfileRevisionId,
  createOrganizationProfileRevisionSequence,
  parseActorAuthorityReference,
} from "../../../organization-registry/index.js";
import * as core from "../../domain/index.js";
import * as decision from "../../domain/decision/index.js";
import * as binding from "../../domain/decision-trust-integration-contract/index.js";
import * as integration from "../../domain/decision-trust-integration/index.js";
import * as evaluationInput from "../../domain/evaluation-input/index.js";
import * as evaluationProjection from "../../domain/evaluation-projection/index.js";
import * as evidenceSnapshot from "../../domain/evidence-snapshot/index.js";
import * as policy from "../../domain/policy/index.js";
import { createOrganizationVerificationPolicyEvaluationCompletionInternal } from "../../domain/policy/policyEvaluationCompletion.js";
import { policyEvaluationClassification } from "../../domain/policy/policyEvaluationCompletion.js";
import * as runtimeContract from "../../domain/policy-runtime-contract/index.js";
import * as policyRuntime from "../../domain/policy-runtime/index.js";
import { createOrganizationVerificationPolicyEvaluationExecutionInternal } from "../../domain/policy-runtime/policyEvaluationExecution.js";
import * as trust from "../../domain/trust-status/index.js";
import * as lifecycleContract from "../attempt-lifecycle-contract/index.js";
import * as lifecycleRuntime from "../attempt-lifecycle-runtime/index.js";
import * as workflow from "./index.js";

type Result<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code: string }>;

function must<T>(result: Result<T>): T {
  assert.equal(result.ok, true, result.ok ? undefined : result.code);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

const ORGANIZATION = "workflow-org-1";
const RECORD = "workflow-record-1";
const REVISION = "workflow-revision-1";
const ATTEMPT = "workflow-attempt-1";
const PROFILE_REVISION = "workflow-profile-revision-1";
const SNAPSHOT = "workflow-snapshot-1";
const COMPLETION = "workflow-completion-1";

function buildInitialLifecycle(
  snapshot: evidenceSnapshot.OrganizationVerificationEvidenceSnapshot =
    buildSnapshot(),
) {
  const organizationId = must(createOrganizationId(ORGANIZATION));
  const profileRevisionId = must(
    createOrganizationProfileRevisionId(PROFILE_REVISION),
  );
  const profileRevisionSequence = must(
    createOrganizationProfileRevisionSequence(1),
  );
  const profileFingerprint = must(
    createOrganizationProfileFingerprint("workflow-profile-fingerprint-1"),
  );
  const authority = must(
    parseActorAuthorityReference({
      actor_id: "workflow-actor-1",
      authority_reference_id: "workflow-authority-1",
      authority_version: "authority.v1",
      organization_scope: organizationId,
      issued_at: "2026-08-30T00:00:00.000Z",
      delegated_scopes: ["verification.submit"],
    }),
  );
  const record = must(
    core.createOrganizationVerificationRecord({
      recordId: must(core.createOrganizationVerificationRecordId(RECORD)),
      organizationId,
      createdAt: "2026-08-30T00:00:00.000Z",
    }),
  );
  const draft = must(
    core.createDraftForRecord(record, {
      draftId: must(
        core.createOrganizationVerificationDraftId("workflow-draft-1"),
      ),
      organizationId,
      profileRevisionId,
      profileRevisionSequence,
      profileFingerprint,
      declaredInputs: {
        sections: [
          {
            key: "organization",
            values: [{ key: "statement", value: "synthetic" }],
          },
        ],
      },
      evidenceReferenceIds: [
        must(
          core.createOrganizationEvidenceReferenceId(
            "workflow-revision-evidence-1",
          ),
        ),
      ],
      draftVersion: must(core.createDraftVersion(1)),
      at: "2026-08-30T00:00:30.000Z",
      actorAuthorityReference: authority,
    }),
  );
  const submitted = must(
    core.submitDraftToRevision(
      must(core.attachDraftToRecord(record, draft)),
      draft,
      {
        draftId: draft.draftId,
        expectedDraftVersion: draft.draftVersion,
        revisionId: must(
          core.createOrganizationVerificationRevisionId(REVISION),
        ),
        revisionSequence: must(core.createVerificationRevisionSequence(1)),
        profileRevisionId,
        profileRevisionSequence,
        profileFingerprint,
        submissionActorAuthorityReference: authority,
        submittedAt: "2026-08-30T00:01:00.000Z",
        submissionIdempotencyKey: must(
          core.createSubmissionIdempotencyKey("workflow-submission-1"),
        ),
        correlationId: must(
          core.createCorrelationId("workflow-correlation-1"),
        ),
      },
    ),
  );
  const created = must(
    core.createAttemptForRevision(submitted.record, submitted.revision, {
      attemptId: must(core.createOrganizationVerificationAttemptId(ATTEMPT)),
      sequence: must(core.createVerificationAttemptSequence(1)),
      snapshotId: must(
        core.createSnapshotId(String(snapshot.evidenceSnapshotId)),
      ),
      snapshotFingerprint: must(
        core.createSnapshotFingerprint(String(snapshot.snapshotFingerprint)),
      ),
      createdAt: "2026-08-30T00:02:00.000Z",
      correlationId: must(
        core.createCorrelationId("workflow-correlation-1"),
      ),
    }),
  );
  const lifecycleExecution = must(
    lifecycleContract.createOrganizationVerificationAttemptLifecycleExecution({
      lifecycleExecutionId: "workflow-lifecycle-1",
      lifecycleExecutionVersion: 1,
      organizationId,
      recordId: created.record.recordId,
      revisionId: submitted.revision.revisionId,
      attemptId: created.attempt.attemptId,
      attemptSequence: created.attempt.sequence,
      record: created.record,
      revision: submitted.revision,
      attempt: created.attempt,
      transitionRecords: [],
      createdAt: "2026-08-30T00:02:00.000Z",
      provenanceReferences: ["lifecycle-provenance"],
      integrityReferences: ["lifecycle-integrity"],
    }),
  );
  return {
    organizationId,
    record: created.record,
    revision: submitted.revision,
    lifecycleExecution,
  };
}

function lifecycleCommand(
  execution: lifecycleContract.OrganizationVerificationAttemptLifecycleExecution,
  transitionId: string,
  requestedTransition: "queued" | "running" | "completed",
  occurredAt: string,
  completionReference?: core.CompletionReference,
) {
  return {
    predecessorLifecycleExecution: execution,
    lifecycleExecutionId: execution.lifecycleExecutionId,
    expectedPredecessorLifecycleExecutionVersion:
      execution.lifecycleExecutionVersion,
    nextLifecycleExecutionVersion: execution.lifecycleExecutionVersion + 1,
    transitionId,
    requestedTransition,
    expectedPredecessorAttemptState: execution.attempt.processState,
    expectedResultingAttemptState: requestedTransition,
    recordId: execution.recordId,
    revisionId: execution.revisionId,
    attemptId: execution.attemptId,
    attemptSequence: execution.attemptSequence,
    occurredAt,
    provenanceReferences: [`${transitionId}-provenance`],
    integrityReferences: [`${transitionId}-integrity`],
    ...(completionReference === undefined ? {} : { completionReference }),
  };
}

function buildSnapshot() {
  const correlationReference = must(
    evidenceSnapshot.createEvidenceSnapshotCorrelationReference(
      "workflow-correlation-1",
    ),
  );
  const context = must(
    evidenceSnapshot.createOrganizationVerificationEvidenceSnapshotConstructionContext(
      {
        evidenceSnapshotId: must(
          evidenceSnapshot.createEvidenceSnapshotId(SNAPSHOT),
        ),
        evidenceSnapshotVersion: must(
          evidenceSnapshot.createEvidenceSnapshotVersion(
            "workflow-snapshot-version-1",
          ),
        ),
        snapshotContractVersion:
          evidenceSnapshot.EVIDENCE_SNAPSHOT_CONTRACT_VERSION,
        snapshotBuilderVersion:
          evidenceSnapshot.EVIDENCE_SNAPSHOT_BUILDER_VERSION,
        manifestVersion: evidenceSnapshot.EVIDENCE_SNAPSHOT_MANIFEST_VERSION,
        organizationId: ORGANIZATION as never,
        recordId: RECORD as never,
        revisionId: REVISION as never,
        profileRevisionId: PROFILE_REVISION as never,
        attemptBinding: {
          attemptId: ATTEMPT as never,
          attemptCreatedAt: "2026-08-30T00:02:00.000Z",
        },
        createdAt: "2026-08-30T00:04:00.000Z",
        sourceSelectionCompletedAt: "2026-08-30T00:03:30.000Z",
        sourceComplete: true,
        sourceIntegrityValid: true,
        provenanceReference: must(
          evidenceSnapshot.createEvidenceSnapshotProvenanceReference(
            "workflow-snapshot-provenance",
          ),
        ),
        correlationReference,
        integrityReference: must(
          evidenceSnapshot.createEvidenceSnapshotIntegrityReference(
            "workflow-snapshot-integrity",
          ),
        ),
      },
    ),
  );
  return must(
    evidenceSnapshot.buildOrganizationVerificationEvidenceSnapshot({
      context,
      registrySource: {
        profileRevision: {
          organizationId: ORGANIZATION,
          organizationProfileRevisionId: PROFILE_REVISION,
          organizationProfileRevisionSequence: 1,
          organizationProfileFingerprint: "workflow-profile-fingerprint-1",
          legalIdentityProjection: {
            legalName: "Workflow Synthetic Entity",
            tradingNames: ["Workflow Synthetic"],
            registrationJurisdiction: "ZZ",
            registrationIdentifiers: [
              { scheme: "synthetic.registry", value: "WORKFLOW-1" },
            ],
          },
          organizationType: "synthetic_entity",
          jurisdiction: "ZZ",
          declaredActivityProjection: {
            activities: [{ code: "synthetic.trade" }],
          },
          organizationLifecycle: "active",
          registryContractVersion:
            "organization_registry_profile_revision.v1",
          publishedAt: "2026-08-30T00:00:00.000Z",
        } as never,
        provenanceReference: must(
          evidenceSnapshot.createEvidenceSnapshotProvenanceReference(
            "workflow-registry-provenance",
          ),
        ),
        integrityReference: must(
          evidenceSnapshot.createEvidenceSnapshotIntegrityReference(
            "workflow-registry-integrity",
          ),
        ),
      },
      submissionSource: {
        revision: {
          organizationId: ORGANIZATION,
          recordId: RECORD,
          revisionId: REVISION,
          profileRevisionId: PROFILE_REVISION,
          profileRevisionSequence: 1,
          profileFingerprint: "workflow-profile-fingerprint-1",
          sequence: 1,
          declaredInputs: {
            sections: [
              {
                key: "organization",
                values: [{ key: "statement", value: "synthetic" }],
              },
            ],
          },
          evidenceReferenceIds: ["workflow-revision-evidence-1"],
          submissionActorAuthorityReference: {
            actorId: "workflow-actor-1",
            authorityReferenceId: "workflow-authority-1",
            authorityVersion: "authority.v1",
            organizationScope: ORGANIZATION,
            issuedAt: "2026-08-30T00:00:00.000Z",
            delegatedScopes: ["verification.submit"],
          },
          submittedAt: "2026-08-30T00:01:00.000Z",
          submissionIdempotencyKey: "workflow-submission-1",
          correlationId: "workflow-correlation-1",
        } as never,
        verificationSourceContractVersion:
          evidenceSnapshot.VERIFICATION_REVISION_SOURCE_CONTRACT_VERSION,
        provenanceReference: must(
          evidenceSnapshot.createEvidenceSnapshotProvenanceReference(
            "workflow-submission-provenance",
          ),
        ),
        integrityReference: must(
          evidenceSnapshot.createEvidenceSnapshotIntegrityReference(
            "workflow-submission-integrity",
          ),
        ),
      },
      evidenceReferences: [
        {
          evidenceReferenceId: must(
            evidenceSnapshot.createEvidenceReferenceId(
              "workflow-evidence-1",
            ),
          ),
          evidenceReferenceVersion: must(
            evidenceSnapshot.createEvidenceReferenceVersion(
              "workflow-evidence-version-1",
            ),
          ),
          revisionEvidenceReferenceId:
            "workflow-revision-evidence-1" as never,
          evidenceKind: must(
            evidenceSnapshot.createEvidenceKind("corporate.registration"),
          ),
          category: must(
            evidenceSnapshot.createEvidenceCategory("legal.identity"),
          ),
          sourceAuthority: must(
            evidenceSnapshot.createEvidenceSourceAuthority(
              "customer.submission",
            ),
          ),
          contentDigest: must(
            evidenceSnapshot.createEvidenceContentDigest("a".repeat(64)),
          ),
          capturedAt: "2026-08-30T00:01:00.000Z",
          attributes: [{ key: "name", value: "Workflow Synthetic" }],
          provenanceReference: must(
            evidenceSnapshot.createEvidenceSnapshotProvenanceReference(
              "workflow-evidence-provenance",
            ),
          ),
          correlationReference,
          integrityReference: must(
            evidenceSnapshot.createEvidenceSnapshotIntegrityReference(
              "workflow-evidence-integrity",
            ),
          ),
        },
      ],
    }),
  );
}

function buildPreparationPipeline() {
  const snapshot = buildSnapshot();
  const projectionContext = must(
    evaluationProjection.createOrganizationVerificationEvaluationProjectionConstructionContext(
      {
        evaluationProjectionId: must(
          evaluationProjection.createEvaluationProjectionId(
            "workflow-projection-1",
          ),
        ),
        evaluationProjectionVersion: must(
          evaluationProjection.createEvaluationProjectionVersion(
            "workflow-projection-version-1",
          ),
        ),
        projectionContractVersion:
          evaluationProjection.EVALUATION_PROJECTION_CONTRACT_VERSION,
        projectionBuilderVersion:
          evaluationProjection.EVALUATION_PROJECTION_BUILDER_VERSION,
        projectionSchemaVersion:
          evaluationProjection.EVALUATION_PROJECTION_SCHEMA_VERSION,
        projectedAt: "2026-08-30T00:05:00.000Z",
        provenanceReference: must(
          evaluationProjection.createEvaluationProjectionProvenanceReference(
            "workflow-projection-provenance",
          ),
        ),
        integrityReference: must(
          evaluationProjection.createEvaluationProjectionIntegrityReference(
            "workflow-projection-integrity",
          ),
        ),
      },
    ),
  );
  const projection = must(
    evaluationProjection.buildOrganizationVerificationEvaluationProjection({
      context: projectionContext,
      evidenceSnapshot: snapshot,
    }),
  );
  const policySetBinding = must(
    evaluationInput.createOrganizationVerificationPolicySetBinding({
      policySetId: must(
        policy.createOrganizationVerificationPolicySetId(
          "workflow-policy-set-1",
        ),
      ),
      policySetVersion: must(
        policy.createOrganizationVerificationPolicySetVersion(
          "workflow-policy-version-1",
        ),
      ),
      policyContractVersion: policy.POLICY_CONTRACT_VERSION,
      provenanceReference: must(
        policy.createOrganizationVerificationPolicyProvenanceReference(
          "workflow-policy-provenance",
        ),
      ),
      integrityReference: must(
        policy.createOrganizationVerificationPolicySetIntegrityReference(
          "workflow-policy-integrity",
        ),
      ),
    }),
  );
  const evaluationContext = must(
    evaluationInput.createOrganizationVerificationEvaluationContext({
      contextContractVersion:
        evaluationInput.EVALUATION_CONTEXT_CONTRACT_VERSION,
      requestedAt: "2026-08-30T00:06:00.000Z",
      effectiveAt: "2026-08-30T00:06:00.000Z",
      sourceCutoffAt: "2026-08-30T00:04:00.000Z",
      executionReference: must(
        evaluationInput.createOrganizationVerificationEvaluationExecutionReference(
          "workflow-evaluation-execution-1",
        ),
      ),
      attemptId: ATTEMPT as never,
      organizationId: projection.identity.organizationId,
      recordId: projection.identity.recordId,
      revisionId: projection.identity.revisionId,
      profileRevisionId: projection.identity.profileRevisionId,
      evaluationProjectionId: projection.evaluationProjectionId,
      evaluationProjectionFingerprint: projection.projectionFingerprint,
      sourceSnapshotId: projection.source.evidenceSnapshotId,
      sourceSnapshotFingerprint: projection.source.snapshotFingerprint,
      provenanceReference: must(
        evaluationInput.createOrganizationVerificationEvaluationProvenanceReference(
          "workflow-evaluation-context-provenance",
        ),
      ),
      correlationReference: must(
        evaluationInput.createOrganizationVerificationEvaluationCorrelationReference(
          "workflow-evaluation-correlation",
        ),
      ),
      integrityReference: must(
        evaluationInput.createOrganizationVerificationEvaluationIntegrityReference(
          "workflow-evaluation-context-integrity",
        ),
      ),
    }),
  );
  const evaluationScope = must(
    evaluationInput.createOrganizationVerificationEvaluationScope({
      scopeContractVersion: evaluationInput.EVALUATION_SCOPE_CONTRACT_VERSION,
      capability:
        evaluationInput.ORGANIZATION_VERIFICATION_EVALUATION_CAPABILITY,
      authorizedProjectionSections: [
        "registry_facts",
        "submission_facts",
        "evidence_facts",
      ],
      authorizedEvidenceCategories: ["legal.identity"],
      authorizedDeclaredFactSections: ["organization"],
      provenanceReference: must(
        evaluationInput.createOrganizationVerificationEvaluationProvenanceReference(
          "workflow-evaluation-scope-provenance",
        ),
      ),
      integrityReference: must(
        evaluationInput.createOrganizationVerificationEvaluationIntegrityReference(
          "workflow-evaluation-scope-integrity",
        ),
      ),
    }),
  );
  const policyEvaluationInput = must(
    evaluationInput.buildOrganizationVerificationPolicyEvaluationInput({
      policyEvaluationInputId: must(
        evaluationInput.createOrganizationVerificationPolicyEvaluationInputId(
          "workflow-evaluation-input-1",
        ),
      ),
      policyEvaluationInputVersion: must(
        evaluationInput.createOrganizationVerificationPolicyEvaluationInputVersion(
          "workflow-evaluation-input-version-1",
        ),
      ),
      inputContractVersion:
        evaluationInput.POLICY_EVALUATION_INPUT_CONTRACT_VERSION,
      inputBuilderVersion:
        evaluationInput.POLICY_EVALUATION_INPUT_BUILDER_VERSION,
      createdAt: "2026-08-30T00:07:00.000Z",
      evaluationProjection: projection,
      policySetBinding,
      evaluationContext,
      evaluationScope,
    }),
  );
  return { snapshot, projection, policyEvaluationInput, policySetBinding };
}

function buildPolicyExecution(
  chain: ReturnType<typeof buildInitialLifecycle>,
  completedLifecycle: lifecycleContract.OrganizationVerificationAttemptLifecycleExecution,
  preparation: ReturnType<typeof buildPreparationPipeline>,
) {
  const completion = createOrganizationVerificationPolicyEvaluationCompletionInternal(
    {
      evaluationCompletionId: must(
        policy.createOrganizationVerificationPolicyEvaluationCompletionId(
          COMPLETION,
        ),
      ),
      policySetId: preparation.policySetBinding.policySetId,
      policySetVersion: preparation.policySetBinding.policySetVersion,
      policyContractVersion: policy.POLICY_EVALUATION_CONTRACT_VERSION,
      organizationId: chain.organizationId,
      recordId: chain.record.recordId,
      revisionId: chain.revision.revisionId,
      attemptId: completedLifecycle.attemptId,
      snapshotId: must(
        core.createSnapshotId(
          String(preparation.snapshot.evidenceSnapshotId),
        ),
      ),
      snapshotFingerprint: must(
        core.createSnapshotFingerprint(
          String(preparation.snapshot.snapshotFingerprint),
        ),
      ),
      ruleResults: [],
      findingSummary: {
        ruleResultCount: 0,
        findingCount: 0,
        categorySummaries: [],
      },
      evaluationStartedAt: "2026-08-30T00:08:00.000Z",
      evaluationCompletedAt: "2026-08-30T00:09:00.000Z",
      completionIntegrityValid: true,
      completionComplete: true,
      classification: policyEvaluationClassification("approval_ready"),
      provenanceReference: must(
        policy.createOrganizationVerificationPolicyProvenanceReference(
          "workflow-completion-provenance",
        ),
      ),
      correlationId: must(
        core.createCorrelationId("workflow-correlation-1"),
      ),
      integrityReference: must(
        policy.createOrganizationVerificationPolicyEvaluationIntegrityReference(
          "workflow-completion-integrity",
        ),
      ),
    },
  );
  return createOrganizationVerificationPolicyEvaluationExecutionInternal({
    executionId: must(
      runtimeContract.createOrganizationVerificationExecutionId(
        "workflow-policy-execution-1",
      ),
    ),
    executionContractVersion:
      policyRuntime.ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTION_CONTRACT_VERSION,
    executorVersion:
      policyRuntime.ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTOR_VERSION,
    policyEvaluationInputId:
      preparation.policyEvaluationInput.policyEvaluationInputId,
    policyEvaluationInputVersion:
      preparation.policyEvaluationInput.policyEvaluationInputVersion,
    policyEvaluationInputFingerprint:
      preparation.policyEvaluationInput.inputFingerprint,
    policySetId: preparation.policySetBinding.policySetId,
    policySetVersion: preparation.policySetBinding.policySetVersion,
    policySetFingerprint: must(
      runtimeContract.createOrganizationVerificationPolicySetFingerprint(
        "a".repeat(64),
      ),
    ),
    implementationSetId: must(
      runtimeContract.createOrganizationVerificationRuleImplementationSetId(
        "workflow-implementation-set-1",
      ),
    ),
    implementationSetVersion: must(
      runtimeContract.createOrganizationVerificationRuleImplementationSetVersion(
        "workflow-implementation-set-version-1",
      ),
    ),
    implementationSetFingerprint: must(
      runtimeContract.createOrganizationVerificationRuleImplementationSetFingerprint(
        "b".repeat(64),
      ),
    ),
    executionArtifactsFingerprint: must(
      runtimeContract.createOrganizationVerificationExecutionArtifactsFingerprint(
        "c".repeat(64),
      ),
    ),
    startedAt: "2026-08-30T00:08:00.000Z",
    completedAt: "2026-08-30T00:09:00.000Z",
    provenanceReference: must(
      runtimeContract.createOrganizationVerificationExecutionArtifactProvenanceReference(
        "workflow-runtime-provenance",
      ),
    ),
    integrityReference: must(
      runtimeContract.createOrganizationVerificationExecutionArtifactIntegrityReference(
        "workflow-runtime-integrity",
      ),
    ),
    ruleExecutions: [],
    findings: [],
    completion,
    executionFingerprint: must(
      policyRuntime.createOrganizationVerificationPolicyRuntimeExecutionFingerprint(
        "d".repeat(64),
      ),
    ),
  });
}

function buildIntegrationExecution(
  chain: ReturnType<typeof buildInitialLifecycle>,
  completedLifecycle: lifecycleContract.OrganizationVerificationAttemptLifecycleExecution,
  policyExecution: policyRuntime.OrganizationVerificationPolicyEvaluationExecution,
) {
  const decisionId = must(
    decision.createOrganizationVerificationDecisionId("workflow-decision-1"),
  );
  const projectionId = must(
    trust.createTrustStatusProjectionId("workflow-trust-projection-1"),
  );
  const applicability = must(
    trust.createDecisionApplicability({
      applicabilityId: must(
        trust.createDecisionApplicabilityId("workflow-applicability-1"),
      ),
      version: trust.DECISION_APPLICABILITY_VERSION,
      decisionId,
      effectiveAt: "2026-08-30T00:12:00.000Z",
      provenanceReference: must(
        trust.createTrustStatusProvenanceReference(
          "workflow-applicability-provenance",
        ),
      ),
      correlationId: policyExecution.completion.correlationId,
      integrityReference: must(
        trust.createTrustStatusIntegrityReference(
          "workflow-applicability-integrity",
        ),
      ),
      applicable: true,
      superseded: false,
      expired: false,
      invalidated: false,
    }),
  );
  return must(
    integration.executeOrganizationVerificationDecisionTrustIntegration({
      policyRuntimeExecution: policyExecution,
      inputBindingArtifacts: {
        bindingId: must(
          binding.createOrganizationVerificationDecisionTrustBindingId(
            "workflow-binding-1",
          ),
        ),
        bindingContractVersion:
          binding.ORGANIZATION_VERIFICATION_DECISION_TRUST_BINDING_CONTRACT_VERSION,
        runtimeExecutionId: policyExecution.executionId,
        runtimeExecutionContractVersion:
          policyExecution.executionContractVersion,
        runtimeExecutorVersion: policyExecution.executorVersion,
        runtimeExecutionFingerprint: policyExecution.executionFingerprint,
        policyEvaluationInputId: policyExecution.policyEvaluationInputId,
        policyEvaluationInputVersion:
          policyExecution.policyEvaluationInputVersion,
        policyEvaluationInputFingerprint:
          policyExecution.policyEvaluationInputFingerprint,
        organizationId: policyExecution.completion.organizationId,
        recordId: policyExecution.completion.recordId,
        revisionId: policyExecution.completion.revisionId,
        attemptId: policyExecution.completion.attemptId,
        snapshotId: policyExecution.completion.snapshotId,
        snapshotFingerprint: policyExecution.completion.snapshotFingerprint,
        policySetId: policyExecution.policySetId,
        policySetVersion: policyExecution.policySetVersion,
        policyEvaluationCompletionId:
          policyExecution.completion.evaluationCompletionId,
        boundAt: "2026-08-30T00:10:00.000Z",
        provenanceReference: must(
          binding.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
            "workflow-input-binding-provenance",
          ),
        ),
        integrityReference: must(
          binding.createOrganizationVerificationDecisionTrustBindingIntegrityReference(
            "workflow-input-binding-integrity",
          ),
        ),
      },
      decisionContext: {
        decisionId,
        decisionEngineVersion: must(
          decision.createDecisionEngineVersion(
            "workflow-decision-engine-v1",
          ),
        ),
        decidedAt: "2026-08-30T00:11:00.000Z",
        integrityReference: must(
          decision.createDecisionIntegrityReference(
            "workflow-decision-integrity",
          ),
        ),
        record: chain.record,
        revision: chain.revision,
        attempt: completedLifecycle.attempt,
      },
      trustSourceFactsArtifacts: {
        sourceFactsVersion: trust.TRUST_STATUS_SOURCE_FACTS_VERSION,
        sourceFactsComplete: true,
        sourceFactsIntegrityValid: true,
        organizationId: chain.organizationId,
        recordId: chain.record.recordId,
        currentVerificationRevisionId: chain.revision.revisionId,
        authoritativeDecisionId: decisionId,
        authoritativeAttemptId: completedLifecycle.attemptId,
        authoritativeSnapshotId: policyExecution.completion.snapshotId,
        authoritativeSnapshotFingerprint:
          policyExecution.completion.snapshotFingerprint,
        decisionApplicability: applicability,
        derivationAsOf: "2026-08-30T00:13:00.000Z",
        provenanceReference: must(
          trust.createTrustStatusProvenanceReference(
            "workflow-source-facts-provenance",
          ),
        ),
        correlationId: policyExecution.completion.correlationId,
        integrityReference: must(
          trust.createTrustStatusIntegrityReference(
            "workflow-source-facts-integrity",
          ),
        ),
      },
      trustDerivationContext: {
        projectionId,
        deriverVersion: trust.TRUST_STATUS_DERIVER_VERSION,
        derivedAt: "2026-08-30T00:13:00.000Z",
        integrityReference: must(
          trust.createTrustStatusIntegrityReference(
            "workflow-trust-integrity",
          ),
        ),
      },
      bindingArtifacts: {
        decision: {
          decisionId,
          boundAt: "2026-08-30T00:12:00.000Z",
          provenanceReference: must(
            binding.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
              "workflow-decision-binding-provenance",
            ),
          ),
          integrityReference: must(
            binding.createOrganizationVerificationDecisionTrustBindingIntegrityReference(
              "workflow-decision-binding-integrity",
            ),
          ),
        },
        trust: {
          projectionId,
          sourceDecisionId: decisionId,
          boundAt: "2026-08-30T00:14:00.000Z",
          provenanceReference: must(
            binding.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
              "workflow-trust-binding-provenance",
            ),
          ),
          integrityReference: must(
            binding.createOrganizationVerificationDecisionTrustBindingIntegrityReference(
              "workflow-trust-binding-integrity",
            ),
          ),
        },
      },
      executionArtifacts: {
        executionId: must(
          integration.createOrganizationVerificationDecisionTrustIntegrationExecutionId(
            "workflow-integration-execution-1",
          ),
        ),
        executionContractVersion:
          integration.ORGANIZATION_VERIFICATION_DECISION_TRUST_INTEGRATION_EXECUTION_CONTRACT_VERSION,
        startedAt: "2026-08-30T00:10:00.000Z",
        completedAt: "2026-08-30T00:15:00.000Z",
        provenanceReference: must(
          integration.createOrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference(
            "workflow-integration-provenance",
          ),
        ),
        integrityReference: must(
          integration.createOrganizationVerificationDecisionTrustIntegrationExecutionIntegrityReference(
            "workflow-integration-integrity",
          ),
        ),
      },
    }),
  );
}

function makeStep(
  version: number,
  predecessorStage: workflow.OrganizationVerificationWorkflowStage,
  resultingStage: workflow.OrganizationVerificationWorkflowStage,
  occurredAt: string,
  artifacts: workflow.OrganizationVerificationWorkflowStepArtifacts,
  identity: ReturnType<typeof buildInitialLifecycle>,
  existingStepRecords: readonly workflow.OrganizationVerificationWorkflowStepRecord[],
) {
  return must(
    workflow.createOrganizationVerificationWorkflowStepRecord({
      workflowStepId: `workflow-step-${version}`,
      workflowExecutionId: "workflow-execution-1",
      predecessorWorkflowExecutionVersion: version,
      nextWorkflowExecutionVersion: version + 1,
      predecessorStage,
      resultingStage,
      organizationId: identity.organizationId,
      recordId: identity.record.recordId,
      revisionId: identity.revision.revisionId,
      attemptId: identity.lifecycleExecution.attemptId,
      occurredAt,
      provenanceReferences: [`workflow-step-${version}-provenance`],
      integrityReferences: [`workflow-step-${version}-integrity`],
      correlationId: "workflow-correlation-1",
      causationId: `workflow-causation-${version}`,
      reasonReference: `workflow-reason-${version}`,
      artifacts,
      existingStepRecords,
    }),
  );
}

function buildCompleteWorkflowFixture() {
  const preparation = buildPreparationPipeline();
  const identity = buildInitialLifecycle(preparation.snapshot);
  const records: workflow.OrganizationVerificationWorkflowStepRecord[] = [];
  let lifecycle = identity.lifecycleExecution;

  const queued = must(
    lifecycleRuntime.executeOrganizationVerificationAttemptTransition(
      lifecycleCommand(
        lifecycle,
        "workflow-transition-queued",
        "queued",
        "2026-08-30T00:02:10.000Z",
      ),
    ),
  );
  records.push(
    makeStep(
      1,
      "attempt_in_progress",
      "attempt_in_progress",
      queued.occurredAt,
      {
        requestedStep: "attempt_transition",
        predecessorLifecycleExecution: lifecycle,
        transitionExecution: queued,
      },
      identity,
      records,
    ),
  );
  lifecycle = queued.nextLifecycleExecution;

  const running = must(
    lifecycleRuntime.executeOrganizationVerificationAttemptTransition(
      lifecycleCommand(
        lifecycle,
        "workflow-transition-running",
        "running",
        "2026-08-30T00:02:20.000Z",
      ),
    ),
  );
  records.push(
    makeStep(
      2,
      "attempt_in_progress",
      "attempt_in_progress",
      running.occurredAt,
      {
        requestedStep: "attempt_transition",
        predecessorLifecycleExecution: lifecycle,
        transitionExecution: running,
      },
      identity,
      records,
    ),
  );
  lifecycle = running.nextLifecycleExecution;

  const completed = must(
    lifecycleRuntime.executeOrganizationVerificationAttemptTransition(
      lifecycleCommand(
        lifecycle,
        "workflow-transition-completed",
        "completed",
        "2026-08-30T00:03:00.000Z",
        must(core.createCompletionReference(COMPLETION)),
      ),
    ),
  );
  records.push(
    makeStep(
      3,
      "attempt_in_progress",
      "attempt_completed",
      completed.occurredAt,
      {
        requestedStep: "attempt_transition",
        predecessorLifecycleExecution: lifecycle,
        transitionExecution: completed,
      },
      identity,
      records,
    ),
  );
  lifecycle = completed.nextLifecycleExecution;

  records.push(
    makeStep(
      4,
      "attempt_completed",
      "snapshot_bound",
      preparation.snapshot.createdAt,
      {
        requestedStep: "bind_snapshot",
        lifecycleExecution: lifecycle,
        snapshot: preparation.snapshot,
      },
      identity,
      records,
    ),
  );
  records.push(
    makeStep(
      5,
      "snapshot_bound",
      "projection_bound",
      preparation.projection.projectedAt,
      {
        requestedStep: "bind_projection",
        snapshot: preparation.snapshot,
        projection: preparation.projection,
      },
      identity,
      records,
    ),
  );
  records.push(
    makeStep(
      6,
      "projection_bound",
      "evaluation_input_bound",
      preparation.policyEvaluationInput.createdAt,
      {
        requestedStep: "bind_evaluation_input",
        projection: preparation.projection,
        evaluationInput: preparation.policyEvaluationInput,
      },
      identity,
      records,
    ),
  );

  const policyExecution = buildPolicyExecution(
    identity,
    lifecycle,
    preparation,
  );
  records.push(
    makeStep(
      7,
      "evaluation_input_bound",
      "policy_completed",
      policyExecution.completedAt,
      {
        requestedStep: "complete_policy",
        evaluationInput: preparation.policyEvaluationInput,
        policyExecution,
      },
      identity,
      records,
    ),
  );
  const integrationExecution = buildIntegrationExecution(
    identity,
    lifecycle,
    policyExecution,
  );
  records.push(
    makeStep(
      8,
      "policy_completed",
      "completed",
      integrationExecution.completedAt,
      {
        requestedStep: "complete_decision_trust_integration",
        policyExecution,
        integrationExecution,
      },
      identity,
      records,
    ),
  );

  const executionInput: workflow.CreateOrganizationVerificationWorkflowExecutionInput =
    {
      workflowExecutionId: "workflow-execution-1",
      workflowExecutionVersion: 9,
      organizationId: identity.organizationId,
      recordId: identity.record.recordId,
      revisionId: identity.revision.revisionId,
      attemptId: identity.lifecycleExecution.attemptId,
      workflowStage: "completed",
      lifecycleExecution: lifecycle,
      evidenceSnapshot: preparation.snapshot,
      evaluationProjection: preparation.projection,
      policyEvaluationInput: preparation.policyEvaluationInput,
      policyEvaluationExecution: policyExecution,
      decisionTrustIntegrationExecution: integrationExecution,
      stepRecords: records,
      createdAt: "2026-08-30T00:02:00.000Z",
      lastStepAt: integrationExecution.completedAt,
      provenanceReferences: ["z-workflow-provenance", "a-workflow-provenance"],
      integrityReferences: ["z-workflow-integrity", "a-workflow-integrity"],
    };
  return {
    identity,
    preparation,
    lifecycle,
    policyExecution,
    integrationExecution,
    records,
    executionInput,
    execution: must(
      workflow.createOrganizationVerificationWorkflowExecution(
        executionInput,
      ),
    ),
  };
}

function initialWorkflowInput(
  lifecycle: lifecycleContract.OrganizationVerificationAttemptLifecycleExecution,
): workflow.CreateOrganizationVerificationWorkflowExecutionInput {
  return {
    workflowExecutionId: "workflow-initial-1",
    workflowExecutionVersion: 1,
    organizationId: lifecycle.organizationId,
    recordId: lifecycle.recordId,
    revisionId: lifecycle.revisionId,
    attemptId: lifecycle.attemptId,
    workflowStage:
      lifecycle.attempt.processState === "completed"
        ? "attempt_completed"
        : "attempt_in_progress",
    lifecycleExecution: lifecycle,
    stepRecords: [],
    createdAt: lifecycle.lastTransitionAt ?? lifecycle.createdAt,
    provenanceReferences: ["initial-provenance"],
    integrityReferences: ["initial-integrity"],
  };
}

test("derives the smallest exact stage vocabulary and authority matrix", () => {
  assert.deepEqual(workflow.ORGANIZATION_VERIFICATION_WORKFLOW_STAGES, [
    "attempt_in_progress",
    "attempt_completed",
    "snapshot_bound",
    "projection_bound",
    "evaluation_input_bound",
    "policy_completed",
    "completed",
  ]);
  assert.equal(
    workflow.ORGANIZATION_VERIFICATION_WORKFLOW_STEP_AUTHORITY_MATRIX.length,
    6,
  );
  assert.deepEqual(
    workflow.ORGANIZATION_VERIFICATION_WORKFLOW_STEP_AUTHORITY_MATRIX.map(
      (entry) => entry.requestedStep,
    ),
    workflow.ORGANIZATION_VERIFICATION_WORKFLOW_STEPS,
  );
  assert.equal(
    new Set(
      workflow.ORGANIZATION_VERIFICATION_WORKFLOW_STEP_AUTHORITY_MATRIX.map(
        (entry) => entry.exactAuthority,
      ),
    ).size,
    6,
  );
  assert.deepEqual(
    workflow.ORGANIZATION_VERIFICATION_WORKFLOW_STEP_AUTHORITY_MATRIX.filter(
      (entry) => entry.terminal,
    ).map((entry) => entry.requestedStep),
    ["complete_decision_trust_integration"],
  );
  const vocabulary = JSON.stringify(
    workflow.ORGANIZATION_VERIFICATION_WORKFLOW_STAGES,
  );
  for (const forbidden of [
    "failed",
    "cancelled",
    "retrying",
    "approved",
    "rejected",
    "eligible",
    "verified",
  ]) {
    assert.equal(vocabulary.includes(forbidden), false);
  }
});

test("creates an authentic deterministic immutable initial Workflow", () => {
  const lifecycle = buildInitialLifecycle().lifecycleExecution;
  const input = initialWorkflowInput(lifecycle);
  const first = must(
    workflow.createOrganizationVerificationWorkflowExecution(input),
  );
  const second = must(
    workflow.createOrganizationVerificationWorkflowExecution({
      ...input,
      provenanceReferences: [...input.provenanceReferences].reverse(),
      integrityReferences: [...input.integrityReferences].reverse(),
    }),
  );
  assert.equal(first.workflowExecutionVersion, 1);
  assert.equal(first.workflowStage, "attempt_in_progress");
  assert.equal(first.lastStepAt, undefined);
  assert.equal(first.workflowExecutionFingerprint, second.workflowExecutionFingerprint);
  assert.equal(
    workflow.isOrganizationVerificationWorkflowExecution(first),
    true,
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.stepRecords), true);
  assert.equal(Object.isFrozen(first.provenanceReferences), true);
  const idempotent = must(
    workflow.createOrganizationVerificationWorkflowExecution({
      ...input,
      existingWorkflowExecution: first,
    }),
  );
  assert.equal(idempotent, first);
  assert.equal(
    workflow.createOrganizationVerificationWorkflowExecution({
      ...input,
      lifecycleExecution: Object.freeze({ ...lifecycle }),
    } as workflow.CreateOrganizationVerificationWorkflowExecutionInput).ok,
    false,
  );
});

test("represents every authorized step and binds the complete authentic chain", () => {
  const fixture = buildCompleteWorkflowFixture();
  assert.deepEqual(
    fixture.records.map((record) => [
      record.predecessorStage,
      record.requestedStep,
      record.resultingStage,
    ]),
    [
      ["attempt_in_progress", "attempt_transition", "attempt_in_progress"],
      ["attempt_in_progress", "attempt_transition", "attempt_in_progress"],
      ["attempt_in_progress", "attempt_transition", "attempt_completed"],
      ["attempt_completed", "bind_snapshot", "snapshot_bound"],
      ["snapshot_bound", "bind_projection", "projection_bound"],
      [
        "projection_bound",
        "bind_evaluation_input",
        "evaluation_input_bound",
      ],
      ["evaluation_input_bound", "complete_policy", "policy_completed"],
      [
        "policy_completed",
        "complete_decision_trust_integration",
        "completed",
      ],
    ],
  );
  assert.equal(fixture.execution.workflowExecutionVersion, 9);
  assert.equal(fixture.execution.workflowStage, "completed");
  assert.equal(
    fixture.execution.decisionTrustIntegrationExecution?.decision,
    fixture.integrationExecution.decision,
  );
  assert.equal(
    fixture.execution.decisionTrustIntegrationExecution?.trustStatus,
    fixture.integrationExecution.trustStatus,
  );
  assert.equal(
    fixture.execution.decisionTrustIntegrationExecution?.binding,
    fixture.integrationExecution.binding,
  );
  assert.equal(fixture.lifecycle.attempt.sequence, 1);
  for (const record of fixture.records) {
    assert.equal(
      workflow.isOrganizationVerificationWorkflowStepRecord(record),
      true,
    );
    assert.equal(Object.isFrozen(record), true);
    assert.equal(Object.isFrozen(record.inputArtifactFingerprints), true);
    assert.equal(Object.isFrozen(record.outputArtifactFingerprints), true);
  }
});

test("enforces exact step versions, stages, chronology, and evidence", () => {
  const preparation = buildPreparationPipeline();
  const identity = buildInitialLifecycle(preparation.snapshot);
  const transition = must(
    lifecycleRuntime.executeOrganizationVerificationAttemptTransition(
      lifecycleCommand(
        identity.lifecycleExecution,
        "workflow-validation-transition",
        "queued",
        "2026-08-30T00:02:10.000Z",
      ),
    ),
  );
  const base: workflow.CreateOrganizationVerificationWorkflowStepRecordInput = {
    workflowStepId: "workflow-validation-step",
    workflowExecutionId: "workflow-validation-execution",
    predecessorWorkflowExecutionVersion: 1,
    nextWorkflowExecutionVersion: 2,
    predecessorStage: "attempt_in_progress",
    resultingStage: "attempt_in_progress",
    organizationId: identity.organizationId,
    recordId: identity.record.recordId,
    revisionId: identity.revision.revisionId,
    attemptId: identity.lifecycleExecution.attemptId,
    occurredAt: transition.occurredAt,
    provenanceReferences: ["validation-provenance"],
    integrityReferences: ["validation-integrity"],
    artifacts: {
      requestedStep: "attempt_transition",
      predecessorLifecycleExecution: identity.lifecycleExecution,
      transitionExecution: transition,
    },
  };
  assert.equal(
    workflow.createOrganizationVerificationWorkflowStepRecord(base).ok,
    true,
  );
  for (const overrides of [
    { predecessorWorkflowExecutionVersion: 0 },
    { nextWorkflowExecutionVersion: 3 },
    { predecessorStage: "attempt_completed" },
    { resultingStage: "snapshot_bound" },
    { occurredAt: "2026-08-30T00:02:00.000Z" },
    { occurredAt: "invalid" },
    { provenanceReferences: [""] },
    { integrityReferences: [""] },
    { correlationId: "" },
  ]) {
    assert.equal(
      workflow.createOrganizationVerificationWorkflowStepRecord({
        ...base,
        ...overrides,
      } as workflow.CreateOrganizationVerificationWorkflowStepRecordInput).ok,
      false,
    );
  }
});

test("step identity is idempotent while duplicate and branch conflicts fail closed", () => {
  const preparation = buildPreparationPipeline();
  const identity = buildInitialLifecycle(preparation.snapshot);
  const transition = must(
    lifecycleRuntime.executeOrganizationVerificationAttemptTransition(
      lifecycleCommand(
        identity.lifecycleExecution,
        "workflow-conflict-transition",
        "queued",
        "2026-08-30T00:02:10.000Z",
      ),
    ),
  );
  const base: workflow.CreateOrganizationVerificationWorkflowStepRecordInput = {
    workflowStepId: "workflow-conflict-step",
    workflowExecutionId: "workflow-conflict-execution",
    predecessorWorkflowExecutionVersion: 1,
    nextWorkflowExecutionVersion: 2,
    predecessorStage: "attempt_in_progress",
    resultingStage: "attempt_in_progress",
    organizationId: identity.organizationId,
    recordId: identity.record.recordId,
    revisionId: identity.revision.revisionId,
    attemptId: identity.lifecycleExecution.attemptId,
    occurredAt: transition.occurredAt,
    provenanceReferences: ["conflict-provenance"],
    integrityReferences: ["conflict-integrity"],
    artifacts: {
      requestedStep: "attempt_transition",
      predecessorLifecycleExecution: identity.lifecycleExecution,
      transitionExecution: transition,
    },
  };
  const existing = must(
    workflow.createOrganizationVerificationWorkflowStepRecord(base),
  );
  const same = must(
    workflow.createOrganizationVerificationWorkflowStepRecord({
      ...base,
      existingStepRecords: [existing],
    }),
  );
  assert.equal(same, existing);
  const duplicate = workflow.createOrganizationVerificationWorkflowStepRecord({
    ...base,
    occurredAt: "2026-08-30T00:02:11.000Z",
    existingStepRecords: [existing],
  });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.code, "duplicate_step_conflict");
  const branch = workflow.createOrganizationVerificationWorkflowStepRecord({
    ...base,
    workflowStepId: "workflow-conflict-branch",
    existingStepRecords: [existing],
  });
  assert.equal(branch.ok, false);
  if (!branch.ok) assert.equal(branch.code, "branch_conflict");
});

test("Workflow execution rejects identity, history, and artifact conflicts", () => {
  const fixture = buildCompleteWorkflowFixture();
  for (const overrides of [
    { workflowExecutionVersion: 10 },
    { workflowExecutionVersion: 8 },
    { workflowStage: "policy_completed" },
    { recordId: "other-record" },
    { lastStepAt: "2026-08-30T00:14:00.000Z" },
    { stepRecords: [...fixture.records].reverse() },
    {
      evidenceSnapshot: Object.freeze({
        ...fixture.preparation.snapshot,
      }),
    },
  ]) {
    assert.equal(
      workflow.createOrganizationVerificationWorkflowExecution({
        ...fixture.executionInput,
        ...overrides,
      } as workflow.CreateOrganizationVerificationWorkflowExecutionInput).ok,
      false,
    );
  }
  const conflict =
    workflow.createOrganizationVerificationWorkflowExecution({
      ...fixture.executionInput,
      provenanceReferences: ["changed-provenance"],
      existingWorkflowExecution: fixture.execution,
    });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.code, "workflow_conflict");
});

test("Workflow fingerprints are deterministic and semantic changes alter them", () => {
  const fixture = buildCompleteWorkflowFixture();
  const reordered = must(
    workflow.createOrganizationVerificationWorkflowExecution({
      ...fixture.executionInput,
      provenanceReferences: [
        "a-workflow-provenance",
        "z-workflow-provenance",
      ],
      integrityReferences: [
        "a-workflow-integrity",
        "z-workflow-integrity",
      ],
    }),
  );
  assert.equal(
    reordered.workflowExecutionFingerprint,
    fixture.execution.workflowExecutionFingerprint,
  );
  const changed = must(
    workflow.createOrganizationVerificationWorkflowExecution({
      ...fixture.executionInput,
      provenanceReferences: ["different-workflow-provenance"],
    }),
  );
  assert.notEqual(
    changed.workflowExecutionFingerprint,
    fixture.execution.workflowExecutionFingerprint,
  );
});

test("Workflow authenticity rejects every structural impersonation", () => {
  const fixture = buildCompleteWorkflowFixture();
  for (const copy of [
    {},
    { ...fixture.execution },
    Object.assign({}, fixture.execution),
    Object.freeze({ ...fixture.execution }),
    JSON.parse(JSON.stringify(fixture.execution)),
    structuredClone(fixture.execution),
  ]) {
    assert.equal(
      workflow.isOrganizationVerificationWorkflowExecution(copy),
      false,
    );
  }
  const step = fixture.records[0];
  assert.ok(step);
  for (const copy of [
    {},
    { ...step },
    Object.assign({}, step),
    Object.freeze({ ...step }),
    JSON.parse(JSON.stringify(step)),
    structuredClone(step),
  ]) {
    assert.equal(
      workflow.isOrganizationVerificationWorkflowStepRecord(copy),
      false,
    );
  }
});

test("public Workflow exports are exact and expose no internals", () => {
  assert.deepEqual(Object.keys(workflow).sort(), [
    "ORGANIZATION_VERIFICATION_WORKFLOW_STAGES",
    "ORGANIZATION_VERIFICATION_WORKFLOW_STEPS",
    "ORGANIZATION_VERIFICATION_WORKFLOW_STEP_AUTHORITY_MATRIX",
    "createOrganizationVerificationWorkflowExecution",
    "createOrganizationVerificationWorkflowStepRecord",
    "isOrganizationVerificationWorkflowExecution",
    "isOrganizationVerificationWorkflowStepRecord",
  ]);
});
