import {
  isOrganizationVerificationPolicyEvaluationInput,
  type OrganizationVerificationPolicyEvaluationInput,
} from "../evaluation-input/index.js";
import {
  completeOrganizationVerificationPolicyEvaluation,
  createOrganizationVerificationFinding,
  createOrganizationVerificationFindingIntegrityReference,
  createOrganizationVerificationPolicyEvaluationIntegrityReference,
  createOrganizationVerificationPolicyProvenanceReference,
  createOrganizationVerificationRuleEvaluationIntegrityReference,
  createOrganizationVerificationRuleEvaluationResult,
  isOrganizationVerificationPolicySet,
  parseOrganizationVerificationFindingDisposition,
  type OrganizationVerificationFinding,
  type OrganizationVerificationPolicySet,
  type OrganizationVerificationRuleEvaluationResult,
} from "../policy/index.js";
import {
  adaptOrganizationVerificationEvaluationInputToPolicyEvaluationFactView,
  fingerprintOrganizationVerificationPolicySet,
  isOrganizationVerificationExecutionArtifacts,
  isOrganizationVerificationRuleImplementationSet,
  type OrganizationVerificationExecutionArtifacts,
  type OrganizationVerificationRuleImplementationSet,
} from "../policy-runtime-contract/index.js";
import { fingerprintPolicyRuntimeExecutionInternal } from "./canonical.js";
import {
  policyRuntimeFailure,
  policyRuntimeSuccess,
  type OrganizationVerificationPolicyRuntimeResult,
} from "./errors.js";
import {
  ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTION_CONTRACT_VERSION,
  ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTOR_VERSION,
  createOrganizationVerificationPolicyRuntimeExecutionFingerprint,
  type OrganizationVerificationPolicyRuntimeExecutionFingerprint,
} from "./ids.js";
import {
  createOrganizationVerificationPolicyEvaluationExecutionInternal,
  type OrganizationVerificationExecutedRuleResult,
  type OrganizationVerificationPolicyEvaluationExecution,
} from "./policyEvaluationExecution.js";
import { adaptAuthenticatedEvaluationInputToFrozenPolicyInput } from "./policyInputAdapter.js";

export interface ExecuteOrganizationVerificationPolicyEvaluationInput {
  readonly evaluationInput: OrganizationVerificationPolicyEvaluationInput;
  readonly policySet: OrganizationVerificationPolicySet;
  readonly implementationSet: OrganizationVerificationRuleImplementationSet;
  readonly executionArtifacts: OrganizationVerificationExecutionArtifacts;
  readonly expectedExecutionFingerprint?: OrganizationVerificationPolicyRuntimeExecutionFingerprint;
}

function exactCompatibility(
  input: ExecuteOrganizationVerificationPolicyEvaluationInput,
): OrganizationVerificationPolicyRuntimeResult<
  Readonly<{
    policySetFingerprint: OrganizationVerificationRuleImplementationSet["policySetFingerprint"];
  }>
