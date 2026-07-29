import {
  createOrganizationVerificationRule,
  isOrganizationVerificationPolicySet,
  type OrganizationVerificationPolicySet,
  type OrganizationVerificationRule,
} from "../policy/index.js";
import { fingerprintInternal } from "./canonical.js";
import {
  runtimeContractFailure,
  runtimeContractSuccess,
  type OrganizationVerificationPolicyRuntimeContractResult,
} from "./errors.js";
import {
  ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_SET_CONTRACT_VERSION,
  createOrganizationVerificationRuleImplementationSetFingerprint,
  type OrganizationVerificationPolicySetFingerprint,
  type OrganizationVerificationRuleImplementationSetContractVersion,
  type OrganizationVerificationRuleImplementationSetFingerprint,
  type OrganizationVerificationRuleImplementationSetId,
  type OrganizationVerificationRuleImplementationSetVersion,
} from "./ids.js";
import { fingerprintOrganizationVerificationPolicySet } from "./policySetFingerprint.js";
import {
  isOrganizationVerificationRuleImplementation,
  type OrganizationVerificationRuleImplementation,
} from "./ruleImplementation.js";

const ruleImplementationSetSeal = Symbol(
  "organization-verification-rule-implementation-set",
);

export interface OrganizationVerificationRuleImplementationBinding {
  readonly rule: OrganizationVerificationRule;
  readonly implementation: OrganizationVerificationRuleImplementation;
}

export interface OrganizationVerificationRuleImplementationSet {
  readonly implementationSetId: OrganizationVerificationRuleImplementationSetId;
  readonly implementationSetVersion: OrganizationVerificationRuleImplementationSetVersion;
  readonly implementationSetContractVersion: OrganizationVerificationRuleImplementationSetContractVersion;
  readonly policySetId: OrganizationVerificationPolicySet["policySetId"];
  readonly policySetVersion: OrganizationVerificationPolicySet["policySetVersion"];
  readonly policySetFingerprint: OrganizationVerificationPolicySetFingerprint;
  readonly bindings: readonly OrganizationVerificationRuleImplementationBinding[];
  readonly provenanceReference: OrganizationVerificationRuleImplementation["provenanceReference"];
  readonly integrityReference: OrganizationVerificationRuleImplementation["integrityReference"];
  readonly implementationSetFingerprint: OrganizationVerificationRuleImplementationSetFingerprint;
  readonly [ruleImplementationSetSeal]: true;
}

export interface CreateOrganizationVerificationRuleImplementationSetInput {
  readonly implementationSetId: OrganizationVerificationRuleImplementationSetId;
  readonly implementationSetVersion: OrganizationVerificationRuleImplementationSetVersion;
  readonly implementationSetContractVersion: unknown;
  readonly policySet: OrganizationVerificationPolicySet;
  readonly expectedPolicySetFingerprint?: OrganizationVerificationPolicySetFingerprint;
  readonly rules: readonly OrganizationVerificationRule[];
  readonly implementations: readonly OrganizationVerificationRuleImplementation[];
  readonly provenanceReference: OrganizationVerificationRuleImplementation["provenanceReference"];
  readonly integrityReference: OrganizationVerificationRuleImplementation["integrityReference"];
  readonly expectedImplementationSetFingerprint?: OrganizationVerificationRuleImplementationSetFingerprint;
}

function validIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "default", "head"].includes(
      value.trim().toLowerCase(),
    )
  );
}

function validatedRule(
  rule: OrganizationVerificationRule,
): OrganizationVerificationPolicyRuntimeContractResult<OrganizationVerificationRule> {
  const result = createOrganizationVerificationRule(rule);
  return result.ok
    ? runtimeContractSuccess(result.value)
    : runtimeContractFailure("rule_definition_mismatch");
}

