import {
  isOrganizationVerificationEvidenceSnapshot,
  type OrganizationVerificationEvidenceSnapshot,
} from "../evidence-snapshot/index.js";
import { computeEvaluationProjectionFingerprintInternal } from "./canonicalization.js";
import type { OrganizationVerificationEvaluationProjectionConstructionContext } from "./constructionContext.js";
import {
  createOrganizationVerificationEvaluationProjectionInternal,
  type OrganizationVerificationEvaluationEvidenceFacts,
  type OrganizationVerificationEvaluationProjection,
  type OrganizationVerificationEvaluationProjectionData,
} from "./evaluationProjection.js";
import {
  evaluationProjectionFailure,
  evaluationProjectionSuccess,
  type EvaluationProjectionDomainResult,
} from "./errors.js";

export interface BuildOrganizationVerificationEvaluationProjectionInput {
  readonly context: OrganizationVerificationEvaluationProjectionConstructionContext;
  readonly evidenceSnapshot: OrganizationVerificationEvidenceSnapshot;
}

function copyLegalIdentity(
  source: OrganizationVerificationEvidenceSnapshot["registryProjection"]["legalIdentity"],
) {
  const registeredAddress = source.registeredAddress
    ? Object.freeze({
        ...(source.registeredAddress.countryCode
          ? { countryCode: source.registeredAddress.countryCode }
          : {}),
        ...(source.registeredAddress.administrativeArea
          ? { administrativeArea: source.registeredAddress.administrativeArea }
          : {}),
        ...(source.registeredAddress.locality
          ? { locality: source.registeredAddress.locality }
          : {}),
        ...(source.registeredAddress.postalCode
          ? { postalCode: source.registeredAddress.postalCode }
          : {}),
        ...(source.registeredAddress.addressLines
          ? {
              addressLines: Object.freeze([
                ...source.registeredAddress.addressLines,
              ]),
            }
          : {}),
      })
    : undefined;
  return Object.freeze({
    legalName: source.legalName,
    tradingNames: Object.freeze(
      [...source.tradingNames].sort((left, right) =>
        left.localeCompare(right),
      ),
    ),
    registrationJurisdiction: source.registrationJurisdiction,
    registrationIdentifiers: Object.freeze(
      source.registrationIdentifiers
        .map((item) => Object.freeze({ scheme: item.scheme, value: item.value }))
        .sort((left, right) =>
          `${left.scheme}\u0000${left.value}`.localeCompare(
            `${right.scheme}\u0000${right.value}`,
          ),
        ),
    ),
    ...(source.legalForm ? { legalForm: source.legalForm } : {}),
    ...(source.incorporationDate
      ? { incorporationDate: source.incorporationDate }
      : {}),
    ...(registeredAddress ? { registeredAddress } : {}),
  });
}

function copyEvidence(
  source: OrganizationVerificationEvidenceSnapshot["evidenceProjections"],
): readonly OrganizationVerificationEvaluationEvidenceFacts[] {
  return Object.freeze(
    source
      .map((item) =>
        Object.freeze({
          evidenceReferenceId: item.evidenceReferenceId,
          evidenceReferenceVersion: item.evidenceReferenceVersion,
          revisionEvidenceReferenceId: item.revisionEvidenceReferenceId,
          evidenceKind: item.evidenceKind,
          category: item.category,
          sourceAuthority: item.sourceAuthority,
          contentDigest: item.contentDigest,
          ...(item.issuedAt ? { issuedAt: item.issuedAt } : {}),
          ...(item.capturedAt ? { capturedAt: item.capturedAt } : {}),
          ...(item.validFrom ? { validFrom: item.validFrom } : {}),
          ...(item.validUntil ? { validUntil: item.validUntil } : {}),
          attributes: Object.freeze(
            item.attributes
              .map((attribute) => Object.freeze({ ...attribute }))
              .sort((left, right) => left.key.localeCompare(right.key)),
          ),
        }),
      )
      .sort((left, right) =>
        `${String(left.evidenceReferenceId)}\u0000${String(
          left.evidenceReferenceVersion,
        )}`.localeCompare(
          `${String(right.evidenceReferenceId)}\u0000${String(
            right.evidenceReferenceVersion,
          )}`,
        ),
      ),
  );
}

