import {
  isOrganizationVerificationDecision,
  type OrganizationVerificationDecision,
} from "../decision/index.js";
import {
  isOrganizationVerificationTrustStatus,
  type OrganizationVerificationTrustStatus,
} from "../trust-status/index.js";
import { fingerprintDecisionTrustBindingInternal } from "./canonical.js";
import {
  bindingFailure,
  bindingSuccess,
  type OrganizationVerificationDecisionTrustBindingResult,
} from "./errors.js";
import {
  isOrganizationVerificationDecisionTrustIntegrationInputBinding,
  type OrganizationVerificationDecisionTrustIntegrationInputBinding,
} from "./inputBinding.js";
import {
  createDecisionBindingFingerprint,
  createTrustBindingFingerprint,
  type CompletionBindingFingerprint,
  type DecisionBindingFingerprint,
  type OrganizationVerificationDecisionTrustBindingContractVersion,
  type OrganizationVerificationDecisionTrustBindingId,
  type OrganizationVerificationDecisionTrustBindingIntegrityReference,
  type OrganizationVerificationDecisionTrustBindingProvenanceReference,
  type TrustBindingFingerprint,
} from "./ids.js";

const integrationBindingSeal = Symbol(
  "organization-verification-decision-trust-integration-binding",
);

export interface OrganizationVerificationDecisionBindingArtifacts {
  readonly decisionId: OrganizationVerificationDecision["decisionId"];
  readonly boundAt: string;
  readonly provenanceReference: OrganizationVerificationDecisionTrustBindingProvenanceReference;
  readonly integrityReference: OrganizationVerificationDecisionTrustBindingIntegrityReference;
  readonly expectedDecisionBindingFingerprint?: DecisionBindingFingerprint;
}

export interface OrganizationVerificationTrustBindingArtifacts {
  readonly projectionId: OrganizationVerificationTrustStatus["projectionId"];
  readonly sourceDecisionId: OrganizationVerificationDecision["decisionId"];
  readonly boundAt: string;
  readonly provenanceReference: OrganizationVerificationDecisionTrustBindingProvenanceReference;
  readonly integrityReference: OrganizationVerificationDecisionTrustBindingIntegrityReference;
  readonly expectedTrustBindingFingerprint?: TrustBindingFingerprint;
}

export interface OrganizationVerificationDecisionTrustBindingArtifacts {
  readonly decision?: OrganizationVerificationDecisionBindingArtifacts;
  readonly trust?: OrganizationVerificationTrustBindingArtifacts;
}

export interface OrganizationVerificationDecisionBindingEvidence {
  readonly decisionId: OrganizationVerificationDecision["decisionId"];
  readonly boundAt: string;
  readonly provenanceReference: OrganizationVerificationDecisionTrustBindingProvenanceReference;
  readonly integrityReference: OrganizationVerificationDecisionTrustBindingIntegrityReference;
}

export interface OrganizationVerificationTrustBindingEvidence {
  readonly projectionId: OrganizationVerificationTrustStatus["projectionId"];
  readonly sourceDecisionId: OrganizationVerificationDecision["decisionId"];
  readonly boundAt: string;
  readonly provenanceReference: OrganizationVerificationDecisionTrustBindingProvenanceReference;
  readonly integrityReference: OrganizationVerificationDecisionTrustBindingIntegrityReference;
}

export interface OrganizationVerificationDecisionTrustIntegrationBinding {
  readonly bindingId: OrganizationVerificationDecisionTrustBindingId;
  readonly bindingContractVersion: OrganizationVerificationDecisionTrustBindingContractVersion;
  readonly inputBinding: OrganizationVerificationDecisionTrustIntegrationInputBinding;
  readonly completionBindingFingerprint: CompletionBindingFingerprint;
  readonly decision?: OrganizationVerificationDecision;
  readonly decisionEvidence?: OrganizationVerificationDecisionBindingEvidence;
  readonly decisionBindingFingerprint?: DecisionBindingFingerprint;
  readonly trustStatus?: OrganizationVerificationTrustStatus;
  readonly trustEvidence?: OrganizationVerificationTrustBindingEvidence;
  readonly trustBindingFingerprint?: TrustBindingFingerprint;
  readonly [integrationBindingSeal]: true;
}

