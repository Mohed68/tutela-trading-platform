import assert from "node:assert/strict";
import test from "node:test";
import * as evaluationInput from "./evaluation-input/index.js";
import * as evaluationProjection from "./evaluation-projection/index.js";
import * as evidenceSnapshot from "./evidence-snapshot/index.js";
import * as policy from "./policy/index.js";

type DomainResult<T> =
  | evidenceSnapshot.EvidenceSnapshotDomainResult<T>
  | evaluationProjection.EvaluationProjectionDomainResult<T>
  | evaluationInput.PolicyEvaluationInputDomainResult<T>
  | policy.PolicyDomainResult<T>;

function value<T>(result: DomainResult<T>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

interface PipelineOptions {
  readonly snapshotAttemptId?: string;
  readonly inputAttemptId?: string;
  readonly statement?: string;
  readonly policySetVersion?: string;
  readonly scopeSections?: readonly string[];
  readonly declaredSections?: readonly string[];
  readonly evidenceCategories?: readonly string[];
  readonly existingSnapshot?: unknown;
}

function buildSnapshot(options: PipelineOptions = {}) {
  const correlationReference = value(
    evidenceSnapshot.createEvidenceSnapshotCorrelationReference(
      "pipeline-correlation-1",
    ),
  );
  const tradingNames = ["Synthetic Pipeline Trading"];
  const declaredValues = [{ key: "statement", value: options.statement ?? "synthetic" }];
  const declaredSections = [
    { key: "organization", values: declaredValues },
    {
      key: "contact",
      values: [{ key: "channel", value: "synthetic" }],
    },
  ];
  const evidenceAttributes = [
    { key: "zeta", value: "last" },
    { key: "alpha", value: "first" },
  ];
  const context = value(
    evidenceSnapshot.createOrganizationVerificationEvidenceSnapshotConstructionContext(
      {
        evidenceSnapshotId: value(
          evidenceSnapshot.createEvidenceSnapshotId("pipeline-snapshot-1"),
        ),
        evidenceSnapshotVersion: value(
          evidenceSnapshot.createEvidenceSnapshotVersion(
            "pipeline-snapshot-version-1",
          ),
        ),
        snapshotContractVersion:
          evidenceSnapshot.EVIDENCE_SNAPSHOT_CONTRACT_VERSION,
        snapshotBuilderVersion:
          evidenceSnapshot.EVIDENCE_SNAPSHOT_BUILDER_VERSION,
        manifestVersion: evidenceSnapshot.EVIDENCE_SNAPSHOT_MANIFEST_VERSION,
        organizationId: "pipeline-org-1" as never,
        recordId: "pipeline-record-1" as never,
        revisionId: "pipeline-revision-1" as never,
        profileRevisionId: "pipeline-profile-revision-1" as never,
        createdAt: "2026-07-29T00:04:00.000Z",
        sourceSelectionCompletedAt: "2026-07-29T00:03:30.000Z",
        ...(options.snapshotAttemptId
          ? {
              attemptBinding: {
                attemptId: options.snapshotAttemptId as never,
                attemptCreatedAt: "2026-07-29T00:03:00.000Z",
              },
            }
          : {}),
        sourceComplete: true,
        sourceIntegrityValid: true,
        provenanceReference: value(
          evidenceSnapshot.createEvidenceSnapshotProvenanceReference(
            "pipeline-snapshot-provenance-1",
          ),
        ),
        correlationReference,
        integrityReference: value(
          evidenceSnapshot.createEvidenceSnapshotIntegrityReference(
            "pipeline-snapshot-integrity-1",
          ),
        ),
      },
    ),
  );
  const registrySource = {
    profileRevision: {
      organizationId: "pipeline-org-1",
      organizationProfileRevisionId: "pipeline-profile-revision-1",
      organizationProfileRevisionSequence: 1,
      organizationProfileFingerprint: "pipeline-profile-fingerprint-1",
      legalIdentityProjection: {
        legalName: "Synthetic Pipeline Entity",
        tradingNames,
        registrationJurisdiction: "ZZ",
        registrationIdentifiers: [
          { scheme: "synthetic.registry", value: "PIPELINE-1" },
        ],
      },
      organizationType: "synthetic_entity",
      jurisdiction: "ZZ",
      declaredActivityProjection: {
        activities: [
          { code: "synthetic.trade", description: "Synthetic trade" },
        ],
      },
      organizationLifecycle: "active",
      registryContractVersion: "organization_registry_profile_revision.v1",
      publishedAt: "2026-07-29T00:00:00.000Z",
    } as never,
    provenanceReference: value(
      evidenceSnapshot.createEvidenceSnapshotProvenanceReference(
        "pipeline-registry-provenance-1",
      ),
    ),
    integrityReference: value(
      evidenceSnapshot.createEvidenceSnapshotIntegrityReference(
        "pipeline-registry-integrity-1",
      ),
    ),
  };
  const submissionSource = {
    revision: {
      organizationId: "pipeline-org-1",
      recordId: "pipeline-record-1",
      revisionId: "pipeline-revision-1",
      profileRevisionId: "pipeline-profile-revision-1",
      profileRevisionSequence: 1,
      profileFingerprint: "pipeline-profile-fingerprint-1",
      sequence: 1,
      declaredInputs: { sections: declaredSections },
      evidenceReferenceIds: ["pipeline-revision-evidence-1"],
      submissionActorAuthorityReference: {
        actorId: "pipeline-actor-1",
        authorityReferenceId: "pipeline-authority-1",
        authorityVersion: "pipeline-authority.v1",
        organizationScope: "pipeline-org-1",
        issuedAt: "2026-07-29T00:00:00.000Z",
        delegatedScopes: ["organization.verification.submit"],
      },
      submittedAt: "2026-07-29T00:02:00.000Z",
      submissionIdempotencyKey: "pipeline-submission-1",
      correlationId: "pipeline-correlation-1",
    } as never,
    verificationSourceContractVersion:
      evidenceSnapshot.VERIFICATION_REVISION_SOURCE_CONTRACT_VERSION,
    provenanceReference: value(
      evidenceSnapshot.createEvidenceSnapshotProvenanceReference(
        "pipeline-submission-provenance-1",
      ),
    ),
    integrityReference: value(
      evidenceSnapshot.createEvidenceSnapshotIntegrityReference(
        "pipeline-submission-integrity-1",
      ),
    ),
  };
  const evidenceReferences = [
    {
      evidenceReferenceId: value(
        evidenceSnapshot.createEvidenceReferenceId("pipeline-evidence-1"),
      ),
      evidenceReferenceVersion: value(
        evidenceSnapshot.createEvidenceReferenceVersion(
          "pipeline-evidence-version-1",
        ),
      ),
      revisionEvidenceReferenceId: "pipeline-revision-evidence-1" as never,
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
        evidenceSnapshot.createEvidenceContentDigest("a".repeat(64)),
      ),
      capturedAt: "2026-07-29T00:01:00.000Z",
      validUntil: "2026-01-01T00:00:00.000Z",
      attributes: evidenceAttributes,
      provenanceReference: value(
        evidenceSnapshot.createEvidenceSnapshotProvenanceReference(
          "pipeline-evidence-provenance-1",
        ),
      ),
      correlationReference,
      integrityReference: value(
        evidenceSnapshot.createEvidenceSnapshotIntegrityReference(
          "pipeline-evidence-integrity-1",
        ),
      ),
    },
  ] satisfies evidenceSnapshot.OrganizationVerificationSemanticEvidenceReferenceInput[];
  const result = evidenceSnapshot.buildOrganizationVerificationEvidenceSnapshot({
    context,
    registrySource,
    submissionSource,
    evidenceReferences,
    ...(options.existingSnapshot !== undefined
      ? { existingSnapshot: options.existingSnapshot }
      : {}),
  });
  return {
    result,
    mutableSources: {
      tradingNames,
      declaredValues,
      declaredSections,
      evidenceAttributes,
      evidenceReferences,
    },
  };
}

