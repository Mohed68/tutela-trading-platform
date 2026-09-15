import { createHash } from "node:crypto";

import * as policy from "../organization-verification/domain/policy/index.js";
import * as runtimeContract from "../organization-verification/domain/policy-runtime-contract/index.js";

export const MINIMUM_TRADE_TRUST_ORGANIZATION_POLICY_VERSION =
  "minimum-trade-trust-organization-policy/v1" as const;
export const ORGANIZATION_VERIFICATION_POLICY_V2 =
  "minimum-trade-trust-organization-policy/v2" as const;

const POLICY_SET_ID = "minimum-trade-trust-organization-policy";
const POLICY_PROVENANCE = "tutela-production-policy:organization-verification:v1";

type FactView = runtimeContract.OrganizationVerificationPolicyEvaluationFactView;
type Disposition = policy.OrganizationVerificationFindingDisposition;

type RuleDefinition = Readonly<{
  id: string;
  title: string;
  category: string;
  reasonCode: string;
  severity: "medium" | "high";
  failureDisposition:
    | "revision_required"
    | "manual_review_required"
    | "rejection_required";
  evaluate: (facts: FactView) => boolean;
}>;

function must<T>(result: policy.PolicyDomainResult<T>): T;
function must<T>(
  result: runtimeContract.OrganizationVerificationPolicyRuntimeContractResult<T>,
): T;
function must<T>(result: { readonly ok: boolean; readonly value?: T }): T {
  if (!result.ok || result.value === undefined) {
    throw new Error("INVALID_MINIMUM_TRADE_TRUST_POLICY_CONFIGURATION");
  }
  return result.value;
}

function disposition(value: string): Disposition {
  return must(policy.parseOrganizationVerificationFindingDisposition(value));
}

function attributes(
  facts: FactView,
  category: string,
): ReadonlyMap<string, string | number | boolean>[] {
  return (facts.evidenceFacts ?? [])
    .filter(
      (evidence) =>
        evidence.sourceAuthority === "platform_submitted" &&
        evidence.category === category,
    )
    .map(
      (evidence) =>
        new Map(
          evidence.attributes.map((attribute) => [
            attribute.key,
            attribute.value,
          ]),
        ),
    );
}

function hasCompleteLegalIdentity(facts: FactView): boolean {
  const identity = facts.registryFacts?.legalIdentity;
  return Boolean(
    identity?.legalName.trim() &&
      identity.registrationJurisdiction.trim() &&
      identity.registrationIdentifiers.length > 0 &&
      identity.registrationIdentifiers.every(
        (identifier) => identifier.scheme.trim() && identifier.value.trim(),
      ) &&
      facts.registryFacts?.organizationType.trim(),
  );
}

function hasOrganizationExistenceEvidence(facts: FactView): boolean {
  return attributes(facts, "organization_existence").some(
    (evidence) =>
      typeof evidence.get("document_type") === "string" &&
      typeof evidence.get("registration_identifier") === "string",
  );
}

function hasRepresentativeAssociationEvidence(facts: FactView): boolean {
  return attributes(facts, "representative_association").some(
    (evidence) =>
      evidence.get("association_asserted") === true &&
      typeof evidence.get("representative_reference") === "string",
  );
}

function hasConsistentEvidence(facts: FactView): boolean {
  const registry = facts.registryFacts;
  if (!registry) return false;
  const expectedIdentifiers = new Set(
    registry.legalIdentity.registrationIdentifiers.map(
      (identifier) => `${identifier.scheme}:${identifier.value}`,
    ),
  );
  return attributes(facts, "organization_existence").some((evidence) => {
    const legalName = evidence.get("legal_name");
    const jurisdiction = evidence.get("registration_jurisdiction");
    const identifier = evidence.get("registration_identifier");
    return (
      legalName === registry.legalIdentity.legalName &&
      jurisdiction === registry.legalIdentity.registrationJurisdiction &&
      typeof identifier === "string" &&
      expectedIdentifiers.has(identifier)
    );
  });
}

function hasValidEvidenceIntegrity(facts: FactView): boolean {
  const evidence = facts.evidenceFacts ?? [];
  return (
    evidence.length > 0 &&
    evidence.every(
      (item) =>
        item.sourceAuthority === "platform_submitted" &&
        /^[a-f0-9]{64}$/.test(item.contentDigest) &&
        item.evidenceReferenceId.trim().length > 0 &&
        item.evidenceReferenceVersion.trim().length > 0,
    )
  );
}

