import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as evidenceSnapshot from "../evidence-snapshot/index.js";
import * as projection from "./index.js";

function value<T>(
  result:
    | evidenceSnapshot.EvidenceSnapshotDomainResult<T>
    | projection.EvaluationProjectionDomainResult<T>,
): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function evidence(
  id: string,
  revisionId: string,
  digest: string,
) {
  return {
    evidenceReferenceId: value(
      evidenceSnapshot.createEvidenceReferenceId(id),
    ),
    evidenceReferenceVersion: value(
      evidenceSnapshot.createEvidenceReferenceVersion("evidence-version-1"),
    ),
    revisionEvidenceReferenceId: revisionId as never,
    evidenceKind: value(
      evidenceSnapshot.createEvidenceKind("corporate.registration"),
    ),
    category: value(
      evidenceSnapshot.createEvidenceCategory("legal.identity"),
    ),
    sourceAuthority: value(
      evidenceSnapshot.createEvidenceSourceAuthority("customer.submission"),
    ),
    contentDigest: value(
      evidenceSnapshot.createEvidenceContentDigest(digest.repeat(64)),
    ),
    issuedAt: "2026-07-27T00:00:00.000Z",
    capturedAt: "2026-07-28T00:01:00.000Z",
    validFrom: "2025-01-01T00:00:00.000Z",
    validUntil: "2026-01-01T00:00:00.000Z",
    attributes: [
      { key: "zeta", value: "last" },
      { key: "alpha", value: "first" },
    ],
    provenanceReference: value(
      evidenceSnapshot.createEvidenceSnapshotProvenanceReference(
        `provenance-${id}`,
      ),
    ),
    correlationReference: value(
      evidenceSnapshot.createEvidenceSnapshotCorrelationReference(
        "correlation-projection-1",
      ),
    ),
    integrityReference: value(
      evidenceSnapshot.createEvidenceSnapshotIntegrityReference(
        `integrity-${id}`,
      ),
    ),
  } satisfies evidenceSnapshot.OrganizationVerificationSemanticEvidenceReferenceInput;
}

