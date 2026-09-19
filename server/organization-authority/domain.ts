import { createHash } from "node:crypto";

export const ORGANIZATION_CAPABILITIES = [
  "CREATE_OFFER", "MANAGE_OFFERS", "PREPARE_CONTRACT",
  "APPROVE_COMMERCIAL_TERMS", "MANAGE_MEMBERS",
  "MANAGE_SIGNING_POLICY", "GRANT_SIGNING_MANDATE",
] as const;
export type OrganizationCapability = typeof ORGANIZATION_CAPABILITIES[number];

export function canonicalFingerprint(scope: string, value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify({ scope, value })).digest("hex")}`;
}

export function normalizeDomain(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/^@/, "").replace(/\.$/, "");
  if (normalized.length > 253 || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(normalized) || !normalized.includes(".")) return null;
  if (normalized.split(".").some((part) => !part || part.length > 63 || part.startsWith("-") || part.endsWith("-"))) return null;
  return normalized;
}

export function domainFromVerifiedEmail(email: string, verified: boolean): string | null {
  if (!verified) return null;
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 ? normalizeDomain(parts[1]!) : null;
}

export type ResolutionCandidate = Readonly<{
  organizationId: string; legalName: string; jurisdiction: string;
  verifiedDomainMatch: boolean; exactIdentifierMatch: boolean; possibleNameMatch: boolean;
  trustStatus: string | null;
}>;
export type ResolutionOutcome = "MATCHED" | "POSSIBLE_MATCH" | "NO_MATCH" | "MULTIPLE_MATCHES" | "CLAIM_REQUIRED" | "MEMBERSHIP_EXISTS" | "MEMBERSHIP_PENDING";

export function resolveOrganization(input: Readonly<{
  candidates: readonly ResolutionCandidate[];
  activeMembershipOrganizationId?: string;
  pendingInvitationOrganizationIds?: readonly string[];
}>): Readonly<{ outcome: ResolutionOutcome; candidates: readonly ResolutionCandidate[] }> {
  if (input.activeMembershipOrganizationId) return { outcome: "MEMBERSHIP_EXISTS", candidates: input.candidates.filter((candidate) => candidate.organizationId === input.activeMembershipOrganizationId) };
  const pending = new Set(input.pendingInvitationOrganizationIds ?? []);
  if (input.candidates.some((candidate) => pending.has(candidate.organizationId))) return { outcome: "MEMBERSHIP_PENDING", candidates: input.candidates.filter((candidate) => pending.has(candidate.organizationId)) };
  const authoritative = input.candidates.filter((candidate) => candidate.verifiedDomainMatch || candidate.exactIdentifierMatch);
  if (authoritative.length > 1) return { outcome: "MULTIPLE_MATCHES", candidates: authoritative };
  if (authoritative.length === 1) return { outcome: authoritative[0]!.verifiedDomainMatch ? "MATCHED" : "CLAIM_REQUIRED", candidates: authoritative };
  const possible = input.candidates.filter((candidate) => candidate.possibleNameMatch);
  return possible.length ? { outcome: possible.length > 1 ? "MULTIPLE_MATCHES" : "POSSIBLE_MATCH", candidates: possible } : { outcome: "NO_MATCH", candidates: [] };
}

export function mayAutoJoin(input: Readonly<{
  emailVerified: boolean; emailDomain: string | null; organizationDomain: string;
  domainStatus: string; membershipPolicy: string; conflictOrRisk: boolean;
}>): boolean {
  return input.emailVerified && input.emailDomain !== null && input.emailDomain === input.organizationDomain &&
    input.domainStatus === "VERIFIED" && input.membershipPolicy === "VERIFIED_DOMAIN_AUTO_JOIN" && !input.conflictOrRisk;
}

export type InvitationDecision = "ALLOW_MEMBER" | "WRONG_EMAIL" | "EXPIRED" | "REPLAYED" | "REVOKED" | "EMAIL_UNVERIFIED";
export function evaluateInvitation(input: Readonly<{ expectedEmail: string; actualEmail: string; emailVerified: boolean; expiresAt: Date; now: Date; redeemedAt?: Date | null; revokedAt?: Date | null }>): InvitationDecision {
  if (input.redeemedAt) return "REPLAYED";
  if (input.revokedAt) return "REVOKED";
  if (!input.emailVerified) return "EMAIL_UNVERIFIED";
  if (input.expectedEmail.trim().toLowerCase() !== input.actualEmail.trim().toLowerCase()) return "WRONG_EMAIL";
  return input.now >= input.expiresAt ? "EXPIRED" : "ALLOW_MEMBER";
}

export type Mandate = Readonly<{
  actionScope: readonly string[]; contractTypeScope: readonly string[];
  commodityScope?: readonly string[] | null; maximumTransactionValue?: string | null;
  valueCurrency?: string | null; signatureEligibility: "INDIVIDUAL" | "JOINT" | "BOTH";
  validFrom: Date; validUntil?: Date | null; revokedAt?: Date | null; membershipActive: boolean;
}>;
export type MandateDecision = "ELIGIBLE" | "INACTIVE_MEMBERSHIP" | "NOT_YET_VALID" | "EXPIRED" | "REVOKED" | "ACTION_OUT_OF_SCOPE" | "CONTRACT_TYPE_OUT_OF_SCOPE" | "COMMODITY_OUT_OF_SCOPE" | "VALUE_OUT_OF_SCOPE" | "CURRENCY_MISMATCH" | "SIGNATURE_MODE_OUT_OF_SCOPE";
export function evaluateMandate(mandate: Mandate, request: Readonly<{ now: Date; action: string; contractType: string; commodity?: string | null; transactionValue?: string | null; currency?: string | null; signatureMode: "INDIVIDUAL" | "JOINT" }>): MandateDecision {
  if (!mandate.membershipActive) return "INACTIVE_MEMBERSHIP";
  if (mandate.revokedAt) return "REVOKED";
  if (request.now < mandate.validFrom) return "NOT_YET_VALID";
  if (mandate.validUntil && request.now >= mandate.validUntil) return "EXPIRED";
  if (!mandate.actionScope.includes(request.action) && !mandate.actionScope.includes("*")) return "ACTION_OUT_OF_SCOPE";
  if (!mandate.contractTypeScope.includes(request.contractType) && !mandate.contractTypeScope.includes("*")) return "CONTRACT_TYPE_OUT_OF_SCOPE";
  if (mandate.commodityScope?.length && (!request.commodity || !mandate.commodityScope.includes(request.commodity))) return "COMMODITY_OUT_OF_SCOPE";
  if (mandate.maximumTransactionValue !== null && mandate.maximumTransactionValue !== undefined) {
    if (request.currency !== mandate.valueCurrency) return "CURRENCY_MISMATCH";
    if (request.transactionValue === null || request.transactionValue === undefined || Number(request.transactionValue) > Number(mandate.maximumTransactionValue)) return "VALUE_OUT_OF_SCOPE";
  }
  if (mandate.signatureEligibility !== "BOTH" && mandate.signatureEligibility !== request.signatureMode) return "SIGNATURE_MODE_OUT_OF_SCOPE";
  return "ELIGIBLE";
}

export type SignatureBand = Readonly<{ minimumInclusive?: string; maximumExclusive?: string; requiredSignatures: number; signatureMode: "INDIVIDUAL" | "JOINT" }>;
export function requiredSignatureSlots(policy: Readonly<{ kind: "COMPATIBILITY_SINGLE" | "VALUE_BANDS"; bands?: readonly SignatureBand[] }>, value: string): Readonly<{ ok: true; slots: number; mode: "INDIVIDUAL" | "JOINT" } | { ok: false; reason: "NO_APPLICABLE_POLICY" | "INVALID_POLICY" }> {
  if (policy.kind === "COMPATIBILITY_SINGLE") return { ok: true, slots: 1, mode: "INDIVIDUAL" };
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || !policy.bands?.length) return { ok: false, reason: "INVALID_POLICY" };
  const matches = policy.bands.filter((band) => (band.minimumInclusive === undefined || amount >= Number(band.minimumInclusive)) && (band.maximumExclusive === undefined || amount < Number(band.maximumExclusive)));
  if (matches.length !== 1) return { ok: false, reason: "NO_APPLICABLE_POLICY" };
  const match = matches[0]!;
  if (!Number.isInteger(match.requiredSignatures) || match.requiredSignatures < 1 || (match.signatureMode === "JOINT" && match.requiredSignatures < 2)) return { ok: false, reason: "INVALID_POLICY" };
  return { ok: true, slots: match.requiredSignatures, mode: match.signatureMode };
}

export function canActivatePlatformTerms(input: Readonly<{ status: string; effectiveAt?: Date | null; approvedAuthorityReference?: string | null }>): boolean {
  return input.status === "ACTIVE" && Boolean(input.effectiveAt && input.approvedAuthorityReference?.trim());
}
export function canCreateFeeEntitlement(input: Readonly<{ scheduleStatus: string; governedTriggerFound: boolean; deterministicInputs: boolean }>): boolean {
  return input.scheduleStatus === "ACTIVE" && input.governedTriggerFound && input.deterministicInputs;
}
export function canConfirmIntegrityAnchor(input: Readonly<{ transactionReference?: string | null; anchorTimestamp?: Date | null; realReceipt?: unknown }>): boolean {
  return Boolean(input.transactionReference?.trim() && input.anchorTimestamp && input.realReceipt && typeof input.realReceipt === "object");
}
export function approvalAppliesToSnapshot(approval: Readonly<{ snapshotId: string; contractVersion: number }>, current: Readonly<{ snapshotId: string; contractVersion: number; state: string }>): boolean {
  return current.state !== "RETURNED_FOR_REVISION" && approval.snapshotId === current.snapshotId && approval.contractVersion === current.contractVersion;
}

export const DATA_RIGHTS_CATEGORIES = ["COMPANY_DATA","TRANSACTION_DATA","UPLOADED_EVIDENCE","DERIVED_ANALYTICAL_DATA","PLATFORM_METADATA","AI_CANDIDATE_OUTPUTS"] as const;
export const AI_CANDIDATE_AUTHORITY = "NON_AUTHORITATIVE_CANDIDATE_ONLY" as const;
