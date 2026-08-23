import { createHash } from "node:crypto";

import {
  isProviderEvidenceEnvelope,
  type ProviderEvidenceEnvelope,
} from "../../../evidence-provider/index.js";
import { createOrganizationEvidenceReferenceId } from "../../domain/index.js";
import {
  createEvidenceCategory,
  createEvidenceContentDigest,
  createEvidenceKind,
  createEvidenceReferenceId,
  createEvidenceReferenceVersion,
  createEvidenceSnapshotCorrelationReference,
  createEvidenceSnapshotIntegrityReference,
  createEvidenceSnapshotProvenanceReference,
  createEvidenceSourceAuthority,
  type OrganizationVerificationSemanticEvidenceReferenceInput,
} from "../../domain/evidence-snapshot/index.js";

export type PlatformOrganizationEvidenceCategory =
  | "organization_existence"
  | "representative_association";

export const PLATFORM_ORGANIZATION_EVIDENCE_ADAPTER_VERSION =
  "platform-organization-evidence-adapter/v1" as const;

export type PlatformOrganizationEvidenceAdaptation =
  | Readonly<{
      ok: true;
      value: OrganizationVerificationSemanticEvidenceReferenceInput;
    }>
  | Readonly<{
      ok: false;
      code:
        | "unauthentic_evidence"
        | "subject_mismatch"
        | "unsupported_evidence_source"
        | "invalid_evidence_category"
        | "invalid_evidence_contract";
    }>;

function value<T>(result: { readonly ok: boolean; readonly value?: T }): T | undefined {
  return result.ok ? result.value : undefined;
}

export function adaptPlatformEvidenceToOrganizationVerificationReference(input: Readonly<{
  evidence: ProviderEvidenceEnvelope;
  organizationId: string;
  organizationVersion: string;
  category: PlatformOrganizationEvidenceCategory;
  revisionEvidenceReferenceId: string;
  correlationReference: string;
}>): PlatformOrganizationEvidenceAdaptation {
  if (!isProviderEvidenceEnvelope(input.evidence)) {
    return Object.freeze({ ok: false, code: "unauthentic_evidence" });
  }
  if (
    input.evidence.subject.subjectKind !== "organization" ||
    input.evidence.subject.subjectId !== input.organizationId ||
    input.evidence.subject.subjectVersion !== input.organizationVersion
  ) {
    return Object.freeze({ ok: false, code: "subject_mismatch" });
  }
  if (
    input.evidence.providerKind !== "platform_submitted" ||
    input.evidence.assuranceLevel !== "documentary"
  ) {
    return Object.freeze({ ok: false, code: "unsupported_evidence_source" });
  }
  if (!input.evidence.assertions.some(
    (assertion) =>
      assertion.assertionCode === "evidence_category" &&
      assertion.value === input.category,
  )) {
    return Object.freeze({ ok: false, code: "invalid_evidence_category" });
  }

  const evidenceReferenceId = value(
    createEvidenceReferenceId(input.evidence.evidenceId),
  );
  const evidenceReferenceVersion = value(
    createEvidenceReferenceVersion(input.evidence.evidenceVersion),
  );
  const revisionEvidenceId = value(
    createOrganizationEvidenceReferenceId(input.revisionEvidenceReferenceId),
  );
  const evidenceKind = value(createEvidenceKind("submitted_document"));
  const category = value(createEvidenceCategory(input.category));
  const sourceAuthority = value(
    createEvidenceSourceAuthority("platform_submitted"),
  );
  const contentDigest = value(
    createEvidenceContentDigest(
      createHash("sha256")
        .update(input.evidence.evidenceFingerprint)
        .digest("hex"),
    ),
  );
  const provenanceReference = value(
    createEvidenceSnapshotProvenanceReference(
      input.evidence.provenanceReference,
    ),
  );
  const integrityReference = value(
    createEvidenceSnapshotIntegrityReference(
      input.evidence.integrityReference,
    ),
  );
  const correlationReference = value(
    createEvidenceSnapshotCorrelationReference(input.correlationReference),
  );
  if (
    !evidenceReferenceId ||
    !evidenceReferenceVersion ||
    !revisionEvidenceId ||
    !evidenceKind ||
    !category ||
    !sourceAuthority ||
    !contentDigest ||
    !provenanceReference ||
    !integrityReference ||
    !correlationReference
  ) {
    return Object.freeze({ ok: false, code: "invalid_evidence_contract" });
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      evidenceReferenceId,
      evidenceReferenceVersion,
      revisionEvidenceReferenceId: revisionEvidenceId,
      evidenceKind,
      category,
      sourceAuthority,
      contentDigest,
      capturedAt: input.evidence.capturedAt,
      attributes: Object.freeze(
        input.evidence.assertions
          .filter((assertion) => assertion.assertionCode !== "evidence_category")
          .map((assertion) =>
            Object.freeze({
              key: assertion.assertionCode,
              value:
                assertion.value === "true"
                  ? true
                  : assertion.value === "false"
                    ? false
                    : assertion.value,
            }),
          ),
      ),
      provenanceReference,
      correlationReference,
      integrityReference,
    }),
  });
}
