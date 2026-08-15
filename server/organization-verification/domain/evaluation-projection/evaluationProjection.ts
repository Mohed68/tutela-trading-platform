import type {
  EvidenceSnapshotAttemptBinding,
  EvidenceSnapshotAttributeValue,
  EvidenceCategory,
  EvidenceContentDigest,
  EvidenceKind,
  EvidenceReferenceId,
  EvidenceReferenceVersion,
  EvidenceSnapshotContractVersion,
  EvidenceSnapshotFingerprint,
  EvidenceSnapshotId,
  EvidenceSnapshotSourceDigest,
  EvidenceSnapshotVersion,
  EvidenceSourceAuthority,
  OrganizationVerificationEvidenceSnapshot,
} from "../evidence-snapshot/index.js";
import type {
  EvaluationProjectionBuilderVersion,
  EvaluationProjectionContractVersion,
  EvaluationProjectionFingerprint,
  EvaluationProjectionId,
  EvaluationProjectionIntegrityReference,
  EvaluationProjectionProvenanceReference,
  EvaluationProjectionSchemaVersion,
  EvaluationProjectionVersion,
} from "./ids.js";
import { evaluationProjectionFailure, evaluationProjectionSuccess, type EvaluationProjectionDomainResult } from "./errors.js";
import { computeEvaluationProjectionFingerprintInternal } from "./canonicalization.js";
import { deepFreezeDurableValue, hasExactDurableKeys, isDurableIdentity, isDurableJsonValue, isDurablePlainObject, isDurablePositiveVersion, isDurableTimestamp } from "../durableRehydrationValidation.js";

const evaluationProjectionSeal = Symbol(
  "organization-verification-evaluation-projection",
);

type Snapshot = OrganizationVerificationEvidenceSnapshot;

export interface OrganizationVerificationEvaluationProjectionIdentity {
  readonly organizationId: Snapshot["organizationId"];
  readonly recordId: Snapshot["recordId"];
  readonly revisionId: Snapshot["revisionId"];
  readonly profileRevisionId: Snapshot["profileRevisionId"];
  readonly attemptId?: EvidenceSnapshotAttemptBinding["attemptId"];
}

export interface OrganizationVerificationEvaluationProjectionSource {
  readonly evidenceSnapshotId: EvidenceSnapshotId;
  readonly evidenceSnapshotVersion: EvidenceSnapshotVersion;
  readonly snapshotContractVersion: EvidenceSnapshotContractVersion;
  readonly snapshotCreatedAt: string;
  readonly sourceDigest: EvidenceSnapshotSourceDigest;
  readonly snapshotFingerprint: EvidenceSnapshotFingerprint;
}

export interface OrganizationVerificationEvaluationLegalIdentityFacts {
  readonly legalName: string;
  readonly tradingNames: readonly string[];
  readonly registrationJurisdiction: string;
  readonly registrationIdentifiers: readonly {
    readonly scheme: string;
    readonly value: string;
  }[];
  readonly legalForm?: string;
  readonly incorporationDate?: string;
  readonly registeredAddress?: {
    readonly countryCode?: string;
    readonly administrativeArea?: string;
    readonly locality?: string;
    readonly postalCode?: string;
    readonly addressLines?: readonly string[];
  };
}

export interface OrganizationVerificationEvaluationRegistryFacts {
  readonly profileRevisionSequence: Snapshot["registryProjection"]["profileRevisionSequence"];
  readonly profileFingerprint: Snapshot["registryProjection"]["profileFingerprint"];
  readonly legalIdentity: OrganizationVerificationEvaluationLegalIdentityFacts;
  readonly organizationType: string;
  readonly jurisdiction: string;
  readonly declaredActivities: readonly {
    readonly code?: string;
    readonly description?: string;
  }[];
}

export interface OrganizationVerificationEvaluationDeclaredValue {
  readonly key: string;
  readonly value: string;
}

export interface OrganizationVerificationEvaluationDeclaredSection {
  readonly key: string;
  readonly values: readonly OrganizationVerificationEvaluationDeclaredValue[];
}

export interface OrganizationVerificationEvaluationSubmissionFacts {
  readonly revisionSequence: Snapshot["submissionProjection"]["revisionSequence"];
  readonly submittedAt: string;
  readonly declaredSections: readonly OrganizationVerificationEvaluationDeclaredSection[];
}

export interface OrganizationVerificationEvaluationEvidenceAttribute {
  readonly key: string;
  readonly value: EvidenceSnapshotAttributeValue;
}