function buildProjection(
  source: evidenceSnapshot.OrganizationVerificationEvidenceSnapshot,
) {
  const context = value(
    evaluationProjection.createOrganizationVerificationEvaluationProjectionConstructionContext(
      {
        evaluationProjectionId: value(
          evaluationProjection.createEvaluationProjectionId(
            "pipeline-projection-1",
          ),
        ),
        evaluationProjectionVersion: value(
          evaluationProjection.createEvaluationProjectionVersion(
            "pipeline-projection-version-1",
          ),
        ),
        projectionContractVersion:
          evaluationProjection.EVALUATION_PROJECTION_CONTRACT_VERSION,
        projectionBuilderVersion:
          evaluationProjection.EVALUATION_PROJECTION_BUILDER_VERSION,
        projectionSchemaVersion:
          evaluationProjection.EVALUATION_PROJECTION_SCHEMA_VERSION,
        projectedAt: "2026-07-29T00:05:00.000Z",
        provenanceReference: value(
          evaluationProjection.createEvaluationProjectionProvenanceReference(
            "pipeline-projection-provenance-1",
          ),
        ),
        integrityReference: value(
          evaluationProjection.createEvaluationProjectionIntegrityReference(
            "pipeline-projection-integrity-1",
          ),
        ),
      },
    ),
  );
  return evaluationProjection.buildOrganizationVerificationEvaluationProjection({
    context,
    evidenceSnapshot: source,
  });
}

