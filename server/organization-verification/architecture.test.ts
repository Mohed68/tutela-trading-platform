import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ORGANIZATION_REGISTRY_ARCHITECTURE } from "../organization-registry/architecture.js";
import { ORGANIZATION_VERIFICATION_ARCHITECTURE } from "./architecture.js";

type ArchitectureViolationCode =
  | "GENERIC_TRUST_RUNTIME"
  | "ORG_VERIFICATION_IMPORTS_OFFER_INTERNAL"
  | "OFFER_IMPORTS_ORG_VERIFICATION_INTERNAL"
  | "ORG_VERIFICATION_IMPORTS_REGISTRY_INTERNAL"
  | "ORG_VERIFICATION_OWNS_RAW_ARTIFACT"
  | "ORG_VERIFICATION_OWNS_ELIGIBILITY"
  | "GENERIC_ORG_VERIFICATION_NAMESPACE"
  | "UNAUTHORIZED_DECISION_AUTHORITY"
  | "UNAUTHORIZED_TRUST_STATUS_AUTHORITY"
  | "ORG_VERIFICATION_STARTUP_WIRING"
  | "REGISTRY_IMPORTS_CAPABILITY_INTERNAL"
  | "REGISTRY_IMPORTS_RUNTIME"
  | "REGISTRY_EXPORTS_FORBIDDEN_AUTHORITY"
  | "REGISTRY_ACL_IMPORTS_RUNTIME"
  | "CORE_DOMAIN_LATER_SLICE_ARTIFACT"
  | "UNRESTRICTED_REVISION_CONSTRUCTOR"
  | "DECISION_DOMAIN_FORBIDDEN_DEPENDENCY"
  | "DECISION_DOMAIN_LATER_SLICE_ARTIFACT"
  | "UNAUTHORIZED_DECISION_CONSTRUCTION"
  | "DECISION_ENGINE_LIFECYCLE_AUTHORITY"
  | "DECISION_ENGINE_RUNTIME_WIRING"
  | "TRUST_STATUS_DOMAIN_FORBIDDEN_DEPENDENCY"
  | "TRUST_STATUS_DOMAIN_FORBIDDEN_AUTHORITY"
  | "UNAUTHORIZED_TRUST_STATUS_CONSTRUCTION"
  | "TRUST_STATUS_DERIVER_DECISION_AUTHORITY"
  | "TRUST_STATUS_DERIVER_RUNTIME_WIRING"
  | "DOMAIN_PUBLIC_EXPORT_LEAK"
  | "UNAUTHORIZED_AUTHENTICITY_READ"
  | "POLICY_DOMAIN_FORBIDDEN_DEPENDENCY"
  | "POLICY_DOMAIN_FORBIDDEN_AUTHORITY"
  | "POLICY_DOMAIN_PUBLIC_EXPORT_LEAK"
  | "UNAUTHORIZED_POLICY_CONSTRUCTION"
  | "POLICY_DOMAIN_RUNTIME_WIRING"
  | "FROZEN_DOMAIN_IMPORTS_POLICY"
  | "SNAPSHOT_DOMAIN_FORBIDDEN_DEPENDENCY"
  | "SNAPSHOT_DOMAIN_FORBIDDEN_AUTHORITY"
  | "SNAPSHOT_DOMAIN_PUBLIC_EXPORT_LEAK"
  | "UNAUTHORIZED_SNAPSHOT_CONSTRUCTION"
  | "UNAUTHORIZED_SNAPSHOT_AUTHENTICITY_READ"
  | "SNAPSHOT_DOMAIN_RUNTIME_WIRING"
  | "FROZEN_DOMAIN_IMPORTS_SNAPSHOT"
  | "EVALUATION_PROJECTION_FORBIDDEN_DEPENDENCY"
  | "EVALUATION_PROJECTION_FORBIDDEN_AUTHORITY"
  | "EVALUATION_PROJECTION_PUBLIC_EXPORT_LEAK"
  | "UNAUTHORIZED_EVALUATION_PROJECTION_CONSTRUCTION"
  | "EVALUATION_PROJECTION_RUNTIME_WIRING"
  | "EVALUATION_PROJECTION_DIRECT_REVISION_CONSUMPTION"
  | "FROZEN_DOMAIN_IMPORTS_EVALUATION_PROJECTION"
  | "EVALUATION_INPUT_FORBIDDEN_DEPENDENCY"
  | "EVALUATION_INPUT_FORBIDDEN_AUTHORITY"
  | "EVALUATION_INPUT_PUBLIC_EXPORT_LEAK"
  | "UNAUTHORIZED_EVALUATION_INPUT_CONSTRUCTION"
  | "UNAUTHORIZED_EVALUATION_INPUT_AUTHENTICITY_READ"
  | "EVALUATION_INPUT_DIRECT_SNAPSHOT_CONSUMPTION"
  | "EVALUATION_INPUT_RUNTIME_WIRING"
  | "FROZEN_DOMAIN_IMPORTS_EVALUATION_INPUT"
  | "POLICY_PREPARATION_BYPASS"
  | "DECISION_PREPARATION_BYPASS"
  | "TRUST_PREPARATION_BYPASS"
  | "POLICY_RUNTIME_CONTRACT_FORBIDDEN_DEPENDENCY"
  | "POLICY_RUNTIME_CONTRACT_FORBIDDEN_AUTHORITY"
  | "POLICY_RUNTIME_CONTRACT_PUBLIC_EXPORT_LEAK"
  | "POLICY_RUNTIME_EXECUTION_STARTED"
  | "POLICY_RUNTIME_FORBIDDEN_DEPENDENCY"
  | "POLICY_RUNTIME_FORBIDDEN_AUTHORITY"
  | "POLICY_RUNTIME_PUBLIC_EXPORT_LEAK"
  | "UNAUTHORIZED_POLICY_RUNTIME_CONSTRUCTION"
  | "POLICY_RUNTIME_EXTERNAL_WIRING"
  | "DECISION_TRUST_BINDING_FORBIDDEN_DEPENDENCY"
  | "DECISION_TRUST_BINDING_FORBIDDEN_AUTHORITY"
  | "DECISION_TRUST_BINDING_PUBLIC_EXPORT_LEAK"
  | "DECISION_TRUST_BINDING_EXTERNAL_WIRING"
  | "DECISION_TRUST_INTEGRATION_FORBIDDEN_DEPENDENCY"
  | "DECISION_TRUST_INTEGRATION_FORBIDDEN_AUTHORITY"
  | "DECISION_TRUST_INTEGRATION_PUBLIC_EXPORT_LEAK"
  | "DECISION_TRUST_INTEGRATION_EXTERNAL_WIRING"
  | "DECISION_TRUST_INTEGRATION_TRUST_BOUNDARY"
  | "CORE_AUTHENTICITY_PUBLIC_EXPORT_LEAK"
  | "CORE_AUTHENTICITY_GUARD_UNAUTHORIZED_CONSUMER"
  | "ATTEMPT_LIFECYCLE_CONTRACT_FORBIDDEN_DEPENDENCY"
  | "ATTEMPT_LIFECYCLE_CONTRACT_FORBIDDEN_AUTHORITY"
  | "ATTEMPT_LIFECYCLE_CONTRACT_PUBLIC_EXPORT_LEAK"
  | "ATTEMPT_LIFECYCLE_CONTRACT_EXTERNAL_WIRING"
  | "ATTEMPT_LIFECYCLE_RUNTIME_FORBIDDEN_DEPENDENCY"
  | "ATTEMPT_LIFECYCLE_RUNTIME_FORBIDDEN_AUTHORITY"
  | "ATTEMPT_LIFECYCLE_RUNTIME_PUBLIC_EXPORT_LEAK"
  | "ATTEMPT_LIFECYCLE_RUNTIME_EXTERNAL_WIRING"
  | "WORKFLOW_CONTRACT_FORBIDDEN_DEPENDENCY"
  | "WORKFLOW_CONTRACT_FORBIDDEN_AUTHORITY"
  | "WORKFLOW_CONTRACT_PUBLIC_EXPORT_LEAK"
  | "WORKFLOW_CONTRACT_EXTERNAL_WIRING"
  | "PERSISTENCE_CONTRACT_FORBIDDEN_DEPENDENCY"
  | "PERSISTENCE_CONTRACT_FORBIDDEN_AUTHORITY"
  | "PERSISTENCE_CONTRACT_PUBLIC_EXPORT_LEAK"
  | "PERSISTENCE_CONTRACT_IMPLEMENTATION"
  | "PERSISTENCE_CONTRACT_EXTERNAL_WIRING"
  | "PERSISTENCE_IN_MEMORY_FORBIDDEN_DEPENDENCY"
  | "PERSISTENCE_IN_MEMORY_FORBIDDEN_AUTHORITY"
  | "PERSISTENCE_IN_MEMORY_PUBLIC_EXPORT_LEAK"
  | "PERSISTENCE_IN_MEMORY_EXTERNAL_WIRING"
  | "REPLAY_RUNTIME_FORBIDDEN_DEPENDENCY"
  | "REPLAY_RUNTIME_FORBIDDEN_AUTHORITY"
  | "REPLAY_RUNTIME_PERSISTENCE_WRITE"
  | "REPLAY_RUNTIME_PUBLIC_EXPORT_LEAK"
  | "REPLAY_RUNTIME_EXTERNAL_WIRING"
  | "TRUST_STATUS_GUARD_UNAUTHORIZED_CONSUMER";

interface ArchitectureViolation {
  code: ArchitectureViolationCode;
  file: string;
  detail: string;
}

interface SourceFile {
  file: string;
  source: string;
}

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const ALLOWED_DECISION_AUTHORITY =
  ORGANIZATION_VERIFICATION_ARCHITECTURE.reservedAuthorities.decisionAuthority;
const ALLOWED_TRUST_STATUS_AUTHORITY =
  ORGANIZATION_VERIFICATION_ARCHITECTURE.reservedAuthorities
    .trustStatusAuthority;

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function productionTypeScriptFiles(root: string): SourceFile[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const files: SourceFile[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (
        !entry.isFile() ||
        !/\.(?:ts|tsx)$/.test(entry.name) ||
        /\.test\.(?:ts|tsx)$/.test(entry.name) ||
        /\.d\.ts$/.test(entry.name)
      ) {
        continue;
      }
      files.push({
        file: normalizePath(path.relative(REPOSITORY_ROOT, absolute)),
        source: fs.readFileSync(absolute, "utf8"),
      });
    }
  };

  visit(root);
  return files;
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\b(?:from|import)\s*\(\s*["']([^"']+)["']/g,
    /\brequire\s*\(\s*["']([^"']+)["']/g,
    /^\s*import\s*["']([^"']+)["']/gm,
    /\bfrom\s*["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) {
        specifiers.push(normalizePath(specifier));
      }
    }
  }
  return [...new Set(specifiers)];
}

function addViolation(
  violations: ArchitectureViolation[],
  code: ArchitectureViolationCode,
  file: string,
  detail: string,
): void {
  violations.push({ code, file, detail });
}

function authorityValues(
  source: string,
  property: "decisionAuthority" | "trustStatusAuthority",
): string[] {
  const values: string[] = [];
  const pattern = new RegExp(
    String.raw`\b${property}\s*[:=]\s*["']([^"']+)["']`,
    "g",
  );
  for (const match of source.matchAll(pattern)) {
    if (match[1]) {
      values.push(match[1]);
    }
  }
  return values;
}

