import type { OrganizationVerificationDecision } from "../decision/index.js";
import {
  createOrganizationVerificationTrustStatusSourceFacts,
  deriveOrganizationVerificationTrustStatus,
  isOrganizationVerificationTrustStatus,
  type OrganizationVerificationTrustStatus,
  type OrganizationVerificationTrustStatusSourceFactsInput,
  type TrustStatusDerivationContext,
  type TrustStatusDomainFailureCode,
} from "../trust-status/index.js";

export type OrganizationVerificationTrustSourceFactsArtifacts = Omit<
  OrganizationVerificationTrustStatusSourceFactsInput,
  "decision"
> &
  Readonly<{ decision?: never }>;

export type OrganizationVerificationTrustDerivationResult =
  | Readonly<{
      ok: true;
      value: OrganizationVerificationTrustStatus;
    }>
  | Readonly<{
      ok: false;
      stage: "trust_source_facts" | "trust_derivation";
      code: TrustStatusDomainFailureCode | "trust_source_facts_integrity_invalid";
    }>;

export function deriveTrustStatusFromAuthenticDecision(
  decision: OrganizationVerificationDecision,
  sourceFactsArtifacts: OrganizationVerificationTrustSourceFactsArtifacts,
  context: TrustStatusDerivationContext,
): OrganizationVerificationTrustDerivationResult {
  const sourceFacts = createOrganizationVerificationTrustStatusSourceFacts({
    ...sourceFactsArtifacts,
    decision,
  });
  if (!sourceFacts.ok) {
    return Object.freeze({
      ok: false,
      stage: "trust_source_facts",
      code: sourceFacts.code,
    });
  }
  const trustStatus = deriveOrganizationVerificationTrustStatus(
    sourceFacts.value,
    context,
  );
  if (!trustStatus.ok) {
    return Object.freeze({
      ok: false,
      stage: "trust_derivation",
      code: trustStatus.code,
    });
  }
  if (!isOrganizationVerificationTrustStatus(trustStatus.value)) {
    return Object.freeze({
      ok: false,
      stage: "trust_derivation",
      code: "trust_source_facts_integrity_invalid",
    });
  }
  return Object.freeze({ ok: true, value: trustStatus.value });
}
