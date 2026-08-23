import { createHash } from "node:crypto";

export const EVIDENCE_PROVIDER_CONTRACT_VERSION =
  "evidence-provider/v1" as const;

export const EVIDENCE_PROVIDER_KINDS = [
  "platform_submitted",
  "kyb",
  "inspection",
  "shipping",
  "warehouse",
] as const;

export const EVIDENCE_ASSURANCE_LEVELS = [
  "documentary",
  "source_confirmed",
  "independently_inspected",
] as const;

export type EvidenceProviderKind =
  (typeof EVIDENCE_PROVIDER_KINDS)[number];
export type EvidenceAssuranceLevel =
  (typeof EVIDENCE_ASSURANCE_LEVELS)[number];
export type EvidenceSubjectKind = "organization" | "offer" | "shipment";

export interface EvidenceSubjectReference {
  readonly subjectKind: EvidenceSubjectKind;
  readonly subjectId: string;
  readonly subjectVersion: string;
}

export interface EvidenceCollectionRequest {
  readonly requestId: string;
  readonly providerKind: EvidenceProviderKind;
  readonly subject: EvidenceSubjectReference;
  readonly requestedAt: string;
  readonly requestFingerprint: string;
}

export interface ProviderEvidenceAssertion {
  readonly assertionCode: string;
  readonly value: string;
}

export interface ProviderEvidenceEnvelope {
  readonly contractVersion: typeof EVIDENCE_PROVIDER_CONTRACT_VERSION;
  readonly evidenceId: string;
  readonly evidenceVersion: string;
  readonly providerKind: EvidenceProviderKind;
  readonly subject: EvidenceSubjectReference;
  readonly assuranceLevel: EvidenceAssuranceLevel;
  readonly assertions: readonly ProviderEvidenceAssertion[];
  readonly capturedAt: string;
  readonly provenanceReference: string;
  readonly integrityReference: string;
  readonly evidenceFingerprint: string;
}

const authenticRequests = new WeakSet<object>();
const authenticEvidence = new WeakSet<object>();

function identity(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hash(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")}`;
}

export function createEvidenceCollectionRequest(input: Readonly<{
  requestId: string;
  providerKind: EvidenceProviderKind;
  subject: EvidenceSubjectReference;
  requestedAt: string;
}>): EvidenceCollectionRequest | undefined {
  if (
    !identity(input.requestId) ||
    !EVIDENCE_PROVIDER_KINDS.includes(input.providerKind) ||
    !["organization", "offer", "shipment"].includes(
      input.subject.subjectKind,
    ) ||
    !identity(input.subject.subjectId) ||
    !identity(input.subject.subjectVersion) ||
    !Number.isFinite(Date.parse(input.requestedAt))
  ) {
    return undefined;
  }
  const subject = Object.freeze({ ...input.subject });
  const unsigned = Object.freeze({
    requestId: input.requestId,
    providerKind: input.providerKind,
    subject,
    requestedAt: input.requestedAt,
  });
  const request: EvidenceCollectionRequest = Object.freeze({
    ...unsigned,
    requestFingerprint: hash({
      scope: EVIDENCE_PROVIDER_CONTRACT_VERSION,
      ...unsigned,
    }),
  });
  authenticRequests.add(request);
  return request;
}

export function isEvidenceCollectionRequest(
  value: unknown,
): value is EvidenceCollectionRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticRequests.has(value) &&
    Object.isFrozen(value)
  );
}

export function createProviderEvidenceEnvelopeInternal(input: Readonly<{
  request: EvidenceCollectionRequest;
  evidenceId: string;
  evidenceVersion: string;
  assuranceLevel: EvidenceAssuranceLevel;
  assertions: readonly ProviderEvidenceAssertion[];
  capturedAt: string;
  provenanceReference: string;
  integrityReference: string;
}>): ProviderEvidenceEnvelope | undefined {
  if (
    !isEvidenceCollectionRequest(input.request) ||
    !identity(input.evidenceId) ||
    !identity(input.evidenceVersion) ||
    !EVIDENCE_ASSURANCE_LEVELS.includes(input.assuranceLevel) ||
    !Number.isFinite(Date.parse(input.capturedAt)) ||
    !identity(input.provenanceReference) ||
    !identity(input.integrityReference) ||
    input.assertions.some(
      (assertion) =>
        !identity(assertion.assertionCode) || !identity(assertion.value),
    )
  ) {
    return undefined;
  }
  const assertions = Object.freeze(
    input.assertions
      .map((assertion) => Object.freeze({ ...assertion }))
      .sort((left, right) =>
        left.assertionCode.localeCompare(right.assertionCode),
      ),
  );
  const unsigned = {
    contractVersion: EVIDENCE_PROVIDER_CONTRACT_VERSION,
    evidenceId: input.evidenceId,
    evidenceVersion: input.evidenceVersion,
    providerKind: input.request.providerKind,
    subject: input.request.subject,
    assuranceLevel: input.assuranceLevel,
    assertions,
    capturedAt: input.capturedAt,
    provenanceReference: input.provenanceReference,
    integrityReference: input.integrityReference,
  } as const;
  const evidence: ProviderEvidenceEnvelope = Object.freeze({
    ...unsigned,
    evidenceFingerprint: hash(unsigned),
  });
  authenticEvidence.add(evidence);
  return evidence;
}

export function isProviderEvidenceEnvelope(
  value: unknown,
): value is ProviderEvidenceEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticEvidence.has(value) &&
    Object.isFrozen(value)
  );
}