export function createOrganizationVerificationRuleImplementationSet(
  input: CreateOrganizationVerificationRuleImplementationSetInput,
): OrganizationVerificationPolicyRuntimeContractResult<OrganizationVerificationRuleImplementationSet> {
  if (
    input.implementationSetContractVersion !==
    ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_SET_CONTRACT_VERSION
  ) {
    return runtimeContractFailure("invalid_runtime_contract_version");
  }
  if (
    !validIdentity(input.implementationSetId) ||
    !validIdentity(input.implementationSetVersion) ||
    !validIdentity(input.provenanceReference) ||
    !validIdentity(input.integrityReference)
  ) {
    return runtimeContractFailure("invalid_runtime_contract_identity");
  }
  if (!isOrganizationVerificationPolicySet(input.policySet)) {
    return runtimeContractFailure("unauthentic_policy_set");
  }

  const policySetFingerprint = fingerprintOrganizationVerificationPolicySet(
    input.policySet,
  );
  if (!policySetFingerprint.ok) return policySetFingerprint;
  if (
    input.expectedPolicySetFingerprint !== undefined &&
    input.expectedPolicySetFingerprint !== policySetFingerprint.value
  ) {
    return runtimeContractFailure("policy_set_fingerprint_mismatch");
  }

  const rulesByKey = new Map<string, OrganizationVerificationRule>();
  for (const [index, rule] of input.rules.entries()) {
    const validated = validatedRule(rule);
    if (!validated.ok) {
      return runtimeContractFailure(
        "rule_definition_mismatch",
        `rules.${index}`,
      );
    }
    const key = `${validated.value.ruleId}\u0000${validated.value.ruleVersion}`;
    if (rulesByKey.has(key)) {
      return runtimeContractFailure("rule_definition_mismatch", `rules.${index}`);
    }
    rulesByKey.set(key, validated.value);
  }

  const implementationsByKey = new Map<
    string,
    OrganizationVerificationRuleImplementation
  >();
  for (const [index, implementation] of input.implementations.entries()) {
    if (!isOrganizationVerificationRuleImplementation(implementation)) {
      return runtimeContractFailure(
        "unauthentic_rule_implementation",
        `implementations.${index}`,
      );
    }
    const key = `${implementation.ruleId}\u0000${implementation.ruleVersion}`;
    if (implementationsByKey.has(key)) {
      return runtimeContractFailure(
        "duplicate_rule_implementation",
        `implementations.${index}`,
      );
    }
    implementationsByKey.set(key, implementation);
  }

  const policyRuleIds = new Set(
    input.policySet.rules.map((reference) => String(reference.ruleId)),
  );
  for (const implementation of input.implementations) {
    if (!policyRuleIds.has(implementation.ruleId)) {
      return runtimeContractFailure("extra_rule_implementation");
    }
  }

  const bindings: OrganizationVerificationRuleImplementationBinding[] = [];
  for (const reference of input.policySet.rules) {
    const key = `${reference.ruleId}\u0000${reference.ruleVersion}`;
    const rule = rulesByKey.get(key);
    if (!rule) {
      return runtimeContractFailure("rule_definition_mismatch");
    }
    if (
      rule.policySetId !== input.policySet.policySetId ||
      rule.policySetVersion !== input.policySet.policySetVersion ||
      rule.required !== reference.required ||
      rule.evaluationOrder !== reference.evaluationOrder
    ) {
      return runtimeContractFailure("rule_definition_mismatch");
    }
    const implementation = implementationsByKey.get(key);
    if (!implementation) {
      const sameRuleId = input.implementations.some(
        (candidate) => candidate.ruleId === reference.ruleId,
      );
      return runtimeContractFailure(
        sameRuleId
          ? "rule_implementation_version_mismatch"
          : "missing_rule_implementation",
      );
    }
    if (
      implementation.policySetId !== input.policySet.policySetId ||
      implementation.policySetVersion !== input.policySet.policySetVersion
    ) {
      return runtimeContractFailure("rule_implementation_policy_mismatch");
    }
    bindings.push(Object.freeze({ rule, implementation }));
  }

  if (rulesByKey.size !== input.policySet.rules.length) {
    return runtimeContractFailure("rule_definition_mismatch");
  }
  if (implementationsByKey.size !== input.policySet.rules.length) {
    return runtimeContractFailure("extra_rule_implementation");
  }

  const implementationSetFingerprint =
    createOrganizationVerificationRuleImplementationSetFingerprint(
      fingerprintInternal({
        implementationSetId: input.implementationSetId,
        implementationSetVersion: input.implementationSetVersion,
        implementationSetContractVersion:
          ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_SET_CONTRACT_VERSION,
        policySetId: input.policySet.policySetId,
        policySetVersion: input.policySet.policySetVersion,
        policySetFingerprint: policySetFingerprint.value,
        bindings: bindings.map(({ rule, implementation }) => ({
          rule,
          implementationFingerprint: implementation.implementationFingerprint,
        })),
        provenanceReference: input.provenanceReference,
        integrityReference: input.integrityReference,
      }),
    );
  if (!implementationSetFingerprint.ok) {
    return runtimeContractFailure("invalid_runtime_contract_digest");
  }
  if (
    input.expectedImplementationSetFingerprint !== undefined &&
    input.expectedImplementationSetFingerprint !==
      implementationSetFingerprint.value
  ) {
    return runtimeContractFailure("implementation_set_fingerprint_mismatch");
  }

  const implementationSet = {
    implementationSetId: input.implementationSetId,
    implementationSetVersion: input.implementationSetVersion,
    implementationSetContractVersion:
      ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_SET_CONTRACT_VERSION,
    policySetId: input.policySet.policySetId,
    policySetVersion: input.policySet.policySetVersion,
    policySetFingerprint: policySetFingerprint.value,
    bindings: Object.freeze(bindings),
    provenanceReference: input.provenanceReference,
    integrityReference: input.integrityReference,
    implementationSetFingerprint: implementationSetFingerprint.value,
  } as OrganizationVerificationRuleImplementationSet;
  Object.defineProperty(implementationSet, ruleImplementationSetSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return runtimeContractSuccess(Object.freeze(implementationSet));
}

export function isOrganizationVerificationRuleImplementationSet(
  value: unknown,
): value is OrganizationVerificationRuleImplementationSet {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<OrganizationVerificationRuleImplementationSet>)[
      ruleImplementationSetSeal
    ] === true &&
    Object.isFrozen(value)
  );
}