const DEFINITIONS: readonly RuleDefinition[] = Object.freeze([
  Object.freeze({
    id: "organization-legal-identity-complete",
    title: "Legal and organizational identity is complete",
    category: "organization_verification.legal_identity",
    reasonCode: "organization_verification.legal_identity.incomplete",
    severity: "high",
    failureDisposition: "revision_required",
    evaluate: hasCompleteLegalIdentity,
  }),
  Object.freeze({
    id: "organization-existence-evidence-present",
    title: "Organization existence evidence is present",
    category: "organization_verification.existence_evidence",
    reasonCode: "organization_verification.existence_evidence.missing",
    severity: "high",
    failureDisposition: "revision_required",
    evaluate: hasOrganizationExistenceEvidence,
  }),
  Object.freeze({
    id: "representative-association-evidence-present",
    title: "Representative association evidence is present",
    category: "organization_verification.representative_association",
    reasonCode: "organization_verification.representative_association.requires_review",
    severity: "medium",
    failureDisposition: "manual_review_required",
    evaluate: hasRepresentativeAssociationEvidence,
  }),
  Object.freeze({
    id: "organization-evidence-consistent",
    title: "Submitted evidence is consistent with registry identity",
    category: "organization_verification.evidence_consistency",
    reasonCode: "organization_verification.evidence_consistency.mismatch",
    severity: "high",
    failureDisposition: "revision_required",
    evaluate: hasConsistentEvidence,
  }),
  Object.freeze({
    id: "organization-evidence-integrity-valid",
    title: "Submitted evidence integrity references are valid",
    category: "organization_verification.evidence_integrity",
    reasonCode: "organization_verification.evidence_integrity.invalid",
    severity: "high",
    failureDisposition: "rejection_required",
    evaluate: hasValidEvidenceIntegrity,
  }),
]);

export interface MinimumTradeTrustOrganizationPolicyBundle {
  readonly policySet: policy.OrganizationVerificationPolicySet;
  readonly rules: readonly policy.OrganizationVerificationRule[];
  readonly implementationSet: runtimeContract.OrganizationVerificationRuleImplementationSet;
}

/** Historical V1 remains reproducible; never use it for new production decisions. */
export function createMinimumTradeTrustOrganizationPolicyBundle(): MinimumTradeTrustOrganizationPolicyBundle {
  return createPolicyBundle(1, "2026-01-01T00:00:00.000Z");
}

export function createOrganizationVerificationPolicyV2(effectiveFrom: string): MinimumTradeTrustOrganizationPolicyBundle {
  return createPolicyBundle(2, effectiveFrom);
}

function hasIndependentConfirmation(facts: FactView): boolean {
  const evidence = facts.evidenceFacts ?? [];
  const submitted = evidence.filter(item => item.sourceAuthority === "platform_submitted");
  return submitted.length > 0 && evidence.some(item => {
    if (item.sourceAuthority !== "independent_confirmation" || item.category !== "independent_confirmation") return false;
    const attrs = new Map(item.attributes.map(a => [a.key, a.value]));
    // Only the server-owned review adapter may create this source authority.
    // No provider is approved for automated confirmation in the initial V2 registry.
    return attrs.get("policy_version") === ORGANIZATION_VERIFICATION_POLICY_V2 &&
      attrs.get("outcome") === "confirmed" && attrs.get("method") === "independent_human" &&
      typeof attrs.get("reviewer_principal_id") === "string" &&
      String(attrs.get("reviewer_principal_id")).length > 0 &&
      attrs.get("profile_fingerprint") === facts.registryFacts?.profileFingerprint &&
      submitted.every(source => source.contentDigest === attrs.get("reviewed_content_digest"));
  });
}

