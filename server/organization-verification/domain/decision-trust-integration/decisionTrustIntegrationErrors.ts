import type { DecisionDomainFailureCode } from "../decision/index.js";
import type { OrganizationVerificationDecisionTrustBindingFailureCode } from "../decision-trust-integration-contract/index.js";
import type { PolicyDomainFailureCode } from "../policy/index.js";
import type { TrustStatusDomainFailureCode } from "../trust-status/index.js";

export type OrganizationVerificationDecisionTrustIntegrationFailureStage =
  | "execution"
  | "normalized_adapter"
  | "decision"
  | "trust_source_facts"
  | "trust_derivation"
  | "binding";

export type OrganizationVerificationDecisionTrustIntegrationExecutionFailureCode =
  | "unauthentic_runtime_execution"
  | "unauthentic_decision"
  | "unauthentic_trust_status"
  | "invalid_execution_artifacts"
  | "invalid_execution_chronology"
  | "execution_fingerprint_mismatch"
  | "duplicate_execution"
  | "conflicting_execution";

export type OrganizationVerificationDecisionTrustIntegrationFailureData =
  | {
      stage: "execution";
      code: OrganizationVerificationDecisionTrustIntegrationExecutionFailureCode;
    }
  | {
      stage: "normalized_adapter";
      code: PolicyDomainFailureCode;
    }
  | {
      stage: "decision";
      code: DecisionDomainFailureCode;
    }
  | {
      stage: "trust_source_facts" | "trust_derivation";
      code: TrustStatusDomainFailureCode;
    }
  | {
      stage: "binding";
      code: OrganizationVerificationDecisionTrustBindingFailureCode;
    };

type WithFailureFlag<T> = T extends
  OrganizationVerificationDecisionTrustIntegrationFailureData
  ? Readonly<T & { ok: false }>
  : never;

export type OrganizationVerificationDecisionTrustIntegrationFailure =
  WithFailureFlag<OrganizationVerificationDecisionTrustIntegrationFailureData>;

export type OrganizationVerificationDecisionTrustIntegrationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | OrganizationVerificationDecisionTrustIntegrationFailure;

export function integrationSuccess<T>(
  value: T,
): OrganizationVerificationDecisionTrustIntegrationResult<T> {
  return Object.freeze({ ok: true, value });
}

export function integrationFailure<
  T extends OrganizationVerificationDecisionTrustIntegrationFailureData,
>(failure: T): Readonly<T & { ok: false }> {
  const result: T & { ok: false } = { ...failure, ok: false };
  Object.freeze(result);
  return result;
}
