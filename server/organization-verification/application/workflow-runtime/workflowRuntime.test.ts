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
import * as binding from "../../domain/decision-trust-integration-contract/index.js";
import * as decision from "../../domain/decision/index.js";
import * as integration from "../../domain/decision-trust-integration/index.js";
import * as evaluationInput from "../../domain/evaluation-input/index.js";
import * as evaluationProjection from "../../domain/evaluation-projection/index.js";
import * as snapshot from "../../domain/evidence-snapshot/index.js";
import * as policy from "../../domain/policy/index.js";
import * as runtimeContract from "../../domain/policy-runtime-contract/index.js";
import * as policyRuntime from "../../domain/policy-runtime/index.js";
import * as trust from "../../domain/trust-status/index.js";
import * as lifecycleContract from "../attempt-lifecycle-contract/index.js";
import * as workflowContract from "../workflow-contract/index.js";
import * as workflowRuntime from "./index.js";

type Result<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code?: string; stage?: string }>;

function must<T>(result: Result<T>): T {
  assert.equal(
    result.ok,
    true,
    result.ok ? undefined : `${result.stage ?? "failure"}:${result.code ?? ""}`,
  );
  if (!result.ok) throw new Error(result.code ?? result.stage);
  return result.value;
}

const ORGANIZATION = "workflow-runtime-org-1";
const RECORD = "workflow-runtime-record-1";
const REVISION = "workflow-runtime-revision-1";
const ATTEMPT = "workflow-runtime-attempt-1";
const PROFILE_REVISION = "workflow-runtime-profile-revision-1";
const CORRELATION = "workflow-runtime-correlation-1";
const COMPLETION = "workflow-runtime-completion-1";