function policySetBinding(policySetVersion = "pipeline-policy-version-1") {
  return value(
    evaluationInput.createOrganizationVerificationPolicySetBinding({
      policySetId: value(
        policy.createOrganizationVerificationPolicySetId(
          "pipeline-policy-set-1",
        ),
      ),
      policySetVersion: value(
        policy.createOrganizationVerificationPolicySetVersion(policySetVersion),
      ),
      policyContractVersion: policy.POLICY_CONTRACT_VERSION,
      provenanceReference: value(
        policy.createOrganizationVerificationPolicyProvenanceReference(
          "pipeline-policy-provenance-1",
        ),
      ),
      integrityReference: value(
        policy.createOrganizationVerificationPolicySetIntegrityReference(
          "pipeline-policy-integrity-1",
        ),
      ),
    }),
  );
}

function inputBuildOptions(
  source: evaluationProjection.OrganizationVerificationEvaluationProjection,
  options: PipelineOptions = {},
) {
  const attemptId = options.inputAttemptId ?? "pipeline-attempt-1";
  const context = value(
    evaluationInput.createOrganizationVerificationEvaluationContext({
      contextContractVersion:
        evaluationInput.EVALUATION_CONTEXT_CONTRACT_VERSION,
      requestedAt: "2026-07-29T00:06:00.000Z",
      effectiveAt: "2026-07-29T00:06:00.000Z",
      sourceCutoffAt: "2026-07-29T00:04:30.000Z",
      executionReference: value(
        evaluationInput.createOrganizationVerificationEvaluationExecutionReference(
          "pipeline-execution-1",
        ),
      ),
      attemptId: attemptId as never,
      organizationId: source.identity.organizationId,
      recordId: source.identity.recordId,
      revisionId: source.identity.revisionId,
      profileRevisionId: source.identity.profileRevisionId,
      evaluationProjectionId: source.evaluationProjectionId,
      evaluationProjectionFingerprint: source.projectionFingerprint,
      sourceSnapshotId: source.source.evidenceSnapshotId,
      sourceSnapshotFingerprint: source.source.snapshotFingerprint,
      provenanceReference: value(
        evaluationInput.createOrganizationVerificationEvaluationProvenanceReference(
          "pipeline-input-context-provenance-1",
        ),
      ),
      correlationReference: value(
        evaluationInput.createOrganizationVerificationEvaluationCorrelationReference(
          "pipeline-input-correlation-1",
        ),
      ),
      integrityReference: value(
        evaluationInput.createOrganizationVerificationEvaluationIntegrityReference(
          "pipeline-input-context-integrity-1",
        ),
      ),
    }),
  );
  const scope = value(
    evaluationInput.createOrganizationVerificationEvaluationScope({
      scopeContractVersion: evaluationInput.EVALUATION_SCOPE_CONTRACT_VERSION,
      capability:
        evaluationInput.ORGANIZATION_VERIFICATION_EVALUATION_CAPABILITY,
      authorizedProjectionSections: options.scopeSections ?? [
        "registry_facts",
        "submission_facts",
        "evidence_facts",
      ],
      authorizedEvidenceCategories: options.evidenceCategories ?? [
        "legal.identity",
      ],
      authorizedDeclaredFactSections: options.declaredSections ?? [
        "organization",
      ],
      provenanceReference: value(
        evaluationInput.createOrganizationVerificationEvaluationProvenanceReference(
          "pipeline-input-scope-provenance-1",
        ),
      ),
      integrityReference: value(
        evaluationInput.createOrganizationVerificationEvaluationIntegrityReference(
          "pipeline-input-scope-integrity-1",
        ),
      ),
    }),
  );
  return {
    policyEvaluationInputId: value(
      evaluationInput.createOrganizationVerificationPolicyEvaluationInputId(
        "pipeline-input-1",
      ),
    ),
    policyEvaluationInputVersion: value(
      evaluationInput.createOrganizationVerificationPolicyEvaluationInputVersion(
        "pipeline-input-version-1",
      ),
    ),
    inputContractVersion:
      evaluationInput.POLICY_EVALUATION_INPUT_CONTRACT_VERSION,
    inputBuilderVersion:
      evaluationInput.POLICY_EVALUATION_INPUT_BUILDER_VERSION,
    createdAt: "2026-07-29T00:07:00.000Z",
    evaluationProjection: source,
    policySetBinding: policySetBinding(options.policySetVersion),
    evaluationContext: context,
    evaluationScope: scope,
  } satisfies evaluationInput.BuildOrganizationVerificationPolicyEvaluationInput;
}

