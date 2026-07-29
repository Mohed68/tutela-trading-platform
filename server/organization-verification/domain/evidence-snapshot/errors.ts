export type EvidenceSnapshotDomainFailureCode =
  | "invalid_evidence_snapshot_id"
  | "invalid_evidence_snapshot_version"
  | "unsupported_evidence_snapshot_contract_version"
  | "unsupported_snapshot_builder_version"
  | "unsupported_snapshot_manifest_version"
  | "invalid_frozen_projection_version"
  | "invalid_evidence_reference_id"
  | "invalid_evidence_reference_version"
  | "invalid_evidence_kind"
  | "invalid_evidence_source_authority"
  | "invalid_evidence_category"
  | "invalid_snapshot_provenance_reference"
  | "invalid_snapshot_correlation_reference"
  | "invalid_snapshot_integrity_reference"
  | "invalid_snapshot_source_digest"
  | "organization_id_mismatch"
  | "verification_record_id_mismatch"
  | "verification_revision_id_mismatch"
  | "profile_revision_id_mismatch"
  | "attempt_id_mismatch"
  | "registry_projection_mismatch"
  | "submission_projection_mismatch"
  | "evidence_reference_mismatch"
  | "evidence_version_mismatch"
  | "evidence_digest_mismatch"
  | "duplicate_evidence_reference"
  | "conflicting_evidence_reference"
  | "unauthorized_evidence_reference"
  | "required_evidence_reference_missing"
  | "source_manifest_incomplete"
  | "source_manifest_integrity_invalid"
  | "snapshot_source_incomplete"
  | "snapshot_source_integrity_invalid"
  | "invalid_snapshot_chronology"
  | "snapshot_fingerprint_mismatch"
  | "duplicate_evidence_snapshot"
  | "conflicting_evidence_snapshot"
  | "unauthentic_evidence_snapshot"
  | "evidence_snapshot_construction_failure";

export type EvidenceSnapshotDomainResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: EvidenceSnapshotDomainFailureCode;
      readonly path?: string;
    };

export function evidenceSnapshotSuccess<T>(
  value: T,
): EvidenceSnapshotDomainResult<T> {
  return Object.freeze({ ok: true, value });
}

export function evidenceSnapshotFailure<T>(
  code: EvidenceSnapshotDomainFailureCode,
  path?: string,
): EvidenceSnapshotDomainResult<T> {
  return Object.freeze(path ? { ok: false, code, path } : { ok: false, code });
}
