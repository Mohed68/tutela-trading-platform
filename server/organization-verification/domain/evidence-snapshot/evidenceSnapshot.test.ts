import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  REGISTRY_CONTRACT_VERSION,
  createOrganizationId,
  createOrganizationProfileFingerprint,
  createOrganizationProfileRevisionId,
  createOrganizationProfileRevisionSequence,
  parseActorAuthorityReference,
  parseOrganizationProfileRevisionContract,
} from "../../../organization-registry/index.js";
import {
  attachDraftToRecord,
  createCorrelationId,
  createDraftForRecord,
  createDraftVersion,
  createOrganizationEvidenceReferenceId,
  createOrganizationVerificationDraftId,
  createOrganizationVerificationRecord,
  createOrganizationVerificationRecordId,
  createOrganizationVerificationRevisionId,
  createSubmissionIdempotencyKey,
  createVerificationRevisionSequence,
  submitDraftToRevision,
  type CoreDomainResult,
} from "../index.js";
import * as snapshot from "./index.js";

function coreValue<T>(result: CoreDomainResult<T>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function snapshotValue<T>(result: snapshot.EvidenceSnapshotDomainResult<T>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function registryContract(lifecycle = "active") {
  const result = parseOrganizationProfileRevisionContract({
    organization_id: "org-snapshot-1",
    organization_profile_revision_id: "profile-snapshot-1",
    organization_profile_revision_sequence: 1,
    organization_profile_fingerprint: "profile-fingerprint-1",
    legal_identity_projection: {
      legal_name: "Synthetic Snapshot Entity",
      trading_names: ["Synthetic Trading"],
      registration_jurisdiction: "ZZ",
      registration_identifiers: [
        { scheme: "synthetic.registry", value: "SYN-001" },
      ],
      registered_address: {
        country_code: "ZZ",
        address_lines: ["Synthetic address"],
      },
    },
    organization_type: "synthetic_entity",
    jurisdiction: "ZZ",
    declared_activity_projection: {
      activities: [{ code: "synthetic.trade", description: "Synthetic trade" }],
    },
    organization_lifecycle: lifecycle,
    registry_contract_version: REGISTRY_CONTRACT_VERSION,
    published_at: "2026-07-28T00:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function revisionFixture() {
  const organizationId = coreValue(createOrganizationId("org-snapshot-1"));
  const profileRevisionId = coreValue(
    createOrganizationProfileRevisionId("profile-snapshot-1"),
  );
  const profileRevisionSequence = coreValue(
    createOrganizationProfileRevisionSequence(1),
  );
  const profileFingerprint = coreValue(
    createOrganizationProfileFingerprint("profile-fingerprint-1"),
  );
  const authorityResult = parseActorAuthorityReference({
    actor_id: "actor-synthetic-1",
    authority_reference_id: "authority-synthetic-1",
    authority_version: "authority.v1",
    organization_scope: "org-snapshot-1",
    issued_at: "2026-07-28T00:00:00.000Z",
    delegated_scopes: ["organization.verification.submit"],
  });
  assert.equal(authorityResult.ok, true);
  if (!authorityResult.ok) throw new Error(authorityResult.code);
  const record = coreValue(
    createOrganizationVerificationRecord({
      recordId: coreValue(
        createOrganizationVerificationRecordId("record-snapshot-1"),
      ),
      organizationId,
      createdAt: "2026-07-28T00:00:00.000Z",
    }),
  );
  const evidenceId = coreValue(
    createOrganizationEvidenceReferenceId("revision-evidence-1"),
  );
  const draft = coreValue(
    createDraftForRecord(record, {
      draftId: coreValue(
        createOrganizationVerificationDraftId("draft-snapshot-1"),
      ),
      organizationId,
      profileRevisionId,
      profileRevisionSequence,
      profileFingerprint,
      declaredInputs: {
        sections: [
          {
            key: "organization",
            values: [{ key: "statement", value: "synthetic" }],
          },
        ],
      },
      evidenceReferenceIds: [evidenceId],
      draftVersion: coreValue(createDraftVersion(1)),
      at: "2026-07-28T00:01:00.000Z",
      actorAuthorityReference: authorityResult.value,
    }),
  );
  const attached = coreValue(attachDraftToRecord(record, draft));
  const submitted = coreValue(
    submitDraftToRevision(attached, draft, {
      draftId: draft.draftId,
      expectedDraftVersion: draft.draftVersion,
      revisionId: coreValue(
        createOrganizationVerificationRevisionId("revision-snapshot-1"),
      ),
      revisionSequence: coreValue(createVerificationRevisionSequence(1)),
      profileRevisionId,
      profileRevisionSequence,
      profileFingerprint,
      submissionActorAuthorityReference: authorityResult.value,
      submittedAt: "2026-07-28T00:02:00.000Z",
      submissionIdempotencyKey: coreValue(
        createSubmissionIdempotencyKey("submission-snapshot-1"),
      ),
      correlationId: coreValue(createCorrelationId("correlation-snapshot-1")),
    }),
  );
  return { revision: submitted.revision, evidenceId };
}

function evidenceInput() {
  const { evidenceId } = revisionFixture();
  return {
    evidenceReferenceId: snapshotValue(
      snapshot.createEvidenceReferenceId("evidence-snapshot-1"),
    ),
    evidenceReferenceVersion: snapshotValue(
      snapshot.createEvidenceReferenceVersion("evidence-version-1"),
    ),
    revisionEvidenceReferenceId: evidenceId,
    evidenceKind: snapshotValue(
      snapshot.createEvidenceKind("corporate.registration"),
    ),
    category: snapshotValue(
      snapshot.createEvidenceCategory("legal.identity"),
    ),
    sourceAuthority: snapshotValue(
      snapshot.createEvidenceSourceAuthority("customer.submission"),
    ),
    contentDigest: snapshotValue(
      snapshot.createEvidenceContentDigest("a".repeat(64)),
    ),
    issuedAt: "2026-07-27T00:00:00.000Z",
    capturedAt: "2026-07-28T00:01:30.000Z",
    validFrom: "2025-01-01T00:00:00.000Z",
    validUntil: "2026-01-01T00:00:00.000Z",
    attributes: [{ key: "document_class", value: "synthetic" }],
    provenanceReference: snapshotValue(
      snapshot.createEvidenceSnapshotProvenanceReference(
        "provenance-evidence-1",
      ),
    ),
    correlationReference: snapshotValue(
      snapshot.createEvidenceSnapshotCorrelationReference(
        "correlation-snapshot-1",
      ),
    ),
    integrityReference: snapshotValue(
      snapshot.createEvidenceSnapshotIntegrityReference(
        "integrity-evidence-1",
      ),
    ),
  } satisfies snapshot.OrganizationVerificationSemanticEvidenceReferenceInput;
}

function context(snapshotId = "evidence-snapshot-record-1", attempt = false) {
  return snapshotValue(
    snapshot.createOrganizationVerificationEvidenceSnapshotConstructionContext({
      evidenceSnapshotId: snapshotValue(
        snapshot.createEvidenceSnapshotId(snapshotId),
      ),
      evidenceSnapshotVersion: snapshotValue(
        snapshot.createEvidenceSnapshotVersion("snapshot-version-1"),
      ),
      snapshotContractVersion: snapshot.EVIDENCE_SNAPSHOT_CONTRACT_VERSION,
      snapshotBuilderVersion: snapshot.EVIDENCE_SNAPSHOT_BUILDER_VERSION,
      manifestVersion: snapshot.EVIDENCE_SNAPSHOT_MANIFEST_VERSION,
      organizationId: "org-snapshot-1" as never,
      recordId: "record-snapshot-1" as never,
      revisionId: "revision-snapshot-1" as never,
      profileRevisionId: "profile-snapshot-1" as never,
      createdAt: "2026-07-28T00:04:00.000Z",
      sourceCutoffAt: "2026-07-28T00:03:00.000Z",
      sourceSelectionCompletedAt: "2026-07-28T00:03:30.000Z",
      ...(attempt
        ? {
            attemptBinding: {
              attemptId: "attempt-snapshot-1" as never,
              attemptCreatedAt: "2026-07-28T00:03:00.000Z",
            },
          }
        : {}),
      sourceComplete: true,
      sourceIntegrityValid: true,
      provenanceReference: snapshotValue(
        snapshot.createEvidenceSnapshotProvenanceReference(
          "provenance-snapshot-1",
        ),
      ),
      correlationReference: snapshotValue(
        snapshot.createEvidenceSnapshotCorrelationReference(
          "correlation-snapshot-1",
        ),
      ),
      integrityReference: snapshotValue(
        snapshot.createEvidenceSnapshotIntegrityReference(
          "integrity-snapshot-1",
        ),
      ),
    }),
  );
}

function buildInput(options?: {
  readonly snapshotId?: string;
  readonly attempt?: boolean;
  readonly lifecycle?: string;
  readonly evidence?: readonly snapshot.OrganizationVerificationSemanticEvidenceReferenceInput[];
  readonly existingSnapshot?: unknown;
}) {
  const revision = revisionFixture().revision;
  return {
    context: context(options?.snapshotId, options?.attempt),
    registrySource: {
      profileRevision: registryContract(options?.lifecycle),
      provenanceReference: snapshotValue(
        snapshot.createEvidenceSnapshotProvenanceReference(
          "provenance-registry-1",
        ),
      ),
      integrityReference: snapshotValue(
        snapshot.createEvidenceSnapshotIntegrityReference(
          "integrity-registry-1",
        ),
      ),
    },
    submissionSource: {
      revision,
      verificationSourceContractVersion:
        snapshot.VERIFICATION_REVISION_SOURCE_CONTRACT_VERSION,
      provenanceReference: snapshotValue(
        snapshot.createEvidenceSnapshotProvenanceReference(
          "provenance-submission-1",
        ),
      ),
      integrityReference: snapshotValue(
        snapshot.createEvidenceSnapshotIntegrityReference(
          "integrity-submission-1",
        ),
      ),
    },
    evidenceReferences: options?.evidence ?? [evidenceInput()],
    ...(options && "existingSnapshot" in options
      ? { existingSnapshot: options.existingSnapshot }
      : {}),
  } satisfies snapshot.BuildOrganizationVerificationEvidenceSnapshotInput;
}

function build(
  options?: Parameters<typeof buildInput>[0],
): snapshot.EvidenceSnapshotDomainResult<snapshot.OrganizationVerificationEvidenceSnapshot> {
  return snapshot.buildOrganizationVerificationEvidenceSnapshot(
    buildInput(options),
  );
}

test("builds one exact, authentic, deeply immutable Evidence Snapshot", () => {
  const result = build();
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.snapshotContractVersion, snapshot.EVIDENCE_SNAPSHOT_CONTRACT_VERSION);
  assert.equal(result.value.snapshotBuilderVersion, snapshot.EVIDENCE_SNAPSHOT_BUILDER_VERSION);
  assert.equal(result.value.manifestVersion, snapshot.EVIDENCE_SNAPSHOT_MANIFEST_VERSION);
  assert.equal(result.value.sourceComplete, true);
  assert.equal(result.value.sourceIntegrityValid, true);
  assert.equal(result.value.evidenceReferences.length, 1);
  assert.match(result.value.sourceDigest, /^[a-f0-9]{64}$/);
  assert.match(result.value.snapshotFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.registryProjection.legalIdentity), true);
  assert.equal(Object.isFrozen(result.value.evidenceProjections[0]!.attributes), true);
  assert.equal("decision" in result.value, false);
  assert.equal("trustStatus" in result.value, false);
  assert.equal("findings" in result.value, false);
  assert.equal("policy" in result.value, false);
});

for (const invalid of ["", " ", "latest", "current", "head", "default"]) {
  test(`rejects invalid or mutable Snapshot ID: ${JSON.stringify(invalid)}`, () => {
    assert.equal(snapshot.createEvidenceSnapshotId(invalid).ok, false);
  });
}

test("accepts exact versions and rejects every unknown version", () => {
  assert.equal(snapshot.parseEvidenceSnapshotContractVersion(snapshot.EVIDENCE_SNAPSHOT_CONTRACT_VERSION).ok, true);
  assert.equal(snapshot.parseEvidenceSnapshotBuilderVersion(snapshot.EVIDENCE_SNAPSHOT_BUILDER_VERSION).ok, true);
  assert.equal(snapshot.parseEvidenceSnapshotManifestVersion(snapshot.EVIDENCE_SNAPSHOT_MANIFEST_VERSION).ok, true);
  for (const invalid of ["v0", "v2", "latest", undefined]) {
    assert.equal(snapshot.parseEvidenceSnapshotContractVersion(invalid).ok, false);
    assert.equal(snapshot.parseEvidenceSnapshotBuilderVersion(invalid).ok, false);
    assert.equal(snapshot.parseEvidenceSnapshotManifestVersion(invalid).ok, false);
  }
});

test("validates semantic Evidence Reference identities, tokens, and SHA-256 digest", () => {
  assert.equal(snapshot.createEvidenceReferenceId(" ").ok, false);
  assert.equal(snapshot.createEvidenceReferenceVersion("current").ok, false);
  assert.equal(snapshot.createEvidenceKind("UPPER CASE").ok, false);
  assert.equal(snapshot.createEvidenceCategory("bad category").ok, false);
  assert.equal(snapshot.createEvidenceSourceAuthority("provider/url").ok, false);
  assert.equal(snapshot.createEvidenceContentDigest("not-a-digest").ok, false);
});

test("rejects duplicate, conflicting, version-conflicting, and digest-conflicting references", () => {
  const first = evidenceInput();
  const duplicate = build({ evidence: [first, first] });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.code, "duplicate_evidence_reference");

  const conflict = build({
    evidence: [first, { ...first, sourceAuthority: snapshotValue(snapshot.createEvidenceSourceAuthority("registry.source")) }],
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.code, "conflicting_evidence_reference");

  const version = build({
    evidence: [first, { ...first, evidenceReferenceVersion: snapshotValue(snapshot.createEvidenceReferenceVersion("evidence-version-2")) }],
  });
  assert.equal(version.ok, false);
  if (!version.ok) assert.equal(version.code, "evidence_version_mismatch");

  const digest = build({
    evidence: [first, { ...first, contentDigest: snapshotValue(snapshot.createEvidenceContentDigest("b".repeat(64))) }],
  });
  assert.equal(digest.ok, false);
  if (!digest.ok) assert.equal(digest.code, "evidence_digest_mismatch");
});

test("rejects missing and unauthorized revision Evidence References", () => {
  const missing = build({ evidence: [] });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, "required_evidence_reference_missing");
  const first = evidenceInput();
  const extra = {
    ...first,
    evidenceReferenceId: snapshotValue(snapshot.createEvidenceReferenceId("evidence-extra")),
    revisionEvidenceReferenceId: "revision-evidence-extra" as never,
  };
  const result = build({ evidence: [first, extra] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "unauthorized_evidence_reference");
});

test("canonical ordering makes caller input ordering semantically irrelevant", () => {
  const first = evidenceInput();
  const second = {
    ...first,
    evidenceReferenceId: snapshotValue(snapshot.createEvidenceReferenceId("aaa-evidence")),
    revisionEvidenceReferenceId: "revision-evidence-2" as never,
  };
  const revision = revisionFixture().revision;
  const twoIdsRevision = {
    ...revision,
    evidenceReferenceIds: Object.freeze([
      first.revisionEvidenceReferenceId,
      second.revisionEvidenceReferenceId,
    ]),
  };
  const a = buildInput({ evidence: [first, second] });
  const b = buildInput({ evidence: [second, first] });
  a.submissionSource = { ...a.submissionSource, revision: twoIdsRevision } as never;
  b.submissionSource = { ...b.submissionSource, revision: twoIdsRevision } as never;
  const left = snapshotValue(snapshot.buildOrganizationVerificationEvidenceSnapshot(a));
  const right = snapshotValue(snapshot.buildOrganizationVerificationEvidenceSnapshot(b));
  assert.deepEqual(left.evidenceReferences, right.evidenceReferences);
  assert.equal(left.sourceDigest, right.sourceDigest);
  assert.equal(left.snapshotFingerprint, right.snapshotFingerprint);
});

test("copies source facts and nested evidence attributes defensively", () => {
  const evidence = evidenceInput();
  const attributes = evidence.attributes as Array<{ key: string; value: string }>;
  const built = snapshotValue(build({ evidence: [evidence] }));
  attributes[0]!.value = "mutated";
  assert.equal(built.evidenceProjections[0]!.attributes[0]!.value, "synthetic");
});

test("retains evidence times exactly and permits structurally expired evidence", () => {
  const built = snapshotValue(build());
  assert.equal(built.evidenceProjections[0]!.validUntil, "2026-01-01T00:00:00.000Z");
  assert.equal(built.evidenceProjections[0]!.issuedAt, "2026-07-27T00:00:00.000Z");
});

test("rejects evidence captured after Snapshot creation", () => {
  const evidence = evidenceInput();
  const result = build({ evidence: [{ ...evidence, capturedAt: "2026-07-29T00:00:00.000Z" }] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "invalid_snapshot_chronology");
});

test("Registry Lifecycle is retained as a fact and has no completeness or trust authority", () => {
  for (const lifecycle of ["active", "suspended"]) {
    const built = snapshotValue(build({ lifecycle }));
    assert.equal(built.registryProjection.sourceLifecycle, lifecycle);
    assert.equal(built.sourceComplete, true);
    assert.equal("trusted" in built, false);
  }
});

test("rejects Organization, Record, Revision, and Profile chain mismatches", () => {
  const cases = [
    ["organization_id_mismatch", { organizationId: "org-other" }],
    ["verification_record_id_mismatch", { recordId: "record-other" }],
    ["verification_revision_id_mismatch", { revisionId: "revision-other" }],
    ["profile_revision_id_mismatch", { profileRevisionId: "profile-other" }],
  ] as const;
  for (const [expected, mutation] of cases) {
    const input = buildInput();
    input.context = Object.freeze({ ...input.context, ...mutation }) as never;
    const result = snapshot.buildOrganizationVerificationEvidenceSnapshot(input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, expected);
  }
});

test("Attempt binding is explicit, chronological, immutable, and performs no transition", () => {
  const built = snapshotValue(build({ attempt: true }));
  assert.equal(built.attemptBinding?.attemptId, "attempt-snapshot-1");
  assert.equal("processState" in built, false);
  const unbound = snapshotValue(build());
  assert.equal(unbound.attemptBinding, undefined);
});

test("identical construction is idempotent and returns the authentic existing instance", () => {
  const existing = snapshotValue(build());
  const result = build({ existingSnapshot: existing });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value, existing);
});

test("arbitrary objects cannot impersonate an existing Snapshot", () => {
  const result = build({ existingSnapshot: Object.freeze({ evidenceSnapshotId: "evidence-snapshot-record-1" }) });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "unauthentic_evidence_snapshot");
});

test("same Snapshot ID with changed semantics fails as conflict", () => {
  const existing = snapshotValue(build());
  const changed = evidenceInput();
  changed.attributes = [{ key: "document_class", value: "changed" }] as never;
  const result = build({ evidence: [changed], existingSnapshot: existing });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "conflicting_evidence_snapshot");
});