function buildPipeline(options: PipelineOptions = {}) {
  const snapshotConstruction = buildSnapshot(options);
  const snapshotValue = value(snapshotConstruction.result);
  const projectionValue = value(buildProjection(snapshotValue));
  const inputValue = value(
    evaluationInput.buildOrganizationVerificationPolicyEvaluationInput(
      inputBuildOptions(projectionValue, options),
    ),
  );
  return {
    snapshot: snapshotValue,
    projection: projectionValue,
    policyEvaluationInput: inputValue,
    mutableSources: snapshotConstruction.mutableSources,
  };
}

test("constructs the complete pure immutable preparation pipeline", () => {
  const pipeline = buildPipeline();
  assert.equal(
    evidenceSnapshot.isOrganizationVerificationEvidenceSnapshot(
      pipeline.snapshot,
    ),
    true,
  );
  assert.equal(
    evaluationProjection.isOrganizationVerificationEvaluationProjection(
      pipeline.projection,
    ),
    true,
  );
  assert.equal(
    evaluationInput.isOrganizationVerificationPolicyEvaluationInput(
      pipeline.policyEvaluationInput,
    ),
    true,
  );
});

test("preserves the exact identity chain", () => {
  const { snapshot, projection, policyEvaluationInput: input } = buildPipeline();
  assert.equal(projection.identity.organizationId, snapshot.organizationId);
  assert.equal(projection.identity.recordId, snapshot.recordId);
  assert.equal(projection.identity.revisionId, snapshot.revisionId);
  assert.equal(projection.identity.profileRevisionId, snapshot.profileRevisionId);
  assert.equal(input.projectionBinding.organizationId, snapshot.organizationId);
  assert.equal(input.projectionBinding.recordId, snapshot.recordId);
  assert.equal(input.projectionBinding.revisionId, snapshot.revisionId);
  assert.equal(
    input.projectionBinding.profileRevisionId,
    snapshot.profileRevisionId,
  );
});

test("preserves the explicit version chain", () => {
  const { snapshot, projection, policyEvaluationInput: input } = buildPipeline();
  assert.equal(
    snapshot.snapshotContractVersion,
    evidenceSnapshot.EVIDENCE_SNAPSHOT_CONTRACT_VERSION,
  );
  assert.equal(
    projection.source.evidenceSnapshotVersion,
    snapshot.evidenceSnapshotVersion,
  );
  assert.equal(
    projection.source.snapshotContractVersion,
    snapshot.snapshotContractVersion,
  );
  assert.equal(
    input.projectionBinding.evaluationProjectionVersion,
    projection.evaluationProjectionVersion,
  );
  assert.equal(
    input.projectionBinding.projectionContractVersion,
    projection.projectionContractVersion,
  );
  assert.equal(
    input.projectionBinding.projectionSchemaVersion,
    projection.projectionSchemaVersion,
  );
  assert.equal(
    input.inputContractVersion,
    evaluationInput.POLICY_EVALUATION_INPUT_CONTRACT_VERSION,
  );
});