function authenticSnapshot(reverse = false) {
  const evidenceA = evidence("evidence-b", "revision-evidence-b", "b");
  const evidenceB = evidence("evidence-a", "revision-evidence-a", "a");
  const evidenceReferences = reverse
    ? [evidenceB, evidenceA]
    : [evidenceA, evidenceB];
  const context = value(
    evidenceSnapshot.createOrganizationVerificationEvidenceSnapshotConstructionContext(
      {
        evidenceSnapshotId: value(
          evidenceSnapshot.createEvidenceSnapshotId(
            "source-snapshot-projection-1",
          ),
        ),
        evidenceSnapshotVersion: value(
          evidenceSnapshot.createEvidenceSnapshotVersion("snapshot-version-1"),
        ),
        snapshotContractVersion:
          evidenceSnapshot.EVIDENCE_SNAPSHOT_CONTRACT_VERSION,
        snapshotBuilderVersion:
          evidenceSnapshot.EVIDENCE_SNAPSHOT_BUILDER_VERSION,
        manifestVersion: evidenceSnapshot.EVIDENCE_SNAPSHOT_MANIFEST_VERSION,
        organizationId: "org-projection-1" as never,
        recordId: "record-projection-1" as never,
        revisionId: "revision-projection-1" as never,
        profileRevisionId: "profile-projection-1" as never,
        createdAt: "2026-07-28T00:04:00.000Z",
        sourceCutoffAt: "2026-07-28T00:03:00.000Z",
        sourceSelectionCompletedAt: "2026-07-28T00:03:30.000Z",
        sourceComplete: true,
        sourceIntegrityValid: true,
        provenanceReference: value(
          evidenceSnapshot.createEvidenceSnapshotProvenanceReference(
            "provenance-snapshot-projection-1",
          ),
        ),
        correlationReference: value(
          evidenceSnapshot.createEvidenceSnapshotCorrelationReference(
            "correlation-projection-1",
          ),
        ),
        integrityReference: value(
          evidenceSnapshot.createEvidenceSnapshotIntegrityReference(
            "integrity-snapshot-projection-1",
          ),
        ),
      },
    ),
  );
  return value(
    evidenceSnapshot.buildOrganizationVerificationEvidenceSnapshot({
      context,
      registrySource: {
        profileRevision: {
          organizationId: "org-projection-1",
          organizationProfileRevisionId: "profile-projection-1",
          organizationProfileRevisionSequence: 1,
          organizationProfileFingerprint: "profile-fingerprint-projection-1",
          legalIdentityProjection: {
            legalName: "Synthetic Projection Entity",
            tradingNames: ["Zulu Synthetic", "Alpha Synthetic"],
            registrationJurisdiction: "ZZ",
            registrationIdentifiers: [
              { scheme: "zeta.registry", value: "Z-1" },
              { scheme: "alpha.registry", value: "A-1" },
            ],
            legalForm: "synthetic_form",
            incorporationDate: "2025-01-01",
            registeredAddress: {
              countryCode: "ZZ",
              locality: "Synthetic City",
              addressLines: ["Synthetic line"],
            },
          },
          organizationType: "synthetic_entity",
          jurisdiction: "ZZ",
          declaredActivityProjection: {
            activities: [
              { code: "z.activity", description: "Zulu activity" },
              { code: "a.activity", description: "Alpha activity" },
            ],
          },
          approvedDisclosureProjection: {
            legalName: "Public Synthetic Name",
          },
          organizationLifecycle: "suspended",
          registryContractVersion:
            "organization_registry_profile_revision.v1",
          publishedAt: "2026-07-28T00:00:00.000Z",
        } as never,
        provenanceReference: value(
          evidenceSnapshot.createEvidenceSnapshotProvenanceReference(
            "provenance-registry-projection-1",
          ),
        ),
        integrityReference: value(
          evidenceSnapshot.createEvidenceSnapshotIntegrityReference(
            "integrity-registry-projection-1",
          ),
        ),
      },
      submissionSource: {
        revision: {
          organizationId: "org-projection-1",
          recordId: "record-projection-1",
          revisionId: "revision-projection-1",
          profileRevisionId: "profile-projection-1",
          profileRevisionSequence: 1,
          profileFingerprint: "profile-fingerprint-projection-1",
          sequence: 1,
          declaredInputs: {
            sections: [
              {
                key: "zeta",
                values: [{ key: "z", value: "last" }],
              },
              {
                key: "alpha",
                values: [
                  { key: "b", value: "second" },
                  { key: "a", value: "first" },
                ],
              },
            ],
          },
          evidenceReferenceIds: [
            "revision-evidence-b",
            "revision-evidence-a",
          ],
          submissionActorAuthorityReference: {
            actorId: "actor-projection-1",
            authorityReferenceId: "authority-projection-1",
            authorityVersion: "authority.v1",
            organizationScope: "org-projection-1",
            issuedAt: "2026-07-28T00:00:00.000Z",
            delegatedScopes: ["organization.verification.submit"],
          },
          submittedAt: "2026-07-28T00:02:00.000Z",
          submissionIdempotencyKey: "submission-projection-1",
          correlationId: "correlation-projection-1",
        } as never,
        verificationSourceContractVersion:
          evidenceSnapshot.VERIFICATION_REVISION_SOURCE_CONTRACT_VERSION,
        provenanceReference: value(
          evidenceSnapshot.createEvidenceSnapshotProvenanceReference(
            "provenance-submission-projection-1",
          ),
        ),
        integrityReference: value(
          evidenceSnapshot.createEvidenceSnapshotIntegrityReference(
            "integrity-submission-projection-1",
          ),
        ),
      },
      evidenceReferences,
    }),
  );
}

function context() {
  return value(
    projection.createOrganizationVerificationEvaluationProjectionConstructionContext(
      {
        evaluationProjectionId: value(
          projection.createEvaluationProjectionId("evaluation-projection-1"),
        ),
        evaluationProjectionVersion: value(
          projection.createEvaluationProjectionVersion(
            "evaluation-projection-version-1",
          ),
        ),
        projectionContractVersion:
          projection.EVALUATION_PROJECTION_CONTRACT_VERSION,
        projectionBuilderVersion:
          projection.EVALUATION_PROJECTION_BUILDER_VERSION,
        projectionSchemaVersion:
          projection.EVALUATION_PROJECTION_SCHEMA_VERSION,
        projectedAt: "2026-07-28T00:05:00.000Z",
        provenanceReference: value(
          projection.createEvaluationProjectionProvenanceReference(
            "provenance-evaluation-projection-1",
          ),
        ),
        integrityReference: value(
          projection.createEvaluationProjectionIntegrityReference(
            "integrity-evaluation-projection-1",
          ),
        ),
      },
    ),
  );
}