export interface CreateOrganizationVerificationDecisionTrustIntegrationBindingInput {
  readonly inputBinding: OrganizationVerificationDecisionTrustIntegrationInputBinding;
  readonly decision?: OrganizationVerificationDecision;
  readonly trustStatus?: OrganizationVerificationTrustStatus;
  readonly artifacts: OrganizationVerificationDecisionTrustBindingArtifacts;
  readonly existingBinding?: OrganizationVerificationDecisionTrustIntegrationBinding;
}

function validReference(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head"].includes(value.trim().toLowerCase())
  );
}

function validateDecisionContinuity(
  inputBinding: OrganizationVerificationDecisionTrustIntegrationInputBinding,
  decision: OrganizationVerificationDecision,
  artifacts: OrganizationVerificationDecisionBindingArtifacts,
): OrganizationVerificationDecisionTrustBindingResult<true> {
  const completion = inputBinding.runtimeExecution.completion;
  if (artifacts.decisionId !== decision.decisionId) {
    return bindingFailure("decision_mismatch", "decisionId");
  }
  if (decision.organizationId !== inputBinding.organizationId) {
    return bindingFailure("organization_id_mismatch");
  }
  if (decision.recordId !== inputBinding.recordId) {
    return bindingFailure("verification_record_id_mismatch");
  }
  if (decision.revisionId !== inputBinding.revisionId) {
    return bindingFailure("verification_revision_id_mismatch");
  }
  if (decision.attemptId !== inputBinding.attemptId) {
    return bindingFailure("attempt_id_mismatch");
  }
  if (decision.snapshotId !== inputBinding.snapshotId) {
    return bindingFailure("snapshot_id_mismatch");
  }
  if (decision.snapshotFingerprint !== inputBinding.snapshotFingerprint) {
    return bindingFailure("snapshot_fingerprint_mismatch");
  }
  if (
    String(decision.evaluationCompletionId) !==
    String(inputBinding.policyEvaluationCompletionId)
  ) {
    return bindingFailure("completion_mismatch");
  }
  if (
    String(decision.policyProvenance.policySetReference) !==
      String(inputBinding.policySetId) ||
    String(decision.policyProvenance.policySetVersion) !==
      String(inputBinding.policySetVersion)
  ) {
    return bindingFailure("policy_set_mismatch");
  }
  if (decision.correlationId !== completion.correlationId) {
    return bindingFailure("decision_mismatch", "correlationId");
  }
  if (
    !validReference(artifacts.provenanceReference) ||
    !validReference(artifacts.integrityReference) ||
    !Number.isFinite(Date.parse(artifacts.boundAt))
  ) {
    return bindingFailure("invalid_binding_artifacts", "decision");
  }
  if (
    Date.parse(decision.decidedAt) <
      Date.parse(completion.evaluationCompletedAt) ||
    Date.parse(artifacts.boundAt) < Date.parse(decision.decidedAt) ||
    Date.parse(artifacts.boundAt) < Date.parse(inputBinding.boundAt)
  ) {
    return bindingFailure("invalid_binding_chronology", "decision");
  }
  return bindingSuccess(true);
}

function validateTrustContinuity(
  inputBinding: OrganizationVerificationDecisionTrustIntegrationInputBinding,
  decision: OrganizationVerificationDecision,
  trustStatus: OrganizationVerificationTrustStatus,
  artifacts: OrganizationVerificationTrustBindingArtifacts,
  decisionBoundAt: string,
): OrganizationVerificationDecisionTrustBindingResult<true> {
  if (
    artifacts.projectionId !== trustStatus.projectionId ||
    artifacts.sourceDecisionId !== decision.decisionId
  ) {
    return bindingFailure("trust_status_mismatch");
  }
  if (trustStatus.organizationId !== decision.organizationId) {
    return bindingFailure("organization_id_mismatch");
  }
  if (trustStatus.recordId !== decision.recordId) {
    return bindingFailure("verification_record_id_mismatch");
  }
  if (trustStatus.sourceDecisionId !== decision.decisionId) {
    return bindingFailure("decision_mismatch", "trustStatus.sourceDecisionId");
  }
  if (trustStatus.sourceRevisionId !== decision.revisionId) {
    return bindingFailure("verification_revision_id_mismatch");
  }
  if (trustStatus.sourceAttemptId !== decision.attemptId) {
    return bindingFailure("attempt_id_mismatch");
  }
  if (trustStatus.sourceSnapshotId !== decision.snapshotId) {
    return bindingFailure("snapshot_id_mismatch");
  }
  if (
    trustStatus.sourceSnapshotFingerprint !== decision.snapshotFingerprint
  ) {
    return bindingFailure("snapshot_fingerprint_mismatch");
  }
  if (trustStatus.sourceDecisionOutcome !== decision.outcome) {
    return bindingFailure("trust_status_mismatch", "sourceDecisionOutcome");
  }
  if (
    trustStatus.correlationId !== decision.correlationId ||
    trustStatus.correlationId !==
      inputBinding.runtimeExecution.completion.correlationId
  ) {
    return bindingFailure("trust_status_mismatch", "correlationId");
  }
  if (
    !validReference(artifacts.provenanceReference) ||
    !validReference(artifacts.integrityReference) ||
    !Number.isFinite(Date.parse(artifacts.boundAt))
  ) {
    return bindingFailure("invalid_binding_artifacts", "trust");
  }
  if (
    Date.parse(trustStatus.derivationAsOf) < Date.parse(decision.decidedAt) ||
    Date.parse(trustStatus.derivedAt) <
      Date.parse(trustStatus.derivationAsOf) ||
    Date.parse(artifacts.boundAt) < Date.parse(trustStatus.derivedAt) ||
    Date.parse(artifacts.boundAt) < Date.parse(decisionBoundAt)
  ) {
    return bindingFailure("invalid_binding_chronology", "trust");
  }
  return bindingSuccess(true);
}