test("preserves the full fingerprint chain", () => {
  const { snapshot, projection, policyEvaluationInput: input } = buildPipeline();
  assert.equal(projection.source.snapshotFingerprint, snapshot.snapshotFingerprint);
  assert.equal(
    input.projectionBinding.projectionFingerprint,
    projection.projectionFingerprint,
  );
  assert.equal(
    input.projectionBinding.sourceSnapshotFingerprint,
    snapshot.snapshotFingerprint,
  );
  for (const fingerprint of [
    snapshot.snapshotFingerprint,
    projection.projectionFingerprint,
    input.inputFingerprint,
  ]) {
    assert.match(fingerprint, /^[a-f0-9]{64}$/);
  }
});

test("keeps provenance and integrity explicit at every layer", () => {
  const { snapshot, projection, policyEvaluationInput: input } = buildPipeline();
  assert.equal(snapshot.provenanceReference, "pipeline-snapshot-provenance-1");
  assert.equal(snapshot.integrityReference, "pipeline-snapshot-integrity-1");
  assert.equal(
    projection.provenanceReference,
    "pipeline-projection-provenance-1",
  );
  assert.equal(
    projection.integrityReference,
    "pipeline-projection-integrity-1",
  );
  assert.equal(
    input.evaluationContext.provenanceReference,
    "pipeline-input-context-provenance-1",
  );
  assert.equal(
    input.evaluationContext.integrityReference,
    "pipeline-input-context-integrity-1",
  );
});

test("supports optional then absent then mandatory Attempt binding", () => {
  const { snapshot, projection, policyEvaluationInput: input } = buildPipeline();
  assert.equal(snapshot.attemptBinding, undefined);
  assert.equal(projection.identity.attemptId, undefined);
  assert.equal(input.projectionBinding.attemptId, "pipeline-attempt-1");
  assert.equal(input.evaluationContext.attemptId, "pipeline-attempt-1");
});

test("preserves an explicit Snapshot Attempt through all layers", () => {
  const pipeline = buildPipeline({
    snapshotAttemptId: "pipeline-attempt-1",
    inputAttemptId: "pipeline-attempt-1",
  });
  assert.equal(
    pipeline.snapshot.attemptBinding?.attemptId,
    "pipeline-attempt-1",
  );
  assert.equal(pipeline.projection.identity.attemptId, "pipeline-attempt-1");
  assert.equal(
    pipeline.policyEvaluationInput.projectionBinding.attemptId,
    "pipeline-attempt-1",
  );
});

test("fails closed when Evaluation Input conflicts with a bound Attempt", () => {
  const snapshotValue = value(
    buildSnapshot({ snapshotAttemptId: "pipeline-attempt-1" }).result,
  );
  const projectionValue = value(buildProjection(snapshotValue));
  const result =
    evaluationInput.buildOrganizationVerificationPolicyEvaluationInput(
      inputBuildOptions(projectionValue, {
        inputAttemptId: "pipeline-attempt-conflict",
      }),
    );
  assert.deepEqual(result, { ok: false, code: "attempt_id_mismatch" });
});

test("scope narrows Projection facts without broadening", () => {
  const pipeline = buildPipeline({
    scopeSections: ["submission_facts"],
    declaredSections: ["organization"],
    evidenceCategories: [],
  });
  assert.equal(pipeline.policyEvaluationInput.factSurface.registryFacts, undefined);
  assert.equal(pipeline.policyEvaluationInput.factSurface.evidenceFacts, undefined);
  assert.deepEqual(
    pipeline.policyEvaluationInput.factSurface.submissionFacts?.declaredSections.map(
      (section) => section.key,
    ),
    ["organization"],
  );
});

test("scope broader than Projection fails closed", () => {
  const snapshotValue = value(buildSnapshot().result);
  const projectionValue = value(buildProjection(snapshotValue));
  const result =
    evaluationInput.buildOrganizationVerificationPolicyEvaluationInput(
      inputBuildOptions(projectionValue, {
        evidenceCategories: ["unknown.synthetic.category"],
      }),
    );
  assert.deepEqual(result, {
    ok: false,
    code: "evaluation_scope_exceeds_projection",
  });
});

