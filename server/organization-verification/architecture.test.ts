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
  | "FROZEN_DOMAIN_IMPORTS_EVALUATION_PROJECTION";

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
  const isOrganizationVerificationCoreDomain =
    lowerFile.startsWith("server/organization-verification/domain/") &&
    !isDecisionDomain &&
    !isTrustStatusDomain &&
    !isPolicyDomain &&
    !isEvidenceSnapshotDomain &&
    !isEvaluationProjectionDomain;
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