test("same semantic Snapshot under a different ID fails as duplicate", () => {
  const existing = snapshotValue(build());
  const result = build({ snapshotId: "evidence-snapshot-record-2", existingSnapshot: existing });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "duplicate_evidence_snapshot");
});

test("expected digest and fingerprint mismatches fail closed", () => {
  const base = buildInput();
  base.context = Object.freeze({
    ...base.context,
    expectedSourceDigest: "b".repeat(64) as never,
  });
  const digest = snapshot.buildOrganizationVerificationEvidenceSnapshot(base);
  assert.equal(digest.ok, false);
  if (!digest.ok) assert.equal(digest.code, "snapshot_fingerprint_mismatch");

  const fingerprintInput = buildInput();
  fingerprintInput.context = Object.freeze({
    ...fingerprintInput.context,
    expectedSnapshotFingerprint: "c".repeat(64) as never,
  });
  const fingerprint = snapshot.buildOrganizationVerificationEvidenceSnapshot(fingerprintInput);
  assert.equal(fingerprint.ok, false);
  if (!fingerprint.ok) assert.equal(fingerprint.code, "snapshot_fingerprint_mismatch");
});

for (const field of [
  "rawBytes",
  "base64",
  "storagePath",
  "signedUrl",
  "providerPayload",
  "ocrOutput",
  "aiOutput",
  "databaseRow",
  "request",
  "session",
  "decision",
  "trustStatus",
  "finding",
  "policyClassification",
  "eligibility",
  "reviewerComment",
  "usersVerified",
  "offerVerification",
]) {
  test(`public Snapshot structurally excludes forbidden authority or payload: ${field}`, () => {
    assert.equal(field in snapshotValue(build()), false);
  });
}