export interface OrganizationVerificationEvaluationEvidenceFacts {
  readonly evidenceReferenceId: EvidenceReferenceId;
  readonly evidenceReferenceVersion: EvidenceReferenceVersion;
  readonly revisionEvidenceReferenceId: Snapshot["submissionProjection"]["evidenceReferenceIds"][number];
  readonly evidenceKind: EvidenceKind;
  readonly category: EvidenceCategory;
  readonly sourceAuthority: EvidenceSourceAuthority;
  readonly contentDigest: EvidenceContentDigest;
  readonly issuedAt?: string;
  readonly capturedAt?: string;
  readonly validFrom?: string;
  readonly validUntil?: string;
  readonly attributes: readonly OrganizationVerificationEvaluationEvidenceAttribute[];
}

export interface OrganizationVerificationEvaluationProjection {
  readonly evaluationProjectionId: EvaluationProjectionId;
  readonly evaluationProjectionVersion: EvaluationProjectionVersion;
  readonly projectionContractVersion: EvaluationProjectionContractVersion;
  readonly projectionBuilderVersion: EvaluationProjectionBuilderVersion;
  readonly projectionSchemaVersion: EvaluationProjectionSchemaVersion;
  readonly identity: OrganizationVerificationEvaluationProjectionIdentity;
  readonly source: OrganizationVerificationEvaluationProjectionSource;
  readonly registryFacts: OrganizationVerificationEvaluationRegistryFacts;
  readonly submissionFacts: OrganizationVerificationEvaluationSubmissionFacts;
  readonly evidenceFacts: readonly OrganizationVerificationEvaluationEvidenceFacts[];
  readonly projectedAt: string;
  readonly projectionFingerprint: EvaluationProjectionFingerprint;
  readonly provenanceReference: EvaluationProjectionProvenanceReference;
  readonly integrityReference: EvaluationProjectionIntegrityReference;
  readonly [evaluationProjectionSeal]: true;
}

export type OrganizationVerificationEvaluationProjectionData = Omit<
  OrganizationVerificationEvaluationProjection,
  typeof evaluationProjectionSeal
>;

export function createOrganizationVerificationEvaluationProjectionInternal(
  data: OrganizationVerificationEvaluationProjectionData,
): OrganizationVerificationEvaluationProjection {
  const projection = {
    ...data,
  } as OrganizationVerificationEvaluationProjection;
  Object.defineProperty(projection, evaluationProjectionSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(projection);
}

function isDurableEvaluationProjectionData(value: unknown): value is OrganizationVerificationEvaluationProjectionData {
  if (!isDurablePlainObject(value) || !isDurableJsonValue(value)) return false;
  const required = ["evaluationProjectionId", "evaluationProjectionVersion", "projectionContractVersion", "projectionBuilderVersion", "projectionSchemaVersion", "identity", "source", "registryFacts", "submissionFacts", "evidenceFacts", "projectedAt", "projectionFingerprint", "provenanceReference", "integrityReference"];
  return hasExactDurableKeys(value, required) &&
    ["evaluationProjectionId", "projectionContractVersion", "projectionBuilderVersion", "projectionSchemaVersion", "projectionFingerprint", "provenanceReference", "integrityReference"].every((key) => isDurableIdentity(value[key])) &&
    isDurableIdentity(value.evaluationProjectionVersion) && isDurableTimestamp(value.projectedAt) && Array.isArray(value.evidenceFacts);
}

export function rehydrateOrganizationVerificationEvaluationProjection(
  durableData: unknown,
): EvaluationProjectionDomainResult<OrganizationVerificationEvaluationProjection> {
  if (!isDurableEvaluationProjectionData(durableData)) return evaluationProjectionFailure("evaluation_projection_construction_failure");
  const { projectionFingerprint, ...semantic } = durableData;
  if (computeEvaluationProjectionFingerprintInternal(semantic) !== projectionFingerprint) return evaluationProjectionFailure("evaluation_projection_fingerprint_mismatch");
  return evaluationProjectionSuccess(createOrganizationVerificationEvaluationProjectionInternal(deepFreezeDurableValue({ ...durableData })));
}

export function isOrganizationVerificationEvaluationProjection(
  value: unknown,
): value is OrganizationVerificationEvaluationProjection {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<OrganizationVerificationEvaluationProjection>)[
      evaluationProjectionSeal
    ] === true &&
    Object.isFrozen(value)
  );
}