function snapshotAuthorityInput(): snapshot.BuildOrganizationVerificationEvidenceSnapshotInput {
  const correlationReference = must(
    snapshot.createEvidenceSnapshotCorrelationReference(CORRELATION),
  );
  const context = must(
    snapshot.createOrganizationVerificationEvidenceSnapshotConstructionContext({
      evidenceSnapshotId: must(
        snapshot.createEvidenceSnapshotId("workflow-runtime-snapshot-1"),
      ),
      evidenceSnapshotVersion: must(
        snapshot.createEvidenceSnapshotVersion(
          "workflow-runtime-snapshot-version-1",
        ),
      ),
      snapshotContractVersion: snapshot.EVIDENCE_SNAPSHOT_CONTRACT_VERSION,
      snapshotBuilderVersion: snapshot.EVIDENCE_SNAPSHOT_BUILDER_VERSION,
      manifestVersion: snapshot.EVIDENCE_SNAPSHOT_MANIFEST_VERSION,
      organizationId: ORGANIZATION as never,
      recordId: RECORD as never,
      revisionId: REVISION as never,
      profileRevisionId: PROFILE_REVISION as never,
      attemptBinding: {
        attemptId: ATTEMPT as never,
        attemptCreatedAt: "2026-09-01T00:02:00.000Z",
      },
      createdAt: "2026-09-01T00:04:00.000Z",
      sourceSelectionCompletedAt: "2026-09-01T00:03:30.000Z",
      sourceComplete: true,
      sourceIntegrityValid: true,
      provenanceReference: must(
        snapshot.createEvidenceSnapshotProvenanceReference(
          "workflow-runtime-snapshot-provenance",
        ),
      ),
      correlationReference,
      integrityReference: must(
        snapshot.createEvidenceSnapshotIntegrityReference(
          "workflow-runtime-snapshot-integrity",
        ),
      ),
    }),
  );
  return {
    context,
    registrySource: {
      profileRevision: {
        organizationId: ORGANIZATION,
        organizationProfileRevisionId: PROFILE_REVISION,
        organizationProfileRevisionSequence: 1,
        organizationProfileFingerprint:
          "workflow-runtime-profile-fingerprint-1",
        legalIdentityProjection: {
          legalName: "Workflow Runtime Synthetic Entity",
          tradingNames: ["Workflow Runtime Synthetic"],
          registrationJurisdiction: "ZZ",
          registrationIdentifiers: [
            { scheme: "synthetic.registry", value: "WORKFLOW-RUNTIME-1" },
          ],
        },
        organizationType: "synthetic_entity",
        jurisdiction: "ZZ",
        declaredActivityProjection: {
          activities: [{ code: "synthetic.trade" }],
        },
        organizationLifecycle: "active",
        registryContractVersion: "organization_registry_profile_revision.v1",
        publishedAt: "2026-09-01T00:00:00.000Z",
      } as never,
      provenanceReference: must(
        snapshot.createEvidenceSnapshotProvenanceReference(
          "workflow-runtime-registry-provenance",
        ),
      ),
      integrityReference: must(
        snapshot.createEvidenceSnapshotIntegrityReference(
          "workflow-runtime-registry-integrity",
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
        profileFingerprint: "workflow-runtime-profile-fingerprint-1",
        sequence: 1,
        declaredInputs: {
          sections: [
            {
              key: "organization",
              values: [{ key: "statement", value: "synthetic" }],
            },
          ],
        },
        evidenceReferenceIds: ["workflow-runtime-revision-evidence-1"],
        submissionActorAuthorityReference: {
          actorId: "workflow-runtime-actor-1",
          authorityReferenceId: "workflow-runtime-authority-1",
          authorityVersion: "authority.v1",
          organizationScope: ORGANIZATION,
          issuedAt: "2026-09-01T00:00:00.000Z",
          delegatedScopes: ["verification.submit"],
        },
        submittedAt: "2026-09-01T00:01:00.000Z",
        submissionIdempotencyKey: "workflow-runtime-submission-1",
        correlationId: CORRELATION,
      } as never,
      verificationSourceContractVersion:
        snapshot.VERIFICATION_REVISION_SOURCE_CONTRACT_VERSION,
      provenanceReference: must(
        snapshot.createEvidenceSnapshotProvenanceReference(
          "workflow-runtime-submission-provenance",
        ),
      ),
      integrityReference: must(
        snapshot.createEvidenceSnapshotIntegrityReference(
          "workflow-runtime-submission-integrity",
        ),
      ),
    },
    evidenceReferences: [
      {
        evidenceReferenceId: must(
          snapshot.createEvidenceReferenceId("workflow-runtime-evidence-1"),
        ),
        evidenceReferenceVersion: must(
          snapshot.createEvidenceReferenceVersion(
            "workflow-runtime-evidence-version-1",
          ),
        ),
        revisionEvidenceReferenceId:
          "workflow-runtime-revision-evidence-1" as never,
        evidenceKind: must(
          snapshot.createEvidenceKind("corporate.registration"),
        ),
        category: must(snapshot.createEvidenceCategory("legal.identity")),
        sourceAuthority: must(
          snapshot.createEvidenceSourceAuthority("customer.submission"),
        ),
        contentDigest: must(
          snapshot.createEvidenceContentDigest("a".repeat(64)),
        ),
        capturedAt: "2026-09-01T00:01:00.000Z",
        attributes: [{ key: "name", value: "Workflow Runtime Synthetic" }],
        provenanceReference: must(
          snapshot.createEvidenceSnapshotProvenanceReference(
            "workflow-runtime-evidence-provenance",
          ),
        ),
        correlationReference,
        integrityReference: must(
          snapshot.createEvidenceSnapshotIntegrityReference(
            "workflow-runtime-evidence-integrity",
          ),
        ),
      },
    ],
  };
}

function buildInitialChain(
  evidenceSnapshot: snapshot.OrganizationVerificationEvidenceSnapshot,
) {
  const organizationId = must(createOrganizationId(ORGANIZATION));
  const profileRevisionId = must(
    createOrganizationProfileRevisionId(PROFILE_REVISION),
  );
  const profileRevisionSequence = must(
    createOrganizationProfileRevisionSequence(1),
  );
  const profileFingerprint = must(
    createOrganizationProfileFingerprint(
      "workflow-runtime-profile-fingerprint-1",
    ),
  );
  const actor = must(
    parseActorAuthorityReference({
      actor_id: "workflow-runtime-actor-1",
      authority_reference_id: "workflow-runtime-authority-1",
      authority_version: "authority.v1",
      organization_scope: organizationId,
      issued_at: "2026-09-01T00:00:00.000Z",
      delegated_scopes: ["verification.submit"],
    }),
  );
  const record = must(
    core.createOrganizationVerificationRecord({
      recordId: must(core.createOrganizationVerificationRecordId(RECORD)),
      organizationId,
      createdAt: "2026-09-01T00:00:00.000Z",
    }),
  );
  const draft = must(
    core.createDraftForRecord(record, {
      draftId: must(
        core.createOrganizationVerificationDraftId(
          "workflow-runtime-draft-1",
        ),
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
            "workflow-runtime-revision-evidence-1",
          ),
        ),
      ],
      draftVersion: must(core.createDraftVersion(1)),
      at: "2026-09-01T00:00:30.000Z",
      actorAuthorityReference: actor,
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
        submissionActorAuthorityReference: actor,
        submittedAt: "2026-09-01T00:01:00.000Z",
        submissionIdempotencyKey: must(
          core.createSubmissionIdempotencyKey(
            "workflow-runtime-submission-1",
          ),
        ),
        correlationId: must(core.createCorrelationId(CORRELATION)),
      },
    ),
  );
  const created = must(
    core.createAttemptForRevision(submitted.record, submitted.revision, {
      attemptId: must(core.createOrganizationVerificationAttemptId(ATTEMPT)),
      sequence: must(core.createVerificationAttemptSequence(1)),
      snapshotId: must(
        core.createSnapshotId(String(evidenceSnapshot.evidenceSnapshotId)),
      ),
      snapshotFingerprint: must(
        core.createSnapshotFingerprint(
          String(evidenceSnapshot.snapshotFingerprint),
        ),
      ),
      createdAt: "2026-09-01T00:02:00.000Z",
      correlationId: must(core.createCorrelationId(CORRELATION)),
    }),
  );
  const lifecycleExecution = must(
    lifecycleContract.createOrganizationVerificationAttemptLifecycleExecution({
      lifecycleExecutionId: "workflow-runtime-lifecycle-1",
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
      createdAt: "2026-09-01T00:02:00.000Z",
      provenanceReferences: ["workflow-runtime-lifecycle-provenance"],
      integrityReferences: ["workflow-runtime-lifecycle-integrity"],
    }),
  );
  const workflowExecution = must(
    workflowContract.createOrganizationVerificationWorkflowExecution({
      workflowExecutionId: "workflow-runtime-execution-1",
      workflowExecutionVersion: 1,
      organizationId,
      recordId: created.record.recordId,
      revisionId: submitted.revision.revisionId,
      attemptId: created.attempt.attemptId,
      workflowStage: "attempt_in_progress",
      lifecycleExecution,
      stepRecords: [],
      createdAt: "2026-09-01T00:02:00.000Z",
      provenanceReferences: ["workflow-runtime-provenance"],
      integrityReferences: ["workflow-runtime-integrity"],
    }),
  );
  return {
    organizationId,
    record: created.record,
    revision: submitted.revision,
    workflowExecution,
  };
}

function common(
  workflowExecution: workflowContract.OrganizationVerificationWorkflowExecution,
  workflowStepId: string,
  occurredAt: string,
) {
  return {
    workflowExecution,
    workflowStepId,
    occurredAt,
    provenanceReferences: [`${workflowStepId}-provenance`],
    integrityReferences: [`${workflowStepId}-integrity`],
    correlationId: CORRELATION,
    causationId: `${workflowStepId}-causation`,
    reasonReference: `${workflowStepId}-reason`,
  };
}