function build(reverse = false) {
  return projection.buildOrganizationVerificationEvaluationProjection({
    context: context(),
    evidenceSnapshot: authenticSnapshot(reverse),
  });
}

test("builds one authentic capability-scoped Evaluation Projection", () => {
  const result = build();
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.identity.organizationId, "org-projection-1");
  assert.equal(result.value.identity.recordId, "record-projection-1");
  assert.equal(
    result.value.source.evidenceSnapshotId,
    "source-snapshot-projection-1",
  );
  assert.match(result.value.projectionFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(
    projection.isOrganizationVerificationEvaluationProjection(result.value),
    true,
  );
});

for (const invalid of ["", " ", "latest", "current", "head", "default"]) {
  test(`rejects invalid or mutable Projection ID: ${JSON.stringify(invalid)}`, () => {
    assert.equal(projection.createEvaluationProjectionId(invalid).ok, false);
  });
}

test("requires exact Projection contract, Builder, and schema versions", () => {
  assert.equal(
    projection.parseEvaluationProjectionContractVersion(
      projection.EVALUATION_PROJECTION_CONTRACT_VERSION,
    ).ok,
    true,
  );
  assert.equal(
    projection.parseEvaluationProjectionBuilderVersion(
      projection.EVALUATION_PROJECTION_BUILDER_VERSION,
    ).ok,
    true,
  );
  assert.equal(
    projection.parseEvaluationProjectionSchemaVersion(
      projection.EVALUATION_PROJECTION_SCHEMA_VERSION,
    ).ok,
    true,
  );
  for (const invalid of ["v0", "v2", "latest", undefined]) {
    assert.equal(
      projection.parseEvaluationProjectionContractVersion(invalid).ok,
      false,
    );
    assert.equal(
      projection.parseEvaluationProjectionBuilderVersion(invalid).ok,
      false,
    );
    assert.equal(
      projection.parseEvaluationProjectionSchemaVersion(invalid).ok,
      false,
    );
  }
});

test("rejects a fabricated Evidence Snapshot even when deeply frozen", () => {
  const result =
    projection.buildOrganizationVerificationEvaluationProjection({
      context: context(),
      evidenceSnapshot: Object.freeze({
        evidenceSnapshotId: "source-snapshot-projection-1",
      }) as never,
    });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "unauthentic_evidence_snapshot");
});

test("rejects a mutable Projection construction context", () => {
  const result =
    projection.buildOrganizationVerificationEvaluationProjection({
      context: { ...context() },
      evidenceSnapshot: authenticSnapshot(),
    });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.code,
      "evaluation_projection_construction_failure",
    );
  }
});

test("Projection is deeply immutable and defensively copied", () => {
  const source = authenticSnapshot();
  const result = value(
    projection.buildOrganizationVerificationEvaluationProjection({
      context: context(),
      evidenceSnapshot: source,
    }),
  );
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.registryFacts), true);
  assert.equal(Object.isFrozen(result.registryFacts.legalIdentity), true);
  assert.equal(
    Object.isFrozen(result.registryFacts.legalIdentity.tradingNames),
    true,
  );
  assert.equal(Object.isFrozen(result.submissionFacts.declaredSections), true);
  assert.equal(Object.isFrozen(result.evidenceFacts), true);
  assert.equal(Object.isFrozen(result.evidenceFacts[0]!.attributes), true);
  assert.notEqual(
    result.evidenceFacts,
    source.evidenceProjections,
  );
  assert.notEqual(
    result.registryFacts.legalIdentity,
    source.registryProjection.legalIdentity,
  );
});

test("canonical ordering is stable across every exposed collection", () => {
  const result = value(build());
  assert.deepEqual(result.registryFacts.legalIdentity.tradingNames, [
    "Alpha Synthetic",
    "Zulu Synthetic",
  ]);
  assert.deepEqual(
    result.registryFacts.legalIdentity.registrationIdentifiers.map(
      (item) => item.scheme,
    ),
    ["alpha.registry", "zeta.registry"],
  );
  assert.deepEqual(
    result.registryFacts.declaredActivities.map((item) => item.code),
    ["a.activity", "z.activity"],
  );
  assert.deepEqual(
    result.submissionFacts.declaredSections.map((item) => item.key),
    ["alpha", "zeta"],
  );
  assert.deepEqual(
    result.evidenceFacts.map((item) => item.evidenceReferenceId),
    ["evidence-a", "evidence-b"],
  );
  assert.deepEqual(
    result.evidenceFacts[0]!.attributes.map((item) => item.key),
    ["alpha", "zeta"],
  );
});