function createPolicyBundle(version: 1 | 2, effectiveFrom: string): MinimumTradeTrustOrganizationPolicyBundle {
  const policyVersion = version === 1 ? MINIMUM_TRADE_TRUST_ORGANIZATION_POLICY_VERSION : ORGANIZATION_VERIFICATION_POLICY_V2;
  const definitions: readonly RuleDefinition[] = version === 1 ? DEFINITIONS : [
    ...DEFINITIONS.map(definition => definition.id !== "organization-evidence-integrity-valid" ? definition : {
      ...definition,
      evaluate: (facts: FactView) => hasValidEvidenceIntegrity({ ...facts,
        evidenceFacts: facts.evidenceFacts?.filter(item => item.sourceAuthority === "platform_submitted"),
      }) && (facts.evidenceFacts ?? []).every(item =>
        (item.sourceAuthority === "platform_submitted" ||
          (item.sourceAuthority === "independent_confirmation" && item.category === "independent_confirmation")) &&
        /^[a-f0-9]{64}$/.test(item.contentDigest)),
    }),
    { id: "organization-independent-confirmation-required", title: "Independent confirmation of the submitted evidence is required",
      category: "organization_verification.independent_confirmation", reasonCode: "organization_verification.independent_confirmation.required",
      severity: "high", failureDisposition: "manual_review_required", evaluate: hasIndependentConfirmation },
  ];
  const policySetId = must(
    policy.createOrganizationVerificationPolicySetId(POLICY_SET_ID),
  );
  const policySetVersion = must(
    policy.createOrganizationVerificationPolicySetVersion(
      policyVersion,
    ),
  );
  const provenanceReference = must(
    policy.createOrganizationVerificationPolicyProvenanceReference(
      version === 1 ? POLICY_PROVENANCE : "tutela-production-policy:organization-verification:v2",
    ),
  );
  const ruleIdentities = definitions.map((definition, index) => ({
    ruleId: must(policy.createOrganizationVerificationRuleId(definition.id)),
    ruleVersion: must(
      policy.createOrganizationVerificationRuleVersion(`rule-version-${version}`),
    ),
    required: true,
    evaluationOrder: index + 1,
  }));
  const policySet = must(
    policy.createOrganizationVerificationPolicySet({
      policySetId,
      policySetVersion,
      policyContractVersion: policy.POLICY_CONTRACT_VERSION,
      name: "TUTELA minimum trade trust organization verification",
      effectiveFrom,
      rules: ruleIdentities,
      evaluationContractVersion: policy.POLICY_EVALUATION_CONTRACT_VERSION,
      provenanceReference,
      integrityReference: must(
        policy.createOrganizationVerificationPolicySetIntegrityReference(
          `tutela-production-policy-integrity:organization-verification:v${version}`,
        ),
      ),
      status: "active",
    }),
  );
  const rules = Object.freeze(
    definitions.map((definition, index) =>
      must(
        policy.createOrganizationVerificationRule({
          ...ruleIdentities[index],
          policySetId,
          policySetVersion,
          ruleContractVersion: policy.RULE_CONTRACT_VERSION,
          title: definition.title,
          normalizedCategory: definition.category,
          severity: definition.severity,
          evaluationDisposition: definition.failureDisposition,
          reasonCode: definition.reasonCode,
          provenanceReference,
          integrityReference: must(
            policy.createOrganizationVerificationRuleIntegrityReference(
              `tutela-production-rule-integrity:${definition.id}:v${version}`,
            ),
          ),
        }),
      ),
    ),
  );
  const implementations = definitions.map((definition, index) =>
    must(
      runtimeContract.createOrganizationVerificationRuleImplementation({
        ruleId: ruleIdentities[index].ruleId,
        ruleVersion: ruleIdentities[index].ruleVersion,
        policySetId,
        policySetVersion,
        implementationContractVersion:
          runtimeContract.ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_CONTRACT_VERSION,
        implementationVersion: must(
          runtimeContract.createOrganizationVerificationRuleImplementationVersion(
            `implementation-version-${version}`,
          ),
        ),
        implementationDigest: must(
          runtimeContract.createOrganizationVerificationRuleImplementationDigest(
            createHash("sha256")
              .update(
                `${policyVersion}:${definition.id}:implementation-version-${version}`,
              )
              .digest("hex"),
          ),
        ),
        provenanceReference: must(
          runtimeContract.createOrganizationVerificationRuleImplementationProvenanceReference(
            `tutela-production-rule-implementation:${definition.id}:v${version}`,
          ),
        ),
        integrityReference: must(
          runtimeContract.createOrganizationVerificationRuleImplementationIntegrityReference(
            `tutela-production-rule-implementation-integrity:${definition.id}:v${version}`,
          ),
        ),
        evaluate: (facts) =>
          disposition(
            definition.evaluate(facts)
              ? "satisfied"
              : definition.failureDisposition,
          ),
      }),
    ),
  );
  const implementationSet = must(
    runtimeContract.createOrganizationVerificationRuleImplementationSet({
      implementationSetId: must(
        runtimeContract.createOrganizationVerificationRuleImplementationSetId(
          "minimum-trade-trust-organization-implementations",
        ),
      ),
      implementationSetVersion: must(
        runtimeContract.createOrganizationVerificationRuleImplementationSetVersion(
          `implementation-set-version-${version}`,
        ),
      ),
      implementationSetContractVersion:
        runtimeContract.ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_SET_CONTRACT_VERSION,
      policySet,
      rules,
      implementations,
      provenanceReference: must(
        runtimeContract.createOrganizationVerificationRuleImplementationProvenanceReference(
          `tutela-production-implementation-set:v${version}`,
        ),
      ),
      integrityReference: must(
        runtimeContract.createOrganizationVerificationRuleImplementationIntegrityReference(
          `tutela-production-implementation-set-integrity:v${version}`,
        ),
      ),
    }),
  );
  return Object.freeze({ policySet, rules, implementationSet });
}