function sameOptional<T>(left: T | undefined, right: T | undefined): boolean {
  return left === right;
}

export function isOrganizationVerificationDecisionTrustIntegrationBinding(
  value: unknown,
): value is OrganizationVerificationDecisionTrustIntegrationBinding {
  if (typeof value !== "object" || value === null) return false;
  const inputBinding = Object.getOwnPropertyDescriptor(
    value,
    "inputBinding",
  )?.value;
  const decision = Object.getOwnPropertyDescriptor(value, "decision")?.value;
  const trustStatus =
    Object.getOwnPropertyDescriptor(value, "trustStatus")?.value;
  return (
    Object.getOwnPropertyDescriptor(value, integrationBindingSeal)?.value ===
      true &&
    Object.isFrozen(value) &&
    isOrganizationVerificationDecisionTrustIntegrationInputBinding(
      inputBinding,
    ) &&
    (decision === undefined ||
      isOrganizationVerificationDecision(decision)) &&
    (trustStatus === undefined ||
      isOrganizationVerificationTrustStatus(trustStatus))
  );
}

export function createOrganizationVerificationDecisionTrustIntegrationBinding(
  input: CreateOrganizationVerificationDecisionTrustIntegrationBindingInput,
): OrganizationVerificationDecisionTrustBindingResult<OrganizationVerificationDecisionTrustIntegrationBinding> {
  if (
    !isOrganizationVerificationDecisionTrustIntegrationInputBinding(
      input.inputBinding,
    )
  ) {
    return bindingFailure("unauthentic_input_binding");
  }
  const hasDecision = input.decision !== undefined;
  const hasDecisionArtifacts = input.artifacts.decision !== undefined;
  const hasTrust = input.trustStatus !== undefined;
  const hasTrustArtifacts = input.artifacts.trust !== undefined;
  if (
    hasDecision !== hasDecisionArtifacts ||
    hasTrust !== hasTrustArtifacts ||
    (hasTrust && !hasDecision)
  ) {
    return bindingFailure("invalid_binding_artifacts");
  }

  let decisionBindingFingerprint: DecisionBindingFingerprint | undefined;
  let decisionEvidence:
    | OrganizationVerificationDecisionBindingEvidence
    | undefined;
  if (input.decision && input.artifacts.decision) {
    if (!isOrganizationVerificationDecision(input.decision)) {
      return bindingFailure("unauthentic_decision");
    }
    const continuity = validateDecisionContinuity(
      input.inputBinding,
      input.decision,
      input.artifacts.decision,
    );
    if (!continuity.ok) return continuity;
    const fingerprint = createDecisionBindingFingerprint(
      fingerprintDecisionTrustBindingInternal({
        scope: "decision_binding",
        bindingContractVersion: input.inputBinding.bindingContractVersion,
        bindingId: input.inputBinding.bindingId,
        completionBindingFingerprint:
          input.inputBinding.completionBindingFingerprint,
        decision: input.decision,
        boundAt: input.artifacts.decision.boundAt,
        provenanceReference: input.artifacts.decision.provenanceReference,
        integrityReference: input.artifacts.decision.integrityReference,
      }),
    );
    if (!fingerprint.ok) {
      return bindingFailure("invalid_binding_artifacts", "decision");
    }
    if (
      input.artifacts.decision.expectedDecisionBindingFingerprint !==
        undefined &&
      input.artifacts.decision.expectedDecisionBindingFingerprint !==
        fingerprint.value
    ) {
      return bindingFailure("decision_binding_fingerprint_mismatch");
    }
    decisionBindingFingerprint = fingerprint.value;
    decisionEvidence = Object.freeze({
      decisionId: input.artifacts.decision.decisionId,
      boundAt: input.artifacts.decision.boundAt,
      provenanceReference: input.artifacts.decision.provenanceReference,
      integrityReference: input.artifacts.decision.integrityReference,
    });
  }

  let trustBindingFingerprint: TrustBindingFingerprint | undefined;
  let trustEvidence: OrganizationVerificationTrustBindingEvidence | undefined;
  if (
    input.decision &&
    input.trustStatus &&
    input.artifacts.decision &&
    input.artifacts.trust &&
    decisionBindingFingerprint
  ) {
    if (!isOrganizationVerificationTrustStatus(input.trustStatus)) {
      return bindingFailure("unauthentic_trust_status");
    }
    const continuity = validateTrustContinuity(
      input.inputBinding,
      input.decision,
      input.trustStatus,
      input.artifacts.trust,
      input.artifacts.decision.boundAt,
    );
    if (!continuity.ok) return continuity;
    const fingerprint = createTrustBindingFingerprint(
      fingerprintDecisionTrustBindingInternal({
        scope: "trust_binding",
        bindingContractVersion: input.inputBinding.bindingContractVersion,
        bindingId: input.inputBinding.bindingId,
        decisionBindingFingerprint,
        trustStatus: input.trustStatus,
        boundAt: input.artifacts.trust.boundAt,
        provenanceReference: input.artifacts.trust.provenanceReference,
        integrityReference: input.artifacts.trust.integrityReference,
      }),
    );
    if (!fingerprint.ok) {
      return bindingFailure("invalid_binding_artifacts", "trust");
    }
    if (
      input.artifacts.trust.expectedTrustBindingFingerprint !== undefined &&
      input.artifacts.trust.expectedTrustBindingFingerprint !==
        fingerprint.value
    ) {
      return bindingFailure("trust_binding_fingerprint_mismatch");
    }
    trustBindingFingerprint = fingerprint.value;
    trustEvidence = Object.freeze({
      projectionId: input.artifacts.trust.projectionId,
      sourceDecisionId: input.artifacts.trust.sourceDecisionId,
      boundAt: input.artifacts.trust.boundAt,
      provenanceReference: input.artifacts.trust.provenanceReference,
      integrityReference: input.artifacts.trust.integrityReference,
    });
  }

  if (input.existingBinding !== undefined) {
    if (
      !isOrganizationVerificationDecisionTrustIntegrationBinding(
        input.existingBinding,
      )
    ) {
      return bindingFailure("conflicting_binding");
    }
    const semanticallyEqual =
      input.existingBinding.bindingId === input.inputBinding.bindingId &&
      input.existingBinding.completionBindingFingerprint ===
        input.inputBinding.completionBindingFingerprint &&
      sameOptional(
        input.existingBinding.decisionBindingFingerprint,
        decisionBindingFingerprint,
      ) &&
      sameOptional(
        input.existingBinding.trustBindingFingerprint,
        trustBindingFingerprint,
      );
    if (semanticallyEqual) {
      return bindingSuccess(input.existingBinding);
    }
    return bindingFailure(
      input.existingBinding.bindingId === input.inputBinding.bindingId
        ? "conflicting_binding"
        : "duplicate_binding",
    );
  }

  const binding = {
    bindingId: input.inputBinding.bindingId,
    bindingContractVersion: input.inputBinding.bindingContractVersion,
    inputBinding: input.inputBinding,
    completionBindingFingerprint:
      input.inputBinding.completionBindingFingerprint,
    ...(input.decision &&
    decisionEvidence &&
    decisionBindingFingerprint
      ? {
          decision: input.decision,
          decisionEvidence,
          decisionBindingFingerprint,
        }
      : {}),
    ...(input.trustStatus && trustEvidence && trustBindingFingerprint
      ? {
          trustStatus: input.trustStatus,
          trustEvidence,
          trustBindingFingerprint,
        }
      : {}),
  };
  Object.defineProperty(binding, integrationBindingSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return bindingSuccess(
    Object.freeze(
      binding,
    ) as OrganizationVerificationDecisionTrustIntegrationBinding,
  );
}