function attemptInput(
  workflowExecution: workflowContract.OrganizationVerificationWorkflowExecution,
  transitionId: string,
  requestedTransition: "queued" | "running" | "completed",
  occurredAt: string,
) {
  const lifecycle = workflowExecution.lifecycleExecution;
  return {
    lifecycleExecutionId: lifecycle.lifecycleExecutionId,
    expectedPredecessorLifecycleExecutionVersion:
      lifecycle.lifecycleExecutionVersion,
    nextLifecycleExecutionVersion: lifecycle.lifecycleExecutionVersion + 1,
    transitionId,
    requestedTransition,
    expectedPredecessorAttemptState: lifecycle.attempt.processState,
    expectedResultingAttemptState: requestedTransition,
    recordId: lifecycle.recordId,
    revisionId: lifecycle.revisionId,
    attemptId: lifecycle.attemptId,
    attemptSequence: lifecycle.attemptSequence,
    occurredAt,
    provenanceReferences: [`${transitionId}-provenance`],
    integrityReferences: [`${transitionId}-integrity`],
    ...(requestedTransition === "completed"
      ? {
          completionReference: must(
            core.createCompletionReference(COMPLETION),
          ),
        }
      : {}),
  };
}

function preparationInputs(
  snapshotInput: snapshot.BuildOrganizationVerificationEvidenceSnapshotInput,
) {
  const evidenceSnapshot = must(
    snapshot.buildOrganizationVerificationEvidenceSnapshot(snapshotInput),
  );
  const projectionContext = must(
    evaluationProjection.createOrganizationVerificationEvaluationProjectionConstructionContext(
      {
        evaluationProjectionId: must(
          evaluationProjection.createEvaluationProjectionId(
            "workflow-runtime-projection-1",
          ),
        ),
        evaluationProjectionVersion: must(
          evaluationProjection.createEvaluationProjectionVersion(
            "workflow-runtime-projection-version-1",
          ),
        ),
        projectionContractVersion:
          evaluationProjection.EVALUATION_PROJECTION_CONTRACT_VERSION,
        projectionBuilderVersion:
          evaluationProjection.EVALUATION_PROJECTION_BUILDER_VERSION,
        projectionSchemaVersion:
          evaluationProjection.EVALUATION_PROJECTION_SCHEMA_VERSION,
        projectedAt: "2026-09-01T00:05:00.000Z",
        provenanceReference: must(
          evaluationProjection.createEvaluationProjectionProvenanceReference(
            "workflow-runtime-projection-provenance",
          ),
        ),
        integrityReference: must(
          evaluationProjection.createEvaluationProjectionIntegrityReference(
            "workflow-runtime-projection-integrity",
          ),
        ),
      },
    ),
  );
  const projection = must(
    evaluationProjection.buildOrganizationVerificationEvaluationProjection({
      context: projectionContext,
      evidenceSnapshot,
    }),
  );
  const policySet = must(
    policy.createOrganizationVerificationPolicySet({
      policySetId: must(
        policy.createOrganizationVerificationPolicySetId(
          "workflow-runtime-policy-set-1",
        ),
      ),
      policySetVersion: must(
        policy.createOrganizationVerificationPolicySetVersion(
          "workflow-runtime-policy-set-version-1",
        ),
      ),
      policyContractVersion: policy.POLICY_CONTRACT_VERSION,
      name: "Synthetic workflow runtime policy",
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      rules: [
        {
          ruleId: must(
            policy.createOrganizationVerificationRuleId(
              "workflow-runtime-rule-1",
            ),
          ),
          ruleVersion: must(
            policy.createOrganizationVerificationRuleVersion(
              "workflow-runtime-rule-version-1",
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
          "workflow-runtime-policy-provenance",
        ),
      ),
      integrityReference: must(
        policy.createOrganizationVerificationPolicySetIntegrityReference(
          "workflow-runtime-policy-integrity",
        ),
      ),
    }),
  );
  const rule = must(
    policy.createOrganizationVerificationRule({
      policySetId: policySet.policySetId,
      policySetVersion: policySet.policySetVersion,
      policyContractVersion: policySet.policyContractVersion,
      ruleId: policySet.rules[0]!.ruleId,
      ruleVersion: policySet.rules[0]!.ruleVersion,
      ruleContractVersion: policy.RULE_CONTRACT_VERSION,
      title: "Synthetic satisfied rule",
      normalizedCategory: "organization_verification.synthetic",
      severity: "low",
      evaluationDisposition: "satisfied",
      reasonCode: "organization_verification.synthetic.satisfied",
      required: true,
      evaluationOrder: 1,
      provenanceReference: policySet.provenanceReference,
      integrityReference: must(
        policy.createOrganizationVerificationRuleIntegrityReference(
          "workflow-runtime-rule-integrity",
        ),
      ),
    }),
  );
  const implementation = must(
    runtimeContract.createOrganizationVerificationRuleImplementation({
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      policySetId: policySet.policySetId,
      policySetVersion: policySet.policySetVersion,
      implementationContractVersion:
        runtimeContract.ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_CONTRACT_VERSION,
      implementationVersion: must(
        runtimeContract.createOrganizationVerificationRuleImplementationVersion(
          "workflow-runtime-implementation-version-1",
        ),
      ),
      implementationDigest: must(
        runtimeContract.createOrganizationVerificationRuleImplementationDigest(
          "b".repeat(64),
        ),
      ),
      provenanceReference: must(
        runtimeContract.createOrganizationVerificationRuleImplementationProvenanceReference(
          "workflow-runtime-implementation-provenance",
        ),
      ),
      integrityReference: must(
        runtimeContract.createOrganizationVerificationRuleImplementationIntegrityReference(
          "workflow-runtime-implementation-integrity",
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
          "workflow-runtime-implementation-set-1",
        ),
      ),
      implementationSetVersion: must(
        runtimeContract.createOrganizationVerificationRuleImplementationSetVersion(
          "workflow-runtime-implementation-set-version-1",
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
  const policySetBinding = must(
    evaluationInput.createOrganizationVerificationPolicySetBinding({
      policySetId: policySet.policySetId,
      policySetVersion: policySet.policySetVersion,
      policyContractVersion: policySet.policyContractVersion,
      provenanceReference: policySet.provenanceReference,
      integrityReference: policySet.integrityReference,
    }),
  );
  const evaluationContext = must(
    evaluationInput.createOrganizationVerificationEvaluationContext({
      contextContractVersion:
        evaluationInput.EVALUATION_CONTEXT_CONTRACT_VERSION,
      requestedAt: "2026-09-01T00:06:00.000Z",
      effectiveAt: "2026-09-01T00:06:00.000Z",
      sourceCutoffAt: "2026-09-01T00:04:00.000Z",
      executionReference: must(
        evaluationInput.createOrganizationVerificationEvaluationExecutionReference(
          "workflow-runtime-evaluation-execution-1",
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
          "workflow-runtime-evaluation-context-provenance",
        ),
      ),
      correlationReference: must(
        evaluationInput.createOrganizationVerificationEvaluationCorrelationReference(
          CORRELATION,
        ),
      ),
      integrityReference: must(
        evaluationInput.createOrganizationVerificationEvaluationIntegrityReference(
          "workflow-runtime-evaluation-context-integrity",
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
          "workflow-runtime-evaluation-scope-provenance",
        ),
      ),
      integrityReference: must(
        evaluationInput.createOrganizationVerificationEvaluationIntegrityReference(
          "workflow-runtime-evaluation-scope-integrity",
        ),
      ),
    }),
  );
  const policyEvaluationInput = must(
    evaluationInput.buildOrganizationVerificationPolicyEvaluationInput({
      policyEvaluationInputId: must(
        evaluationInput.createOrganizationVerificationPolicyEvaluationInputId(
          "workflow-runtime-evaluation-input-1",
        ),
      ),
      policyEvaluationInputVersion: must(
        evaluationInput.createOrganizationVerificationPolicyEvaluationInputVersion(
          "workflow-runtime-evaluation-input-version-1",
        ),
      ),
      inputContractVersion:
        evaluationInput.POLICY_EVALUATION_INPUT_CONTRACT_VERSION,
      inputBuilderVersion:
        evaluationInput.POLICY_EVALUATION_INPUT_BUILDER_VERSION,
      createdAt: "2026-09-01T00:07:00.000Z",
      evaluationProjection: projection,
      policySetBinding,
      evaluationContext,
      evaluationScope,
    }),
  );
  const artifactProvenance = must(
    runtimeContract.createOrganizationVerificationExecutionArtifactProvenanceReference(
      "workflow-runtime-artifact-provenance",
    ),
  );
  const artifactIntegrity = must(
    runtimeContract.createOrganizationVerificationExecutionArtifactIntegrityReference(
      "workflow-runtime-artifact-integrity",
    ),
  );
  const executionArtifacts = must(
    runtimeContract.createOrganizationVerificationExecutionArtifacts({
      executionArtifactsContractVersion:
        runtimeContract.ORGANIZATION_VERIFICATION_EXECUTION_ARTIFACTS_CONTRACT_VERSION,
      evaluationInput: policyEvaluationInput,
      implementationSet,
      executionId: must(
        runtimeContract.createOrganizationVerificationExecutionId(
          "workflow-runtime-policy-execution-1",
        ),
      ),
      startedAt: "2026-09-01T00:08:00.000Z",
      completedAt: "2026-09-01T00:09:00.000Z",
      provenanceReference: artifactProvenance,
      integrityReference: artifactIntegrity,
      ruleResults: [
        {
          ruleId: rule.ruleId,
          ruleVersion: rule.ruleVersion,
          ruleResultId: must(
            runtimeContract.createOrganizationVerificationRuleResultId(
              "workflow-runtime-rule-result-1",
            ),
          ),
          evaluatedAt: "2026-09-01T00:08:30.000Z",
          provenanceReference: artifactProvenance,
          integrityReference: artifactIntegrity,
        },
      ],
      findings: [],
      completion: {
        completionId: must(
          policy.createOrganizationVerificationPolicyEvaluationCompletionId(
            COMPLETION,
          ),
        ),
        completedAt: "2026-09-01T00:09:00.000Z",
        provenanceReference: artifactProvenance,
        integrityReference: artifactIntegrity,
      },
    }),
  );
  return {
    evidenceSnapshot,
    projection,
    policyEvaluationInput,
    projectionInput: { context: projectionContext },
    evaluationInput: {
      policyEvaluationInputId: policyEvaluationInput.policyEvaluationInputId,
      policyEvaluationInputVersion:
        policyEvaluationInput.policyEvaluationInputVersion,
      inputContractVersion:
        evaluationInput.POLICY_EVALUATION_INPUT_CONTRACT_VERSION,
      inputBuilderVersion:
        evaluationInput.POLICY_EVALUATION_INPUT_BUILDER_VERSION,
      createdAt: policyEvaluationInput.createdAt,
      policySetBinding,
      evaluationContext,
      evaluationScope,
    },
    policyInput: { policySet, implementationSet, executionArtifacts },
  };
}

function executeStep(
  input: workflowRuntime.ExecuteOrganizationVerificationWorkflowStepInput,
) {
  return must(
    workflowRuntime.executeOrganizationVerificationWorkflowStep(input),
  );
}

export function buildRuntimeFixture() {
  const snapshotInput = snapshotAuthorityInput();
  const preparation = preparationInputs(snapshotInput);
  const chain = buildInitialChain(preparation.evidenceSnapshot);
  let current = chain.workflowExecution;
  const stages: workflowContract.OrganizationVerificationWorkflowStage[] = [
    current.workflowStage,
  ];

  const transition = (
    id: string,
    state: "queued" | "running" | "completed",
    at: string,
  ) => {
    const execution = executeStep({
      ...common(current, `workflow-runtime-step-${id}`, at),
      requestedStep: "attempt_transition",
      attemptTransitionInput: attemptInput(
        current,
        `workflow-runtime-transition-${id}`,
        state,
        at,
      ),
    });
    current = execution.nextWorkflowExecution;
    stages.push(current.workflowStage);
    return execution;
  };

  const queued = transition("queued-1", "queued", "2026-09-01T00:02:10.000Z");
  const running = transition(
    "running-1",
    "running",
    "2026-09-01T00:02:20.000Z",
  );
  const requeued = transition(
    "queued-2",
    "queued",
    "2026-09-01T00:02:30.000Z",
  );
  const rerunning = transition(
    "running-2",
    "running",
    "2026-09-01T00:02:40.000Z",
  );
  const completed = transition(
    "completed",
    "completed",
    "2026-09-01T00:03:00.000Z",
  );

  const snapshotExecution = executeStep({
    ...common(
      current,
      "workflow-runtime-step-snapshot",
      "2026-09-01T00:04:00.000Z",
    ),
    requestedStep: "bind_snapshot",
    snapshotInput,
  });
  current = snapshotExecution.nextWorkflowExecution;
  stages.push(current.workflowStage);

  const projectionExecution = executeStep({
    ...common(
      current,
      "workflow-runtime-step-projection",
      "2026-09-01T00:05:00.000Z",
    ),
    requestedStep: "bind_projection",
    projectionInput: preparation.projectionInput,
  });
  current = projectionExecution.nextWorkflowExecution;
  stages.push(current.workflowStage);

  const evaluationInputExecution = executeStep({
    ...common(
      current,
      "workflow-runtime-step-evaluation-input",
      "2026-09-01T00:07:00.000Z",
    ),
    requestedStep: "bind_evaluation_input",
    evaluationInput: preparation.evaluationInput,
  });
  current = evaluationInputExecution.nextWorkflowExecution;
  stages.push(current.workflowStage);

  const policyExecution = executeStep({
    ...common(
      current,
      "workflow-runtime-step-policy",
      "2026-09-01T00:09:00.000Z",
    ),
    requestedStep: "complete_policy",
    policyInput: preparation.policyInput,
  });
  current = policyExecution.nextWorkflowExecution;
  stages.push(current.workflowStage);
  assert.equal(policyExecution.requestedStep, "complete_policy");
  if (policyExecution.requestedStep !== "complete_policy") {
    throw new Error("unexpected policy execution");
  }

  const decisionId = must(
    decision.createOrganizationVerificationDecisionId(
      "workflow-runtime-decision-1",
    ),
  );
  const projectionId = must(
    trust.createTrustStatusProjectionId(
      "workflow-runtime-trust-projection-1",
    ),
  );
  const applicability = must(
    trust.createDecisionApplicability({
      applicabilityId: must(
        trust.createDecisionApplicabilityId(
          "workflow-runtime-applicability-1",
        ),
      ),
      version: trust.DECISION_APPLICABILITY_VERSION,
      decisionId,
      effectiveAt: "2026-09-01T00:12:00.000Z",
      provenanceReference: must(
        trust.createTrustStatusProvenanceReference(
          "workflow-runtime-applicability-provenance",
        ),
      ),
      correlationId: policyExecution.authorityResult.completion.correlationId,
      integrityReference: must(
        trust.createTrustStatusIntegrityReference(
          "workflow-runtime-applicability-integrity",
        ),
      ),
      applicable: true,
      superseded: false,
      expired: false,
      invalidated: false,
    }),
  );
  const runtimePolicy = policyExecution.authorityResult;
  const integrationExecution = executeStep({
    ...common(
      current,
      "workflow-runtime-step-integration",
      "2026-09-01T00:15:00.000Z",
    ),
    requestedStep: "complete_decision_trust_integration",
    decisionTrustIntegrationInput: {
      inputBindingArtifacts: {
        bindingId: must(
          binding.createOrganizationVerificationDecisionTrustBindingId(
            "workflow-runtime-binding-1",
          ),
        ),
        bindingContractVersion:
          binding.ORGANIZATION_VERIFICATION_DECISION_TRUST_BINDING_CONTRACT_VERSION,
        runtimeExecutionId: runtimePolicy.executionId,
        runtimeExecutionContractVersion: runtimePolicy.executionContractVersion,
        runtimeExecutorVersion: runtimePolicy.executorVersion,
        runtimeExecutionFingerprint: runtimePolicy.executionFingerprint,
        policyEvaluationInputId: runtimePolicy.policyEvaluationInputId,
        policyEvaluationInputVersion: runtimePolicy.policyEvaluationInputVersion,
        policyEvaluationInputFingerprint:
          runtimePolicy.policyEvaluationInputFingerprint,
        organizationId: runtimePolicy.completion.organizationId,
        recordId: runtimePolicy.completion.recordId,
        revisionId: runtimePolicy.completion.revisionId,
        attemptId: runtimePolicy.completion.attemptId,
        snapshotId: runtimePolicy.completion.snapshotId,
        snapshotFingerprint: runtimePolicy.completion.snapshotFingerprint,
        policySetId: runtimePolicy.policySetId,
        policySetVersion: runtimePolicy.policySetVersion,
        policyEvaluationCompletionId:
          runtimePolicy.completion.evaluationCompletionId,
        boundAt: "2026-09-01T00:10:00.000Z",
        provenanceReference: must(
          binding.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
            "workflow-runtime-input-binding-provenance",
          ),
        ),
        integrityReference: must(
          binding.createOrganizationVerificationDecisionTrustBindingIntegrityReference(
            "workflow-runtime-input-binding-integrity",
          ),
        ),
      },
      decisionContext: {
        decisionId,
        decisionEngineVersion: must(
          decision.createDecisionEngineVersion(
            "workflow-runtime-decision-engine-v1",
          ),
        ),
        decidedAt: "2026-09-01T00:11:00.000Z",
        integrityReference: must(
          decision.createDecisionIntegrityReference(
            "workflow-runtime-decision-integrity",
          ),
        ),
        record: chain.record,
        revision: chain.revision,
        attempt: current.lifecycleExecution.attempt,
      },
      trustSourceFactsArtifacts: {
        sourceFactsVersion: trust.TRUST_STATUS_SOURCE_FACTS_VERSION,
        sourceFactsComplete: true,
        sourceFactsIntegrityValid: true,
        organizationId: chain.organizationId,
        recordId: chain.record.recordId,
        currentVerificationRevisionId: chain.revision.revisionId,
        authoritativeDecisionId: decisionId,
        authoritativeAttemptId: current.attemptId,
        authoritativeSnapshotId: runtimePolicy.completion.snapshotId,
        authoritativeSnapshotFingerprint:
          runtimePolicy.completion.snapshotFingerprint,
        decisionApplicability: applicability,
        derivationAsOf: "2026-09-01T00:13:00.000Z",
        provenanceReference: must(
          trust.createTrustStatusProvenanceReference(
            "workflow-runtime-source-facts-provenance",
          ),
        ),
        correlationId: runtimePolicy.completion.correlationId,
        integrityReference: must(
          trust.createTrustStatusIntegrityReference(
            "workflow-runtime-source-facts-integrity",
          ),
        ),
      },
      trustDerivationContext: {
        projectionId,
        deriverVersion: trust.TRUST_STATUS_DERIVER_VERSION,
        derivedAt: "2026-09-01T00:13:00.000Z",
        integrityReference: must(
          trust.createTrustStatusIntegrityReference(
            "workflow-runtime-trust-integrity",
          ),
        ),
      },
      bindingArtifacts: {
        decision: {
          decisionId,
          boundAt: "2026-09-01T00:12:00.000Z",
          provenanceReference: must(
            binding.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
              "workflow-runtime-decision-binding-provenance",
            ),
          ),
          integrityReference: must(
            binding.createOrganizationVerificationDecisionTrustBindingIntegrityReference(
              "workflow-runtime-decision-binding-integrity",
            ),
          ),
        },
        trust: {
          projectionId,
          sourceDecisionId: decisionId,
          boundAt: "2026-09-01T00:14:00.000Z",
          provenanceReference: must(
            binding.createOrganizationVerificationDecisionTrustBindingProvenanceReference(
              "workflow-runtime-trust-binding-provenance",
            ),
          ),
          integrityReference: must(
            binding.createOrganizationVerificationDecisionTrustBindingIntegrityReference(
              "workflow-runtime-trust-binding-integrity",
            ),
          ),
        },
      },
      executionArtifacts: {
        executionId: must(
          integration.createOrganizationVerificationDecisionTrustIntegrationExecutionId(
            "workflow-runtime-integration-execution-1",
          ),
        ),
        executionContractVersion:
          integration.ORGANIZATION_VERIFICATION_DECISION_TRUST_INTEGRATION_EXECUTION_CONTRACT_VERSION,
        startedAt: "2026-09-01T00:10:00.000Z",
        completedAt: "2026-09-01T00:15:00.000Z",
        provenanceReference: must(
          integration.createOrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference(
            "workflow-runtime-integration-provenance",
          ),
        ),
        integrityReference: must(
          integration.createOrganizationVerificationDecisionTrustIntegrationExecutionIntegrityReference(
            "workflow-runtime-integration-integrity",
          ),
        ),
      },
    },
  });
  stages.push(integrationExecution.nextWorkflowExecution.workflowStage);
  return {
    chain,
    snapshotInput,
    preparation,
    queued,
    running,
    requeued,
    rerunning,
    completed,
    snapshotExecution,
    projectionExecution,
    evaluationInputExecution,
    policyExecution,
    integrationExecution,
    stages,
  };
}

test("executes the six authorized steps one authority at a time", () => {
  const fixture = buildRuntimeFixture();
  assert.deepEqual(fixture.stages, [
    "attempt_in_progress",
    "attempt_in_progress",
    "attempt_in_progress",
    "attempt_in_progress",
    "attempt_in_progress",
    "attempt_completed",
    "snapshot_bound",
    "projection_bound",
    "evaluation_input_bound",
    "policy_completed",
    "completed",
  ]);
  assert.equal(
    fixture.queued.authorityResult.nextLifecycleExecution.attempt.processState,
    "queued",
  );
  assert.equal(
    fixture.running.authorityResult.nextLifecycleExecution.attempt.processState,
    "running",
  );
  assert.equal(
    fixture.requeued.authorityResult.nextLifecycleExecution.attempt.processState,
    "queued",
  );
  assert.equal(
    fixture.completed.authorityResult.nextLifecycleExecution.attempt.processState,
    "completed",
  );
});

test("increments only the Workflow version and preserves the Attempt sequence", () => {
  const fixture = buildRuntimeFixture();
  const executions = [
    fixture.queued,
    fixture.running,
    fixture.requeued,
    fixture.rerunning,
    fixture.completed,
    fixture.snapshotExecution,
    fixture.projectionExecution,
    fixture.evaluationInputExecution,
    fixture.policyExecution,
    fixture.integrationExecution,
  ];
  for (const [index, execution] of executions.entries()) {
    assert.equal(execution.predecessorWorkflowExecutionVersion, index + 1);
    assert.equal(execution.nextWorkflowExecutionVersion, index + 2);
    assert.equal(
      execution.nextWorkflowExecution.lifecycleExecution.attemptSequence,
      1,
    );
    assert.equal(
      execution.nextWorkflowExecution.stepRecords.length,
      index + 1,
    );
  }
});

test("binds exact authentic outputs and preserves all earlier artifacts", () => {
  const fixture = buildRuntimeFixture();
  const completed = fixture.integrationExecution.nextWorkflowExecution;
  assert.equal(
    completed.evidenceSnapshot,
    fixture.snapshotExecution.authorityResult,
  );
  assert.equal(
    completed.evaluationProjection,
    fixture.projectionExecution.authorityResult,
  );
  assert.equal(
    completed.policyEvaluationInput,
    fixture.evaluationInputExecution.authorityResult,
  );
  assert.equal(
    completed.policyEvaluationExecution,
    fixture.policyExecution.authorityResult,
  );
  assert.equal(
    completed.decisionTrustIntegrationExecution,
    fixture.integrationExecution.authorityResult,
  );
  assert.equal(
    integration.isOrganizationVerificationDecisionTrustIntegrationExecution(
      fixture.integrationExecution.authorityResult,
    ),
    true,
  );
  assert.equal(
    decision.isOrganizationVerificationDecision(
      fixture.integrationExecution.authorityResult.decision,
    ),
    true,
  );
  assert.equal(
    trust.isOrganizationVerificationTrustStatus(
      fixture.integrationExecution.authorityResult.trustStatus,
    ),
    true,
  );
});

test("completed remains coordination vocabulary only", () => {
  const fixture = buildRuntimeFixture();
  const execution = fixture.integrationExecution;
  assert.equal(execution.resultingStage, "completed");
  assert.equal(
    ["approved", "verified", "trusted", "eligible"].includes(
      execution.resultingStage,
    ),
    false,
  );
});

test("rejects out-of-order, skipped, and post-completion steps", () => {
  const fixture = buildRuntimeFixture();
  const initial = fixture.chain.workflowExecution;
  const earlySnapshot =
    workflowRuntime.executeOrganizationVerificationWorkflowStep({
      ...common(
        initial,
        "workflow-runtime-invalid-early",
        "2026-09-01T00:04:00.000Z",
      ),
      requestedStep: "bind_snapshot",
      snapshotInput: fixture.snapshotInput,
    });
  assert.deepEqual(earlySnapshot, {
    ok: false,
    stage: "workflow_runtime",
    code: "invalid_workflow_step_for_stage",
  });
  const afterCompleted =
    workflowRuntime.executeOrganizationVerificationWorkflowStep({
      ...common(
        fixture.integrationExecution.nextWorkflowExecution,
        "workflow-runtime-invalid-completed",
        "2026-09-01T00:16:00.000Z",
      ),
      requestedStep: "complete_decision_trust_integration",
      decisionTrustIntegrationInput: {} as never,
    });
  assert.deepEqual(afterCompleted, {
    ok: false,
    stage: "workflow_runtime",
    code: "invalid_workflow_step_for_stage",
  });
});

test("rejects fake, spread, serialized, and structured Workflow values", () => {
  const fixture = buildRuntimeFixture();
  const authentic = fixture.chain.workflowExecution;
  const candidates = [
    { ...authentic },
    Object.freeze({ ...authentic }),
    JSON.parse(JSON.stringify(authentic)),
    structuredClone(authentic),
  ];
  for (const candidate of candidates) {
    const result =
      workflowRuntime.executeOrganizationVerificationWorkflowStep({
        ...common(
          candidate as never,
          "workflow-runtime-fake",
          "2026-09-01T00:02:10.000Z",
        ),
        requestedStep: "attempt_transition",
        attemptTransitionInput: attemptInput(
          authentic,
          "workflow-runtime-fake-transition",
          "queued",
          "2026-09-01T00:02:10.000Z",
        ),
      });
    assert.deepEqual(result, {
      ok: false,
      stage: "workflow_runtime",
      code: "unauthentic_workflow_execution",
    });
  }
});

test("runtime result authenticity rejects every structural impersonation", () => {
  const execution = buildRuntimeFixture().queued;
  assert.equal(
    workflowRuntime.isOrganizationVerificationWorkflowStepExecution(execution),
    true,
  );
  for (const candidate of [
    { ...execution },
    Object.freeze({ ...execution }),
    JSON.parse(JSON.stringify(execution)),
    structuredClone(execution),
  ]) {
    assert.equal(
      workflowRuntime.isOrganizationVerificationWorkflowStepExecution(
        candidate,
      ),
      false,
    );
  }
});

test("identical explicit replay is deterministic and semantically idempotent", () => {
  const fixture = buildRuntimeFixture();
  const predecessor = fixture.chain.workflowExecution;
  const input = {
    ...common(
      predecessor,
      "workflow-runtime-idempotent-step",
      "2026-09-01T00:02:10.000Z",
    ),
    requestedStep: "attempt_transition" as const,
    attemptTransitionInput: attemptInput(
      predecessor,
      "workflow-runtime-idempotent-transition",
      "queued",
      "2026-09-01T00:02:10.000Z",
    ),
  };
  const first = executeStep(input);
  const replay = executeStep({
    ...input,
    existingWorkflowStepExecution: first,
  });
  assert.equal(replay, first);
  assert.equal(
    replay.workflowStepExecutionFingerprint,
    first.workflowStepExecutionFingerprint,
  );
  assert.equal(
    replay.nextWorkflowExecution.workflowExecutionFingerprint,
    first.nextWorkflowExecution.workflowExecutionFingerprint,
  );
});

test("reference and property insertion order do not alter fingerprints", () => {
  const predecessor = buildRuntimeFixture().chain.workflowExecution;
  const authorityInput = attemptInput(
    predecessor,
    "workflow-runtime-canonical-transition",
    "queued",
    "2026-09-01T00:02:10.000Z",
  );
  const first = executeStep({
    workflowExecution: predecessor,
    workflowStepId: "workflow-runtime-canonical-step",
    requestedStep: "attempt_transition",
    occurredAt: "2026-09-01T00:02:10.000Z",
    provenanceReferences: ["step-provenance-b", "step-provenance-a"],
    integrityReferences: ["step-integrity-b", "step-integrity-a"],
    attemptTransitionInput: {
      ...authorityInput,
      provenanceReferences: [
        "transition-provenance-b",
        "transition-provenance-a",
      ],
      integrityReferences: [
        "transition-integrity-b",
        "transition-integrity-a",
      ],
    },
  });
  const second = executeStep({
    integrityReferences: ["step-integrity-a", "step-integrity-b"],
    provenanceReferences: ["step-provenance-a", "step-provenance-b"],
    occurredAt: "2026-09-01T00:02:10.000Z",
    requestedStep: "attempt_transition",
    workflowStepId: "workflow-runtime-canonical-step",
    workflowExecution: predecessor,
    attemptTransitionInput: {
      integrityReferences: [
        "transition-integrity-a",
        "transition-integrity-b",
      ],
      provenanceReferences: [
        "transition-provenance-a",
        "transition-provenance-b",
      ],
      occurredAt: authorityInput.occurredAt,
      attemptSequence: authorityInput.attemptSequence,
      attemptId: authorityInput.attemptId,
      revisionId: authorityInput.revisionId,
      recordId: authorityInput.recordId,
      expectedResultingAttemptState:
        authorityInput.expectedResultingAttemptState,
      expectedPredecessorAttemptState:
        authorityInput.expectedPredecessorAttemptState,
      requestedTransition: authorityInput.requestedTransition,
      transitionId: authorityInput.transitionId,
      nextLifecycleExecutionVersion:
        authorityInput.nextLifecycleExecutionVersion,
      expectedPredecessorLifecycleExecutionVersion:
        authorityInput.expectedPredecessorLifecycleExecutionVersion,
      lifecycleExecutionId: authorityInput.lifecycleExecutionId,
    },
  });
  assert.equal(
    first.authorityResult.attemptLifecycleTransitionExecutionFingerprint,
    second.authorityResult.attemptLifecycleTransitionExecutionFingerprint,
  );
  assert.equal(
    first.workflowStepRecord.workflowStepBindingFingerprint,
    second.workflowStepRecord.workflowStepBindingFingerprint,
  );
  assert.equal(
    first.nextWorkflowExecution.workflowExecutionFingerprint,
    second.nextWorkflowExecution.workflowExecutionFingerprint,
  );
  assert.equal(
    first.workflowStepExecutionFingerprint,
    second.workflowStepExecutionFingerprint,
  );
});

test("conflicting branch and step identity fail closed", () => {
  const fixture = buildRuntimeFixture();
  const predecessor = fixture.chain.workflowExecution;
  const existing = executeStep({
    ...common(
      predecessor,
      "workflow-runtime-conflict-step",
      "2026-09-01T00:02:10.000Z",
    ),
    requestedStep: "attempt_transition",
    attemptTransitionInput: attemptInput(
      predecessor,
      "workflow-runtime-conflict-transition",
      "queued",
      "2026-09-01T00:02:10.000Z",
    ),
  });
  const branch = workflowRuntime.executeOrganizationVerificationWorkflowStep({
    ...common(
      predecessor,
      "workflow-runtime-other-step",
      "2026-09-01T00:02:10.000Z",
    ),
    requestedStep: "attempt_transition",
    attemptTransitionInput: attemptInput(
      predecessor,
      "workflow-runtime-other-transition",
      "queued",
      "2026-09-01T00:02:10.000Z",
    ),
    existingWorkflowStepExecution: existing,
  });
  assert.deepEqual(branch, {
    ok: false,
    stage: "workflow_runtime",
    code: "workflow_step_execution_conflict",
  });
});

test("chronology and irrelevant authority inputs fail closed", () => {
  const fixture = buildRuntimeFixture();
  const predecessor = fixture.chain.workflowExecution;
  const old = workflowRuntime.executeOrganizationVerificationWorkflowStep({
    ...common(
      predecessor,
      "workflow-runtime-old-step",
      "2026-08-31T23:59:00.000Z",
    ),
    requestedStep: "attempt_transition",
    attemptTransitionInput: attemptInput(
      predecessor,
      "workflow-runtime-old-transition",
      "queued",
      "2026-08-31T23:59:00.000Z",
    ),
  });
  assert.deepEqual(old, {
    ok: false,
    stage: "workflow_runtime",
    code: "invalid_runtime_artifacts",
  });
  const conflicting =
    workflowRuntime.executeOrganizationVerificationWorkflowStep({
      ...common(
        predecessor,
        "workflow-runtime-extra-step",
        "2026-09-01T00:02:10.000Z",
      ),
      requestedStep: "attempt_transition",
      attemptTransitionInput: attemptInput(
        predecessor,
        "workflow-runtime-extra-transition",
        "queued",
        "2026-09-01T00:02:10.000Z",
      ),
      snapshotInput: fixture.snapshotInput,
    } as never);
  assert.deepEqual(conflicting, {
    ok: false,
    stage: "workflow_runtime",
    code: "invalid_runtime_artifacts",
  });
  const missing =
    workflowRuntime.executeOrganizationVerificationWorkflowStep({
      ...common(
        predecessor,
        "workflow-runtime-missing-step",
        "2026-09-01T00:02:10.000Z",
      ),
      requestedStep: "attempt_transition",
    } as never);
  assert.deepEqual(missing, {
    ok: false,
    stage: "workflow_runtime",
    code: "invalid_runtime_artifacts",
  });
});

test("predecessor, caller evidence, and all runtime results remain immutable", () => {
  const fixture = buildRuntimeFixture();
  const predecessor = fixture.chain.workflowExecution;
  const predecessorFingerprint = predecessor.workflowExecutionFingerprint;
  const provenance = ["caller-provenance"];
  const integrity = ["caller-integrity"];
  const execution = executeStep({
    workflowExecution: predecessor,
    workflowStepId: "workflow-runtime-immutability-step",
    requestedStep: "attempt_transition",
    occurredAt: "2026-09-01T00:02:10.000Z",
    provenanceReferences: provenance,
    integrityReferences: integrity,
    attemptTransitionInput: attemptInput(
      predecessor,
      "workflow-runtime-immutability-transition",
      "queued",
      "2026-09-01T00:02:10.000Z",
    ),
  });
  provenance.push("mutated");
  integrity.push("mutated");
  assert.equal(predecessor.workflowExecutionFingerprint, predecessorFingerprint);
  assert.deepEqual(execution.workflowStepRecord.provenanceReferences, [
    "caller-provenance",
  ]);
  assert.deepEqual(execution.workflowStepRecord.integrityReferences, [
    "caller-integrity",
  ]);
  assert.equal(Object.isFrozen(execution), true);
  assert.equal(Object.isFrozen(execution.workflowStepRecord), true);
  assert.equal(Object.isFrozen(execution.nextWorkflowExecution), true);
  assert.equal(Object.isFrozen(execution.nextWorkflowExecution.stepRecords), true);
});

test("public runtime exports are exact and expose no seals or factories", async () => {
  const publicSurface = await import("./index.js");
  assert.deepEqual(Object.keys(publicSurface).sort(), [
    "executeOrganizationVerificationWorkflowStep",
    "isOrganizationVerificationWorkflowStepExecution",
  ]);
});