> {
  if (!isOrganizationVerificationPolicyEvaluationInput(input.evaluationInput)) {
    return policyRuntimeFailure("unauthentic_evaluation_input");
  }
  if (!isOrganizationVerificationPolicySet(input.policySet)) {
    return policyRuntimeFailure("unauthentic_policy_set");
  }
  if (
    !isOrganizationVerificationRuleImplementationSet(input.implementationSet)
  ) {
    return policyRuntimeFailure("unauthentic_rule_implementation_set");
  }
  if (!isOrganizationVerificationExecutionArtifacts(input.executionArtifacts)) {
    return policyRuntimeFailure("unauthentic_execution_artifacts");
  }

  const policySetFingerprint = fingerprintOrganizationVerificationPolicySet(
    input.policySet,
  );
  if (!policySetFingerprint.ok) {
    return policyRuntimeFailure("unauthentic_policy_set", {
      cause: policySetFingerprint.code,
    });
  }
  const binding = input.evaluationInput.policySetBinding;
  if (
    binding.policySetId !== input.policySet.policySetId ||
    binding.policySetVersion !== input.policySet.policySetVersion ||
    binding.policyContractVersion !== input.policySet.policyContractVersion ||
    binding.provenanceReference !== input.policySet.provenanceReference ||
    binding.integrityReference !== input.policySet.integrityReference
  ) {
    return policyRuntimeFailure("evaluation_input_policy_mismatch");
  }
  if (
    input.implementationSet.policySetId !== input.policySet.policySetId ||
    input.implementationSet.policySetVersion !==
      input.policySet.policySetVersion
  ) {
    return policyRuntimeFailure("rule_implementation_set_mismatch");
  }
  if (
    input.implementationSet.policySetFingerprint !== policySetFingerprint.value
  ) {
    return policyRuntimeFailure("policy_set_fingerprint_mismatch");
  }

  const artifacts = input.executionArtifacts;
  if (
    artifacts.policyEvaluationInputId !==
      input.evaluationInput.policyEvaluationInputId ||
    artifacts.policyEvaluationInputVersion !==
      input.evaluationInput.policyEvaluationInputVersion ||
    artifacts.policyEvaluationInputFingerprint !==
      input.evaluationInput.inputFingerprint ||
    artifacts.implementationSetId !==
      input.implementationSet.implementationSetId ||
    artifacts.implementationSetVersion !==
      input.implementationSet.implementationSetVersion ||
    artifacts.implementationSetFingerprint !==
      input.implementationSet.implementationSetFingerprint
  ) {
    return policyRuntimeFailure("execution_artifacts_mismatch");
  }
  if (
    input.policySet.status !== "active" ||
    Date.parse(artifacts.startedAt) <
      Date.parse(input.evaluationInput.evaluationContext.requestedAt) ||
    Date.parse(artifacts.startedAt) <
      Date.parse(input.evaluationInput.evaluationContext.effectiveAt) ||
    Date.parse(artifacts.completedAt) < Date.parse(artifacts.startedAt) ||
    Date.parse(artifacts.startedAt) < Date.parse(input.policySet.effectiveFrom) ||
    (input.policySet.effectiveUntil !== undefined &&
      Date.parse(artifacts.startedAt) >=
        Date.parse(input.policySet.effectiveUntil))
  ) {
    return policyRuntimeFailure("invalid_execution_chronology");
  }
  return policyRuntimeSuccess(
    Object.freeze({ policySetFingerprint: policySetFingerprint.value }),
  );
}