function scanSourceFile(input: SourceFile): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  const file = normalizePath(input.file);
  const lowerFile = file.toLowerCase();
  const isOrganizationVerification = lowerFile.startsWith(
    "server/organization-verification/",
  );
  const isOfferVerification = lowerFile.startsWith("server/verification/");
  const isOrganizationRegistry = lowerFile.startsWith(
    "server/organization-registry/",
  );
  const isRegistryAcl = lowerFile.endsWith(
    "server/organization-verification/integration/organizationregistryacl.ts",
  );
  const isDecisionDomain = lowerFile.startsWith(
    "server/organization-verification/domain/decision/",
  );
  const isTrustStatusDomain = lowerFile.startsWith(
    "server/organization-verification/domain/trust-status/",
  );
  const isPolicyDomain = lowerFile.startsWith(
    "server/organization-verification/domain/policy/",
  );
  const isEvidenceSnapshotDomain = lowerFile.startsWith(
    "server/organization-verification/domain/evidence-snapshot/",
  );
  const isEvaluationProjectionDomain = lowerFile.startsWith(
    "server/organization-verification/domain/evaluation-projection/",
  );
  const isEvaluationInputDomain = lowerFile.startsWith(
    "server/organization-verification/domain/evaluation-input/",
  );
  const isPolicyRuntimeContractDomain = lowerFile.startsWith(
    "server/organization-verification/domain/policy-runtime-contract/",
  );
  const isPolicyRuntimeDomain = lowerFile.startsWith(
    "server/organization-verification/domain/policy-runtime/",
  );
  const isDecisionTrustIntegrationContractDomain = lowerFile.startsWith(
    "server/organization-verification/domain/decision-trust-integration-contract/",
  );
  const isDecisionTrustIntegrationDomain = lowerFile.startsWith(
    "server/organization-verification/domain/decision-trust-integration/",
  );
  const isAttemptLifecycleContract = lowerFile.startsWith(
    "server/organization-verification/application/attempt-lifecycle-contract/",
  );
  const isAttemptLifecycleRuntime = lowerFile.startsWith(
    "server/organization-verification/application/attempt-lifecycle-runtime/",
  );
  const isWorkflowContract = lowerFile.startsWith(
    "server/organization-verification/application/workflow-contract/",
  );
  const isWorkflowRuntime = lowerFile.startsWith(
    "server/organization-verification/application/workflow-runtime/",
  );
  const isPersistenceContract = lowerFile.startsWith(
    "server/organization-verification/application/persistence-contract/",
  );
  const isInMemoryPersistenceAdapter = lowerFile.startsWith(
    "server/organization-verification/infrastructure/persistence/in-memory/",
  );
  const isReplayRuntime = lowerFile.startsWith(
    "server/organization-verification/application/replay-runtime/",
  );
  const isOrganizationVerificationCoreDomain =
    lowerFile.startsWith("server/organization-verification/domain/") &&
    !isDecisionDomain &&
    !isTrustStatusDomain &&
    !isPolicyDomain &&
    !isEvidenceSnapshotDomain &&
    !isEvaluationProjectionDomain &&
    !isEvaluationInputDomain &&
    !isPolicyRuntimeContractDomain &&
    !isPolicyRuntimeDomain &&
    !isDecisionTrustIntegrationContractDomain &&
    !isDecisionTrustIntegrationDomain;
  const isDomainPublicIndex = lowerFile.endsWith(
    "server/organization-verification/domain/index.ts",
  );
  const isDecisionPublicIndex = lowerFile.endsWith(
    "server/organization-verification/domain/decision/index.ts",
  );
  const isTrustStatusPublicIndex = lowerFile.endsWith(
    "server/organization-verification/domain/trust-status/index.ts",
  );
  const isPolicyPublicIndex = lowerFile.endsWith(
    "server/organization-verification/domain/policy/index.ts",
  );
  const isEvidenceSnapshotPublicIndex = lowerFile.endsWith(
    "server/organization-verification/domain/evidence-snapshot/index.ts",
  );
  const isEvaluationProjectionPublicIndex = lowerFile.endsWith(
    "server/organization-verification/domain/evaluation-projection/index.ts",
  );
  const isEvaluationInputPublicIndex = lowerFile.endsWith(
    "server/organization-verification/domain/evaluation-input/index.ts",
  );
  const isPolicyRuntimeContractPublicIndex = lowerFile.endsWith(
    "server/organization-verification/domain/policy-runtime-contract/index.ts",
  );
  const isPolicyRuntimePublicIndex = lowerFile.endsWith(
    "server/organization-verification/domain/policy-runtime/index.ts",
  );
  const isDecisionTrustIntegrationContractPublicIndex = lowerFile.endsWith(
    "server/organization-verification/domain/decision-trust-integration-contract/index.ts",
  );
  const isDecisionTrustIntegrationPublicIndex = lowerFile.endsWith(
    "server/organization-verification/domain/decision-trust-integration/index.ts",
  );
  const isAttemptLifecycleContractPublicIndex = lowerFile.endsWith(
    "server/organization-verification/application/attempt-lifecycle-contract/index.ts",
  );
  const isAttemptLifecycleRuntimePublicIndex = lowerFile.endsWith(
    "server/organization-verification/application/attempt-lifecycle-runtime/index.ts",
  );
  const isWorkflowContractPublicIndex = lowerFile.endsWith(
    "server/organization-verification/application/workflow-contract/index.ts",
  );
  const isWorkflowRuntimePublicIndex = lowerFile.endsWith(
    "server/organization-verification/application/workflow-runtime/index.ts",
  );
  const isPersistenceContractPublicIndex = lowerFile.endsWith(
    "server/organization-verification/application/persistence-contract/index.ts",
  );
  const isArchitectureMarker =
    lowerFile.endsWith("/architecture.ts") ||
    lowerFile.endsWith("/index.ts");
  const specifiers = importSpecifiers(input.source);

  if (
    /(^|\/)server\/(?:trust|trust-engine|shared-trust)(?:\/|$)/i.test(file)
  ) {
    addViolation(
      violations,
      "GENERIC_TRUST_RUNTIME",
      file,
      "generic runtime trust capability root",
    );
  }

  if (
    ((isDomainPublicIndex ||
      isDecisionPublicIndex ||
      isTrustStatusPublicIndex ||
      isPolicyPublicIndex) &&
      /\b(?:copyDeclaredInputs|freezeEvidenceReferenceSet|appendRevisionReference|appendAttemptReference|domainSuccess|domainFailure|readSealedEvaluationCompletion|readDecisionApplicability|readOrganizationVerificationExpiryFact|readOrganizationVerificationInvalidationFact|readOrganizationVerificationTrustStatusSourceFacts|createDecisionInternal|createTrustStatusInternal)\b/.test(
      input.source,
      )) ||
    (isDomainPublicIndex &&
      /export\s+\*\s+from\s+["']\.\/(?:attempt|draft|errors|evidenceReferences|ids|process|record|revision|submission)\.js["']/.test(
        input.source,
      ))
  ) {
    addViolation(
      violations,
      "DOMAIN_PUBLIC_EXPORT_LEAK",
      file,
      "Public domain barrel exposes an internal helper or uncurated core module",
    );
  }

  if (
    isDomainPublicIndex &&
    /\b(?:recordAuthenticitySeal|revisionAuthenticitySeal|attemptAuthenticitySeal|authenticRecords|authenticRevisions|authenticAttempts|sealOrganizationVerificationRecord|sealOrganizationVerificationRevision|sealOrganizationVerificationAttempt)\b/.test(
      input.source,
    )
  ) {
    addViolation(
      violations,
      "CORE_AUTHENTICITY_PUBLIC_EXPORT_LEAK",
      file,
      "Core public surface exposes a private authenticity seal, registry, or stamping authority",
    );
  }

  const coreAuthenticityGuardAuthorities: ReadonlyArray<{
    readonly symbol: string;
    readonly allowedSuffixes: readonly string[];
  }> = [
    {
      symbol: "isOrganizationVerificationRecord",
      allowedSuffixes: [
        "/domain/record.ts",
        "/domain/submission.ts",
        "/domain/attempt.ts",
        "/domain/index.ts",
      ],
    },
    {
      symbol: "isOrganizationVerificationRevision",
      allowedSuffixes: [
        "/domain/submission.ts",
        "/domain/attempt.ts",
        "/domain/index.ts",
      ],
    },
    {
      symbol: "isOrganizationVerificationAttempt",
      allowedSuffixes: ["/domain/attempt.ts", "/domain/index.ts"],
    },
  ];
  for (const authority of coreAuthenticityGuardAuthorities) {
    const isApprovedLifecycleContract =
      lowerFile.startsWith(
        "server/organization-verification/application/attempt-lifecycle-contract/",
      ) ||
      lowerFile.startsWith(
        "server/organization-verification/application/attempt-lifecycle-runtime/",
      );
    if (
      new RegExp(`\\b${authority.symbol}\\b`).test(input.source) &&
      !isApprovedLifecycleContract &&
      !authority.allowedSuffixes.some((suffix) => lowerFile.endsWith(suffix))
    ) {
      addViolation(
        violations,
        "CORE_AUTHENTICITY_GUARD_UNAUTHORIZED_CONSUMER",
        file,
        authority.symbol,
      );
    }
  }

  if (
    isPolicyPublicIndex &&
    (/\b(?:policySuccess|policyFailure|readOrganizationVerificationFinding|readOrganizationVerificationRuleEvaluationResult|readOrganizationVerificationPolicyEvaluationCompletion|createOrganizationVerificationPolicyEvaluationCompletionInternal|policyEvaluationClassification)\b/.test(
      input.source,
    ) ||
      /export\s+\*\s+from\s+["']/.test(input.source))
  ) {
    addViolation(
      violations,
      "POLICY_DOMAIN_PUBLIC_EXPORT_LEAK",
      file,
      "Policy public surface exposes internal authenticity or construction authority",
    );
  }

  if (
    isEvidenceSnapshotPublicIndex &&
    (/\b(?:evidenceSnapshotSeal|createOrganizationVerificationEvidenceSnapshotInternal|readOrganizationVerificationEvidenceSnapshotInternal|canonicalizeEvidenceSnapshotValueInternal|computeEvidenceSnapshotFingerprintInternal|freezeOrganizationVerificationEvidenceSet)\b/.test(
      input.source,
    ) ||
      /export\s+\*\s+from\s+["']/.test(input.source))
  ) {
    addViolation(
      violations,
      "SNAPSHOT_DOMAIN_PUBLIC_EXPORT_LEAK",
      file,
      "Evidence Snapshot public surface exposes construction, authenticity, canonicalization, or freezing internals",
    );
  }

  if (
    isEvaluationProjectionPublicIndex &&
    (/\b(?:evaluationProjectionSeal|createOrganizationVerificationEvaluationProjectionInternal|computeEvaluationProjectionFingerprintInternal|createEvaluationProjectionFingerprintInternal|canonical)\b/.test(
      input.source,
    ) ||
      /export\s+\*\s+from\s+["']/.test(input.source))
  ) {
    addViolation(
      violations,
      "EVALUATION_PROJECTION_PUBLIC_EXPORT_LEAK",
      file,
      "Evaluation Projection public surface exposes construction, seal, fingerprint, or canonicalization internals",
    );
  }

  if (
    isEvaluationInputPublicIndex &&
    (/\b(?:policyEvaluationInputSeal|createOrganizationVerificationPolicyEvaluationInputInternal|readOrganizationVerificationPolicyEvaluationInputInternal|canonicalizePolicyEvaluationInputInternal|computePolicyEvaluationInputFingerprintInternal|createPolicyEvaluationInputFingerprintInternal)\b/.test(
      input.source,
    ) ||
      /export\s+\*\s+from\s+["']/.test(input.source))
  ) {
    addViolation(
      violations,
      "EVALUATION_INPUT_PUBLIC_EXPORT_LEAK",
      file,
      "Evaluation Input public surface exposes seals, constructors, readers, hashing, or canonicalization internals",
    );
  }

  if (
    isPolicyRuntimeContractPublicIndex &&
    (/\b(?:fingerprintInternal|canonicalize|runtimeContractSuccess|runtimeContractFailure|ruleImplementationSeal|ruleImplementationSetSeal|executionArtifactsSeal)\b/.test(
      input.source,
    ) ||
      /export\s+\*\s+from\s+["']/.test(input.source))
  ) {
    addViolation(
      violations,
      "POLICY_RUNTIME_CONTRACT_PUBLIC_EXPORT_LEAK",
      file,
      "Executable Rule contract public surface exposes construction, seal, result, hashing, or canonicalization internals",
    );
  }

  if (
    isPolicyRuntimePublicIndex &&
    (/\b(?:policyRuntimeExecutionSeal|createOrganizationVerificationPolicyEvaluationExecutionInternal|fingerprintPolicyRuntimeExecutionInternal|canonicalize|policyRuntimeSuccess|policyRuntimeFailure|adaptAuthenticatedEvaluationInputToFrozenPolicyInput)\b/.test(
      input.source,
    ) ||
      /export\s+\*\s+from\s+["']/.test(input.source))
  ) {
    addViolation(
      violations,
      "POLICY_RUNTIME_PUBLIC_EXPORT_LEAK",
      file,
      "Policy Runtime public surface exposes construction, seal, result, adapter, hashing, or canonicalization internals",
    );
  }

  if (
    isDecisionTrustIntegrationContractPublicIndex &&
    (/\b(?:integrationBindingSeal|integrationInputBindingSeal|fingerprintDecisionTrustBindingInternal|canonicalize|bindingSuccess|bindingFailure|createTrustStatusInternal|createDecisionInternal)\b/.test(
      input.source,
    ) ||
      /export\s+\*\s+from\s+["']/.test(input.source))
  ) {
    addViolation(
      violations,
      "DECISION_TRUST_BINDING_PUBLIC_EXPORT_LEAK",
      file,
      "Decision–Trust binding public surface exposes a seal, constructor, result helper, or canonicalization internal",
    );
  }

  if (
    isDecisionTrustIntegrationPublicIndex &&
    (/\b(?:decisionTrustIntegrationExecutionSeal|createOrganizationVerificationDecisionTrustIntegrationExecutionInternal|fingerprintDecisionTrustIntegrationExecutionInternal|canonicalize|integrationSuccess|integrationFailure|deriveTrustStatusFromAuthenticDecision)\b/.test(
      input.source,
    ) ||
      /export\s+\*\s+from\s+["']/.test(input.source))
  ) {
    addViolation(
      violations,
      "DECISION_TRUST_INTEGRATION_PUBLIC_EXPORT_LEAK",
      file,
      "Decision–Trust integration public surface exposes a seal, constructor, internal helper, result helper, or canonicalization authority",
    );
  }

  if (
    isAttemptLifecycleContractPublicIndex &&
    (/\b(?:transitionRecordSeal|lifecycleExecutionSeal|authenticTransitionRecords|authenticLifecycleExecutions|sealTransitionRecord|sealLifecycleExecution|canonicalizeAttemptLifecycleValue|fingerprintAttemptLifecycleValue|contractSuccess|contractFailure|normalizeAttemptLifecycleEvidenceArtifacts)\b/.test(
      input.source,
    ) ||
      /export\s+\*\s+from\s+["']/.test(input.source))
  ) {
    addViolation(
      violations,
      "ATTEMPT_LIFECYCLE_CONTRACT_PUBLIC_EXPORT_LEAK",
      file,
      "Attempt Lifecycle contract exposes a seal, constructor helper, canonicalization, or result internal",
    );
  }

  if (
    isAttemptLifecycleRuntimePublicIndex &&
    (/\b(?:runtimeExecutionSeal|authenticRuntimeExecutions|createAttemptLifecycleTransitionExecutionInternal|fingerprintAttemptLifecycleRuntime|runtimeSuccess|runtimeFailure)\b/.test(
      input.source,
    ) ||
      /export\s+\*\s+from\s+["']/.test(input.source))
  ) {
    addViolation(
      violations,
      "ATTEMPT_LIFECYCLE_RUNTIME_PUBLIC_EXPORT_LEAK",
      file,
      "Attempt Lifecycle runtime exposes a seal, constructor, fingerprint, or result internal",
    );
  }

  if (
    isWorkflowContractPublicIndex &&
    (/\b(?:workflowExecutionSeal|workflowStepSeal|authenticWorkflowExecutions|authenticWorkflowStepRecords|canonicalizeWorkflowValue|fingerprintWorkflowValue|workflowSuccess|workflowFailure|validateArtifacts|validateArtifactChain)\b/.test(
      input.source,
    ) ||
      /export\s+\*\s+from\s+["']/.test(input.source))
  ) {
    addViolation(
      violations,
      "WORKFLOW_CONTRACT_PUBLIC_EXPORT_LEAK",
      file,
      "Workflow contract exposes a seal, constructor internal, canonicalization, fingerprint, or result helper",
    );
  }

  if (
    /\bisOrganizationVerificationTrustStatus\b/.test(input.source) &&
    !lowerFile.endsWith(
      "/domain/trust-status/truststatusderiver.ts",
    ) &&
    !lowerFile.endsWith("/domain/trust-status/index.ts") &&
    !lowerFile.endsWith(
      "/domain/decision-trust-integration-contract/integrationbinding.ts",
    ) &&
    !lowerFile.endsWith(
      "/domain/decision-trust-integration/trustderivation.ts",
    ) &&
    !lowerFile.endsWith(
      "/domain/decision-trust-integration/decisiontrustintegrationexecution.ts",
    )
  ) {
    addViolation(
      violations,
      "TRUST_STATUS_GUARD_UNAUTHORIZED_CONSUMER",
      file,
      "Trust Status authenticity guard is restricted to Trust public validation and the Decision–Trust binding contract",
    );
  }

  const authenticityReadAuthorities: ReadonlyArray<{
    readonly symbol: string;
    readonly allowedSuffixes: readonly string[];
  }> = [
    {
      symbol: "readSealedEvaluationCompletion",
      allowedSuffixes: [
        "/domain/decision/sealedevaluationcompletion.ts",
        "/domain/decision/decisionengine.ts",
      ],
    },
    {
      symbol: "readDecisionApplicability",
      allowedSuffixes: [
        "/domain/trust-status/applicability.ts",
        "/domain/trust-status/sourcefacts.ts",
      ],
    },
    {
      symbol: "readOrganizationVerificationExpiryFact",
      allowedSuffixes: [
        "/domain/trust-status/expiryfact.ts",
        "/domain/trust-status/sourcefacts.ts",
      ],
    },
    {
      symbol: "readOrganizationVerificationInvalidationFact",
      allowedSuffixes: [
        "/domain/trust-status/invalidationfact.ts",
        "/domain/trust-status/sourcefacts.ts",
      ],
    },
    {
      symbol: "readOrganizationVerificationTrustStatusSourceFacts",
      allowedSuffixes: [
        "/domain/trust-status/sourcefacts.ts",
        "/domain/trust-status/truststatusderiver.ts",
      ],
    },
    {
      symbol: "readOrganizationVerificationFinding",
      allowedSuffixes: [
        "/domain/policy/finding.ts",
        "/domain/policy/ruleevaluationresult.ts",
      ],
    },
    {
      symbol: "readOrganizationVerificationRuleEvaluationResult",
      allowedSuffixes: [
        "/domain/policy/ruleevaluationresult.ts",
        "/domain/policy/findingaggregator.ts",
      ],
    },
    {
      symbol: "readOrganizationVerificationPolicyEvaluationCompletion",
      allowedSuffixes: [
        "/domain/policy/policyevaluationcompletion.ts",
        "/domain/policy/findingaggregator.ts",
        "/domain/policy/normalizedevaluationadapter.ts",
      ],
    },
  ];
  for (const authority of authenticityReadAuthorities) {
    if (
      new RegExp(`\\b${authority.symbol}\\b`).test(input.source) &&
      !authority.allowedSuffixes.some((suffix) => lowerFile.endsWith(suffix))
    ) {
      addViolation(
        violations,
        "UNAUTHORIZED_AUTHENTICITY_READ",
        file,
        authority.symbol,
      );
    }
  }

  if (
    /\breadOrganizationVerificationEvidenceSnapshotInternal\b/.test(
      input.source,
    ) &&
    !lowerFile.endsWith("/domain/evidence-snapshot/evidencesnapshot.ts") &&
    !lowerFile.endsWith("/domain/evidence-snapshot/evidencesnapshotbuilder.ts")
  ) {
    addViolation(
      violations,
      "UNAUTHORIZED_SNAPSHOT_AUTHENTICITY_READ",
      file,
      "Evidence Snapshot authenticity is private to the model and sole Builder",
    );
  }

  if (isOrganizationVerification) {
    for (const specifier of specifiers) {
      if (/(^|\/)verification(?:\/|$)/i.test(specifier)) {
        addViolation(
          violations,
          "ORG_VERIFICATION_IMPORTS_OFFER_INTERNAL",
          file,
          specifier,
        );
      }

      const importsRegistry = /organization-registry/i.test(specifier);
      const importsApprovedRegistryPublicSurface =
        /organization-registry\/index\.js$/i.test(specifier);
      if (
        (importsRegistry && !importsApprovedRegistryPublicSurface) ||
        /(?:^|\/)registry\/(?:repository|database|db|schema|aggregate)/i.test(
          specifier,
        ) ||
        /@shared\/schema/i.test(specifier) ||
        /(?:^|\/)(?:db|database|storage)(?:\.js)?$/i.test(specifier) ||
        /^(?:drizzle-orm|pg|@neondatabase\/)/i.test(specifier)
      ) {
        addViolation(
          violations,
          "ORG_VERIFICATION_IMPORTS_REGISTRY_INTERNAL",
          file,
          specifier,
        );
      }

      if (
        /(?:^|\/)(?:object-storage|objectstorage|blob-storage|upload-storage|raw-document|artifact-storage|storage-provider)(?:\/|$)/i.test(
          specifier,
        ) ||
        /@google-cloud\/storage|@aws-sdk\/client-s3/i.test(specifier)
      ) {
        addViolation(
          violations,
          "ORG_VERIFICATION_OWNS_RAW_ARTIFACT",
          file,
          specifier,
        );
      }
    }

    if (
      /(?:^|\/)(?:raw-artifact|raw-document|blob-storage|upload-storage|artifact-storage|storage-provider)(?:\/|\.|$)/i.test(
        lowerFile,
      ) ||
      (!isArchitectureMarker &&
        /\b(?:RawArtifactStore|RawDocumentStore|BlobStorageClient|UploadStorage|EvidenceByteStore)\b/.test(
          input.source,
        ))
    ) {
      addViolation(
        violations,
        "ORG_VERIFICATION_OWNS_RAW_ARTIFACT",
        file,
        "raw artifact storage module or ownership identifier",
      );
    }

    if (
      /(?:^|\/)(?:participation|publication)-eligibility(?:\/|\.|$)/i.test(
        lowerFile,
      ) ||
      (!isArchitectureMarker &&
        /\b(?:ParticipationEligibilityDecision|PublicationEligibilityDecision|MarketplacePermissionDecision|TransactionAuthorization)\b/.test(
          input.source,
        ))
    ) {
      addViolation(
        violations,
        "ORG_VERIFICATION_OWNS_ELIGIBILITY",
        file,
        "downstream action-specific eligibility authority",
      );
    }

    if (
      !isArchitectureMarker &&
      /["'](?:trust|verification)\.[A-Za-z0-9_.-]+["']/.test(input.source)
    ) {
      addViolation(
        violations,
        "GENERIC_ORG_VERIFICATION_NAMESPACE",
        file,
        "generic runtime identifier namespace",
      );
    }

    for (const authority of authorityValues(
      input.source,
      "decisionAuthority",
    )) {
      if (authority !== ALLOWED_DECISION_AUTHORITY) {
        addViolation(
          violations,
          "UNAUTHORIZED_DECISION_AUTHORITY",
          file,
          authority,
        );
      }
    }

    for (const authority of authorityValues(
      input.source,
      "trustStatusAuthority",
    )) {
      if (authority !== ALLOWED_TRUST_STATUS_AUTHORITY) {
        addViolation(
          violations,
          "UNAUTHORIZED_TRUST_STATUS_AUTHORITY",
          file,
          authority,
        );
      }
    }
  }

  if (isOrganizationRegistry) {
    for (const specifier of specifiers) {
      if (
        /(?:^|\/)organization-verification(?:\/|$)/i.test(specifier) ||
        /(?:^|\/)verification(?:\/|$)/i.test(specifier)
      ) {
        addViolation(
          violations,
          "REGISTRY_IMPORTS_CAPABILITY_INTERNAL",
          file,
          specifier,
        );
      }
      if (
        /(?:^|\/)(?:db|database|storage|routes?|worker|index)(?:\.js)?$/i.test(
          specifier,
        ) ||
        /@shared\/schema|drizzle-orm|^pg$|@neondatabase\//i.test(specifier)
      ) {
        addViolation(
          violations,
          "REGISTRY_IMPORTS_RUNTIME",
          file,
          specifier,
        );
      }
    }
    if (
      /export\s+(?:type|interface|class|const|function)\s+\w*(?:Decision|TrustStatus)\w*/i.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "REGISTRY_EXPORTS_FORBIDDEN_AUTHORITY",
        file,
        "Registry contract exports Decision or Trust Status authority",
      );
    }
  }

  if (isRegistryAcl) {
    for (const specifier of specifiers) {
      if (
        /(?:^|\/)(?:db|database|storage|routes?|worker|index)(?:\.js)?$/i.test(
          specifier,
        ) &&
        !/organization-registry\/index\.js$/i.test(specifier)
      ) {
        addViolation(
          violations,
          "REGISTRY_ACL_IMPORTS_RUNTIME",
          file,
          specifier,
        );
      }
    }
  }

  if (isOrganizationVerificationCoreDomain) {
    if (
      /(?:^|\/)(?:decision|decision-engine|trust-status|trust-status-deriver|finding|policy)(?:\/|\.|$)/i.test(
        lowerFile,
      ) ||
      /["'](?:approved|revision_required|manual_review|rejected|unestablished|trusted|not_trusted|expired|invalidated)["']/.test(
        input.source,
      ) ||
      /\b(?:DecisionEngine|TrustStatusDeriver|VerificationFinding|ReasonCode|PolicyVersion)\b/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "CORE_DOMAIN_LATER_SLICE_ARTIFACT",
        file,
        "Decision, status, finding, or policy belongs to a later slice",
      );
    }
    if (
      /\bexport\s+(?:class|function|const)\s+(?:create)?OrganizationVerificationRevision\b/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "UNRESTRICTED_REVISION_CONSTRUCTOR",
        file,
        "Revision construction must remain behind Submission",
      );
    }
  }

  if (isEvidenceSnapshotDomain) {
    for (const specifier of specifiers) {
      const allowed =
        /^\.\/[A-Za-z0-9]+\.js$/.test(specifier) ||
        specifier === "../index.js" ||
        specifier === "../../../organization-registry/index.js" ||
        specifier === "node:crypto";
      if (
        !allowed ||
        /(?:^|\/)(?:db|database|schema|storage|repository|routes?|workers?|startup|frontend|client|providers?|services?|sessions?)(?:\/|\.|$)/i.test(
          specifier,
        ) ||
        /(?:^|\/)(?:verification|marketplace|kyb|aml|sanctions|compliance|payments?|orders?|contracts?|notifications?|blockchain|ai|openai|stripe|sentry)(?:\/|$)/i.test(
          specifier,
        ) ||
        /^(?:drizzle-orm|pg|@neondatabase\/|openai|stripe|@sentry\/)/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "SNAPSHOT_DOMAIN_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }
    if (
      /\b(?:decideOrganizationVerification|deriveOrganizationVerificationTrustStatus|transitionAttemptProcess|createOrganizationVerificationFinding|evaluateOrganizationVerificationPolicy|ParticipationEligibility)\b/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "SNAPSHOT_DOMAIN_FORBIDDEN_AUTHORITY",
        file,
        "Evidence Snapshot must record source facts without Policy, Finding, Decision, Trust, Eligibility, or workflow authority",
      );
    }
  }

  if (isEvaluationProjectionDomain) {
    for (const specifier of specifiers) {
      const allowed =
        /^\.\/[A-Za-z0-9]+\.js$/.test(specifier) ||
        specifier === "../evidence-snapshot/index.js" ||
        specifier === "node:crypto";
      if (
        !allowed ||
        /(?:^|\/)(?:db|database|schema|storage|repository|routes?|workers?|startup|frontend|client|providers?|services?|sessions?)(?:\/|\.|$)/i.test(
          specifier,
        ) ||
        /(?:^|\/)(?:marketplace|kyb|aml|sanctions|compliance|payments?|orders?|contracts?|notifications?|blockchain|ai|openai|stripe|sentry|policy|decision|trust-status)(?:\/|$)/i.test(
          specifier,
        ) ||
        /^(?:drizzle-orm|pg|@neondatabase\/|openai|stripe|@sentry\/)/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "EVALUATION_PROJECTION_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }
    if (
      /\b(?:evaluateOrganizationVerificationPolicy|createOrganizationVerificationFinding|decideOrganizationVerification|deriveOrganizationVerificationTrustStatus|transitionAttemptProcess|ParticipationEligibility|PolicyEvaluationInput|EvaluationInput)\b/.test(
        input.source,
      ) ||
      /\b(?:hasLicense|documentExpired|supportedJurisdiction|isEligible|isCompliant|isAuthentic|riskScore)\b/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "EVALUATION_PROJECTION_FORBIDDEN_AUTHORITY",
        file,
        "Projection must select and redact without evaluation, inference, Policy, Finding, Decision, Trust, Eligibility, or workflow authority",
      );
    }
    if (
      specifiers.some((specifier) =>
        /(?:^|\/)(?:revision|submission)(?:\.js)?$/i.test(specifier),
      ) ||
      /\bOrganizationVerificationRevision\b/.test(input.source)
    ) {
      addViolation(
        violations,
        "EVALUATION_PROJECTION_DIRECT_REVISION_CONSUMPTION",
        file,
        "Evaluation Projection must consume an authentic Evidence Snapshot and cannot construct from Verification Revision directly",
      );
    }
  }

  if (isEvaluationInputDomain) {
    for (const specifier of specifiers) {
      const allowed =
        /^\.\/[A-Za-z0-9]+\.js$/.test(specifier) ||
        specifier === "../evaluation-projection/index.js" ||
        specifier === "../policy/index.js" ||
        specifier === "node:crypto";
      if (
        !allowed ||
        /(?:^|\/)evidence-snapshot(?:\/|$)/i.test(specifier) ||
        /(?:^|\/)(?:db|database|schema|migrations?|storage|repository|routes?|workers?|startup|frontend|client|providers?|services?|sessions?)(?:\/|\.|$)/i.test(
          specifier,
        ) ||
        /(?:^|\/)(?:marketplace|kyb|aml|sanctions|compliance|payments?|orders?|contracts?|notifications?|blockchain|ai|openai|stripe|sentry|decision|trust-status)(?:\/|$)/i.test(
          specifier,
        ) ||
        /^(?:drizzle-orm|pg|@neondatabase\/|openai|stripe|@sentry\/)/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "EVALUATION_INPUT_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
      if (/(?:^|\/)evidence-snapshot(?:\/|$)/i.test(specifier)) {
        addViolation(
          violations,
          "EVALUATION_INPUT_DIRECT_SNAPSHOT_CONSUMPTION",
          file,
          specifier,
        );
      }
    }
    if (
      /\b(?:evaluateOrganizationVerificationPolicy|completeOrganizationVerificationPolicyEvaluation|createOrganizationVerificationFinding|createOrganizationVerificationRuleEvaluationResult|decideOrganizationVerification|deriveOrganizationVerificationTrustStatus|transitionAttemptProcess|createAttemptForRevision|ParticipationEligibility|PolicyEvaluationCompletion|NormalizedEvaluationClassification)\b/.test(
        input.source,
      ) ||
      /\b(?:documentValid|documentExpired|supportedJurisdiction|riskScore|riskClassification|complianceStatus|requiredEvidence|sufficientEvidence|uiSelectedPolicy)\b/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "EVALUATION_INPUT_FORBIDDEN_AUTHORITY",
        file,
        "Evaluation Input must define an execution contract without Policy execution, inference, Finding, Decision, Trust, Eligibility, or workflow authority",
      );
    }
  }

  if (
    /\bcreateOrganizationVerificationPolicyEvaluationInputInternal\b/.test(
      input.source,
    ) &&
    !lowerFile.endsWith(
      "/domain/evaluation-input/policyevaluationinput.ts",
    ) &&
    !lowerFile.endsWith(
      "/domain/evaluation-input/policyevaluationinputbuilder.ts",
    )
  ) {
    addViolation(
      violations,
      "UNAUTHORIZED_EVALUATION_INPUT_CONSTRUCTION",
      file,
      "Only the Evaluation Input Builder may invoke the private constructor",
    );
  }

  if (
    /\breadOrganizationVerificationPolicyEvaluationInputInternal\b/.test(
      input.source,
    ) &&
    !lowerFile.endsWith(
      "/domain/evaluation-input/policyevaluationinput.ts",
    ) &&
    !lowerFile.endsWith(
      "/domain/evaluation-input/policyevaluationinputbuilder.ts",
    )
  ) {
    addViolation(
      violations,
      "UNAUTHORIZED_EVALUATION_INPUT_AUTHENTICITY_READ",
      file,
      "Evaluation Input authenticity reader is private to the model and Builder",
    );
  }

  if (
    (isOrganizationRegistry ||
      (isOrganizationVerificationCoreDomain && !isDomainPublicIndex) ||
      isEvidenceSnapshotDomain ||
      isEvaluationProjectionDomain ||
      isDecisionDomain ||
      isTrustStatusDomain ||
      isPolicyDomain) &&
    specifiers.some((specifier) =>
      /(?:^|\/)evaluation-input(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "FROZEN_DOMAIN_IMPORTS_EVALUATION_INPUT",
      file,
      "Architecture-frozen predecessor domains must not depend on Evaluation Input",
    );
  }

  if (
    !isEvaluationInputDomain &&
    !isPolicyRuntimeContractDomain &&
    !isPolicyRuntimeDomain &&
    !isWorkflowContract &&
    !isWorkflowRuntime &&
    !isPersistenceContract &&
    !isDomainPublicIndex &&
    !lowerFile.endsWith("/organization-verification/index.ts") &&
    specifiers.some((specifier) =>
      /(?:^|\/)evaluation-input(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "EVALUATION_INPUT_RUNTIME_WIRING",
      file,
      "Evaluation Input Builder must remain inert outside its curated public surface",
    );
  }

  if (
    /\bcreateOrganizationVerificationEvaluationProjectionInternal\b/.test(
      input.source,
    ) &&
    !lowerFile.endsWith(
      "/domain/evaluation-projection/evaluationprojection.ts",
    ) &&
    !lowerFile.endsWith(
      "/domain/evaluation-projection/evaluationprojectionbuilder.ts",
    )
  ) {
    addViolation(
      violations,
      "UNAUTHORIZED_EVALUATION_PROJECTION_CONSTRUCTION",
      file,
      "Only the Evaluation Projection Builder may invoke the private constructor",
    );
  }

  if (
    (isOrganizationRegistry ||
      isEvidenceSnapshotDomain ||
      isDecisionDomain ||
      isTrustStatusDomain ||
      isPolicyDomain ||
      (isOrganizationVerificationCoreDomain && !isDomainPublicIndex)) &&
    specifiers.some((specifier) =>
      /(?:^|\/)evaluation-projection(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "FROZEN_DOMAIN_IMPORTS_EVALUATION_PROJECTION",
      file,
      "Architecture-frozen predecessor domains must not depend on Evaluation Projection",
    );
  }

  if (
    !isEvaluationProjectionDomain &&
    !isEvaluationInputDomain &&
    !isWorkflowContract &&
    !isWorkflowRuntime &&
    !isPersistenceContract &&
    !isDomainPublicIndex &&
    !lowerFile.endsWith("/organization-verification/index.ts") &&
    specifiers.some((specifier) =>
      /(?:^|\/)evaluation-projection(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "EVALUATION_PROJECTION_RUNTIME_WIRING",
      file,
      "Evaluation Projection Builder must remain inert outside its curated public surface",
    );
  }

  if (
    /\bcreateOrganizationVerificationEvidenceSnapshotInternal\b/.test(
      input.source,
    ) &&
    !lowerFile.endsWith("/domain/evidence-snapshot/evidencesnapshot.ts") &&
    !lowerFile.endsWith("/domain/evidence-snapshot/evidencesnapshotbuilder.ts")
  ) {
    addViolation(
      violations,
      "UNAUTHORIZED_SNAPSHOT_CONSTRUCTION",
      file,
      "Only the Evidence Snapshot Builder may invoke the private constructor",
    );
  }

  if (
    (isDecisionDomain ||
      isTrustStatusDomain ||
      isPolicyDomain ||
      (isOrganizationVerificationCoreDomain && !isDomainPublicIndex) ||
      isOrganizationRegistry) &&
    specifiers.some((specifier) =>
      /(?:^|\/)evidence-snapshot(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "FROZEN_DOMAIN_IMPORTS_SNAPSHOT",
      file,
      "Architecture-frozen predecessor domains must not depend on Evidence Snapshot",
    );
  }

  if (
    !isEvidenceSnapshotDomain &&
    !isEvaluationProjectionDomain &&
    !isWorkflowContract &&
    !isWorkflowRuntime &&
    !isPersistenceContract &&
    !isDomainPublicIndex &&
    !lowerFile.endsWith("/organization-verification/index.ts") &&
    specifiers.some((specifier) =>
      /(?:^|\/)evidence-snapshot(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "SNAPSHOT_DOMAIN_RUNTIME_WIRING",
      file,
      "Evidence Snapshot Builder must remain inert outside its curated public surface",
    );
  }

  if (isDecisionDomain) {
    if (
      specifiers.some((specifier) =>
        /(?:^|\/)(?:evidence-snapshot|evaluation-projection|evaluation-input)(?:\/|$)/i.test(
          specifier,
        ),
      )
    ) {
      addViolation(
        violations,
        "DECISION_PREPARATION_BYPASS",
        file,
        "Decision Domain cannot consume preparation-layer construction internals or raw preparation inputs",
      );
    }
    for (const specifier of specifiers) {
      if (
        !/^\.\/[A-Za-z0-9]+\.js$/.test(specifier) &&
        !/^\.\.\/(?:attempt|ids|record|revision)\.js$/.test(specifier) &&
        specifier !== "../../../organization-registry/index.js"
      ) {
        addViolation(
          violations,
          "DECISION_DOMAIN_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
      if (
        /(?:^|\/)(?:db|database|storage|repository|routes?|workers?|providers?|services?)(?:\/|\.|$)/i.test(
          specifier,
        ) ||
        /(?:^|\/)(?:verification|marketplace|kyb|compliance|payments?|orders?|contracts?|notifications?|blockchain|ai)(?:\/|$)/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "DECISION_DOMAIN_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }

    if (
      /(?:^|\/)(?:trust-status|finding|policy|reason-code|rule)(?:\/|\.|$)/i.test(
        lowerFile,
      ) ||
      /["'](?:unestablished|trusted|not_trusted|expired|invalidated)["']/.test(
        input.source,
      ) ||
      /\b(?:TrustStatus|TrustStatusDeriver|VerificationFinding|ReasonCode|RuleId|Severity|Disposition|PolicyRegistry)\b/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "DECISION_DOMAIN_LATER_SLICE_ARTIFACT",
        file,
        "Trust, finding, rule, reason-code, severity, or policy authority belongs to a later slice",
      );
    }

    if (
      lowerFile.endsWith("/decisionengine.ts") &&
      /\btransitionAttemptProcess\b/.test(input.source)
    ) {
      addViolation(
        violations,
        "DECISION_ENGINE_LIFECYCLE_AUTHORITY",
        file,
        "Decision Engine must not own attempt or lifecycle transitions",
      );
    }

  }

  if (isPolicyDomain) {
    if (
      specifiers.some((specifier) =>
        /(?:^|\/)(?:evidence-snapshot|evaluation-projection)(?:\/|$)/i.test(
          specifier,
        ),
      )
    ) {
      addViolation(
        violations,
        "POLICY_PREPARATION_BYPASS",
        file,
        "Policy execution cannot consume Snapshot or Projection as a substitute for authenticated Evaluation Input",
      );
    }
    for (const specifier of specifiers) {
      const isLocalPolicyModule = /^\.\/[A-Za-z0-9]+\.js$/.test(specifier);
      const isApprovedCoreIdentity = specifier === "../index.js";
      const isApprovedRegistrySurface =
        specifier === "../../../organization-registry/index.js";
      const isApprovedNormalizedBoundary =
        lowerFile.endsWith("/normalizedevaluationadapter.ts") &&
        specifier === "../decision/index.js";
      if (
        !isLocalPolicyModule &&
        !isApprovedCoreIdentity &&
        !isApprovedRegistrySurface &&
        !isApprovedNormalizedBoundary
      ) {
        addViolation(
          violations,
          "POLICY_DOMAIN_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
      if (
        /(?:^|\/)(?:db|database|schema|storage|repository|routes?|workers?|startup|frontend|client|providers?|services?|sessions?)(?:\/|\.|$)/i.test(
          specifier,
        ) ||
        /(?:^|\/)(?:verification|marketplace|kyb|aml|sanctions|compliance|payments?|orders?|contracts?|notifications?|blockchain|ai|openai|stripe|sentry)(?:\/|$)/i.test(
          specifier,
        ) ||
        /^(?:drizzle-orm|pg|@neondatabase\/|openai|stripe|@sentry\/)/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "POLICY_DOMAIN_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }

    if (
      /\b(?:decideOrganizationVerification|createDecisionInternal|OrganizationVerificationDecision|deriveOrganizationVerificationTrustStatus|createTrustStatusInternal|transitionAttemptProcess)\b/.test(
        input.source,
      ) ||
      /["'](?:approved|rejected|trusted|not_trusted|expired|invalidated|allowed_to_trade|allowed_to_publish|marketplace_access)["']/.test(
        input.source,
      ) ||
      /\b(?:ParticipationEligibility|RegistryLifecycle|ReviewerSelectedStatus)\b/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "POLICY_DOMAIN_FORBIDDEN_AUTHORITY",
        file,
        "Policy Framework attempted to own Decision, Trust, lifecycle, workflow, or eligibility authority",
      );
    }
  }

  if (isPolicyRuntimeContractDomain) {
    for (const specifier of specifiers) {
      const isLocalContractModule =
        /^\.\/[A-Za-z0-9-]+\.js$/.test(specifier);
      const isApprovedPolicySurface = specifier === "../policy/index.js";
      const isApprovedEvaluationInputSurface =
        specifier === "../evaluation-input/index.js";
      const isApprovedHashingPrimitive = specifier === "node:crypto";
      if (
        !isLocalContractModule &&
        !isApprovedPolicySurface &&
        !isApprovedEvaluationInputSurface &&
        !isApprovedHashingPrimitive
      ) {
        addViolation(
          violations,
          "POLICY_RUNTIME_CONTRACT_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
      if (
        /(?:^|\/)(?:evidence-snapshot|evaluation-projection|decision|trust-status|db|database|schema|storage|repository|routes?|workers?|startup|providers?|services?|sessions?)(?:\/|\.|$)/i.test(
          specifier,
        ) ||
        /(?:^|\/)(?:verification|marketplace|kyb|aml|sanctions|compliance|payments?|orders?|contracts?|notifications?|blockchain|ai|openai|stripe|sentry)(?:\/|$)/i.test(
          specifier,
        ) ||
        /^(?:drizzle-orm|pg|@neondatabase\/|openai|stripe|@sentry\/)/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "POLICY_RUNTIME_CONTRACT_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }

    if (
      /\b(?:decideOrganizationVerification|deriveOrganizationVerificationTrustStatus|transitionAttemptProcess|createOrganizationVerificationFinding|createOrganizationVerificationRuleEvaluationResult|completeOrganizationVerificationPolicyEvaluation|createOrganizationVerificationPolicyEvaluationCompletionInternal)\b/.test(
        input.source,
      ) ||
      /\bprocess\.env\b|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\brandomUUID\s*\(|\bnanoid\s*\(|\bas\s+unknown\s+as\b/.test(
        input.source,
      ) ||
      /["'](?:approved|rejected|trusted|not_trusted|allowed_to_trade|allowed_to_publish|marketplace_access)["']/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "POLICY_RUNTIME_CONTRACT_FORBIDDEN_AUTHORITY",
        file,
        "Executable Rule contract attempted to own findings, results, completion, Decision, Trust, lifecycle, workflow, or downstream authority",
      );
    }

    if (
      (!lowerFile.endsWith(
        "/domain/policy-runtime-contract/ruleimplementation.ts",
      ) &&
        /\bcreateOrganizationVerificationRuleImplementation\s*\(/.test(
          input.source,
        )) ||
      /\.evaluate\s*\(/.test(input.source)
    ) {
      addViolation(
        violations,
        "POLICY_RUNTIME_EXECUTION_STARTED",
        file,
        "Phase 7B-6A.0 defines contracts only; production Rule construction or execution is not authorized",
      );
    }
  }

  if (isPolicyRuntimeDomain) {
    for (const specifier of specifiers) {
      const isLocalRuntimeModule =
        /^\.\/[A-Za-z0-9-]+\.js$/.test(specifier);
      const isApprovedEvaluationInputSurface =
        specifier === "../evaluation-input/index.js";
      const isApprovedPolicySurface = specifier === "../policy/index.js";
      const isApprovedExecutionContractSurface =
        specifier === "../policy-runtime-contract/index.js";
      const isApprovedCoreSurface = specifier === "../index.js";
      const isApprovedHashingPrimitive = specifier === "node:crypto";
      if (
        !isLocalRuntimeModule &&
        !isApprovedEvaluationInputSurface &&
        !isApprovedPolicySurface &&
        !isApprovedExecutionContractSurface &&
        !isApprovedCoreSurface &&
        !isApprovedHashingPrimitive
      ) {
        addViolation(
          violations,
          "POLICY_RUNTIME_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
      if (
        /(?:^|\/)(?:evidence-snapshot|evaluation-projection|decision|trust-status|organization-registry|eligibility|db|database|schema|storage|repository|routes?|controllers?|workers?|queues?|schedulers?|startup|providers?|services?|sessions?)(?:\/|\.|$)/i.test(
          specifier,
        ) ||
        /(?:^|\/)(?:verification|marketplace|kyb|aml|sanctions|compliance|payments?|orders?|contracts?|notifications?|blockchain|ai|openai|stripe|sentry)(?:\/|$)/i.test(
          specifier,
        ) ||
        /^(?:drizzle-orm|pg|@neondatabase\/|openai|stripe|@sentry\/)/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "POLICY_RUNTIME_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }

    if (
      /\b(?:decideOrganizationVerification|deriveOrganizationVerificationTrustStatus|transitionAttemptProcess|ParticipationEligibility|PolicyRegistry|RuleProvider|RuleLoader)\b/.test(
        input.source,
      ) ||
      /\bprocess\.env\b|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\brandomUUID\s*\(|\bnanoid\s*\(|\bas\s+unknown\s+as\b/.test(
        input.source,
      ) ||
      /["'](?:approved|rejected|trusted|not_trusted|allowed_to_trade|allowed_to_publish|marketplace_access)["']/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "POLICY_RUNTIME_FORBIDDEN_AUTHORITY",
        file,
        "Policy Runtime attempted to own Decision, Trust, Eligibility, Workflow, dynamic discovery, environment, hidden clock, hidden ID, or unsafe opaque conversion authority",
      );
    }

    const isExecutor = lowerFile.endsWith(
      "/domain/policy-runtime/policyevaluationexecutor.ts",
    );
    if (
      !isExecutor &&
      (/\bcreateOrganizationVerificationFinding\s*\(/.test(input.source) ||
        /\bcreateOrganizationVerificationRuleEvaluationResult\s*\(/.test(
          input.source,
        ) ||
        /\bcompleteOrganizationVerificationPolicyEvaluation\s*\(/.test(
          input.source,
        ) ||
        /\.evaluate\s*\(/.test(input.source))
    ) {
      addViolation(
        violations,
        "POLICY_RUNTIME_FORBIDDEN_AUTHORITY",
        file,
        "Only the Policy Evaluation Executor may invoke Rules or frozen Finding, Result, and Completion authority",
      );
    }

    if (
      /\bcreateOrganizationVerificationRuleImplementation\s*\(/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "POLICY_RUNTIME_FORBIDDEN_AUTHORITY",
        file,
        "Policy Runtime must not define production business Rule implementations",
      );
    }
  }

  if (isDecisionTrustIntegrationContractDomain) {
    for (const specifier of specifiers) {
      const allowed =
        /^\.\/[A-Za-z0-9-]+\.js$/.test(specifier) ||
        specifier === "../policy-runtime/index.js" ||
        specifier === "../decision/index.js" ||
        specifier === "../trust-status/index.js" ||
        specifier === "node:crypto";
      if (
        !allowed ||
        /(?:^|\/)(?:evaluation-input|evidence-snapshot|evaluation-projection|policy-runtime-contract|db|database|schema|migrations?|storage|repository|routes?|controllers?|workers?|queues?|schedulers?|startup|frontend|client|providers?|services?|sessions?)(?:\/|\.|$)/i.test(
          specifier,
        ) ||
        /(?:^|\/)(?:marketplace|kyb|aml|sanctions|compliance|payments?|orders?|contracts?|notifications?|blockchain|ai|openai|stripe|sentry|eligibility|workflow)(?:\/|$)/i.test(
          specifier,
        ) ||
        /^(?:drizzle-orm|pg|@neondatabase\/|openai|stripe|@sentry\/)/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "DECISION_TRUST_BINDING_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }

    if (
      /\b(?:decideOrganizationVerification|deriveOrganizationVerificationTrustStatus|createDecisionInternal|createTrustStatusInternal|transitionAttemptProcess|ParticipationEligibility|PublicationEligibility|MarketplaceAccess|TransactionAuthorization)\b/.test(
        input.source,
      ) ||
      /\.(?:findings|ruleResults|ruleExecutions)\b/.test(input.source) ||
      /\bprocess\.env\b|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\brandomUUID\s*\(|\bnanoid\s*\(|\bas\s+unknown\s+as\b/.test(
        input.source,
      ) ||
      /["'](?:allowed_to_trade|allowed_to_publish|marketplace_access|seller_access|buyer_access)["']/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "DECISION_TRUST_BINDING_FORBIDDEN_AUTHORITY",
        file,
        "Decision–Trust binding contract attempted execution, downstream authority, direct Finding/Result consumption, hidden input, or unsafe conversion",
      );
    }
  }

  if (isDecisionTrustIntegrationDomain) {
    const isExecutor = lowerFile.endsWith(
      "/domain/decision-trust-integration/executedecisiontrustintegration.ts",
    );
    const isTrustDerivationBoundary = lowerFile.endsWith(
      "/domain/decision-trust-integration/trustderivation.ts",
    );

    for (const specifier of specifiers) {
      const allowed =
        /^\.\/[A-Za-z0-9-]+\.js$/.test(specifier) ||
        specifier === "../policy-runtime/index.js" ||
        specifier === "../policy/index.js" ||
        specifier === "../decision/index.js" ||
        specifier === "../trust-status/index.js" ||
        specifier === "../decision-trust-integration-contract/index.js" ||
        specifier === "node:crypto";
      if (
        !allowed ||
        /(?:^|\/)(?:evaluation-input|evidence-snapshot|evaluation-projection|policy-runtime-contract|db|database|schema|migrations?|storage|repository|routes?|controllers?|workers?|queues?|schedulers?|startup|frontend|client|providers?|services?|sessions?)(?:\/|\.|$)/i.test(
          specifier,
        ) ||
        /(?:^|\/)(?:marketplace|kyb|aml|sanctions|compliance|payments?|orders?|contracts?|notifications?|blockchain|ai|openai|stripe|sentry|eligibility|workflow)(?:\/|$)/i.test(
          specifier,
        ) ||
        /^(?:drizzle-orm|pg|@neondatabase\/|openai|stripe|@sentry\/)/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "DECISION_TRUST_INTEGRATION_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }

    if (
      /\.(?:findings|ruleResults|ruleExecutions)\b/.test(input.source) ||
      /\bprocess\.env\b|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\brandomUUID\s*\(|\bnanoid\s*\(|\bMath\.random\s*\(|\bas\s+unknown\s+as\b/.test(
        input.source,
      ) ||
      /\b(?:transitionAttemptProcess|ParticipationEligibility|PublicationEligibility|MarketplaceAccess|TransactionAuthorization)\b/.test(
        input.source,
      ) ||
      /["'](?:allowed_to_trade|allowed_to_publish|marketplace_access|seller_access|buyer_access)["']/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "DECISION_TRUST_INTEGRATION_FORBIDDEN_AUTHORITY",
        file,
        "Decision–Trust integration attempted direct Rule output consumption, downstream authority, hidden input, or unsafe opaque conversion",
      );
    }

    if (
      !isExecutor &&
      /\b(?:adaptPolicyEvaluationCompletionToNormalizedEvaluation|decideOrganizationVerification|createOrganizationVerificationDecisionTrustIntegrationInputBinding|createOrganizationVerificationDecisionTrustIntegrationBinding)\s*\(/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "DECISION_TRUST_INTEGRATION_FORBIDDEN_AUTHORITY",
        file,
        "Only the pure Decision–Trust integration executor may sequence the frozen adapter, Decision authority, Trust boundary, and binding authorities",
      );
    }

    if (
      !isExecutor &&
      !isTrustDerivationBoundary &&
      /\bderiveTrustStatusFromAuthenticDecision\s*\(/.test(input.source)
    ) {
      addViolation(
        violations,
        "DECISION_TRUST_INTEGRATION_FORBIDDEN_AUTHORITY",
        file,
        "Only the pure Decision–Trust integration executor may consume the isolated Decision-to-Trust derivation boundary",
      );
    }

    if (
      !isTrustDerivationBoundary &&
      /\b(?:createOrganizationVerificationTrustStatusSourceFacts|deriveOrganizationVerificationTrustStatus)\s*\(/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "DECISION_TRUST_INTEGRATION_TRUST_BOUNDARY",
        file,
        "Trust source-fact construction and Trust derivation are isolated to the dedicated Decision-to-Trust boundary",
      );
    }

    if (isTrustDerivationBoundary) {
      for (const specifier of specifiers) {
        if (
          specifier !== "../decision/index.js" &&
          specifier !== "../trust-status/index.js"
        ) {
          addViolation(
            violations,
            "DECISION_TRUST_INTEGRATION_TRUST_BOUNDARY",
            file,
            `Trust derivation boundary imported ${specifier}`,
          );
        }
      }
      if (
        /\b(?:Policy|Completion|Finding|RuleResult|PolicyEvaluationExecution)\b/.test(
          input.source,
        )
      ) {
        addViolation(
          violations,
          "DECISION_TRUST_INTEGRATION_TRUST_BOUNDARY",
          file,
          "Trust derivation boundary must consume only an authentic Decision and explicit Trust source facts",
        );
      }
    }

    if (
      /\b(?:createDecisionInternal|createTrustStatusInternal)\b/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "DECISION_TRUST_INTEGRATION_FORBIDDEN_AUTHORITY",
        file,
        "Decision–Trust integration cannot access private Decision or Trust construction authority",
      );
    }
  }

  if (isAttemptLifecycleContract) {
    for (const specifier of specifiers) {
      const allowed =
        /^\.\/[A-Za-z0-9-]+\.js$/.test(specifier) ||
        specifier === "node:crypto" ||
        specifier === "../../../organization-registry/index.js" ||
        /^\.\.\/\.\.\/domain\/(?:attempt|ids|process|record|revision|submission)\.js$/.test(
          specifier,
        );
      if (
        !allowed ||
        /(?:^|\/)(?:snapshot|evaluation|policy|decision|trust|eligibility|workflow|marketplace|db|database|schema|migrations?|storage|repository|routes?|controllers?|workers?|queues?|providers?|services?|startup|frontend|client)(?:\/|\.|$)/i.test(
          specifier,
        ) ||
        /^(?:drizzle-orm|pg|@neondatabase\/|openai|stripe|@sentry\/)/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "ATTEMPT_LIFECYCLE_CONTRACT_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }
    if (
      /\b(?:transitionAttemptProcess|createAttemptForRevision|createOrganizationVerificationRecord|submitDraftToRevision|decideOrganizationVerification|deriveOrganizationVerificationTrustStatus)\s*\(/.test(
        input.source,
      ) ||
      /\bprocess\.env\b|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\brandomUUID\s*\(|\bnanoid\s*\(|\bMath\.random\s*\(|\bas\s+unknown\s+as\b/.test(
        input.source,
      ) ||
      /\b(?:ParticipationEligibility|PublicationEligibility|WorkflowCoordinator|AttemptRepository)\b/.test(
        input.source,
      ) ||
      /["'](?:failed|cancelled|retrying|expired|timed_out|restarted|lease_expired)["']/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "ATTEMPT_LIFECYCLE_CONTRACT_FORBIDDEN_AUTHORITY",
        file,
        "Attempt Lifecycle contract attempted Domain transition, construction, downstream authority, hidden input, or excluded lifecycle semantics",
      );
    }
  }

  if (isAttemptLifecycleRuntime) {
    const isExecutor = lowerFile.endsWith(
      "/application/attempt-lifecycle-runtime/executeattempttransition.ts",
    );
    for (const specifier of specifiers) {
      const allowed =
        /^\.\/[A-Za-z0-9-]+\.js$/.test(specifier) ||
        specifier === "node:crypto" ||
        specifier === "../../domain/attempt.js" ||
        specifier === "../../domain/ids.js" ||
        specifier === "../../domain/errors.js" ||
        specifier === "../attempt-lifecycle-contract/index.js";
      if (
        !allowed ||
        /(?:^|\/)(?:snapshot|projection|evaluation|policy|decision|trust|eligibility|workflow|marketplace|db|database|schema|migrations?|storage|repository|routes?|controllers?|workers?|queues?|providers?|services?|startup|frontend|client)(?:\/|\.|$)/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "ATTEMPT_LIFECYCLE_RUNTIME_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }
    if (
      (!isExecutor && /\btransitionAttemptProcess\s*\(/.test(input.source)) ||
      /\b(?:createAttemptForRevision|createOrganizationVerificationRecord|submitDraftToRevision)\s*\(/.test(
        input.source,
      ) ||
      /\bprocess\.env\b|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\brandomUUID\s*\(|\bnanoid\s*\(|\bMath\.random\s*\(|\bas\s+unknown\s+as\b/.test(
        input.source,
      ) ||
      /\b(?:ParticipationEligibility|WorkflowCoordinator|AttemptRepository)\b/.test(
        input.source,
      ) ||
      /["'](?:failed|cancelled|retrying|expired|timed_out|restarted|lease_expired)["']/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "ATTEMPT_LIFECYCLE_RUNTIME_FORBIDDEN_AUTHORITY",
        file,
        "Attempt Lifecycle runtime attempted authority outside its sole executor, hidden input, construction, or excluded semantics",
      );
    }
  }

  if (
    isOrganizationVerification &&
    !isAttemptLifecycleRuntime &&
    !isWorkflowContract &&
    !isWorkflowRuntime &&
    !isPersistenceContract &&
    specifiers.some((specifier) =>
      /(?:^|\/)attempt-lifecycle-runtime(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "ATTEMPT_LIFECYCLE_RUNTIME_EXTERNAL_WIRING",
      file,
      "Pure Attempt Lifecycle runtime must remain unwired before Phase 8B",
    );
  }

  if (
    isOrganizationVerification &&
    !isAttemptLifecycleContract &&
    !isAttemptLifecycleRuntime &&
    !isWorkflowContract &&
    !isWorkflowRuntime &&
    !isPersistenceContract &&
    !isReplayRuntime &&
    !lowerFile.endsWith("/organization-verification/index.ts") &&
    specifiers.some((specifier) =>
      /(?:^|\/)attempt-lifecycle-contract(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "ATTEMPT_LIFECYCLE_CONTRACT_EXTERNAL_WIRING",
      file,
      "Pure Attempt Lifecycle execution contracts must remain unwired",
    );
  }

  if (isWorkflowContract) {
    for (const specifier of specifiers) {
      const allowed =
        /^\.\/[A-Za-z0-9-]+\.js$/.test(specifier) ||
        specifier === "node:crypto" ||
        specifier === "../attempt-lifecycle-contract/index.js" ||
        specifier === "../attempt-lifecycle-runtime/index.js" ||
        specifier === "../../domain/evidence-snapshot/index.js" ||
        specifier === "../../domain/evaluation-projection/index.js" ||
        specifier === "../../domain/evaluation-input/index.js" ||
        specifier === "../../domain/policy-runtime/index.js" ||
        specifier ===
          "../../domain/decision-trust-integration/index.js";
      if (
        !allowed ||
        /(?:^|\/)(?:db|database|schema|migrations?|storage|repositories?|routes?|controllers?|frontend|client|providers?|services?|startup|workers?|queues?|notifications?|permissions?|eligibility)(?:\/|\.|$)/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "WORKFLOW_CONTRACT_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }
    if (
      /\b(?:transitionAttemptProcess|executeOrganizationVerificationAttemptTransition|buildOrganizationVerificationEvidenceSnapshot|buildOrganizationVerificationEvaluationProjection|buildOrganizationVerificationPolicyEvaluationInput|executeOrganizationVerificationPolicyEvaluation|decideOrganizationVerification|deriveOrganizationVerificationTrustStatus|executeOrganizationVerificationDecisionTrustIntegration)\s*\(/.test(
        input.source,
      ) ||
      /\b(?:createOrganizationVerificationEvidenceSnapshotInternal|createOrganizationVerificationEvaluationProjectionInternal|createOrganizationVerificationPolicyEvaluationInputInternal|createOrganizationVerificationPolicyEvaluationExecutionInternal|createDecisionInternal|createTrustStatusInternal|createOrganizationVerificationDecisionTrustIntegrationExecutionInternal)\s*\(/.test(
        input.source,
      ) ||
      /\bprocess\.env\b|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\brandomUUID\s*\(|\bnanoid\s*\(|\bMath\.random\s*\(|\bas\s+unknown\s+as\b|\bas\s+never\b/.test(
        input.source,
      ) ||
      /\b(?:WorkflowCoordinator|UnitOfWork|AttemptRepository|ParticipationEligibility)\b/.test(
        input.source,
      ) ||
      /["'](?:failed|cancelled|retrying|suspended|timed_out|approved|rejected|eligible|verified)["']/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "WORKFLOW_CONTRACT_FORBIDDEN_AUTHORITY",
        file,
        "Workflow contract attempted authority execution, hidden input, construction, or excluded semantics",
      );
    }
  }

  if (
    isOrganizationVerification &&
    !isWorkflowContract &&
    !isWorkflowRuntime &&
    !isPersistenceContract &&
    !isReplayRuntime &&
    specifiers.some((specifier) =>
      /(?:^|\/)workflow-contract(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "WORKFLOW_CONTRACT_EXTERNAL_WIRING",
      file,
      "Pure Workflow evidence contracts must remain unwired before Phase 8B.1",
    );
  }

  if (isWorkflowRuntime) {
    for (const specifier of specifiers) {
      const allowed =
        /^\.\/[A-Za-z0-9-]+\.js$/.test(specifier) ||
        specifier === "node:crypto" ||
        specifier === "../attempt-lifecycle-runtime/index.js" ||
        specifier === "../workflow-contract/index.js" ||
        specifier === "../../domain/evidence-snapshot/index.js" ||
        specifier === "../../domain/evaluation-projection/index.js" ||
        specifier === "../../domain/evaluation-input/index.js" ||
        specifier === "../../domain/policy-runtime/index.js" ||
        specifier ===
          "../../domain/decision-trust-integration/index.js";
      if (
        !allowed ||
        /(?:^|\/)(?:db|database|schema|migrations?|storage|repositories?|routes?|controllers?|frontend|client|providers?|services?|startup|workers?|queues?|notifications?|permissions?|eligibility|unit-of-work|transactions?)(?:\/|\.|$)/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "WORKFLOW_RUNTIME_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }

    const isSoleExecutor = lowerFile.endsWith(
      "/application/workflow-runtime/executeworkflowstep.ts",
    );
    const authorities = [
      "executeOrganizationVerificationAttemptTransition",
      "buildOrganizationVerificationEvidenceSnapshot",
      "buildOrganizationVerificationEvaluationProjection",
      "buildOrganizationVerificationPolicyEvaluationInput",
      "executeOrganizationVerificationPolicyEvaluation",
      "executeOrganizationVerificationDecisionTrustIntegration",
    ];
    for (const authority of authorities) {
      const invocationCount = (
        input.source.match(new RegExp(`\\b${authority}\\s*\\(`, "g")) ?? []
      ).length;
      if (
        (isSoleExecutor && invocationCount !== 1) ||
        (!isSoleExecutor && invocationCount !== 0)
      ) {
        addViolation(
          violations,
          "WORKFLOW_RUNTIME_AUTHORITY_DISPATCH_VIOLATION",
          file,
          `${authority}:${invocationCount}`,
        );
      }
    }

    if (
      /\bprocess\.env\b|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\brandomUUID\s*\(|\bnanoid\s*\(|\bMath\.random\s*\(|\bas\s+unknown\s+as\b|\bas\s+never\b/.test(
        input.source,
      ) ||
      /\b(?:while|for)\s*\(|\bexecuteUntilComplete\b|\bWorkflowEngine\b|\bPipelineRunner\b|\bSaga\b|\bUnitOfWork\b|\bAttemptRepository\b|\bParticipationEligibility\b|\bPublicationEligibility\b/.test(
        input.source,
      ) ||
      /\b(?:createOrganizationVerificationEvidenceSnapshotInternal|createOrganizationVerificationEvaluationProjectionInternal|createOrganizationVerificationPolicyEvaluationInputInternal|createOrganizationVerificationPolicyEvaluationExecutionInternal|createDecisionInternal|createTrustStatusInternal|transitionAttemptProcess|decideOrganizationVerification|deriveOrganizationVerificationTrustStatus)\s*\(/.test(
        input.source,
      ) ||
      /["'](?:approved|rejected|verified|unverified|trusted|untrusted|eligible|ineligible|authorized|blocked|retrying|timed_out|cancelled)["']/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "WORKFLOW_RUNTIME_FORBIDDEN_AUTHORITY",
        file,
        "Workflow runtime introduced hidden input, multi-step execution, duplicated authority, or excluded semantics",
      );
    }
  }

  if (
    isWorkflowRuntimePublicIndex &&
    /\b(?:workflowStepExecutionSeal|authenticWorkflowStepExecutions|createWorkflowStepExecutionInternal|authorityResultFingerprint|fingerprintOrganizationVerificationWorkflowRuntime|workflowRuntimeSuccess|workflowRuntimeFailure)\b/.test(
      input.source,
    )
  ) {
    addViolation(
      violations,
      "WORKFLOW_RUNTIME_PUBLIC_EXPORT_LEAK",
      file,
      "Workflow runtime exposes a seal, constructor, fingerprint, or result helper",
    );
  }

  if (
    isOrganizationVerification &&
    !isWorkflowRuntime &&
    !isPersistenceContract &&
    specifiers.some((specifier) =>
      /(?:^|\/)workflow-runtime(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "WORKFLOW_RUNTIME_EXTERNAL_WIRING",
      file,
      "Pure Workflow runtime must remain unwired before persistence or API integration",
    );
  }

  if (isPersistenceContract) {
    for (const specifier of specifiers) {
      const allowed =
        /^\.\/[A-Za-z0-9-]+\.js$/.test(specifier) ||
        specifier === "node:crypto" ||
        specifier === "../attempt-lifecycle-contract/index.js" ||
        specifier === "../workflow-contract/index.js" ||
        specifier === "../../domain/evidence-snapshot/index.js" ||
        specifier === "../../domain/evaluation-projection/index.js" ||
        specifier === "../../domain/evaluation-input/index.js" ||
        specifier === "../../domain/policy-runtime/index.js" ||
        specifier ===
          "../../domain/decision-trust-integration/index.js";
      if (
        !allowed ||
        /(?:^|\/)(?:db|database|schema|migrations?|storage|repositories?|routes?|controllers?|frontend|client|providers?|services?|startup|workers?|queues?|notifications?|permissions?|eligibility|unit-of-work|transactions?|infrastructure)(?:\/|\.|$)/i.test(
          specifier,
        ) ||
        /^(?:node:fs|node:http|node:https|node:net|node:tls|node:dns)$/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "PERSISTENCE_CONTRACT_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }
    if (
      /\b(?:executeOrganizationVerificationWorkflowStep|executeOrganizationVerificationAttemptTransition|buildOrganizationVerificationEvidenceSnapshot|buildOrganizationVerificationEvaluationProjection|buildOrganizationVerificationPolicyEvaluationInput|executeOrganizationVerificationPolicyEvaluation|executeOrganizationVerificationDecisionTrustIntegration|transitionAttemptProcess|decideOrganizationVerification|deriveOrganizationVerificationTrustStatus)\s*\(/.test(
        input.source,
      ) ||
      /\b(?:createOrganizationVerificationEvidenceSnapshotInternal|createOrganizationVerificationEvaluationProjectionInternal|createOrganizationVerificationPolicyEvaluationInputInternal|createOrganizationVerificationPolicyEvaluationExecutionInternal|createDecisionInternal|createTrustStatusInternal|createOrganizationVerificationDecisionTrustIntegrationExecutionInternal)\s*\(/.test(
        input.source,
      ) ||
      /\bprocess\.env\b|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\brandomUUID\s*\(|\bnanoid\s*\(|\bMath\.random\s*\(|\bas\s+unknown\s+as\b|\bas\s+never\b/.test(
        input.source,
      ) ||
      /\b(?:ReplayEngine|WorkflowEngine|WorkflowCoordinator|UnitOfWork|ParticipationEligibility|PublicationEligibility)\b/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "PERSISTENCE_CONTRACT_FORBIDDEN_AUTHORITY",
        file,
        "Persistence contracts attempted execution, replay, hidden input, or downstream authority",
      );
    }
    if (
      /\b(?:drizzle|sequelize|typeorm|prisma|knex|postgres|pgPool|sql\s*`|fetch\s*\(|readFile|writeFile|createConnection)\b/i.test(
        input.source,
      ) ||
      /\bclass\s+\w*(?:Repository|Adapter|Store)\b/.test(input.source) ||
      /\bnew\s+(?:Map|WeakMap|WeakSet)\s*</.test(input.source)
    ) {
      addViolation(
        violations,
        "PERSISTENCE_CONTRACT_IMPLEMENTATION",
        file,
        "Persistence boundary contains technology, storage, or repository implementation",
      );
    }
  }

  if (
    isPersistenceContractPublicIndex &&
    /\b(?:storedEvidenceSeal|appendBatchSeal|appendReceiptSeal|evidenceStreamSeal|streamIdentitySeal|authenticStoredEvidence|authenticAppendBatches|authenticAppendReceipts|authenticEvidenceStreams|authenticStreamIdentities|fingerprintPersistenceContract|expectedStoredEvidenceFingerprint|persistenceSuccess|persistenceFailure)\b/.test(
      input.source,
    )
  ) {
    addViolation(
      violations,
      "PERSISTENCE_CONTRACT_PUBLIC_EXPORT_LEAK",
      file,
      "Persistence contract exposes a seal, authenticity registry, canonical fingerprint helper, or result constructor",
    );
  }

  if (
    isOrganizationVerification &&
    !isPersistenceContract &&
    !isInMemoryPersistenceAdapter &&
    !isReplayRuntime &&
    !lowerFile.endsWith("/organization-verification/index.ts") &&
    specifiers.some((specifier) =>
      /(?:^|\/)persistence-contract(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "PERSISTENCE_CONTRACT_EXTERNAL_WIRING",
      file,
      "Pure persistence ports remain unwired until an explicitly authorized application integration phase",
    );
  }

  if (isInMemoryPersistenceAdapter) {
    for (const specifier of specifiers) {
      const allowed =
        /^\.\/[A-Za-z0-9-]+\.js$/.test(specifier) ||
        specifier ===
          "../../../application/persistence-contract/index.js";
      if (
        !allowed ||
        /(?:^|\/)(?:db|database|schema|migrations?|routes?|controllers?|frontend|client|providers?|services?|startup|workers?|queues?|notifications?|permissions?|eligibility|unit-of-work|transactions?)(?:\/|\.|$)/i.test(
          specifier,
        ) ||
        /^(?:node:fs|node:http|node:https|node:net|node:tls|node:dns)$/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "PERSISTENCE_IN_MEMORY_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }
    if (
      /\b(?:drizzle|sequelize|typeorm|prisma|knex|postgres|pgPool|sql\s*`|fetch\s*\(|readFile|writeFile|createConnection)\b/i.test(
        input.source,
      ) ||
      /\bprocess\.env\b|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\brandomUUID\s*\(|\bnanoid\s*\(|\bMath\.random\s*\(|\bas\s+unknown\s+as\b|\bas\s+never\b/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "PERSISTENCE_IN_MEMORY_FORBIDDEN_DEPENDENCY",
        file,
        "In-memory adapter introduced technology, environment, hidden time, randomness, or unsafe conversion",
      );
    }
    if (
      /\b(?:executeOrganizationVerificationWorkflowStep|executeOrganizationVerificationAttemptTransition|buildOrganizationVerificationEvidenceSnapshot|buildOrganizationVerificationEvaluationProjection|buildOrganizationVerificationPolicyEvaluationInput|executeOrganizationVerificationPolicyEvaluation|executeOrganizationVerificationDecisionTrustIntegration|transitionAttemptProcess|decideOrganizationVerification|deriveOrganizationVerificationTrustStatus)\s*\(/.test(
        input.source,
      ) ||
      /\b(?:ReplayEngine|WorkflowEngine|WorkflowCoordinator|UnitOfWork|ParticipationEligibility|PublicationEligibility|RetryPolicy|LockManager|TransactionManager)\b/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "PERSISTENCE_IN_MEMORY_FORBIDDEN_AUTHORITY",
        file,
        "In-memory adapter introduced business execution, replay, coordination, retries, locking, or downstream authority",
      );
    }
  }

  if (
    lowerFile.endsWith(
      "/infrastructure/persistence/in-memory/index.ts",
    ) &&
    /\b(?:Map|streams|committedAppends|canonicalStreamKey|InMemoryPersistenceInvariantError|delete|reset|seed|set|store)\b/.test(
      input.source,
    )
  ) {
    addViolation(
      violations,
      "PERSISTENCE_IN_MEMORY_PUBLIC_EXPORT_LEAK",
      file,
      "In-memory adapter public surface exposes internal storage, mutation, or implementation details",
    );
  }

  if (
    isOrganizationVerification &&
    !isInMemoryPersistenceAdapter &&
    specifiers.some((specifier) =>
      /(?:^|\/)infrastructure\/persistence\/in-memory(?:\/|$)/i.test(
        specifier,
      ),
    )
  ) {
    addViolation(
      violations,
      "PERSISTENCE_IN_MEMORY_EXTERNAL_WIRING",
      file,
      "Reference persistence adapter must remain unwired from Domain, Workflow, runtime, API, and startup",
    );
  }

  if (isReplayRuntime) {
    for (const specifier of specifiers) {
      const allowed =
        /^\.\/[A-Za-z0-9-]+\.js$/.test(specifier) ||
        specifier === "node:crypto" ||
        specifier === "../attempt-lifecycle-contract/index.js" ||
        specifier === "../workflow-contract/index.js" ||
        specifier === "../persistence-contract/index.js";
      if (
        !allowed ||
        /(?:^|\/)(?:db|database|schema|migrations?|repositories?|routes?|controllers?|frontend|client|providers?|services?|startup|workers?|queues?|notifications?|permissions?|eligibility|unit-of-work|transactions?|infrastructure|workflow-runtime|attempt-lifecycle-runtime)(?:\/|\.|$)/i.test(
          specifier,
        ) ||
        /^(?:node:fs|node:http|node:https|node:net|node:tls|node:dns)$/i.test(
          specifier,
        )
      ) {
        addViolation(
          violations,
          "REPLAY_RUNTIME_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }
    if (
      /\bprocess\.env\b|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\brandomUUID\s*\(|\bnanoid\s*\(|\bMath\.random\s*\(|\bas\s+unknown\s+as\b|\bas\s+never\b/.test(
        input.source,
      ) ||
      /\b(?:drizzle|sequelize|typeorm|prisma|knex|postgres|pgPool|sql\s*`|fetch\s*\(|readFile|writeFile|createConnection)\b/i.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "REPLAY_RUNTIME_FORBIDDEN_DEPENDENCY",
        file,
        "Replay introduced infrastructure, environment, hidden time, randomness, or unsafe conversion",
      );
    }
    if (
      /\b(?:executeOrganizationVerificationWorkflowStep|executeOrganizationVerificationAttemptTransition|buildOrganizationVerificationEvidenceSnapshot|buildOrganizationVerificationEvaluationProjection|buildOrganizationVerificationPolicyEvaluationInput|executeOrganizationVerificationPolicyEvaluation|executeOrganizationVerificationDecisionTrustIntegration|transitionAttemptProcess|decideOrganizationVerification|deriveOrganizationVerificationTrustStatus)\s*\(/.test(
        input.source,
      ) ||
      /\b(?:WorkflowEngine|WorkflowCoordinator|ReplayRepair|EventUpcaster|GenericReducer|executeUntilComplete|automaticProgression|ParticipationEligibility|PublicationEligibility|RetryPolicy|LockManager|TransactionManager)\b/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "REPLAY_RUNTIME_FORBIDDEN_AUTHORITY",
        file,
        "Replay invoked business authority, automatic progression, repair, migration, retry, or downstream authority",
      );
    }
    if (
      /\b(?:appendOrganizationVerificationEvidence|createOrganizationVerificationStoredEvidence|createOrganizationVerificationEvidenceAppendBatch|createOrganizationVerificationEvidenceAppendReceipt|loadOrganizationVerificationEvidenceStream)\s*\(/.test(
        input.source,
      ) ||
      /\bOrganizationVerificationEvidenceAppendPort\b|\bOrganizationVerificationEvidenceRepositoryPort\b/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "REPLAY_RUNTIME_PERSISTENCE_WRITE",
        file,
        "Replay attempted repository access or persistence mutation",
      );
    }
  }

  if (
    lowerFile.endsWith("/application/replay-runtime/index.ts") &&
    /\b(?:replayRequestSeal|replayBindingSeal|replayExecutionSeal|replayResultSeal|fingerprintOrganizationVerificationReplay|createReplayEvidenceBindingInternal|createReplayExecutionInternal|replayCompletedInternal|replayRejectedInternal)\b/.test(
      input.source,
    )
  ) {
    addViolation(
      violations,
      "REPLAY_RUNTIME_PUBLIC_EXPORT_LEAK",
      file,
      "Replay public surface exposes private seals, fingerprinting, or construction authority",
    );
  }

  if (
    isOrganizationVerification &&
    !isReplayRuntime &&
    specifiers.some((specifier) =>
      /(?:^|\/)replay-runtime(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "REPLAY_RUNTIME_EXTERNAL_WIRING",
      file,
      "Pure Replay runtime must remain unwired from Domain, Workflow, persistence adapters, API, and startup",
    );
  }

  if (
    /\bcreateOrganizationVerificationPolicyEvaluationExecutionInternal\s*\(/.test(
      input.source,
    ) &&
    !lowerFile.endsWith(
      "/domain/policy-runtime/policyevaluationexecution.ts",
    ) &&
    !lowerFile.endsWith(
      "/domain/policy-runtime/policyevaluationexecutor.ts",
    )
  ) {
    addViolation(
      violations,
      "UNAUTHORIZED_POLICY_RUNTIME_CONSTRUCTION",
      file,
      "Only the Policy Runtime model and sole Executor may construct an authenticated Execution",
    );
  }

  if (
    isOrganizationVerification &&
    !isPolicyRuntimeDomain &&
    !isDecisionTrustIntegrationContractDomain &&
    !isDecisionTrustIntegrationDomain &&
    !isWorkflowContract &&
    !isWorkflowRuntime &&
    !isPersistenceContract &&
    !isDomainPublicIndex &&
    specifiers.some((specifier) =>
      /(?:^|\/)policy-runtime(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "POLICY_RUNTIME_EXTERNAL_WIRING",
      file,
      "Pure Policy Runtime must remain unwired outside its curated domain boundary",
    );
  }

  if (
    isOrganizationVerification &&
    !isDecisionTrustIntegrationContractDomain &&
    !isDecisionTrustIntegrationDomain &&
    !isDomainPublicIndex &&
    !lowerFile.endsWith("/organization-verification/index.ts") &&
    specifiers.some((specifier) =>
      /(?:^|\/)decision-trust-integration-contract(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "DECISION_TRUST_BINDING_EXTERNAL_WIRING",
      file,
      "Decision–Trust binding contract must remain inert outside its curated domain boundary",
    );
  }

  if (
    isOrganizationVerification &&
    !isDecisionTrustIntegrationDomain &&
    !isWorkflowContract &&
    !isWorkflowRuntime &&
    !isPersistenceContract &&
    !isDomainPublicIndex &&
    !lowerFile.endsWith("/organization-verification/index.ts") &&
    specifiers.some((specifier) =>
      /(?:^|\/)decision-trust-integration(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "DECISION_TRUST_INTEGRATION_EXTERNAL_WIRING",
      file,
      "Pure Decision–Trust integration must remain unwired outside its curated domain boundary",
    );
  }

  if (
    /\bcreateOrganizationVerificationPolicyEvaluationCompletionInternal\b/.test(
      input.source,
    ) &&
    !lowerFile.endsWith("/domain/policy/policyevaluationcompletion.ts") &&
    !lowerFile.endsWith("/domain/policy/findingaggregator.ts")
  ) {
    addViolation(
      violations,
      "UNAUTHORIZED_POLICY_CONSTRUCTION",
      file,
      "Only the Finding Aggregator may invoke Policy Evaluation Completion construction",
    );
  }

  if (
    (isDecisionDomain ||
      isTrustStatusDomain ||
      (isOrganizationVerificationCoreDomain && !isDomainPublicIndex) ||
      isOrganizationRegistry) &&
    specifiers.some((specifier) => /(?:^|\/)policy(?:\/|$)/i.test(specifier))
  ) {
    addViolation(
      violations,
      "FROZEN_DOMAIN_IMPORTS_POLICY",
      file,
      "Architecture-frozen domains must not depend on Policy Framework internals",
    );
  }

  if (
    !lowerFile.endsWith(
      "/organization-verification/domain/decision/decisionengine.ts",
    ) &&
    /\bcreateDecisionInternal\b/.test(input.source)
  ) {
    addViolation(
      violations,
      "UNAUTHORIZED_DECISION_CONSTRUCTION",
      file,
      "Only Decision Engine may invoke the internal Decision constructor",
    );
  }

  if (
    isOrganizationVerification &&
    !isDecisionDomain &&
    specifiers.some((specifier) =>
      /(?:^|\/)decision\/decisionEngine(?:\.js)?$/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "DECISION_ENGINE_RUNTIME_WIRING",
      file,
      "Decision Engine must remain unwired in this slice",
    );
  }

  if (
    isOrganizationVerification &&
    !isPolicyDomain &&
    !isEvaluationInputDomain &&
    !isPolicyRuntimeContractDomain &&
    !isPolicyRuntimeDomain &&
    !isDecisionTrustIntegrationDomain &&
    !isDomainPublicIndex &&
    !lowerFile.endsWith("/organization-verification/index.ts") &&
    specifiers.some((specifier) =>
      /(?:^|\/)domain\/policy(?:\/|$)|(?:^|\/)policy(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "POLICY_DOMAIN_RUNTIME_WIRING",
      file,
      "Policy Framework must remain inert outside its curated public surface",
    );
  }

  if (isTrustStatusDomain) {
    if (
      specifiers.some(
        (specifier) =>
          /(?:^|\/)(?:evidence-snapshot|evaluation-projection|evaluation-input)(?:\/|$)/i.test(
            specifier,
          ) ||
          /(?:^|\/)policy\/(?:finding|policyEvaluationCompletion|evaluationInput)(?:\.js)?$/i.test(
            specifier,
          ),
      )
    ) {
      addViolation(
        violations,
        "TRUST_PREPARATION_BYPASS",
        file,
        "Trust Status Domain cannot consume preparation internals, Findings, Policy Evaluation Completion, or raw Policy inputs directly",
      );
    }
    for (const specifier of specifiers) {
      if (
        !/^\.\/[A-Za-z0-9]+\.js$/.test(specifier) &&
        specifier !== "../decision/index.js" &&
        specifier !== "../ids.js" &&
        specifier !== "../../../organization-registry/index.js"
      ) {
        addViolation(
          violations,
          "TRUST_STATUS_DOMAIN_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
      if (
        /(?:^|\/)(?:db|database|storage|repository|routes?|workers?|providers?|services?|schema|frontend|client|startup)(?:\/|\.|$)/i.test(
          specifier,
        ) ||
        /(?:^|\/)(?:verification|marketplace|kyb|compliance|payments?|orders?|contracts?|notifications?|blockchain|ai)(?:\/|$)/i.test(
          specifier,
        ) ||
        /^(?:drizzle-orm|pg|@neondatabase\/)/i.test(specifier)
      ) {
        addViolation(
          violations,
          "TRUST_STATUS_DOMAIN_FORBIDDEN_DEPENDENCY",
          file,
          specifier,
        );
      }
    }

    if (
      /(?:^|\/)(?:eligibility|policy|finding|reason-code|rule|reviewer-status-override)(?:\/|\.|$)/i.test(
        lowerFile,
      ) ||
      /\b(?:ParticipationEligibility|PublicationEligibility|MarketplaceAccess|TransactionAuthorization|VerificationFinding|ReasonCode|RuleId|Severity|PolicyRegistry|ReviewerStatusOverride)\b/.test(
        input.source,
      ) ||
      /["'](?:allowed_to_trade|allowed_to_publish|allowed_to_transact|marketplace_access|seller_access|buyer_access)["']/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "TRUST_STATUS_DOMAIN_FORBIDDEN_AUTHORITY",
        file,
        "Eligibility, policy, finding, or reviewer authority is outside this slice",
      );
    }

    if (
      /\b(?:createDecisionInternal|decideOrganizationVerification)\b/.test(
        input.source,
      )
    ) {
      addViolation(
        violations,
        "TRUST_STATUS_DERIVER_DECISION_AUTHORITY",
        file,
        "Trust Status domain must not construct or invoke Decisions",
      );
    }
  }

  if (
    !lowerFile.endsWith(
      "/organization-verification/domain/trust-status/truststatusderiver.ts",
    ) &&
    /\bcreateTrustStatusInternal\b/.test(input.source)
  ) {
    addViolation(
      violations,
      "UNAUTHORIZED_TRUST_STATUS_CONSTRUCTION",
      file,
      "Only Trust Status Deriver may construct Trust Status",
    );
  }

  if (
    isOrganizationVerification &&
    !isTrustStatusDomain &&
    specifiers.some((specifier) =>
      /(?:^|\/)trust-status\/trustStatusDeriver(?:\.js)?$/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "TRUST_STATUS_DERIVER_RUNTIME_WIRING",
      file,
      "Trust Status Deriver must remain unwired in this slice",
    );
  }

  if (
    isOfferVerification &&
    specifiers.some((specifier) =>
      /(?:^|\/)organization-verification(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "OFFER_IMPORTS_ORG_VERIFICATION_INTERNAL",
      file,
      "Offer Verification imports Organization Verification internals",
    );
  }

  if (
    !isOrganizationVerification &&
    !/\.test\.(?:ts|tsx)$/i.test(lowerFile) &&
    specifiers.some((specifier) =>
      /(?:^|\/)organization-verification(?:\/|$)/i.test(specifier),
    )
  ) {
    addViolation(
      violations,
      "ORG_VERIFICATION_STARTUP_WIRING",
      file,
      "Organization Verification skeleton imported outside its inert boundary",
    );
  }

  return violations;
}

function scanRepository(): ArchitectureViolation[] {
  const files = [
    ...productionTypeScriptFiles(path.join(REPOSITORY_ROOT, "server")),
    ...productionTypeScriptFiles(path.join(REPOSITORY_ROOT, "client", "src")),
  ];
  return files.flatMap(scanSourceFile);
}

function expectFixtureViolation(
  expected: ArchitectureViolationCode,
  fixture: SourceFile,
): void {
  const codes = scanSourceFile(fixture).map((violation) => violation.code);
  assert.ok(
    codes.includes(expected),
    `expected ${expected}; received ${codes.join(", ") || "no violation"}`,
  );
}

test("capability ownership markers reserve the approved inert boundaries", () => {
  assert.equal(
    ORGANIZATION_VERIFICATION_ARCHITECTURE.capabilityRoot,
    "server/organization-verification",
  );
  assert.equal(
    ORGANIZATION_VERIFICATION_ARCHITECTURE.runtimeNamespacePrefix,
    "org_verification.",
  );
  assert.equal(
    ORGANIZATION_VERIFICATION_ARCHITECTURE.runtimeStatus,
    "inert_architecture_boundary",
  );
  assert.equal(
    ORGANIZATION_VERIFICATION_ARCHITECTURE.boundaries.offerVerification
      .capabilityRoot,
    "server/verification",
  );
  assert.equal(
    ORGANIZATION_VERIFICATION_ARCHITECTURE.boundaries
      .confidentialEvidenceStorage.relationship,
    "external_raw_artifact_authority",
  );
  assert.equal(
    ORGANIZATION_VERIFICATION_ARCHITECTURE.boundaries
      .participationEligibility.relationship,
    "external_downstream_authority",
  );

  assert.equal(
    ORGANIZATION_REGISTRY_ARCHITECTURE.capabilityRoot,
    "server/organization-registry",
  );
  assert.equal(
    ORGANIZATION_REGISTRY_ARCHITECTURE.reservedAuthorities.identityAuthority,
    "organization_registry",
  );
  assert.equal(
    ORGANIZATION_REGISTRY_ARCHITECTURE.runtimeStatus,
    "inert_architecture_boundary",
  );
});

test("production source satisfies every approved Organization Verification architecture rule", () => {
  assert.deepEqual(scanRepository(), []);
});

test("intentional fixture rejects Organization Verification importing Offer Verification internals", () => {
  expectFixtureViolation("ORG_VERIFICATION_IMPORTS_OFFER_INTERNAL", {
    file: "server/organization-verification/fixture.ts",
    source: 'import { decideVerification } from "../verification/engine.js";',
  });
});

test("intentional fixture rejects Offer Verification importing Organization Verification internals", () => {
  expectFixtureViolation("OFFER_IMPORTS_ORG_VERIFICATION_INTERNAL", {
    file: "server/verification/fixture.ts",
    source:
      'import { internal } from "../organization-verification/domain/internal.js";',
  });
});

test("intentional fixture rejects direct Registry repository or table access", () => {
  expectFixtureViolation("ORG_VERIFICATION_IMPORTS_REGISTRY_INTERNAL", {
    file: "server/organization-verification/fixture.ts",
    source:
      'import { organizations } from "../organization-registry/repository.js";',
  });
  expectFixtureViolation("ORG_VERIFICATION_IMPORTS_REGISTRY_INTERNAL", {
    file: "server/organization-verification/fixture.ts",
    source: 'import { organizations } from "@shared/schema";',
  });
});

test("intentional fixture rejects Organization Verification raw artifact storage", () => {
  expectFixtureViolation("ORG_VERIFICATION_OWNS_RAW_ARTIFACT", {
    file: "server/organization-verification/raw-artifact-storage.ts",
    source: "export class RawArtifactStore {}",
  });
});

test("intentional fixture rejects a generic trust runtime root", () => {
  expectFixtureViolation("GENERIC_TRUST_RUNTIME", {
    file: "server/trust/engine.ts",
    source: "export const genericRuntime = true;",
  });
});

test("intentional fixture rejects downstream eligibility authority", () => {
  expectFixtureViolation("ORG_VERIFICATION_OWNS_ELIGIBILITY", {
    file: "server/organization-verification/participation-eligibility.ts",
    source: "export interface ParticipationEligibilityDecision {}",
  });
});

test("intentional fixture rejects unauthorized Decision authority metadata", () => {
  expectFixtureViolation("UNAUTHORIZED_DECISION_AUTHORITY", {
    file: "server/organization-verification/reviewer.ts",
    source: 'export const reviewer = { decisionAuthority: "reviewer" };',
  });
});

test("intentional fixture rejects unauthorized Trust Status mutation authority metadata", () => {
  expectFixtureViolation("UNAUTHORIZED_TRUST_STATUS_AUTHORITY", {
    file: "server/organization-verification/coordinator.ts",
    source:
      'export const coordinator = { trustStatusAuthority: "workflow_coordinator" };',
  });
});

test("intentional fixture rejects a generic Organization Verification namespace", () => {
  expectFixtureViolation("GENERIC_ORG_VERIFICATION_NAMESPACE", {
    file: "server/organization-verification/catalog.ts",
    source: 'export const ruleId = "trust.identity.complete";',
  });
});

test("intentional fixture rejects startup or route wiring", () => {
  expectFixtureViolation("ORG_VERIFICATION_STARTUP_WIRING", {
    file: "server/index.ts",
    source:
      'import { marker } from "./organization-verification/index.js";',
  });
});

test("intentional fixture rejects Registry importing capability internals", () => {
  expectFixtureViolation("REGISTRY_IMPORTS_CAPABILITY_INTERNAL", {
    file: "server/organization-registry/contracts.ts",
    source:
      'import type { Decision } from "../organization-verification/domain/decision.js";',
  });
});

test("intentional fixture rejects Registry runtime or persistence imports", () => {
  expectFixtureViolation("REGISTRY_IMPORTS_RUNTIME", {
    file: "server/organization-registry/contracts.ts",
    source: 'import { db } from "../db.js";',
  });
});

test("intentional fixture rejects Registry Decision or Trust Status exports", () => {
  expectFixtureViolation("REGISTRY_EXPORTS_FORBIDDEN_AUTHORITY", {
    file: "server/organization-registry/contracts.ts",
    source: "export interface RegistryTrustStatus {}",
  });
});

test("intentional fixture rejects ACL runtime imports", () => {
  expectFixtureViolation("REGISTRY_ACL_IMPORTS_RUNTIME", {
    file: "server/organization-verification/integration/organizationRegistryAcl.ts",
    source: 'import { registerRoutes } from "../../routes.js";',
  });
});

test("intentional fixture rejects later-slice concepts in core domain", () => {
  expectFixtureViolation("CORE_DOMAIN_LATER_SLICE_ARTIFACT", {
    file: "server/organization-verification/domain/trust-status.ts",
    source: 'export const value = "trusted";',
  });
});

test("intentional fixture rejects unrestricted Revision construction", () => {
  expectFixtureViolation("UNRESTRICTED_REVISION_CONSTRUCTOR", {
    file: "server/organization-verification/domain/revision.ts",
    source:
      "export function createOrganizationVerificationRevision() { return {}; }",
  });
});

test("intentional fixture rejects runtime dependencies in Decision Domain", () => {
  expectFixtureViolation("DECISION_DOMAIN_FORBIDDEN_DEPENDENCY", {
    file: "server/organization-verification/domain/decision/evaluator.ts",
    source: 'import { db } from "../../../db.js";',
  });
});

test("intentional fixture rejects later-slice authority in Decision Domain", () => {
  expectFixtureViolation("DECISION_DOMAIN_LATER_SLICE_ARTIFACT", {
    file: "server/organization-verification/domain/decision/trust-status.ts",
    source: 'export type TrustStatus = "trusted";',
  });
});

test("intentional fixture rejects Decision construction outside Decision Engine", () => {
  expectFixtureViolation("UNAUTHORIZED_DECISION_CONSTRUCTION", {
    file: "server/organization-verification/domain/decision/reviewer.ts",
    source: "export function createDecisionInternal() { return {}; }",
  });
});

test("intentional fixture rejects lifecycle authority in Decision Engine", () => {
  expectFixtureViolation("DECISION_ENGINE_LIFECYCLE_AUTHORITY", {
    file: "server/organization-verification/domain/decision/decisionEngine.ts",
    source: "transitionAttemptProcess(attempt, 'completed');",
  });
});

test("intentional fixture rejects Decision Engine runtime wiring", () => {
  expectFixtureViolation("DECISION_ENGINE_RUNTIME_WIRING", {
    file: "server/organization-verification/worker.ts",
    source:
      'import { decideOrganizationVerification } from "./domain/decision/decisionEngine.js";',
  });
});

test("intentional fixture rejects runtime dependencies in Trust Status Domain", () => {
  expectFixtureViolation("TRUST_STATUS_DOMAIN_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/trust-status/projector.ts",
    source: 'import { db } from "../../../db.js";',
  });
});

test("intentional fixture rejects eligibility authority in Trust Status Domain", () => {
  expectFixtureViolation("TRUST_STATUS_DOMAIN_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/trust-status/eligibility.ts",
    source: "export interface ParticipationEligibility {}",
  });
});

test("intentional fixture rejects Trust Status construction outside Deriver", () => {
  expectFixtureViolation("UNAUTHORIZED_TRUST_STATUS_CONSTRUCTION", {
    file: "server/organization-verification/reviewer.ts",
    source: "export function createTrustStatusInternal() { return {}; }",
  });
});

test("intentional fixture rejects Decision authority in Trust Status Domain", () => {
  expectFixtureViolation("TRUST_STATUS_DERIVER_DECISION_AUTHORITY", {
    file:
      "server/organization-verification/domain/trust-status/trustStatusDeriver.ts",
    source: "decideOrganizationVerification(completion, context);",
  });
});

test("intentional fixture rejects Trust Status Deriver runtime wiring", () => {
  expectFixtureViolation("TRUST_STATUS_DERIVER_RUNTIME_WIRING", {
    file: "server/organization-verification/worker.ts",
    source:
      'import { deriveOrganizationVerificationTrustStatus } from "./domain/trust-status/trustStatusDeriver.js";',
  });
});

test("intentional fixture rejects uncurated core-domain public exports", () => {
  expectFixtureViolation("DOMAIN_PUBLIC_EXPORT_LEAK", {
    file: "server/organization-verification/domain/index.ts",
    source: 'export * from "./record.js";',
  });
});

test("intentional fixture rejects Trust Status importing Decision Engine implementation", () => {
  expectFixtureViolation("TRUST_STATUS_DOMAIN_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/trust-status/sourceFacts.ts",
    source:
      'import { isOrganizationVerificationDecision } from "../decision/decisionEngine.js";',
  });
});

test("intentional fixture rejects internal authenticity readers on public surfaces", () => {
  expectFixtureViolation("DOMAIN_PUBLIC_EXPORT_LEAK", {
    file: "server/organization-verification/domain/trust-status/index.ts",
    source:
      'export { readDecisionApplicability } from "./applicability.js";',
  });
});

test("intentional fixture rejects unauthorized authenticity-reader access", () => {
  expectFixtureViolation("UNAUTHORIZED_AUTHENTICITY_READ", {
    file: "server/organization-verification/domain/reviewer.ts",
    source:
      'import { readSealedEvaluationCompletion } from "./decision/sealedEvaluationCompletion.js";',
  });
});

test("intentional fixture rejects Policy Framework Decision construction", () => {
  expectFixtureViolation("POLICY_DOMAIN_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/policy/decisionPolicy.ts",
    source: "decideOrganizationVerification(completion, context);",
  });
});

test("intentional fixture rejects Policy Framework Trust Status construction", () => {
  expectFixtureViolation("POLICY_DOMAIN_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/policy/trustPolicy.ts",
    source: "deriveOrganizationVerificationTrustStatus(facts, context);",
  });
});

test("intentional fixture rejects Policy Framework runtime imports", () => {
  expectFixtureViolation("POLICY_DOMAIN_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/policy/policyEvaluator.ts",
    source: 'import { db } from "../../../db.js";',
  });
});

test("intentional fixture rejects Policy Framework provider imports", () => {
  expectFixtureViolation("POLICY_DOMAIN_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/policy/policyEvaluator.ts",
    source: 'import { screen } from "../../../providers/sanctions.js";',
  });
});

test("intentional fixture rejects direct policy-to-Decision Engine coupling", () => {
  expectFixtureViolation("POLICY_DOMAIN_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/policy/evaluator.ts",
    source: 'import { decide } from "../decision/decisionEngine.js";',
  });
});

test("intentional fixture rejects direct policy-to-Trust Status coupling", () => {
  expectFixtureViolation("POLICY_DOMAIN_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/policy/evaluator.ts",
    source:
      'import { derive } from "../trust-status/trustStatusDeriver.js";',
  });
});

test("intentional fixture rejects unrestricted Policy internal exports", () => {
  expectFixtureViolation("POLICY_DOMAIN_PUBLIC_EXPORT_LEAK", {
    file:
      "server/organization-verification/domain/policy/index.ts",
    source:
      'export { readOrganizationVerificationPolicyEvaluationCompletion } from "./policyEvaluationCompletion.js";',
  });
});

test("intentional fixture rejects unauthorized Evidence Snapshot construction", () => {
  expectFixtureViolation("UNAUTHORIZED_SNAPSHOT_CONSTRUCTION", {
    file: "server/organization-verification/domain/reviewer.ts",
    source:
      "export function createOrganizationVerificationEvidenceSnapshotInternal() { return {}; }",
  });
});

test("intentional fixture rejects Evidence Snapshot private authenticity reads", () => {
  expectFixtureViolation("UNAUTHORIZED_SNAPSHOT_AUTHENTICITY_READ", {
    file: "server/organization-verification/domain/policy/evaluator.ts",
    source:
      'import { readOrganizationVerificationEvidenceSnapshotInternal } from "../evidence-snapshot/evidenceSnapshot.js";',
  });
});

test("intentional fixture rejects unrestricted Evidence Snapshot exports", () => {
  expectFixtureViolation("SNAPSHOT_DOMAIN_PUBLIC_EXPORT_LEAK", {
    file:
      "server/organization-verification/domain/evidence-snapshot/index.ts",
    source: 'export * from "./evidenceSnapshot.js";',
  });
});

test("intentional fixture rejects Evidence Snapshot database imports", () => {
  expectFixtureViolation("SNAPSHOT_DOMAIN_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/evidence-snapshot/evidenceSnapshotBuilder.ts",
    source: 'import { db } from "../../../db.js";',
  });
});

test("intentional fixture rejects Evidence Snapshot storage imports", () => {
  expectFixtureViolation("SNAPSHOT_DOMAIN_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/evidence-snapshot/evidenceSnapshotBuilder.ts",
    source: 'import { storage } from "../../../storage/client.js";',
  });
});

test("intentional fixture rejects Evidence Snapshot provider imports", () => {
  expectFixtureViolation("SNAPSHOT_DOMAIN_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/evidence-snapshot/evidenceSnapshotBuilder.ts",
    source: 'import { provider } from "../../../providers/kyb.js";',
  });
});

test("intentional fixture rejects Evidence Snapshot Policy authority", () => {
  expectFixtureViolation("SNAPSHOT_DOMAIN_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/evidence-snapshot/evaluator.ts",
    source: "evaluateOrganizationVerificationPolicy(snapshot);",
  });
});

test("intentional fixture rejects Evidence Snapshot Decision authority", () => {
  expectFixtureViolation("SNAPSHOT_DOMAIN_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/evidence-snapshot/evaluator.ts",
    source: "decideOrganizationVerification(snapshot);",
  });
});

test("intentional fixture rejects Evidence Snapshot Trust authority", () => {
  expectFixtureViolation("SNAPSHOT_DOMAIN_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/evidence-snapshot/evaluator.ts",
    source: "deriveOrganizationVerificationTrustStatus(snapshot);",
  });
});

test("intentional fixture rejects Evidence Snapshot workflow authority", () => {
  expectFixtureViolation("SNAPSHOT_DOMAIN_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/evidence-snapshot/coordinator.ts",
    source: "transitionAttemptProcess(attempt, 'running');",
  });
});

test("intentional fixture rejects runtime wiring of Evidence Snapshot Builder", () => {
  expectFixtureViolation("SNAPSHOT_DOMAIN_RUNTIME_WIRING", {
    file: "server/organization-verification/worker.ts",
    source:
      'import { buildOrganizationVerificationEvidenceSnapshot } from "./domain/evidence-snapshot/index.js";',
  });
});

test("intentional fixture rejects reverse Core dependency on Evidence Snapshot", () => {
  expectFixtureViolation("FROZEN_DOMAIN_IMPORTS_SNAPSHOT", {
    file: "server/organization-verification/domain/submission.ts",
    source:
      'import type { OrganizationVerificationEvidenceSnapshot } from "./evidence-snapshot/index.js";',
  });
});

test("intentional fixture rejects unauthorized Evaluation Projection construction", () => {
  expectFixtureViolation("UNAUTHORIZED_EVALUATION_PROJECTION_CONSTRUCTION", {
    file: "server/organization-verification/domain/reviewer.ts",
    source:
      "export function createOrganizationVerificationEvaluationProjectionInternal() { return {}; }",
  });
});

test("intentional fixture rejects unrestricted Evaluation Projection exports", () => {
  expectFixtureViolation("EVALUATION_PROJECTION_PUBLIC_EXPORT_LEAK", {
    file:
      "server/organization-verification/domain/evaluation-projection/index.ts",
    source: 'export * from "./evaluationProjection.js";',
  });
});

test("intentional fixture rejects Evaluation Projection Policy dependency", () => {
  expectFixtureViolation("EVALUATION_PROJECTION_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/evaluation-projection/evaluator.ts",
    source: 'import { policy } from "../policy/index.js";',
  });
});

test("intentional fixture rejects Evaluation Projection database dependency", () => {
  expectFixtureViolation("EVALUATION_PROJECTION_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/evaluation-projection/builder.ts",
    source: 'import { db } from "../../../db.js";',
  });
});

test("intentional fixture rejects Evaluation Projection storage dependency", () => {
  expectFixtureViolation("EVALUATION_PROJECTION_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/evaluation-projection/builder.ts",
    source: 'import { storage } from "../../../storage/client.js";',
  });
});

test("intentional fixture rejects Evaluation Projection business inference", () => {
  expectFixtureViolation("EVALUATION_PROJECTION_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/evaluation-projection/inference.ts",
    source: "const supportedJurisdiction = jurisdiction === 'ZZ';",
  });
});

test("intentional fixture rejects Evaluation Projection Decision authority", () => {
  expectFixtureViolation("EVALUATION_PROJECTION_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/evaluation-projection/decision.ts",
    source: "decideOrganizationVerification(projection);",
  });
});

test("intentional fixture rejects Evaluation Projection Workflow authority", () => {
  expectFixtureViolation("EVALUATION_PROJECTION_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/evaluation-projection/workflow.ts",
    source: "transitionAttemptProcess(attempt, 'running');",
  });
});

test("intentional fixture rejects Evaluation Projection runtime wiring", () => {
  expectFixtureViolation("EVALUATION_PROJECTION_RUNTIME_WIRING", {
    file: "server/organization-verification/worker.ts",
    source:
      'import { buildOrganizationVerificationEvaluationProjection } from "./domain/evaluation-projection/index.js";',
  });
});

test("intentional fixture rejects reverse Snapshot dependency on Evaluation Projection", () => {
  expectFixtureViolation("FROZEN_DOMAIN_IMPORTS_EVALUATION_PROJECTION", {
    file:
      "server/organization-verification/domain/evidence-snapshot/evidenceSnapshot.ts",
    source:
      'import type { Projection } from "../evaluation-projection/index.js";',
  });
});

test("intentional fixture rejects unauthorized Evaluation Input construction", () => {
  expectFixtureViolation("UNAUTHORIZED_EVALUATION_INPUT_CONSTRUCTION", {
    file: "server/organization-verification/domain/reviewer.ts",
    source:
      "export function createOrganizationVerificationPolicyEvaluationInputInternal() { return {}; }",
  });
});

test("intentional fixture rejects Evaluation Input seal or internal-reader export", () => {
  expectFixtureViolation("EVALUATION_INPUT_PUBLIC_EXPORT_LEAK", {
    file: "server/organization-verification/domain/evaluation-input/index.ts",
    source:
      'export { readOrganizationVerificationPolicyEvaluationInputInternal } from "./policyEvaluationInput.js";',
  });
});

test("intentional fixture rejects direct Snapshot consumption by Evaluation Input", () => {
  expectFixtureViolation("EVALUATION_INPUT_DIRECT_SNAPSHOT_CONSUMPTION", {
    file:
      "server/organization-verification/domain/evaluation-input/builder.ts",
    source:
      'import type { OrganizationVerificationEvidenceSnapshot } from "../evidence-snapshot/index.js";',
  });
});

test("intentional fixture rejects Policy execution import by Evaluation Input", () => {
  expectFixtureViolation("EVALUATION_INPUT_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/evaluation-input/executor.ts",
    source: "completeOrganizationVerificationPolicyEvaluation(input);",
  });
});

test("intentional fixture rejects Decision authority in Evaluation Input", () => {
  expectFixtureViolation("EVALUATION_INPUT_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/evaluation-input/decision.ts",
    source: "decideOrganizationVerification(input);",
  });
});

test("intentional fixture rejects Trust authority in Evaluation Input", () => {
  expectFixtureViolation("EVALUATION_INPUT_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/evaluation-input/trust.ts",
    source: "deriveOrganizationVerificationTrustStatus(input);",
  });
});

test("intentional fixture rejects database imports in Evaluation Input", () => {
  expectFixtureViolation("EVALUATION_INPUT_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/evaluation-input/repository.ts",
    source: 'import { db } from "../../../db.js";',
  });
});

test("intentional fixture rejects provider imports in Evaluation Input", () => {
  expectFixtureViolation("EVALUATION_INPUT_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/evaluation-input/provider.ts",
    source: 'import { provider } from "../../../providers/kyb.js";',
  });
});

test("intentional fixture rejects Attempt transition in Evaluation Input", () => {
  expectFixtureViolation("EVALUATION_INPUT_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/evaluation-input/workflow.ts",
    source: "transitionAttemptProcess(attempt, 'running');",
  });
});

test("intentional fixture rejects Evaluation Input runtime wiring", () => {
  expectFixtureViolation("EVALUATION_INPUT_RUNTIME_WIRING", {
    file: "server/organization-verification/worker.ts",
    source:
      'import { buildOrganizationVerificationPolicyEvaluationInput } from "./domain/evaluation-input/index.js";',
  });
});

test("intentional fixture rejects reverse Projection dependency on Evaluation Input", () => {
  expectFixtureViolation("FROZEN_DOMAIN_IMPORTS_EVALUATION_INPUT", {
    file:
      "server/organization-verification/domain/evaluation-projection/evaluationProjection.ts",
    source:
      'import type { OrganizationVerificationPolicyEvaluationInput } from "../evaluation-input/index.js";',
  });
});

test("Executable Rule contract rejects direct Snapshot access", () => {
  expectFixtureViolation("POLICY_RUNTIME_CONTRACT_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/policy-runtime-contract/bypass.ts",
    source:
      'import type { OrganizationVerificationEvidenceSnapshot } from "../evidence-snapshot/index.js";',
  });
});

test("Executable Rule contract rejects direct Projection access", () => {
  expectFixtureViolation("POLICY_RUNTIME_CONTRACT_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/policy-runtime-contract/bypass.ts",
    source:
      'import type { OrganizationVerificationEvaluationProjection } from "../evaluation-projection/index.js";',
  });
});

test("Executable Rule contract rejects database infrastructure", () => {
  expectFixtureViolation("POLICY_RUNTIME_CONTRACT_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/policy-runtime-contract/repository.ts",
    source: 'import { db } from "../../../db.js";',
  });
});

test("Executable Rule contract rejects providers and dynamic Registry lookup", () => {
  expectFixtureViolation("POLICY_RUNTIME_CONTRACT_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/policy-runtime-contract/loader.ts",
    source:
      'import { registry } from "../../../organization-registry/index.js";',
  });
  expectFixtureViolation("POLICY_RUNTIME_CONTRACT_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/policy-runtime-contract/provider.ts",
    source: 'import { provider } from "../../../providers/kyb.js";',
  });
});

test("Executable Rule contract rejects Finding and completion production", () => {
  expectFixtureViolation("POLICY_RUNTIME_CONTRACT_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/policy-runtime-contract/executor.ts",
    source:
      "createOrganizationVerificationFinding(input); completeOrganizationVerificationPolicyEvaluation(input);",
  });
});

test("Executable Rule contract rejects Decision, Trust, and Attempt authority", () => {
  expectFixtureViolation("POLICY_RUNTIME_CONTRACT_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/policy-runtime-contract/decision.ts",
    source: "decideOrganizationVerification(input);",
  });
  expectFixtureViolation("POLICY_RUNTIME_CONTRACT_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/policy-runtime-contract/trust.ts",
    source: "deriveOrganizationVerificationTrustStatus(input);",
  });
  expectFixtureViolation("POLICY_RUNTIME_CONTRACT_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/policy-runtime-contract/workflow.ts",
    source: "transitionAttemptProcess(attempt, 'running');",
  });
});

test("Executable Rule contract rejects environment, hidden clock, and hidden ID authority", () => {
  for (const source of [
    "const configured = process.env.POLICY_SET;",
    "const timestamp = Date.now();",
    "const timestamp = new Date();",
    "const id = randomUUID();",
    "const id = nanoid();",
  ]) {
    expectFixtureViolation("POLICY_RUNTIME_CONTRACT_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/domain/policy-runtime-contract/hiddenAuthority.ts",
      source,
    });
  }
});

test("Executable Rule contract rejects unsafe opaque-type substitution", () => {
  expectFixtureViolation("POLICY_RUNTIME_CONTRACT_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/policy-runtime-contract/unsafe.ts",
    source: "const executionId = value as unknown as ExecutionId;",
  });
});

test("Phase 7B-6A.0 rejects production Rule execution", () => {
  expectFixtureViolation("POLICY_RUNTIME_EXECUTION_STARTED", {
    file:
      "server/organization-verification/domain/policy-runtime-contract/executor.ts",
    source: "implementation.evaluate(facts);",
  });
});

test("Phase 7B-6A.0 rejects production Rule implementation creation", () => {
  expectFixtureViolation("POLICY_RUNTIME_EXECUTION_STARTED", {
    file:
      "server/organization-verification/domain/policy-runtime-contract/businessRule.ts",
    source: "createOrganizationVerificationRuleImplementation(input);",
  });
});

test("Executable Rule contract protects seals and canonicalization from public exports", () => {
  expectFixtureViolation("POLICY_RUNTIME_CONTRACT_PUBLIC_EXPORT_LEAK", {
    file:
      "server/organization-verification/domain/policy-runtime-contract/index.ts",
    source: 'export { fingerprintInternal } from "./canonical.js";',
  });
});

test("Policy Runtime rejects direct Snapshot and Projection access", () => {
  expectFixtureViolation("POLICY_RUNTIME_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/policy-runtime/bypass.ts",
    source:
      'import type { OrganizationVerificationEvidenceSnapshot } from "../evidence-snapshot/index.js";',
  });
  expectFixtureViolation("POLICY_RUNTIME_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/policy-runtime/bypass.ts",
    source:
      'import type { OrganizationVerificationEvaluationProjection } from "../evaluation-projection/index.js";',
  });
});

test("Policy Runtime rejects database, provider, and Registry dependencies", () => {
  for (const source of [
    'import { db } from "../../../db.js";',
    'import { provider } from "../../../providers/kyb.js";',
    'import { registry } from "../../../organization-registry/index.js";',
  ]) {
    expectFixtureViolation("POLICY_RUNTIME_FORBIDDEN_DEPENDENCY", {
      file:
        "server/organization-verification/domain/policy-runtime/infrastructure.ts",
      source,
    });
  }
});

test("Policy Runtime rejects Decision, Trust, Eligibility, and Attempt authority", () => {
  for (const source of [
    "decideOrganizationVerification(input);",
    "deriveOrganizationVerificationTrustStatus(input);",
    "transitionAttemptProcess(attempt, 'completed');",
    "const eligibility: ParticipationEligibility = value;",
  ]) {
    expectFixtureViolation("POLICY_RUNTIME_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/domain/policy-runtime/authority.ts",
      source,
    });
  }
});

test("Policy Runtime rejects environment, hidden clock, and hidden IDs", () => {
  for (const source of [
    "const policy = process.env.POLICY;",
    "const timestamp = Date.now();",
    "const timestamp = new Date();",
    "const id = randomUUID();",
    "const id = nanoid();",
  ]) {
    expectFixtureViolation("POLICY_RUNTIME_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/domain/policy-runtime/hidden.ts",
      source,
    });
  }
});

test("Policy Runtime rejects unsafe opaque-type substitution", () => {
  expectFixtureViolation("POLICY_RUNTIME_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/policy-runtime/unsafe.ts",
    source: "const id = input as unknown as ExecutionId;",
  });
});

test("Policy Runtime rejects production business Rule construction", () => {
  expectFixtureViolation("POLICY_RUNTIME_FORBIDDEN_AUTHORITY", {
    file:
      "server/organization-verification/domain/policy-runtime/businessRule.ts",
    source: "createOrganizationVerificationRuleImplementation(input);",
  });
});

test("Policy Runtime limits Rule and frozen Policy invocation to the Executor", () => {
  for (const source of [
    "implementation.evaluate(facts);",
    "createOrganizationVerificationFinding(input, context);",
    "createOrganizationVerificationRuleEvaluationResult(input);",
    "completeOrganizationVerificationPolicyEvaluation(input);",
  ]) {
    expectFixtureViolation("POLICY_RUNTIME_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/domain/policy-runtime/helper.ts",
      source,
    });
  }
});

test("Policy Runtime protects Execution construction authority", () => {
  expectFixtureViolation("UNAUTHORIZED_POLICY_RUNTIME_CONSTRUCTION", {
    file:
      "server/organization-verification/domain/policy-runtime/helper.ts",
    source:
      "createOrganizationVerificationPolicyEvaluationExecutionInternal(input);",
  });
});

test("Policy Runtime protects its private public-export surface", () => {
  expectFixtureViolation("POLICY_RUNTIME_PUBLIC_EXPORT_LEAK", {
    file:
      "server/organization-verification/domain/policy-runtime/index.ts",
    source:
      'export { policyRuntimeExecutionSeal } from "./policyEvaluationExecution.js";',
  });
});

test("Policy Runtime remains unwired outside the curated domain boundary", () => {
  expectFixtureViolation("POLICY_RUNTIME_EXTERNAL_WIRING", {
    file: "server/organization-verification/worker.ts",
    source:
      'import { executeOrganizationVerificationPolicyEvaluation } from "./domain/policy-runtime/index.js";',
  });
});

test("combined-pipeline fixture rejects Snapshot importing Evaluation Input", () => {
  expectFixtureViolation("FROZEN_DOMAIN_IMPORTS_EVALUATION_INPUT", {
    file:
      "server/organization-verification/domain/evidence-snapshot/evidenceSnapshot.ts",
    source:
      'import type { OrganizationVerificationPolicyEvaluationInput } from "../evaluation-input/index.js";',
  });
});

test("combined-pipeline fixture rejects Projection consuming Verification Revision directly", () => {
  expectFixtureViolation("EVALUATION_PROJECTION_DIRECT_REVISION_CONSUMPTION", {
    file:
      "server/organization-verification/domain/evaluation-projection/evaluationProjectionBuilder.ts",
    source:
      'import type { OrganizationVerificationRevision } from "../revision.js";',
  });
});

test("combined-pipeline fixture rejects Policy consuming Snapshot directly", () => {
  expectFixtureViolation("POLICY_PREPARATION_BYPASS", {
    file:
      "server/organization-verification/domain/policy/policyExecutor.ts",
    source:
      'import type { OrganizationVerificationEvidenceSnapshot } from "../evidence-snapshot/index.js";',
  });
});

test("combined-pipeline fixture rejects Policy consuming Projection as Evaluation Input", () => {
  expectFixtureViolation("POLICY_PREPARATION_BYPASS", {
    file:
      "server/organization-verification/domain/policy/policyExecutor.ts",
    source:
      'import type { OrganizationVerificationEvaluationProjection } from "../evaluation-projection/index.js";',
  });
});

test("combined-pipeline fixture rejects Decision consuming preparation internals", () => {
  expectFixtureViolation("DECISION_PREPARATION_BYPASS", {
    file:
      "server/organization-verification/domain/decision/decisionEngine.ts",
    source:
      'import type { OrganizationVerificationPolicyEvaluationInput } from "../evaluation-input/policyEvaluationInput.js";',
  });
});

test("combined-pipeline fixture rejects Trust consuming preparation internals", () => {
  expectFixtureViolation("TRUST_PREPARATION_BYPASS", {
    file:
      "server/organization-verification/domain/trust-status/trustStatusDeriver.ts",
    source:
      'import type { OrganizationVerificationEvaluationProjection } from "../evaluation-projection/evaluationProjection.js";',
  });
});

test("combined-pipeline fixture rejects Trust consuming Findings directly", () => {
  expectFixtureViolation("TRUST_PREPARATION_BYPASS", {
    file:
      "server/organization-verification/domain/trust-status/trustStatusDeriver.ts",
    source:
      'import type { OrganizationVerificationFinding } from "../policy/finding.js";',
  });
});

test("Decision–Trust binding rejects infrastructure and provider dependencies", () => {
  for (const source of [
    'import { db } from "../../../db.js";',
    'import { repository } from "../../../repositories/trust.js";',
    'import { provider } from "../../../providers/organization.js";',
    'import { worker } from "../../../workers/trust.js";',
  ]) {
    expectFixtureViolation("DECISION_TRUST_BINDING_FORBIDDEN_DEPENDENCY", {
      file:
        "server/organization-verification/domain/decision-trust-integration-contract/infrastructure.ts",
      source,
    });
  }
});

test("Decision–Trust binding rejects Decision, Trust, Workflow, and Eligibility execution", () => {
  for (const source of [
    "decideOrganizationVerification(input);",
    "deriveOrganizationVerificationTrustStatus(input);",
    "transitionAttemptProcess(attempt, input);",
    "const result: ParticipationEligibility = input;",
  ]) {
    expectFixtureViolation("DECISION_TRUST_BINDING_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/domain/decision-trust-integration-contract/executor.ts",
      source,
    });
  }
});

test("Decision–Trust binding rejects direct Finding and Rule Result consumption", () => {
  for (const source of [
    "const findings = execution.findings;",
    "const results = completion.ruleResults;",
    "const executions = execution.ruleExecutions;",
  ]) {
    expectFixtureViolation("DECISION_TRUST_BINDING_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/domain/decision-trust-integration-contract/bypass.ts",
      source,
    });
  }
});

test("Decision–Trust binding rejects environment, hidden clocks, IDs, and unsafe conversion", () => {
  for (const source of [
    "const value = process.env.BINDING;",
    "const timestamp = Date.now();",
    "const timestamp = new Date();",
    "const id = randomUUID();",
    "const id = nanoid();",
    "const id = value as unknown as DecisionId;",
  ]) {
    expectFixtureViolation("DECISION_TRUST_BINDING_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/domain/decision-trust-integration-contract/hidden.ts",
      source,
    });
  }
});

test("Decision–Trust binding protects seals, constructors, and canonicalization", () => {
  expectFixtureViolation("DECISION_TRUST_BINDING_PUBLIC_EXPORT_LEAK", {
    file:
      "server/organization-verification/domain/decision-trust-integration-contract/index.ts",
    source:
      'export { integrationBindingSeal, fingerprintDecisionTrustBindingInternal } from "./canonical.js";',
  });
});

test("Decision–Trust binding remains unwired outside its curated boundary", () => {
  expectFixtureViolation("DECISION_TRUST_BINDING_EXTERNAL_WIRING", {
    file: "server/organization-verification/worker.ts",
    source:
      'import { binding } from "./domain/decision-trust-integration-contract/index.js";',
  });
});

test("Trust Status authenticity guard rejects unauthorized consumers", () => {
  for (const file of [
    "server/organization-verification/workflow.ts",
    "server/organization-verification/eligibility.ts",
    "server/organization-verification/repository.ts",
    "server/marketplace/trust.ts",
  ]) {
    expectFixtureViolation("TRUST_STATUS_GUARD_UNAUTHORIZED_CONSUMER", {
      file,
      source: "isOrganizationVerificationTrustStatus(value);",
    });
  }
});

test("Decision–Trust contract accepts only curated public domain surfaces", () => {
  expectFixtureViolation("DECISION_TRUST_BINDING_FORBIDDEN_DEPENDENCY", {
    file:
      "server/organization-verification/domain/decision-trust-integration-contract/bypass.ts",
    source:
      'import { readOrganizationVerificationPolicyEvaluationCompletion } from "../policy/policyEvaluationCompletion.js";',
  });
});

test("Decision–Trust integration rejects infrastructure and downstream capabilities", () => {
  for (const source of [
    'import { db } from "../../../db.js";',
    'import { repository } from "../../../repositories/trust.js";',
    'import { workflow } from "../../../workflow/organization.js";',
    'import { eligibility } from "../../../eligibility/organization.js";',
    'import { marketplace } from "../../../marketplace/index.js";',
  ]) {
    expectFixtureViolation("DECISION_TRUST_INTEGRATION_FORBIDDEN_DEPENDENCY", {
      file:
        "server/organization-verification/domain/decision-trust-integration/infrastructure.ts",
      source,
    });
  }
});

test("Decision–Trust integration rejects direct Rule output consumption", () => {
  for (const source of [
    "const findings = execution.findings;",
    "const results = completion.ruleResults;",
    "const executions = execution.ruleExecutions;",
  ]) {
    expectFixtureViolation("DECISION_TRUST_INTEGRATION_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/domain/decision-trust-integration/bypass.ts",
      source,
    });
  }
});

test("Decision–Trust integration rejects hidden inputs and downstream authority", () => {
  for (const source of [
    "const value = process.env.INTEGRATION;",
    "const timestamp = Date.now();",
    "const timestamp = new Date();",
    "const id = randomUUID();",
    "const id = nanoid();",
    "const id = Math.random();",
    "const id = value as unknown as DecisionId;",
    "transitionAttemptProcess(attempt, input);",
    "const result: ParticipationEligibility = input;",
  ]) {
    expectFixtureViolation("DECISION_TRUST_INTEGRATION_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/domain/decision-trust-integration/hidden.ts",
      source,
    });
  }
});

test("Decision–Trust integration protects its private execution authority", () => {
  expectFixtureViolation("DECISION_TRUST_INTEGRATION_PUBLIC_EXPORT_LEAK", {
    file:
      "server/organization-verification/domain/decision-trust-integration/index.ts",
    source:
      'export { decisionTrustIntegrationExecutionSeal, deriveTrustStatusFromAuthenticDecision } from "./internal.js";',
  });
});

test("Decision–Trust integration remains unwired outside its curated boundary", () => {
  expectFixtureViolation("DECISION_TRUST_INTEGRATION_EXTERNAL_WIRING", {
    file: "server/organization-verification/worker.ts",
    source:
      'import { executeOrganizationVerificationDecisionTrustIntegration } from "./domain/decision-trust-integration/index.js";',
  });
});

test("Decision–Trust integration centralizes authority sequencing in its executor", () => {
  for (const source of [
    "adaptPolicyEvaluationCompletionToNormalizedEvaluation(completion);",
    "decideOrganizationVerification(input, context);",
    "deriveTrustStatusFromAuthenticDecision(decision, facts, context);",
    "createOrganizationVerificationDecisionTrustIntegrationBinding(input);",
  ]) {
    expectFixtureViolation("DECISION_TRUST_INTEGRATION_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/domain/decision-trust-integration/alternateExecutor.ts",
      source,
    });
  }
});

test("Decision–Trust integration isolates Decision-to-Trust derivation", () => {
  expectFixtureViolation("DECISION_TRUST_INTEGRATION_TRUST_BOUNDARY", {
    file:
      "server/organization-verification/domain/decision-trust-integration/notTrustDerivation.ts",
    source: "deriveOrganizationVerificationTrustStatus(facts, context);",
  });
  expectFixtureViolation("DECISION_TRUST_INTEGRATION_TRUST_BOUNDARY", {
    file:
      "server/organization-verification/domain/decision-trust-integration/trustDerivation.ts",
    source:
      'import { completion } from "../policy/index.js";\nconst value: PolicyEvaluationExecution = completion;',
  });
});

test("Decision–Trust integration rejects private Decision and Trust constructors", () => {
  for (const source of [
    "createDecisionInternal(input);",
    "createTrustStatusInternal(input);",
  ]) {
    expectFixtureViolation("DECISION_TRUST_INTEGRATION_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/domain/decision-trust-integration/privateAuthority.ts",
      source,
    });
  }
});

test("Core authenticity seals and stamping authorities remain private", () => {
  for (const source of [
    'export { recordAuthenticitySeal } from "./record.js";',
    'export { revisionAuthenticitySeal } from "./submission.js";',
    'export { attemptAuthenticitySeal } from "./attempt.js";',
    'export { sealOrganizationVerificationAttempt } from "./attempt.js";',
  ]) {
    expectFixtureViolation("CORE_AUTHENTICITY_PUBLIC_EXPORT_LEAK", {
      file: "server/organization-verification/domain/index.ts",
      source,
    });
  }
});

test("Core authenticity guards reject unrelated application consumers", () => {
  const fixtures = [
    [
      "server/organization-verification/eligibility.ts",
      "isOrganizationVerificationRecord(value);",
    ],
    [
      "server/organization-verification/workflow.ts",
      "isOrganizationVerificationRevision(value);",
    ],
    [
      "server/organization-verification/repository.ts",
      "isOrganizationVerificationAttempt(value);",
    ],
    [
      "server/marketplace/permissions.ts",
      "isOrganizationVerificationAttempt(value);",
    ],
    [
      "server/routes.ts",
      "isOrganizationVerificationRecord(value);",
    ],
  ] as const;
  for (const [file, source] of fixtures) {
    expectFixtureViolation(
      "CORE_AUTHENTICITY_GUARD_UNAUTHORIZED_CONSUMER",
      { file, source },
    );
  }
});

test("Core authenticity guards are reserved for the Phase 8A.0 contract boundary", () => {
  const violations = scanSourceFile({
    file:
      "server/organization-verification/application/attempt-lifecycle-contract/continuity.ts",
    source: [
      "isOrganizationVerificationRecord(record);",
      "isOrganizationVerificationRevision(revision);",
      "isOrganizationVerificationAttempt(attempt);",
    ].join("\n"),
  });
  assert.equal(
    violations.some(
      (violation) =>
        violation.code ===
        "CORE_AUTHENTICITY_GUARD_UNAUTHORIZED_CONSUMER",
    ),
    false,
  );
});

test("Attempt Lifecycle contract rejects infrastructure and downstream domain imports", () => {
  for (const source of [
    'import { db } from "../../../db.js";',
    'import { policy } from "../../domain/policy/index.js";',
    'import { trust } from "../../domain/trust-status/index.js";',
    'import { repository } from "../../../repositories/attempt.js";',
    'import { workflow } from "../../../workflow/index.js";',
  ]) {
    expectFixtureViolation(
      "ATTEMPT_LIFECYCLE_CONTRACT_FORBIDDEN_DEPENDENCY",
      {
        file:
          "server/organization-verification/application/attempt-lifecycle-contract/forbidden.ts",
        source,
      },
    );
  }
});

test("Attempt Lifecycle contract rejects transition execution and hidden authority", () => {
  for (const source of [
    "transitionAttemptProcess(attempt, input);",
    "createAttemptForRevision(record, revision, input);",
    "const now = Date.now();",
    "const value = process.env.RUNTIME;",
    "const id = randomUUID();",
    'const state = "cancelled";',
    "const result: WorkflowCoordinator = input;",
  ]) {
    expectFixtureViolation(
      "ATTEMPT_LIFECYCLE_CONTRACT_FORBIDDEN_AUTHORITY",
      {
        file:
          "server/organization-verification/application/attempt-lifecycle-contract/executor.ts",
        source,
      },
    );
  }
});

test("Attempt Lifecycle contract protects private construction internals", () => {
  expectFixtureViolation("ATTEMPT_LIFECYCLE_CONTRACT_PUBLIC_EXPORT_LEAK", {
    file:
      "server/organization-verification/application/attempt-lifecycle-contract/index.ts",
    source:
      'export { lifecycleExecutionSeal, sealTransitionRecord, canonicalizeAttemptLifecycleValue } from "./internal.js";',
  });
});

test("Attempt Lifecycle contract remains unwired before Phase 8A runtime", () => {
  expectFixtureViolation("ATTEMPT_LIFECYCLE_CONTRACT_EXTERNAL_WIRING", {
    file: "server/organization-verification/application/runtime.ts",
    source:
      'import { execution } from "./attempt-lifecycle-contract/index.js";',
  });
});

test("Attempt Lifecycle runtime rejects infrastructure and downstream imports", () => {
  for (const source of [
    'import { db } from "../../../db.js";',
    'import { policy } from "../../domain/policy/index.js";',
    'import { workflow } from "../../../workflow/index.js";',
    'import { repository } from "../../../repositories/attempt.js";',
  ]) {
    expectFixtureViolation(
      "ATTEMPT_LIFECYCLE_RUNTIME_FORBIDDEN_DEPENDENCY",
      {
        file:
          "server/organization-verification/application/attempt-lifecycle-runtime/forbidden.ts",
        source,
      },
    );
  }
});

test("Attempt Lifecycle runtime restricts transition authority to its sole executor", () => {
  for (const source of [
    "transitionAttemptProcess(attempt, input);",
    "createAttemptForRevision(record, revision, input);",
    "const now = Date.now();",
    "const value = process.env.RUNTIME;",
    'const state = "retrying";',
  ]) {
    expectFixtureViolation(
      "ATTEMPT_LIFECYCLE_RUNTIME_FORBIDDEN_AUTHORITY",
      {
        file:
          "server/organization-verification/application/attempt-lifecycle-runtime/bypass.ts",
        source,
      },
    );
  }
});

test("Attempt Lifecycle runtime protects private execution internals", () => {
  expectFixtureViolation("ATTEMPT_LIFECYCLE_RUNTIME_PUBLIC_EXPORT_LEAK", {
    file:
      "server/organization-verification/application/attempt-lifecycle-runtime/index.ts",
    source:
      'export { runtimeExecutionSeal, createAttemptLifecycleTransitionExecutionInternal } from "./internal.js";',
  });
});

test("Attempt Lifecycle runtime remains unwired before Phase 8B", () => {
  expectFixtureViolation("ATTEMPT_LIFECYCLE_RUNTIME_EXTERNAL_WIRING", {
    file: "server/organization-verification/application/workflow.ts",
    source: 'import { runtime } from "./attempt-lifecycle-runtime/index.js";',
  });
});

test("Workflow contract rejects infrastructure and downstream imports", () => {
  for (const source of [
    'import { db } from "../../../db.js";',
    'import { repository } from "../../../repositories/workflow.js";',
    'import { provider } from "../../../providers/verification.js";',
    'import { eligibility } from "../../domain/eligibility/index.js";',
  ]) {
    expectFixtureViolation("WORKFLOW_CONTRACT_FORBIDDEN_DEPENDENCY", {
      file:
        "server/organization-verification/application/workflow-contract/forbidden.ts",
      source,
    });
  }
});

test("Workflow contract rejects authority execution and hidden inputs", () => {
  for (const source of [
    "executeOrganizationVerificationAttemptTransition(input);",
    "buildOrganizationVerificationEvidenceSnapshot(input);",
    "executeOrganizationVerificationPolicyEvaluation(input);",
    "executeOrganizationVerificationDecisionTrustIntegration(input);",
    "const now = Date.now();",
    "const value = process.env.WORKFLOW;",
    'const state = "approved";',
  ]) {
    expectFixtureViolation("WORKFLOW_CONTRACT_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/application/workflow-contract/bypass.ts",
      source,
    });
  }
});

test("Workflow contract protects private authenticity and fingerprint internals", () => {
  expectFixtureViolation("WORKFLOW_CONTRACT_PUBLIC_EXPORT_LEAK", {
    file:
      "server/organization-verification/application/workflow-contract/index.ts",
    source:
      'export { workflowExecutionSeal, fingerprintWorkflowValue } from "./internal.js";',
  });
});

test("Workflow contract remains unwired before Phase 8B.1", () => {
  expectFixtureViolation("WORKFLOW_CONTRACT_EXTERNAL_WIRING", {
    file: "server/organization-verification/application/coordinator.ts",
    source: 'import { workflow } from "./workflow-contract/index.js";',
  });
});

test("Workflow runtime rejects infrastructure and downstream dependencies", () => {
  for (const source of [
    'import { db } from "../../../db.js";',
    'import { repository } from "../../../repositories/workflow.js";',
    'import { provider } from "../../../providers/verification.js";',
    'import { eligibility } from "../../domain/eligibility/index.js";',
    'import { worker } from "../../../workers/verification.js";',
  ]) {
    expectFixtureViolation("WORKFLOW_RUNTIME_FORBIDDEN_DEPENDENCY", {
      file:
        "server/organization-verification/application/workflow-runtime/forbidden.ts",
      source,
    });
  }
});

test("Workflow runtime rejects hidden input, multi-step, and duplicated authority", () => {
  for (const source of [
    "const now = Date.now();",
    "const value = process.env.WORKFLOW;",
    "const id = randomUUID();",
    "while (pending) executeNext();",
    "const engine: WorkflowEngine = input;",
    "transitionAttemptProcess(attempt, input);",
    'const result = "verified";',
  ]) {
    expectFixtureViolation("WORKFLOW_RUNTIME_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/application/workflow-runtime/bypass.ts",
      source,
    });
  }
});

test("Workflow runtime restricts all six authorities to the sole executor", () => {
  expectFixtureViolation("WORKFLOW_RUNTIME_AUTHORITY_DISPATCH_VIOLATION", {
    file:
      "server/organization-verification/application/workflow-runtime/alternate.ts",
    source:
      "executeOrganizationVerificationPolicyEvaluation(input);",
  });
});

test("Workflow runtime protects private execution evidence and remains unwired", () => {
  expectFixtureViolation("WORKFLOW_RUNTIME_PUBLIC_EXPORT_LEAK", {
    file:
      "server/organization-verification/application/workflow-runtime/index.ts",
    source:
      'export { workflowStepExecutionSeal, createWorkflowStepExecutionInternal } from "./internal.js";',
  });
  expectFixtureViolation("WORKFLOW_RUNTIME_EXTERNAL_WIRING", {
    file: "server/organization-verification/application/api.ts",
    source: 'import { runtime } from "./workflow-runtime/index.js";',
  });
});

test("Persistence contracts reject technology and infrastructure dependencies", () => {
  for (const source of [
    'import { db } from "../../../db.js";',
    'import { sql } from "drizzle-orm";',
    'import fs from "node:fs";',
    'import { adapter } from "../../../infrastructure/persistence.js";',
    'import { provider } from "../../../providers/evidence.js";',
  ]) {
    expectFixtureViolation("PERSISTENCE_CONTRACT_FORBIDDEN_DEPENDENCY", {
      file:
        "server/organization-verification/application/persistence-contract/forbidden.ts",
      source,
    });
  }
});

test("Persistence contracts reject execution, replay, and hidden authority", () => {
  for (const source of [
    "executeOrganizationVerificationWorkflowStep(input);",
    "executeOrganizationVerificationPolicyEvaluation(input);",
    "const now = Date.now();",
    "const secret = process.env.DATABASE_URL;",
    "const engine: ReplayEngine = input;",
  ]) {
    expectFixtureViolation("PERSISTENCE_CONTRACT_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/application/persistence-contract/bypass.ts",
      source,
    });
  }
});

test("Persistence contracts reject repository and storage implementations", () => {
  for (const source of [
    "class PostgresRepository {}",
    "const sql = db.sql`select 1`;",
    "const records = new Map<string, unknown>();",
  ]) {
    expectFixtureViolation("PERSISTENCE_CONTRACT_IMPLEMENTATION", {
      file:
        "server/organization-verification/application/persistence-contract/implementation.ts",
      source,
    });
  }
});

test("Persistence contract public surface protects seals and canonical helpers", () => {
  expectFixtureViolation("PERSISTENCE_CONTRACT_PUBLIC_EXPORT_LEAK", {
    file:
      "server/organization-verification/application/persistence-contract/index.ts",
    source:
      'export { storedEvidenceSeal, fingerprintPersistenceContract } from "./internal.js";',
  });
});

test("Persistence ports remain unwired outside the authorized reference adapter", () => {
  expectFixtureViolation("PERSISTENCE_CONTRACT_EXTERNAL_WIRING", {
    file: "server/organization-verification/application/api.ts",
    source: 'import { repository } from "./persistence-contract/index.js";',
  });
});

test("In-memory persistence adapter rejects technology and infrastructure dependencies", () => {
  for (const source of [
    'import { db } from "../../../../db.js";',
    'import { sql } from "drizzle-orm";',
    'import fs from "node:fs";',
    "const secret = process.env.DATABASE_URL;",
    "const now = Date.now();",
    "const id = crypto.randomUUID();",
    "const unsafe = input as unknown as StoredEvidence;",
  ]) {
    expectFixtureViolation("PERSISTENCE_IN_MEMORY_FORBIDDEN_DEPENDENCY", {
      file:
        "server/organization-verification/infrastructure/persistence/in-memory/forbidden.ts",
      source,
    });
  }
});

test("In-memory persistence adapter rejects replay and business authority", () => {
  for (const source of [
    "executeOrganizationVerificationWorkflowStep(input);",
    "executeOrganizationVerificationPolicyEvaluation(input);",
    "const replay: ReplayEngine = input;",
    "const workflow: WorkflowEngine = input;",
    "const retry: RetryPolicy = input;",
    "const transaction: TransactionManager = input;",
  ]) {
    expectFixtureViolation("PERSISTENCE_IN_MEMORY_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/infrastructure/persistence/in-memory/forbidden.ts",
      source,
    });
  }
});

test("In-memory persistence adapter protects its internal store from public exports", () => {
  expectFixtureViolation("PERSISTENCE_IN_MEMORY_PUBLIC_EXPORT_LEAK", {
    file:
      "server/organization-verification/infrastructure/persistence/in-memory/index.ts",
    source:
      'export { streams, committedAppends, resetStore } from "./internal.js";',
  });
});

test("In-memory persistence adapter remains unwired from application runtime", () => {
  expectFixtureViolation("PERSISTENCE_IN_MEMORY_EXTERNAL_WIRING", {
    file: "server/organization-verification/application/api.ts",
    source:
      'import { createInMemoryOrganizationVerificationEvidenceRepository } from "../infrastructure/persistence/in-memory/index.js";',
  });
});

test("Replay runtime rejects infrastructure and adapter dependencies", () => {
  for (const source of [
    'import { db } from "../../../db.js";',
    'import { adapter } from "../../infrastructure/persistence/in-memory/index.js";',
    'import fs from "node:fs";',
    'import { runtime } from "../workflow-runtime/index.js";',
    "const secret = process.env.DATABASE_URL;",
    "const now = Date.now();",
    "const id = crypto.randomUUID();",
    "const unsafe = input as unknown as ReplayExecution;",
  ]) {
    expectFixtureViolation("REPLAY_RUNTIME_FORBIDDEN_DEPENDENCY", {
      file:
        "server/organization-verification/application/replay-runtime/forbidden.ts",
      source,
    });
  }
});

test("Replay runtime rejects business authority and automatic progression", () => {
  for (const source of [
    "executeOrganizationVerificationAttemptTransition(input);",
    "buildOrganizationVerificationEvidenceSnapshot(input);",
    "buildOrganizationVerificationEvaluationProjection(input);",
    "buildOrganizationVerificationPolicyEvaluationInput(input);",
    "executeOrganizationVerificationPolicyEvaluation(input);",
    "executeOrganizationVerificationDecisionTrustIntegration(input);",
    "executeOrganizationVerificationWorkflowStep(input);",
    "const engine: WorkflowEngine = input;",
    "const repair: ReplayRepair = input;",
    "const reducer: GenericReducer = input;",
  ]) {
    expectFixtureViolation("REPLAY_RUNTIME_FORBIDDEN_AUTHORITY", {
      file:
        "server/organization-verification/application/replay-runtime/forbidden.ts",
      source,
    });
  }
});

test("Replay runtime rejects persistence reads and writes", () => {
  for (const source of [
    "appendOrganizationVerificationEvidence(request);",
    "loadOrganizationVerificationEvidenceStream(request);",
    "createOrganizationVerificationStoredEvidence(input);",
    "const repository: OrganizationVerificationEvidenceRepositoryPort = input;",
  ]) {
    expectFixtureViolation("REPLAY_RUNTIME_PERSISTENCE_WRITE", {
      file:
        "server/organization-verification/application/replay-runtime/forbidden.ts",
      source,
    });
  }
});

test("Replay runtime protects private authenticity and fingerprint authority", () => {
  expectFixtureViolation("REPLAY_RUNTIME_PUBLIC_EXPORT_LEAK", {
    file:
      "server/organization-verification/application/replay-runtime/index.ts",
    source:
      'export { replayExecutionSeal, fingerprintOrganizationVerificationReplay, createReplayExecutionInternal } from "./internal.js";',
  });
});

test("Replay runtime remains unwired from API and startup", () => {
  expectFixtureViolation("REPLAY_RUNTIME_EXTERNAL_WIRING", {
    file: "server/organization-verification/application/api.ts",
    source:
      'import { replayOrganizationVerificationWorkflow } from "./replay-runtime/index.js";',
  });
});