test("redacted Snapshot internals cannot reappear downstream", () => {
  const { projection, policyEvaluationInput: input } = buildPipeline();
  const projectionJson = JSON.stringify(projection);
  const inputJson = JSON.stringify(input);
  for (const forbidden of [
    "sourceManifest",
    "constructionContext",
    "submissionActorAuthorityReference",
    "submissionIdempotencyKey",
    "organizationLifecycle",
    "sourceSelectionCompletedAt",
  ]) {
    assert.equal(projectionJson.includes(forbidden), false);
    assert.equal(inputJson.includes(forbidden), false);
  }
});

test("rejects an arbitrary fake Snapshot", () => {
  const authentic = value(buildSnapshot().result);
  const fake = Object.freeze({ ...authentic });
  const result = buildProjection(fake as never);
  assert.deepEqual(result, { ok: false, code: "unauthentic_evidence_snapshot" });
});

test("rejects an arbitrary fake Projection", () => {
  const authenticSnapshot = value(buildSnapshot().result);
  const authenticProjection = value(buildProjection(authenticSnapshot));
  const fake = Object.freeze({ ...authenticProjection });
  const result =
    evaluationInput.buildOrganizationVerificationPolicyEvaluationInput(
      inputBuildOptions(fake as never),
    );
  assert.deepEqual(result, {
    ok: false,
    code: "unauthentic_evaluation_projection",
  });
});

test("rejects an arbitrary fake Evaluation Input", () => {
  const authentic = buildPipeline().policyEvaluationInput;
  assert.equal(
    evaluationInput.isOrganizationVerificationPolicyEvaluationInput(
      Object.freeze({ ...authentic }),
    ),
    false,
  );
});

test("changed Snapshot semantics change all downstream fingerprints", () => {
  const first = buildPipeline({ statement: "synthetic-alpha" });
  const second = buildPipeline({ statement: "synthetic-beta" });
  assert.notEqual(
    first.snapshot.snapshotFingerprint,
    second.snapshot.snapshotFingerprint,
  );
  assert.notEqual(
    first.projection.projectionFingerprint,
    second.projection.projectionFingerprint,
  );
  assert.notEqual(
    first.policyEvaluationInput.inputFingerprint,
    second.policyEvaluationInput.inputFingerprint,
  );
});

test("changed exposed Projection surface changes Evaluation Input fingerprint", () => {
  const complete = buildPipeline();
  const narrowed = buildPipeline({
    scopeSections: ["registry_facts"],
    declaredSections: [],
    evidenceCategories: [],
  });
  assert.equal(
    complete.projection.projectionFingerprint,
    narrowed.projection.projectionFingerprint,
  );
  assert.notEqual(
    complete.policyEvaluationInput.inputFingerprint,
    narrowed.policyEvaluationInput.inputFingerprint,
  );
});

test("changed exact Policy Set version changes Evaluation Input fingerprint", () => {
  const first = buildPipeline({ policySetVersion: "pipeline-policy-version-1" });
  const second = buildPipeline({ policySetVersion: "pipeline-policy-version-2" });
  assert.notEqual(
    first.policyEvaluationInput.inputFingerprint,
    second.policyEvaluationInput.inputFingerprint,
  );
});

test("changed explicit Attempt changes Evaluation Input fingerprint", () => {
  const first = buildPipeline({ inputAttemptId: "pipeline-attempt-1" });
  const second = buildPipeline({ inputAttemptId: "pipeline-attempt-2" });
  assert.notEqual(
    first.policyEvaluationInput.inputFingerprint,
    second.policyEvaluationInput.inputFingerprint,
  );
});

test("caller mutation after construction has no downstream effect", () => {
  const pipeline = buildPipeline();
  const before = {
    snapshot: pipeline.snapshot.snapshotFingerprint,
    projection: pipeline.projection.projectionFingerprint,
    input: pipeline.policyEvaluationInput.inputFingerprint,
    legalName:
      pipeline.policyEvaluationInput.factSurface.registryFacts?.legalIdentity
        .tradingNames[0],
    statement:
      pipeline.policyEvaluationInput.factSurface.submissionFacts?.declaredSections[0]
        ?.values[0]?.value,
  };
  pipeline.mutableSources.tradingNames.push("Caller Mutation");
  pipeline.mutableSources.declaredValues[0]!.value = "caller mutation";
  pipeline.mutableSources.evidenceAttributes.push({
    key: "caller",
    value: "mutation",
  });
  assert.deepEqual(
    {
      snapshot: pipeline.snapshot.snapshotFingerprint,
      projection: pipeline.projection.projectionFingerprint,
      input: pipeline.policyEvaluationInput.inputFingerprint,
      legalName:
        pipeline.policyEvaluationInput.factSurface.registryFacts?.legalIdentity
          .tradingNames[0],
      statement:
        pipeline.policyEvaluationInput.factSurface.submissionFacts
          ?.declaredSections[0]?.values[0]?.value,
    },
    before,
  );
});

