import {
  createProviderEvidenceEnvelopeInternal,
  isEvidenceCollectionRequest,
  type EvidenceCollectionRequest,
} from "./contracts.js";
import type {
  EvidenceProviderPort,
  LocalSubmittedEvidenceReadPort,
} from "./ports.js";

export function createLocalPlatformEvidenceProvider(
  source: LocalSubmittedEvidenceReadPort,
): EvidenceProviderPort {
  return Object.freeze({
    async collectEvidence(request: EvidenceCollectionRequest) {
      if (
        !isEvidenceCollectionRequest(request) ||
        request.providerKind !== "platform_submitted"
      ) {
        return Object.freeze({ status: "integrity_failure" as const });
      }
      const submitted = await source.resolveSubmittedEvidence({
        subjectId: request.subject.subjectId,
        subjectVersion: request.subject.subjectVersion,
      });
      if (!submitted) {
        return Object.freeze({ status: "not_available" as const });
      }
      if (
        submitted.subjectId !== request.subject.subjectId ||
        submitted.subjectVersion !== request.subject.subjectVersion
      ) {
        return Object.freeze({ status: "integrity_failure" as const });
      }
      const evidence = createProviderEvidenceEnvelopeInternal({
        request,
        evidenceId: submitted.evidenceId,
        evidenceVersion: submitted.evidenceVersion,
        assuranceLevel: "documentary",
        assertions: submitted.assertions,
        capturedAt: submitted.submittedAt,
        provenanceReference: submitted.provenanceReference,
        integrityReference: submitted.integrityReference,
      });
      return evidence
        ? Object.freeze({ status: "evidence_available" as const, evidence })
        : Object.freeze({ status: "integrity_failure" as const });
    },
  });
}