export function executeOrganizationVerificationPolicyEvaluation(
  input: ExecuteOrganizationVerificationPolicyEvaluationInput,
): OrganizationVerificationPolicyRuntimeResult<OrganizationVerificationPolicyEvaluationExecution> {
  const compatibility = exactCompatibility(input);
  if (!compatibility.ok) return compatibility;

  const factView =
    adaptOrganizationVerificationEvaluationInputToPolicyEvaluationFactView(
      input.evaluationInput,
    );
  if (!factView.ok) {
    return policyRuntimeFailure("fact_view_adaptation_failure", {
      cause: factView.code,
    });
  }
  const policyInput = adaptAuthenticatedEvaluationInputToFrozenPolicyInput(
    input.evaluationInput,
  );
  if (!policyInput.ok) return policyInput;

  const findings: OrganizationVerificationFinding[] = [];
  const ruleExecutions: OrganizationVerificationExecutedRuleResult[] = [];
  const artifacts = input.executionArtifacts;

  for (const [index, binding] of input.implementationSet.bindings.entries()) {
    const resultArtifact = artifacts.ruleResults[index];
    if (
      !resultArtifact ||
      resultArtifact.ruleId !== binding.rule.ruleId ||
      resultArtifact.ruleVersion !== binding.rule.ruleVersion
    ) {
      return policyRuntimeFailure("execution_artifacts_mismatch", {
        path: `ruleResults.${index}`,
      });
    }

    let evaluatedDisposition: unknown;
    try {
      evaluatedDisposition = binding.implementation.evaluate(factView.value);
    } catch {
      return policyRuntimeFailure("rule_execution_failure", {
        path: `rules.${index}`,
      });
    }
    const disposition = parseOrganizationVerificationFindingDisposition(
      evaluatedDisposition,
    );
    if (
      !disposition.ok ||
      (disposition.value !== "satisfied" &&
        disposition.value !== binding.rule.evaluationDisposition)
    ) {
      return policyRuntimeFailure("rule_execution_contract_failure", {
        path: `rules.${index}`,
        cause: disposition.ok
          ? "rule_disposition_mismatch"
          : disposition.code,
      });
    }

    const ruleFindings: OrganizationVerificationFinding[] = [];
    const findingArtifacts = artifacts.findings.filter(
      (artifact) =>
        artifact.ruleId === binding.rule.ruleId &&
        artifact.ruleVersion === binding.rule.ruleVersion,
    );
    if (
      disposition.value === "satisfied" &&
      binding.rule.evaluationDisposition === "satisfied" &&
      findingArtifacts.length > 0
    ) {
      return policyRuntimeFailure("execution_artifacts_mismatch", {
        path: `rules.${index}.findings`,
        cause: "contradictory_satisfied_finding",
      });
    }
    const emittedFindingArtifacts =
      disposition.value === "satisfied" ? [] : findingArtifacts;
    for (const [findingIndex, findingArtifact] of emittedFindingArtifacts.entries()) {
      const provenanceReference =
        createOrganizationVerificationPolicyProvenanceReference(
          findingArtifact.provenanceReference,
        );
      const integrityReference =
        createOrganizationVerificationFindingIntegrityReference(
          findingArtifact.integrityReference,
        );
      if (!provenanceReference.ok || !integrityReference.ok) {
        return policyRuntimeFailure("finding_construction_failure", {
          path: `rules.${index}.findings.${findingIndex}`,
          cause: !provenanceReference.ok
            ? provenanceReference.code
            : !integrityReference.ok
              ? integrityReference.code
              : "finding_reference_validation_failed",
        });
      }
      const finding = createOrganizationVerificationFinding(
        {
          findingId: findingArtifact.findingId,
          policySetId: binding.rule.policySetId,
          policySetVersion: binding.rule.policySetVersion,
          ruleId: binding.rule.ruleId,
          ruleVersion: binding.rule.ruleVersion,
          organizationId: policyInput.value.organizationId,
          recordId: policyInput.value.recordId,
          revisionId: policyInput.value.revisionId,
          attemptId: policyInput.value.attemptId,
          snapshotId: policyInput.value.snapshotId,
          snapshotFingerprint: policyInput.value.snapshotFingerprint,
          reasonCode: binding.rule.reasonCode,
          severity: binding.rule.severity,
          disposition: disposition.value,
          normalizedCategory: binding.rule.normalizedCategory,
          evaluatedAt: findingArtifact.recordedAt,
          provenanceReference: provenanceReference.value,
          correlationId: policyInput.value.correlationId,
          integrityReference: integrityReference.value,
          evidenceReferenceIds: [],
          attributes: [],
        },
        { rule: binding.rule, evaluationInput: policyInput.value },
      );
      if (!finding.ok) {
        return policyRuntimeFailure("finding_construction_failure", {
          path: `rules.${index}.findings.${findingIndex}`,
          cause: finding.code,
        });
      }
      ruleFindings.push(finding.value);
      findings.push(finding.value);
    }

    const resultProvenance =
      createOrganizationVerificationPolicyProvenanceReference(
        resultArtifact.provenanceReference,
      );
    const resultIntegrity =
      createOrganizationVerificationRuleEvaluationIntegrityReference(
        resultArtifact.integrityReference,
      );
    if (!resultProvenance.ok || !resultIntegrity.ok) {
      return policyRuntimeFailure("rule_result_construction_failure", {
        path: `ruleResults.${index}`,
        cause: !resultProvenance.ok
          ? resultProvenance.code
          : !resultIntegrity.ok
            ? resultIntegrity.code
            : "rule_result_reference_validation_failed",
      });
    }
    const result = createOrganizationVerificationRuleEvaluationResult({
      rule: binding.rule,
      evaluationInput: policyInput.value,
      disposition: disposition.value,
      evaluationStartedAt: artifacts.startedAt,
      evaluationCompletedAt: resultArtifact.evaluatedAt,
      resultComplete: true,
      resultIntegrityValid: true,
      findings: ruleFindings,
      provenanceReference: resultProvenance.value,
      correlationId: policyInput.value.correlationId,
      integrityReference: resultIntegrity.value,
    });
    if (!result.ok) {
      return policyRuntimeFailure("rule_result_construction_failure", {
        path: `ruleResults.${index}`,
        cause: result.code,
      });
    }
    ruleExecutions.push(
      Object.freeze({
        ruleResultId: resultArtifact.ruleResultId,
        result: result.value,
      }),
    );
  }

  const completionProvenance =
    createOrganizationVerificationPolicyProvenanceReference(
      artifacts.completion.provenanceReference,
    );
  const completionIntegrity =
    createOrganizationVerificationPolicyEvaluationIntegrityReference(
      artifacts.completion.integrityReference,
    );
  if (!completionProvenance.ok || !completionIntegrity.ok) {
    return policyRuntimeFailure("policy_completion_failure", {
      cause: !completionProvenance.ok
        ? completionProvenance.code
        : !completionIntegrity.ok
          ? completionIntegrity.code
          : "completion_reference_validation_failed",
    });
  }
  const completion = completeOrganizationVerificationPolicyEvaluation({
    evaluationCompletionId: artifacts.completion.completionId,
    policySet: input.policySet,
    evaluationInput: policyInput.value,
    ruleResults: ruleExecutions.map((entry) => entry.result),
    evaluationStartedAt: artifacts.startedAt,
    evaluationCompletedAt: artifacts.completedAt,
    completionComplete: true,
    completionIntegrityValid: true,
    provenanceReference: completionProvenance.value,
    correlationId: policyInput.value.correlationId,
    integrityReference: completionIntegrity.value,
  });
  if (!completion.ok) {
    return policyRuntimeFailure("policy_completion_failure", {
      cause: completion.code,
    });
  }

  const executionFingerprint =
    createOrganizationVerificationPolicyRuntimeExecutionFingerprint(
      fingerprintPolicyRuntimeExecutionInternal({
        executionId: artifacts.executionId,
        executionContractVersion:
          ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTION_CONTRACT_VERSION,
        executorVersion:
          ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTOR_VERSION,
        policyEvaluationInputId:
          input.evaluationInput.policyEvaluationInputId,
        policyEvaluationInputVersion:
          input.evaluationInput.policyEvaluationInputVersion,
        policyEvaluationInputFingerprint: input.evaluationInput.inputFingerprint,
        policySetId: input.policySet.policySetId,
        policySetVersion: input.policySet.policySetVersion,
        policySetFingerprint: compatibility.value.policySetFingerprint,
        implementationSetId: input.implementationSet.implementationSetId,
        implementationSetVersion:
          input.implementationSet.implementationSetVersion,
        implementationSetFingerprint:
          input.implementationSet.implementationSetFingerprint,
        executionArtifactsFingerprint:
          artifacts.executionArtifactsFingerprint,
        startedAt: artifacts.startedAt,
        completedAt: artifacts.completedAt,
        provenanceReference: artifacts.provenanceReference,
        integrityReference: artifacts.integrityReference,
        ruleExecutions,
        findings,
        completion: completion.value,
      }),
    );
  if (!executionFingerprint.ok) return executionFingerprint;
  if (
    input.expectedExecutionFingerprint !== undefined &&
    input.expectedExecutionFingerprint !== executionFingerprint.value
  ) {
    return policyRuntimeFailure("execution_fingerprint_mismatch");
  }

  return policyRuntimeSuccess(
    createOrganizationVerificationPolicyEvaluationExecutionInternal({
      executionId: artifacts.executionId,
      executionContractVersion:
        ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTION_CONTRACT_VERSION,
      executorVersion:
        ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTOR_VERSION,
      policyEvaluationInputId:
        input.evaluationInput.policyEvaluationInputId,
      policyEvaluationInputVersion:
        input.evaluationInput.policyEvaluationInputVersion,
      policyEvaluationInputFingerprint: input.evaluationInput.inputFingerprint,
      policySetId: input.policySet.policySetId,
      policySetVersion: input.policySet.policySetVersion,
      policySetFingerprint: compatibility.value.policySetFingerprint,
      implementationSetId: input.implementationSet.implementationSetId,
      implementationSetVersion:
        input.implementationSet.implementationSetVersion,
      implementationSetFingerprint:
        input.implementationSet.implementationSetFingerprint,
      executionArtifactsFingerprint: artifacts.executionArtifactsFingerprint,
      startedAt: artifacts.startedAt,
      completedAt: artifacts.completedAt,
      provenanceReference: artifacts.provenanceReference,
      integrityReference: artifacts.integrityReference,
      ruleExecutions,
      findings,
      completion: completion.value,
      executionFingerprint: executionFingerprint.value,
    }),
  );
}