export function buildOrganizationVerificationEvaluationProjection(
  input: BuildOrganizationVerificationEvaluationProjectionInput,
): EvaluationProjectionDomainResult<OrganizationVerificationEvaluationProjection> {
  if (!Object.isFrozen(input.context)) {
    return evaluationProjectionFailure(
      "evaluation_projection_construction_failure",
    );
  }
  if (!isOrganizationVerificationEvidenceSnapshot(input.evidenceSnapshot)) {
    return evaluationProjectionFailure("unauthentic_evidence_snapshot");
  }
  if (
    Date.parse(input.context.projectedAt) <
    Date.parse(input.evidenceSnapshot.createdAt)
  ) {
    return evaluationProjectionFailure("invalid_evaluation_projection_timestamp");
  }
  const snapshot = input.evidenceSnapshot;
  const withoutFingerprint: Omit<
    OrganizationVerificationEvaluationProjectionData,
    "projectionFingerprint"
  > = {
    evaluationProjectionId: input.context.evaluationProjectionId,
    evaluationProjectionVersion: input.context.evaluationProjectionVersion,
    projectionContractVersion: input.context.projectionContractVersion,
    projectionBuilderVersion: input.context.projectionBuilderVersion,
    projectionSchemaVersion: input.context.projectionSchemaVersion,
    identity: Object.freeze({
      organizationId: snapshot.organizationId,
      recordId: snapshot.recordId,
      revisionId: snapshot.revisionId,
      profileRevisionId: snapshot.profileRevisionId,
      ...(snapshot.attemptBinding
        ? { attemptId: snapshot.attemptBinding.attemptId }
        : {}),
    }),
    source: Object.freeze({
      evidenceSnapshotId: snapshot.evidenceSnapshotId,
      evidenceSnapshotVersion: snapshot.evidenceSnapshotVersion,
      snapshotContractVersion: snapshot.snapshotContractVersion,
      snapshotCreatedAt: snapshot.createdAt,
      sourceDigest: snapshot.sourceDigest,
      snapshotFingerprint: snapshot.snapshotFingerprint,
    }),
    registryFacts: Object.freeze({
      profileRevisionSequence:
        snapshot.registryProjection.profileRevisionSequence,
      profileFingerprint: snapshot.registryProjection.profileFingerprint,
      legalIdentity: copyLegalIdentity(
        snapshot.registryProjection.legalIdentity,
      ),
      organizationType: snapshot.registryProjection.organizationType,
      jurisdiction: snapshot.registryProjection.jurisdiction,
      declaredActivities: Object.freeze(
        snapshot.registryProjection.declaredActivities.activities
          .map((activity) => Object.freeze({ ...activity }))
          .sort((left, right) =>
            `${left.code ?? ""}\u0000${left.description ?? ""}`.localeCompare(
              `${right.code ?? ""}\u0000${right.description ?? ""}`,
            ),
          ),
      ),
    }),
    submissionFacts: Object.freeze({
      revisionSequence: snapshot.submissionProjection.revisionSequence,
      submittedAt: snapshot.submissionProjection.submittedAt,
      declaredSections: Object.freeze(
        snapshot.submissionProjection.declaredInputs.sections
          .map((section) =>
            Object.freeze({
              key: section.key,
              values: Object.freeze(
                section.values
                  .map((value) => Object.freeze({ ...value }))
                  .sort((left, right) =>
                    `${left.key}\u0000${left.value}`.localeCompare(
                      `${right.key}\u0000${right.value}`,
                    ),
                  ),
              ),
            }),
          )
          .sort((left, right) => left.key.localeCompare(right.key)),
      ),
    }),
    evidenceFacts: copyEvidence(snapshot.evidenceProjections),
    projectedAt: input.context.projectedAt,
    provenanceReference: input.context.provenanceReference,
    integrityReference: input.context.integrityReference,
  };
  const projectionFingerprint =
    computeEvaluationProjectionFingerprintInternal(withoutFingerprint);
  if (
    input.context.expectedProjectionFingerprint !== undefined &&
    input.context.expectedProjectionFingerprint !== projectionFingerprint
  ) {
    return evaluationProjectionFailure(
      "evaluation_projection_fingerprint_mismatch",
    );
  }
  return evaluationProjectionSuccess(
    createOrganizationVerificationEvaluationProjectionInternal({
      ...withoutFingerprint,
      projectionFingerprint,
    }),
  );
}