test("public surface exposes Builder but no seal, constructor, reader, or canonicalizer", () => {
  const publicSurface = snapshot as Record<string, unknown>;
  assert.equal(typeof publicSurface.buildOrganizationVerificationEvidenceSnapshot, "function");
  for (const forbidden of [
    "evidenceSnapshotSeal",
    "createOrganizationVerificationEvidenceSnapshotInternal",
    "readOrganizationVerificationEvidenceSnapshotInternal",
    "canonicalizeEvidenceSnapshotValueInternal",
    "computeEvidenceSnapshotFingerprintInternal",
    "freezeOrganizationVerificationEvidenceSet",
  ]) {
    assert.equal(forbidden in publicSurface, false, forbidden);
  }
  const indexSource = fs.readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  assert.equal(/export\s+\*\s+from/.test(indexSource), false);
});

const identityFactoryCases = [
  ["Snapshot ID", snapshot.createEvidenceSnapshotId, "snapshot-id-exact"],
  ["Snapshot version", snapshot.createEvidenceSnapshotVersion, "snapshot-version-exact"],
  ["Snapshot integrity", snapshot.createEvidenceSnapshotIntegrityReference, "integrity-exact"],
  ["Snapshot provenance", snapshot.createEvidenceSnapshotProvenanceReference, "provenance-exact"],
  ["Snapshot correlation", snapshot.createEvidenceSnapshotCorrelationReference, "correlation-exact"],
  ["Evidence ID", snapshot.createEvidenceReferenceId, "evidence-id-exact"],
  ["Evidence version", snapshot.createEvidenceReferenceVersion, "evidence-version-exact"],
] as const;
for (const [label, factory, input] of identityFactoryCases) {
  test(`constructs an exact opaque ${label}`, () => {
    const result = factory(input);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value, input);
  });
}

