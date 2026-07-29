import {
  isOrganizationVerificationPolicyEvaluationInput,
  type OrganizationVerificationPolicyEvaluationInput,
} from "../evaluation-input/index.js";
import type {
  OrganizationVerificationFindingId,
  OrganizationVerificationPolicyEvaluationCompletionId,
  OrganizationVerificationRuleId,
  OrganizationVerificationRuleVersion,
} from "../policy/index.js";
import { fingerprintInternal } from "./canonical.js";
import {
  runtimeContractFailure,
  runtimeContractSuccess,
  type OrganizationVerificationPolicyRuntimeContractResult,
} from "./errors.js";
import {
  ORGANIZATION_VERIFICATION_EXECUTION_ARTIFACTS_CONTRACT_VERSION,
  createOrganizationVerificationExecutionArtifactsFingerprint,
  type OrganizationVerificationExecutionArtifactIntegrityReference,
  type OrganizationVerificationExecutionArtifactProvenanceReference,
  type OrganizationVerificationExecutionArtifactsContractVersion,
  type OrganizationVerificationExecutionArtifactsFingerprint,
  type OrganizationVerificationExecutionId,
  type OrganizationVerificationRuleResultId,
} from "./ids.js";
import {
  isOrganizationVerificationRuleImplementationSet,
  type OrganizationVerificationRuleImplementationSet,
} from "./ruleImplementationSet.js";

const executionArtifactsSeal = Symbol(
  "organization-verification-execution-artifacts",
);

export interface OrganizationVerificationRuleResultArtifact {
  readonly ruleId: OrganizationVerificationRuleId;
  readonly ruleVersion: OrganizationVerificationRuleVersion;
  readonly ruleResultId: OrganizationVerificationRuleResultId;
  readonly evaluatedAt: string;
  readonly provenanceReference: OrganizationVerificationExecutionArtifactProvenanceReference;
  readonly integrityReference: OrganizationVerificationExecutionArtifactIntegrityReference;
}

export interface OrganizationVerificationFindingArtifact {
  readonly ruleId: OrganizationVerificationRuleId;
  readonly ruleVersion: OrganizationVerificationRuleVersion;
  readonly findingId: OrganizationVerificationFindingId;
  readonly recordedAt: string;
  readonly provenanceReference: OrganizationVerificationExecutionArtifactProvenanceReference;
  readonly integrityReference: OrganizationVerificationExecutionArtifactIntegrityReference;
}

export interface OrganizationVerificationCompletionArtifact {
  readonly completionId: OrganizationVerificationPolicyEvaluationCompletionId;
  readonly completedAt: string;
  readonly provenanceReference: OrganizationVerificationExecutionArtifactProvenanceReference;
  readonly integrityReference: OrganizationVerificationExecutionArtifactIntegrityReference;
}

export interface OrganizationVerificationExecutionArtifacts {
  readonly executionArtifactsContractVersion: OrganizationVerificationExecutionArtifactsContractVersion;
  readonly executionId: OrganizationVerificationExecutionId;
  readonly policyEvaluationInputId: OrganizationVerificationPolicyEvaluationInput["policyEvaluationInputId"];
  readonly policyEvaluationInputVersion: OrganizationVerificationPolicyEvaluationInput["policyEvaluationInputVersion"];
  readonly policyEvaluationInputFingerprint: OrganizationVerificationPolicyEvaluationInput["inputFingerprint"];
  readonly implementationSetId: OrganizationVerificationRuleImplementationSet["implementationSetId"];
  readonly implementationSetVersion: OrganizationVerificationRuleImplementationSet["implementationSetVersion"];
  readonly implementationSetFingerprint: OrganizationVerificationRuleImplementationSet["implementationSetFingerprint"];
  readonly startedAt: string;
  readonly completedAt: string;
  readonly provenanceReference: OrganizationVerificationExecutionArtifactProvenanceReference;
  readonly integrityReference: OrganizationVerificationExecutionArtifactIntegrityReference;
  readonly ruleResults: readonly OrganizationVerificationRuleResultArtifact[];
  readonly findings: readonly OrganizationVerificationFindingArtifact[];
  readonly completion: OrganizationVerificationCompletionArtifact;
  readonly executionArtifactsFingerprint: OrganizationVerificationExecutionArtifactsFingerprint;
  readonly [executionArtifactsSeal]: true;
}

