import type {
  EvidenceCollectionRequest,
  ProviderEvidenceAssertion,
  ProviderEvidenceEnvelope,
} from "./contracts.js";

export type EvidenceProviderResolution =
  | Readonly<{
      status: "evidence_available";
      evidence: ProviderEvidenceEnvelope;
    }>
  | Readonly<{ status: "not_available" }>
  | Readonly<{ status: "provider_unavailable" }>
  | Readonly<{ status: "integrity_failure" }>;

export interface EvidenceProviderPort {
  collectEvidence(
    request: EvidenceCollectionRequest,
  ): Promise<EvidenceProviderResolution>;
}

export interface LocalSubmittedEvidenceRecord {
  readonly evidenceId: string;
  readonly evidenceVersion: string;
  readonly subjectId: string;
  readonly subjectVersion: string;
  readonly assertions: readonly ProviderEvidenceAssertion[];
  readonly submittedAt: string;
  readonly provenanceReference: string;
  readonly integrityReference: string;
}

export interface LocalSubmittedEvidenceReadPort {
  resolveSubmittedEvidence(input: Readonly<{
    subjectId: string;
    subjectVersion: string;
  }>): Promise<LocalSubmittedEvidenceRecord | null>;
}
