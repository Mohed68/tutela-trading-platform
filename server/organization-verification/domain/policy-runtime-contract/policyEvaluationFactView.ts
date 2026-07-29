import {
  isOrganizationVerificationPolicyEvaluationInput,
  type OrganizationVerificationPolicyEvaluationFactSurface,
  type OrganizationVerificationPolicyEvaluationInput,
} from "../evaluation-input/index.js";
import {
  runtimeContractFailure,
  runtimeContractSuccess,
  type OrganizationVerificationPolicyRuntimeContractResult,
} from "./errors.js";

export interface OrganizationVerificationPolicyEvaluationFactView
  extends OrganizationVerificationPolicyEvaluationFactSurface {}

type RegistryFacts = NonNullable<
  OrganizationVerificationPolicyEvaluationFactSurface["registryFacts"]
>;
type SubmissionFacts = NonNullable<
  OrganizationVerificationPolicyEvaluationFactSurface["submissionFacts"]
>;
type EvidenceFacts = NonNullable<
  OrganizationVerificationPolicyEvaluationFactSurface["evidenceFacts"]
>;

function copyRegistryFacts(facts: RegistryFacts): RegistryFacts {
  const address = facts.legalIdentity.registeredAddress;
  return Object.freeze({
    profileRevisionSequence: facts.profileRevisionSequence,
    profileFingerprint: facts.profileFingerprint,
    legalIdentity: Object.freeze({
      legalName: facts.legalIdentity.legalName,
      tradingNames: Object.freeze([...facts.legalIdentity.tradingNames]),
      registrationJurisdiction:
        facts.legalIdentity.registrationJurisdiction,
      registrationIdentifiers: Object.freeze(
        facts.legalIdentity.registrationIdentifiers.map((identifier) =>
          Object.freeze({
            scheme: identifier.scheme,
            value: identifier.value,
          }),
        ),
      ),
      ...(facts.legalIdentity.legalForm
        ? { legalForm: facts.legalIdentity.legalForm }
        : {}),
      ...(facts.legalIdentity.incorporationDate
        ? { incorporationDate: facts.legalIdentity.incorporationDate }
        : {}),
      ...(address
        ? {
            registeredAddress: Object.freeze({
              ...(address.countryCode
                ? { countryCode: address.countryCode }
                : {}),
              ...(address.administrativeArea
                ? { administrativeArea: address.administrativeArea }
                : {}),
              ...(address.locality ? { locality: address.locality } : {}),
              ...(address.postalCode
                ? { postalCode: address.postalCode }
                : {}),
              ...(address.addressLines
                ? {
                    addressLines: Object.freeze([...address.addressLines]),
                  }
                : {}),
            }),
          }
        : {}),
    }),
    organizationType: facts.organizationType,
    jurisdiction: facts.jurisdiction,
    declaredActivities: Object.freeze(
      facts.declaredActivities.map((activity) =>
        Object.freeze({
          ...(activity.code ? { code: activity.code } : {}),
          ...(activity.description
            ? { description: activity.description }
            : {}),
        }),
      ),
    ),
  });
}

function copySubmissionFacts(facts: SubmissionFacts): SubmissionFacts {
  return Object.freeze({
    revisionSequence: facts.revisionSequence,
    submittedAt: facts.submittedAt,
    declaredSections: Object.freeze(
      facts.declaredSections.map((section) =>
        Object.freeze({
          key: section.key,
          values: Object.freeze(
            section.values.map((value) =>
              Object.freeze({ key: value.key, value: value.value }),
            ),
          ),
        }),
      ),
    ),
  });
}

function copyEvidenceFacts(facts: EvidenceFacts): EvidenceFacts {
  return Object.freeze(
    facts.map((evidence) =>
      Object.freeze({
        evidenceReferenceId: evidence.evidenceReferenceId,
        evidenceReferenceVersion: evidence.evidenceReferenceVersion,
        revisionEvidenceReferenceId: evidence.revisionEvidenceReferenceId,
        evidenceKind: evidence.evidenceKind,
        category: evidence.category,
        sourceAuthority: evidence.sourceAuthority,
        contentDigest: evidence.contentDigest,
        ...(evidence.issuedAt ? { issuedAt: evidence.issuedAt } : {}),
        ...(evidence.capturedAt ? { capturedAt: evidence.capturedAt } : {}),
        ...(evidence.validFrom ? { validFrom: evidence.validFrom } : {}),
        ...(evidence.validUntil ? { validUntil: evidence.validUntil } : {}),
        attributes: Object.freeze(
          evidence.attributes.map((attribute) =>
            Object.freeze({
              key: attribute.key,
              value: attribute.value,
            }),
          ),
        ),
      }),
    ),
  );
}

export function adaptOrganizationVerificationEvaluationInputToPolicyEvaluationFactView(
  input: OrganizationVerificationPolicyEvaluationInput,
): OrganizationVerificationPolicyRuntimeContractResult<OrganizationVerificationPolicyEvaluationFactView> {
  if (!isOrganizationVerificationPolicyEvaluationInput(input)) {
    return runtimeContractFailure("unauthentic_policy_evaluation_input");
  }
  return runtimeContractSuccess(
    Object.freeze({
      ...(input.factSurface.registryFacts
        ? { registryFacts: copyRegistryFacts(input.factSurface.registryFacts) }
        : {}),
      ...(input.factSurface.submissionFacts
        ? {
            submissionFacts: copySubmissionFacts(
              input.factSurface.submissionFacts,
            ),
          }
        : {}),
      ...(input.factSurface.evidenceFacts
        ? { evidenceFacts: copyEvidenceFacts(input.factSurface.evidenceFacts) }
        : {}),
    }),
  );
}