test("Snapshot input ordering cannot alter Projection semantics or fingerprint", () => {
  const left = value(build(false));
  const right = value(build(true));
  assert.deepEqual(left, right);
  assert.equal(left.projectionFingerprint, right.projectionFingerprint);
});

test("identical construction is deterministic", () => {
  const left = value(build());
  const right = value(build());
  assert.equal(left.projectionFingerprint, right.projectionFingerprint);
  assert.deepEqual(left, right);
});

test("expected Projection fingerprint mismatch fails closed", () => {
  const base = context();
  const result =
    projection.buildOrganizationVerificationEvaluationProjection({
      context: Object.freeze({
        ...base,
        expectedProjectionFingerprint: "f".repeat(64) as never,
      }),
      evidenceSnapshot: authenticSnapshot(),
    });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "evaluation_projection_fingerprint_mismatch");
  }
});

test("Projection time cannot predate its source Snapshot", () => {
  const base = context();
  const result =
    projection.buildOrganizationVerificationEvaluationProjection({
      context: Object.freeze({
        ...base,
        projectedAt: "2026-07-28T00:03:00.000Z",
      }),
      evidenceSnapshot: authenticSnapshot(),
    });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "invalid_evaluation_projection_timestamp");
  }
});

for (const forbidden of [
  "sourceManifest",
  "manifestVersion",
  "snapshotBuilderVersion",
  "sourceCutoffAt",
  "sourceComplete",
  "sourceIntegrityValid",
  "sourceLifecycle",
  "approvedDisclosure",
  "submissionActorAuthorityReference",
  "submissionIdempotencyKey",
  "correlationId",
  "supersedesRevisionId",
  "projectionVersion",
  "registryContractVersion",
  "verificationSourceContractVersion",
  "internalIntegrity",
  "constructionContext",
  "authenticitySeal",
]) {
  test(`structurally redacts Snapshot implementation detail: ${forbidden}`, () => {
    const serialized = JSON.stringify(value(build()));
    assert.equal(serialized.includes(`"${forbidden}"`), false);
  });
}

for (const forbidden of [
  "hasLicense",
  "documentExpired",
  "supportedJurisdiction",
  "eligible",
  "compliant",
  "valid",
  "authentic",
  "trusted",
  "risk",
  "finding",
  "decision",
  "trustStatus",
  "policyResult",
  "classification",
  "reviewerStatus",
  "workflowState",
]) {
  test(`performs no prohibited business inference or authority: ${forbidden}`, () => {
    const serialized = JSON.stringify(value(build()));
    assert.equal(serialized.includes(`"${forbidden}"`), false);
  });
}

test("expired evidence is exposed as supplied times without interpretation", () => {
  const result = value(build());
  assert.equal(
    result.evidenceFacts[0]!.validUntil,
    "2026-01-01T00:00:00.000Z",
  );
  assert.equal("documentExpired" in result.evidenceFacts[0]!, false);
});

test("Registry Lifecycle is omitted rather than interpreted", () => {
  const result = value(build());
  assert.equal("sourceLifecycle" in result.registryFacts, false);
  assert.equal("trusted" in result.registryFacts, false);
});

test("public surface exposes the Builder and guard but no internals or export star", () => {
  const publicSurface = projection as Record<string, unknown>;
  assert.equal(
    typeof publicSurface.buildOrganizationVerificationEvaluationProjection,
    "function",
  );
  assert.equal(
    typeof publicSurface.isOrganizationVerificationEvaluationProjection,
    "function",
  );
  for (const forbidden of [
    "evaluationProjectionSeal",
    "createOrganizationVerificationEvaluationProjectionInternal",
    "computeEvaluationProjectionFingerprintInternal",
    "canonical",
  ]) {
    assert.equal(forbidden in publicSurface, false);
  }
  const indexSource = fs.readFileSync(
    new URL("./index.ts", import.meta.url),
    "utf8",
  );
  assert.equal(/export\s+\*\s+from/.test(indexSource), false);
});

test("Projection output contains no Evaluation Input", () => {
  const result = value(build());
  assert.equal("evaluationInput" in result, false);
  assert.equal("policyEvaluationInput" in result, false);
});