export interface CreateOrganizationVerificationExecutionArtifactsInput {
  readonly executionArtifactsContractVersion: unknown;
  readonly evaluationInput: OrganizationVerificationPolicyEvaluationInput;
  readonly implementationSet: OrganizationVerificationRuleImplementationSet;
  readonly executionId: OrganizationVerificationExecutionId;
  readonly startedAt: unknown;
  readonly completedAt: unknown;
  readonly provenanceReference: OrganizationVerificationExecutionArtifactProvenanceReference;
  readonly integrityReference: OrganizationVerificationExecutionArtifactIntegrityReference;
  readonly ruleResults: readonly OrganizationVerificationRuleResultArtifact[];
  readonly findings: readonly OrganizationVerificationFindingArtifact[];
  readonly completion: OrganizationVerificationCompletionArtifact;
  readonly expectedExecutionArtifactsFingerprint?: OrganizationVerificationExecutionArtifactsFingerprint;
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

function validTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function validArtifactReferences(
  provenanceReference: unknown,
  integrityReference: unknown,
): boolean {
  return (
    validIdentity(provenanceReference) && validIdentity(integrityReference)
  );
}

export function createOrganizationVerificationExecutionArtifacts(
  input: CreateOrganizationVerificationExecutionArtifactsInput,
): OrganizationVerificationPolicyRuntimeContractResult<OrganizationVerificationExecutionArtifacts> {
  if (
    input.executionArtifactsContractVersion !==
    ORGANIZATION_VERIFICATION_EXECUTION_ARTIFACTS_CONTRACT_VERSION
  ) {
    return runtimeContractFailure("invalid_runtime_contract_version");
  }
  if (!isOrganizationVerificationPolicyEvaluationInput(input.evaluationInput)) {
    return runtimeContractFailure("unauthentic_policy_evaluation_input");
  }
  if (
    !isOrganizationVerificationRuleImplementationSet(input.implementationSet)
  ) {
    return runtimeContractFailure("unauthentic_rule_implementation_set");
  }
  if (
    input.evaluationInput.policySetBinding.policySetId !==
      input.implementationSet.policySetId ||
    input.evaluationInput.policySetBinding.policySetVersion !==
      input.implementationSet.policySetVersion
  ) {
    return runtimeContractFailure("policy_set_binding_mismatch");
  }
  if (
    !validIdentity(input.executionId) ||
    !validArtifactReferences(
      input.provenanceReference,
      input.integrityReference,
    ) ||
    !validTimestamp(input.startedAt) ||
    !validTimestamp(input.completedAt)
  ) {
    return runtimeContractFailure("missing_execution_artifact");
  }
  if (Date.parse(input.completedAt) < Date.parse(input.startedAt)) {
    return runtimeContractFailure("invalid_execution_artifact_chronology");
  }

  const ruleResultIds = new Set<string>();
  const ruleResultKeys = new Set<string>();
  const ruleResults: OrganizationVerificationRuleResultArtifact[] = [];
  for (const [index, artifact] of input.ruleResults.entries()) {
    const key = `${artifact.ruleId}\u0000${artifact.ruleVersion}`;
    if (
      !validIdentity(artifact.ruleResultId) ||
      !validTimestamp(artifact.evaluatedAt) ||
      !validArtifactReferences(
        artifact.provenanceReference,
        artifact.integrityReference,
      )
    ) {
      return runtimeContractFailure(
        "missing_execution_artifact",
        `ruleResults.${index}`,
      );
    }
    if (
      Date.parse(artifact.evaluatedAt) < Date.parse(input.startedAt) ||
      Date.parse(artifact.evaluatedAt) > Date.parse(input.completedAt)
    ) {
      return runtimeContractFailure(
        "invalid_execution_artifact_chronology",
        `ruleResults.${index}`,
      );
    }
    if (
      ruleResultIds.has(artifact.ruleResultId) ||
      ruleResultKeys.has(key)
    ) {
      return runtimeContractFailure(
        "duplicate_execution_artifact",
        `ruleResults.${index}`,
      );
    }
    const binding = input.implementationSet.bindings.find(
      (candidate) =>
        candidate.rule.ruleId === artifact.ruleId &&
        candidate.rule.ruleVersion === artifact.ruleVersion,
    );
    if (!binding) {
      return runtimeContractFailure(
        "execution_artifact_binding_mismatch",
        `ruleResults.${index}`,
      );
    }
    ruleResultIds.add(artifact.ruleResultId);
    ruleResultKeys.add(key);
    ruleResults.push(Object.freeze({ ...artifact }));
  }
  if (ruleResults.length !== input.implementationSet.bindings.length) {
    return runtimeContractFailure("missing_execution_artifact", "ruleResults");
  }
  const ruleOrder = new Map(
    input.implementationSet.bindings.map((binding, index) => [
      `${binding.rule.ruleId}\u0000${binding.rule.ruleVersion}`,
      index,
    ]),
  );
  ruleResults.sort(
    (left, right) =>
      (ruleOrder.get(`${left.ruleId}\u0000${left.ruleVersion}`) ?? 0) -
      (ruleOrder.get(`${right.ruleId}\u0000${right.ruleVersion}`) ?? 0),
  );

  const findingIds = new Set<string>();
  const findings: OrganizationVerificationFindingArtifact[] = [];
  for (const [index, artifact] of input.findings.entries()) {
    if (
      !validIdentity(artifact.findingId) ||
      !validTimestamp(artifact.recordedAt) ||
      !validArtifactReferences(
        artifact.provenanceReference,
        artifact.integrityReference,
      )
    ) {
      return runtimeContractFailure(
        "missing_execution_artifact",
        `findings.${index}`,
      );
    }
    if (
      findingIds.has(artifact.findingId) ||
      !ruleResultKeys.has(`${artifact.ruleId}\u0000${artifact.ruleVersion}`)
    ) {
      return runtimeContractFailure(
        findingIds.has(artifact.findingId)
          ? "duplicate_execution_artifact"
          : "execution_artifact_binding_mismatch",
        `findings.${index}`,
      );
    }
    if (
      Date.parse(artifact.recordedAt) < Date.parse(input.startedAt) ||
      Date.parse(artifact.recordedAt) > Date.parse(input.completedAt)
    ) {
      return runtimeContractFailure(
        "invalid_execution_artifact_chronology",
        `findings.${index}`,
      );
    }
    findingIds.add(artifact.findingId);
    findings.push(Object.freeze({ ...artifact }));
  }
  findings.sort((left, right) => {
    const orderDifference =
      (ruleOrder.get(`${left.ruleId}\u0000${left.ruleVersion}`) ?? 0) -
      (ruleOrder.get(`${right.ruleId}\u0000${right.ruleVersion}`) ?? 0);
    return orderDifference !== 0
      ? orderDifference
      : left.findingId.localeCompare(right.findingId);
  });

  if (
    !validIdentity(input.completion.completionId) ||
    !validTimestamp(input.completion.completedAt) ||
    !validArtifactReferences(
      input.completion.provenanceReference,
      input.completion.integrityReference,
    )
  ) {
    return runtimeContractFailure(
      "missing_execution_artifact",
      "completion",
    );
  }
  if (input.completion.completedAt !== input.completedAt) {
    return runtimeContractFailure(
      "execution_artifact_binding_mismatch",
      "completion.completedAt",
    );
  }
  const completion = Object.freeze({ ...input.completion });

  const executionArtifactsFingerprint =
    createOrganizationVerificationExecutionArtifactsFingerprint(
      fingerprintInternal({
        executionArtifactsContractVersion:
          ORGANIZATION_VERIFICATION_EXECUTION_ARTIFACTS_CONTRACT_VERSION,
        executionId: input.executionId,
        policyEvaluationInputId:
          input.evaluationInput.policyEvaluationInputId,
        policyEvaluationInputVersion:
          input.evaluationInput.policyEvaluationInputVersion,
        policyEvaluationInputFingerprint: input.evaluationInput.inputFingerprint,
        implementationSetId: input.implementationSet.implementationSetId,
        implementationSetVersion:
          input.implementationSet.implementationSetVersion,
        implementationSetFingerprint:
          input.implementationSet.implementationSetFingerprint,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        provenanceReference: input.provenanceReference,
        integrityReference: input.integrityReference,
        ruleResults,
        findings,
        completion,
      }),
    );
  if (!executionArtifactsFingerprint.ok) {
    return runtimeContractFailure("invalid_runtime_contract_digest");
  }
  if (
    input.expectedExecutionArtifactsFingerprint !== undefined &&
    input.expectedExecutionArtifactsFingerprint !==
      executionArtifactsFingerprint.value
  ) {
    return runtimeContractFailure("invalid_execution_artifacts");
  }

  const artifacts = {
    executionArtifactsContractVersion:
      ORGANIZATION_VERIFICATION_EXECUTION_ARTIFACTS_CONTRACT_VERSION,
    executionId: input.executionId,
    policyEvaluationInputId: input.evaluationInput.policyEvaluationInputId,
    policyEvaluationInputVersion:
      input.evaluationInput.policyEvaluationInputVersion,
    policyEvaluationInputFingerprint: input.evaluationInput.inputFingerprint,
    implementationSetId: input.implementationSet.implementationSetId,
    implementationSetVersion:
      input.implementationSet.implementationSetVersion,
    implementationSetFingerprint:
      input.implementationSet.implementationSetFingerprint,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    provenanceReference: input.provenanceReference,
    integrityReference: input.integrityReference,
    ruleResults: Object.freeze(ruleResults),
    findings: Object.freeze(findings),
    completion,
    executionArtifactsFingerprint: executionArtifactsFingerprint.value,
  } as OrganizationVerificationExecutionArtifacts;
  Object.defineProperty(artifacts, executionArtifactsSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return runtimeContractSuccess(Object.freeze(artifacts));
}

export function isOrganizationVerificationExecutionArtifacts(
  value: unknown,
): value is OrganizationVerificationExecutionArtifacts {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<OrganizationVerificationExecutionArtifacts>)[
      executionArtifactsSeal
    ] === true &&
    Object.isFrozen(value)
  );
}