test("downstream construction never mutates upstream objects", () => {
  const snapshotValue = value(buildSnapshot().result);
  const snapshotBefore = JSON.stringify(snapshotValue);
  const projectionValue = value(buildProjection(snapshotValue));
  const projectionBefore = JSON.stringify(projectionValue);
  value(
    evaluationInput.buildOrganizationVerificationPolicyEvaluationInput(
      inputBuildOptions(projectionValue),
    ),
  );
  assert.equal(JSON.stringify(snapshotValue), snapshotBefore);
  assert.equal(JSON.stringify(projectionValue), projectionBefore);
});

test("the complete pipeline is deeply immutable", () => {
  const pipeline = buildPipeline();
  for (const candidate of [
    pipeline.snapshot,
    pipeline.snapshot.sourceManifest,
    pipeline.projection,
    pipeline.projection.registryFacts,
    pipeline.policyEvaluationInput,
    pipeline.policyEvaluationInput.evaluationContext,
    pipeline.policyEvaluationInput.evaluationScope,
    pipeline.policyEvaluationInput.policySetBinding,
    pipeline.policyEvaluationInput.factSurface,
  ]) {
    assert.equal(Object.isFrozen(candidate), true);
  }
  assert.throws(() => {
    (
      pipeline.policyEvaluationInput.factSurface.registryFacts!.legalIdentity
        .tradingNames as string[]
    ).push("mutation");
  }, TypeError);
});

test("identical semantic construction is deterministic", () => {
  const first = buildPipeline();
  const second = buildPipeline();
  assert.equal(first.snapshot.sourceDigest, second.snapshot.sourceDigest);
  assert.equal(
    first.snapshot.snapshotFingerprint,
    second.snapshot.snapshotFingerprint,
  );
  assert.equal(
    first.projection.projectionFingerprint,
    second.projection.projectionFingerprint,
  );
  assert.equal(
    first.policyEvaluationInput.inputFingerprint,
    second.policyEvaluationInput.inputFingerprint,
  );
});

test("same Evaluation Input identity with changed semantics fails closed", () => {
  const pipeline = buildPipeline();
  const changed = inputBuildOptions(pipeline.projection, {
    policySetVersion: "pipeline-policy-version-2",
  });
  const result =
    evaluationInput.buildOrganizationVerificationPolicyEvaluationInput({
      ...changed,
      existingInput: pipeline.policyEvaluationInput,
    });
  assert.deepEqual(result, {
    ok: false,
    code: "conflicting_policy_evaluation_input",
  });
});

test("same Snapshot identity with changed semantics fails closed", () => {
  const existing = value(
    buildSnapshot({ statement: "synthetic-alpha" }).result,
  );
  const result = buildSnapshot({
    statement: "synthetic-beta",
    existingSnapshot: existing,
  }).result;
  assert.deepEqual(result, {
    ok: false,
    code: "conflicting_evidence_snapshot",
  });
});

test("preparation output contains no execution result or downstream authority", () => {
  const json = JSON.stringify(buildPipeline().policyEvaluationInput);
  for (const forbidden of [
    '"finding"',
    '"ruleEvaluationResult"',
    '"policyEvaluationCompletion"',
    '"normalizedEvaluationClassification"',
    '"decision"',
    '"trustStatus"',
    '"eligibility"',
    '"workflowState"',
    '"attemptProcessState"',
  ]) {
    assert.equal(json.includes(forbidden), false);
  }
});

test("pipeline construction performs no Policy or Rule execution", () => {
  const input = buildPipeline().policyEvaluationInput;
  assert.equal(input.policySetBinding.policySetId, "pipeline-policy-set-1");
  assert.equal("rules" in input, false);
  assert.equal("findings" in input, false);
  assert.equal("completion" in input, false);
});
