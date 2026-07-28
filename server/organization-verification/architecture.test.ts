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
  | "REGISTRY_ACL_IMPORTS_RUNTIME";

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

test("production source satisfies every Phase 7B-1 architecture rule", () => {
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
