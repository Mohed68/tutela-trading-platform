import {
  decisionFailure,
  decisionSuccess,
  type DecisionDomainFailureCode,
  type DecisionDomainResult,
} from "./errors.js";

declare const decisionBrand: unique symbol;
type Opaque<T extends string> = string & { readonly [decisionBrand]: T };

export type OrganizationVerificationDecisionId =
  Opaque<"OrganizationVerificationDecisionId">;
export type EvaluationCompletionId = Opaque<"EvaluationCompletionId">;
export type DecisionEngineVersion = Opaque<"DecisionEngineVersion">;
export type PolicySetReference = Opaque<"PolicySetReference">;
export type PolicySetVersion = Opaque<"PolicySetVersion">;
export type DecisionIntegrityReference = Opaque<"DecisionIntegrityReference">;

function createOpaque<T extends string>(
  value: unknown,
  failure: DecisionDomainFailureCode,
): DecisionDomainResult<Opaque<T>> {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head"].includes(value.trim().toLowerCase())
    ? decisionSuccess(value as Opaque<T>)
    : decisionFailure(failure);
}

export const createOrganizationVerificationDecisionId = (value: unknown) =>
  createOpaque<"OrganizationVerificationDecisionId">(
    value,
    "decision_id_invalid",
  );
export const createEvaluationCompletionId = (value: unknown) =>
  createOpaque<"EvaluationCompletionId">(value, "decision_context_invalid");
export const createDecisionEngineVersion = (value: unknown) =>
  createOpaque<"DecisionEngineVersion">(
    value,
    "decision_engine_version_invalid",
  );
export const createPolicySetReference = (value: unknown) =>
  createOpaque<"PolicySetReference">(value, "policy_set_reference_invalid");
export const createPolicySetVersion = (value: unknown) =>
  createOpaque<"PolicySetVersion">(value, "policy_set_version_invalid");
export const createDecisionIntegrityReference = (value: unknown) =>
  createOpaque<"DecisionIntegrityReference">(
    value,
    "decision_context_invalid",
  );