const tokenFactoryCases = [
  ["Evidence kind", snapshot.createEvidenceKind, "document.registration"],
  ["Evidence category", snapshot.createEvidenceCategory, "legal.identity"],
  ["Evidence authority", snapshot.createEvidenceSourceAuthority, "registry.authority"],
] as const;
for (const [label, factory, input] of tokenFactoryCases) {
  test(`constructs a normalized ${label} token`, () => {
    const result = factory(input);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value, input);
  });
}

test("constructs exact SHA-256 content, source, and Snapshot digests", () => {
  for (const factory of [
    snapshot.createEvidenceContentDigest,
    snapshot.createEvidenceSnapshotSourceDigest,
    snapshot.createEvidenceSnapshotFingerprint,
  ]) {
    assert.equal(factory("d".repeat(64)).ok, true);
    assert.equal(factory("D".repeat(64)).ok, false);
  }
});

test("rejects incomplete construction context", () => {
  const result = snapshot.createOrganizationVerificationEvidenceSnapshotConstructionContext({
    ...context(),
    sourceComplete: false,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "snapshot_source_incomplete");
});

test("rejects integrity-invalid construction context", () => {
  const result = snapshot.createOrganizationVerificationEvidenceSnapshotConstructionContext({
    ...context(),
    sourceIntegrityValid: false,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "snapshot_source_integrity_invalid");
});

for (const [label, mutation] of [
  ["non-canonical created-at", { createdAt: "2026-07-28" }],
  ["source selection after creation", { sourceSelectionCompletedAt: "2026-07-29T00:00:00.000Z" }],
  ["source cut-off after creation", { sourceCutoffAt: "2026-07-29T00:00:00.000Z" }],
] as const) {
  test(`rejects invalid Snapshot chronology: ${label}`, () => {
    const result = snapshot.createOrganizationVerificationEvidenceSnapshotConstructionContext({
      ...context(),
      ...mutation,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_snapshot_chronology");
  });
}

test("rejects a Revision submitted after Snapshot creation", () => {
  const input = buildInput();
  input.submissionSource = {
    ...input.submissionSource,
    revision: {
      ...input.submissionSource.revision,
      submittedAt: "2026-07-29T00:00:00.000Z",
    },
  } as never;
  const result = snapshot.buildOrganizationVerificationEvidenceSnapshot(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "submission_projection_mismatch");
});

test("rejects a Registry Profile Revision published after Snapshot creation", () => {
  const input = buildInput();
  input.registrySource = {
    ...input.registrySource,
    profileRevision: {
      ...input.registrySource.profileRevision,
      publishedAt: "2026-07-29T00:00:00.000Z",
    },
  } as never;
  const result = snapshot.buildOrganizationVerificationEvidenceSnapshot(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "registry_projection_mismatch");
});

test("rejects evidence issued after it was captured", () => {
  const evidence = evidenceInput();
  const result = build({
    evidence: [{
      ...evidence,
      issuedAt: "2026-07-28T00:02:00.000Z",
      capturedAt: "2026-07-28T00:01:30.000Z",
    }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "invalid_snapshot_chronology");
});

test("rejects contradictory evidence validity chronology", () => {
  const evidence = evidenceInput();
  const result = build({
    evidence: [{
      ...evidence,
      validFrom: "2026-02-01T00:00:00.000Z",
      validUntil: "2026-01-01T00:00:00.000Z",
    }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "invalid_snapshot_chronology");
});

test("rejects evidence from a different correlation chain", () => {
  const evidence = evidenceInput();
  const result = build({
    evidence: [{
      ...evidence,
      correlationReference: snapshotValue(
        snapshot.createEvidenceSnapshotCorrelationReference("correlation-other"),
      ),
    }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "evidence_reference_mismatch");
});

test("rejects an Attempt predating the bound Revision", () => {
  const base = context("evidence-snapshot-record-1", true);
  const input = buildInput();
  input.context = Object.freeze({
    ...base,
    attemptBinding: Object.freeze({
      ...base.attemptBinding!,
      attemptCreatedAt: "2026-07-28T00:01:00.000Z",
    }),
  });
  const result = snapshot.buildOrganizationVerificationEvidenceSnapshot(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "attempt_id_mismatch");
});

test("an unbound Snapshot cannot be silently rebound to an Attempt", () => {
  const existing = snapshotValue(build());
  const result = build({ attempt: true, existingSnapshot: existing });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "conflicting_evidence_snapshot");
});

test("Profile Revision sequence mismatch fails closed", () => {
  const input = buildInput();
  input.submissionSource = {
    ...input.submissionSource,
    revision: {
      ...input.submissionSource.revision,
      profileRevisionSequence: 2 as never,
    },
  } as never;
  const result = snapshot.buildOrganizationVerificationEvidenceSnapshot(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "profile_revision_id_mismatch");
});

test("Profile fingerprint mismatch fails closed", () => {
  const input = buildInput();
  input.submissionSource = {
    ...input.submissionSource,
    revision: {
      ...input.submissionSource.revision,
      profileFingerprint: "profile-fingerprint-other" as never,
    },
  } as never;
  const result = snapshot.buildOrganizationVerificationEvidenceSnapshot(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "profile_revision_id_mismatch");
});

test("Builder preserves caller-supplied clock and identity exactly", () => {
  const built = snapshotValue(build());
  assert.equal(built.createdAt, "2026-07-28T00:04:00.000Z");
  assert.equal(built.evidenceSnapshotId, "evidence-snapshot-record-1");
  assert.equal(built.sourceManifest.sourceSelectionCompletedAt, "2026-07-28T00:03:30.000Z");
});

for (const [label, mutation] of [
  ["provenance", { provenanceReference: " " }],
  ["correlation", { correlationReference: "latest" }],
  ["integrity", { integrityReference: "" }],
] as const) {
  test(`rejects invalid Snapshot ${label} reference`, () => {
    const result = snapshot.createOrganizationVerificationEvidenceSnapshotConstructionContext({
      ...context(),
      ...mutation,
    } as never);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "evidence_snapshot_construction_failure");
    }
  });
}

test("rejects a non-canonical Attempt creation timestamp", () => {
  const result = snapshot.createOrganizationVerificationEvidenceSnapshotConstructionContext({
    ...context(),
    attemptBinding: {
      attemptId: "attempt-snapshot-1" as never,
      attemptCreatedAt: "2026-07-28",
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "attempt_id_mismatch");
});

test("source manifest records the exact immutable source chain", () => {
  const built = snapshotValue(build());
  assert.equal(built.sourceManifest.organizationId, built.organizationId);
  assert.equal(built.sourceManifest.recordId, built.recordId);
  assert.equal(built.sourceManifest.revisionId, built.revisionId);
  assert.equal(built.sourceManifest.profileRevisionId, built.profileRevisionId);
  assert.deepEqual(built.sourceManifest.evidenceReferences, built.evidenceReferences);
});

test("all Snapshot-owned collections are frozen", () => {
  const built = snapshotValue(build());
  assert.equal(Object.isFrozen(built.sourceManifest.evidenceReferences), true);
  assert.equal(Object.isFrozen(built.evidenceReferences), true);
  assert.equal(Object.isFrozen(built.evidenceProjections), true);
  assert.equal(Object.isFrozen(built.submissionProjection.evidenceReferenceIds), true);
});

test("source mutations after construction cannot change the source digest", () => {
  const evidence = evidenceInput();
  const result = snapshotValue(build({ evidence: [evidence] }));
  const digest = result.sourceDigest;
  evidence.attributes = [{ key: "later", value: "mutation" }] as never;
  assert.equal(result.sourceDigest, digest);
  assert.equal(result.evidenceProjections[0]!.attributes[0]!.key, "document_class");
});
