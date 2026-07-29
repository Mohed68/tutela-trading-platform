import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as snapshot from "../evidence-snapshot/index.js";
import * as projection from "../evaluation-projection/index.js";
import * as policy from "../policy/index.js";
import * as input from "./index.js";

function value<T>(
  result:
    | snapshot.EvidenceSnapshotDomainResult<T>
    | projection.EvaluationProjectionDomainResult<T>
    | policy.PolicyDomainResult<T>
    | input.PolicyEvaluationInputDomainResult<T>,
): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function authenticProjection(boundAttemptId?: string) {
  const correlation = value(
    snapshot.createEvidenceSnapshotCorrelationReference("correlation-input-1"),
  );
  const snapshotContext = value(
    snapshot.createOrganizationVerificationEvidenceSnapshotConstructionContext({
      evidenceSnapshotId: value(
        snapshot.createEvidenceSnapshotId("snapshot-input-1"),
      ),
      evidenceSnapshotVersion: value(
        snapshot.createEvidenceSnapshotVersion("snapshot-version-1"),
      ),
      snapshotContractVersion: snapshot.EVIDENCE_SNAPSHOT_CONTRACT_VERSION,
      snapshotBuilderVersion: snapshot.EVIDENCE_SNAPSHOT_BUILDER_VERSION,
      manifestVersion: snapshot.EVIDENCE_SNAPSHOT_MANIFEST_VERSION,
      organizationId: "org-input-1" as never,
      recordId: "record-input-1" as never,
      revisionId: "revision-input-1" as never,
      profileRevisionId: "profile-input-1" as never,
      createdAt: "2026-07-28T00:04:00.000Z",
      sourceSelectionCompletedAt: "2026-07-28T00:03:30.000Z",
      ...(boundAttemptId
        ? {
            attemptBinding: {
              attemptId: boundAttemptId as never,
              attemptCreatedAt: "2026-07-28T00:03:00.000Z",
            },
          }
        : {}),
      sourceComplete: true,
      sourceIntegrityValid: true,
      provenanceReference: value(
        snapshot.createEvidenceSnapshotProvenanceReference(
          "provenance-snapshot-input-1",
        ),
      ),
      correlationReference: correlation,
      integrityReference: value(
        snapshot.createEvidenceSnapshotIntegrityReference(
          "integrity-snapshot-input-1",
        ),
      ),
    }),
  );
  const evidence = {
    evidenceReferenceId: value(
      snapshot.createEvidenceReferenceId("evidence-input-1"),
    ),
    evidenceReferenceVersion: value(
      snapshot.createEvidenceReferenceVersion("evidence-version-1"),
    ),
    revisionEvidenceReferenceId: "revision-evidence-input-1" as never,
    evidenceKind: value(
      snapshot.createEvidenceKind("corporate.registration"),
    ),
    category: value(snapshot.createEvidenceCategory("legal.identity")),
    sourceAuthority: value(
      snapshot.createEvidenceSourceAuthority("customer.submission"),
    ),
    contentDigest: value(
      snapshot.createEvidenceContentDigest("a".repeat(64)),
    ),
    capturedAt: "2026-07-28T00:01:00.000Z",
    validUntil: "2026-01-01T00:00:00.000Z",
    attributes: [
      { key: "zeta", value: "last" },
      { key: "alpha", value: "first" },
    ],
    provenanceReference: value(
      snapshot.createEvidenceSnapshotProvenanceReference(
        "provenance-evidence-input-1",
      ),
    ),
    correlationReference: correlation,
    integrityReference: value(
      snapshot.createEvidenceSnapshotIntegrityReference(
        "integrity-evidence-input-1",
      ),
    ),
  } satisfies snapshot.OrganizationVerificationSemanticEvidenceReferenceInput;
  const source = value(
    snapshot.buildOrganizationVerificationEvidenceSnapshot({
      context: snapshotContext,
      registrySource: {
        profileRevision: {
          organizationId: "org-input-1",
          organizationProfileRevisionId: "profile-input-1",
          organizationProfileRevisionSequence: 1,
          organizationProfileFingerprint: "profile-fingerprint-input-1",
          legalIdentityProjection: {
            legalName: "Synthetic Input Entity",
            tradingNames: ["Synthetic Input"],
            registrationJurisdiction: "ZZ",
            registrationIdentifiers: [
              { scheme: "synthetic.registry", value: "SYN-INPUT-1" },
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
          registryContractVersion:
            "organization_registry_profile_revision.v1",
          publishedAt: "2026-07-28T00:00:00.000Z",
        } as never,
        provenanceReference: value(
          snapshot.createEvidenceSnapshotProvenanceReference(
            "provenance-registry-input-1",
          ),
        ),
        integrityReference: value(
          snapshot.createEvidenceSnapshotIntegrityReference(
            "integrity-registry-input-1",
          ),
        ),
      },
      submissionSource: {
        revision: {
          organizationId: "org-input-1",
          recordId: "record-input-1",
          revisionId: "revision-input-1",
          profileRevisionId: "profile-input-1",
          profileRevisionSequence: 1,
          profileFingerprint: "profile-fingerprint-input-1",
          sequence: 1,
          declaredInputs: {
            sections: [
              {
                key: "organization",
                values: [{ key: "statement", value: "synthetic" }],
              },
              {
                key: "contact",
                values: [{ key: "channel", value: "synthetic" }],
              },
            ],
          },
          evidenceReferenceIds: ["revision-evidence-input-1"],
          submissionActorAuthorityReference: {
            actorId: "actor-input-1",
            authorityReferenceId: "authority-input-1",
            authorityVersion: "authority.v1",
            organizationScope: "org-input-1",
            issuedAt: "2026-07-28T00:00:00.000Z",
            delegatedScopes: ["organization.verification.submit"],
          },
          submittedAt: "2026-07-28T00:02:00.000Z",
          submissionIdempotencyKey: "submission-input-1",
          correlationId: "correlation-input-1",
        } as never,
        verificationSourceContractVersion:
          snapshot.VERIFICATION_REVISION_SOURCE_CONTRACT_VERSION,
        provenanceReference: value(
          snapshot.createEvidenceSnapshotProvenanceReference(
            "provenance-submission-input-1",
          ),
        ),
        integrityReference: value(
          snapshot.createEvidenceSnapshotIntegrityReference(
            "integrity-submission-input-1",
          ),
        ),
      },
      evidenceReferences: [evidence],
    }),
  );
  const projectionContext = value(
    projection.createOrganizationVerificationEvaluationProjectionConstructionContext(
      {
        evaluationProjectionId: value(
          projection.createEvaluationProjectionId("projection-input-1"),
        ),
        evaluationProjectionVersion: value(
          projection.createEvaluationProjectionVersion("projection-version-1"),
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
            "provenance-projection-input-1",
          ),
        ),
        integrityReference: value(
          projection.createEvaluationProjectionIntegrityReference(
            "integrity-projection-input-1",
          ),
        ),
      },
    ),
  );
  return value(
    projection.buildOrganizationVerificationEvaluationProjection({
      context: projectionContext,
      evidenceSnapshot: source,
    }),
  );
}

function evaluationContext(
  source: projection.OrganizationVerificationEvaluationProjection,
  attemptId = "attempt-input-1",
) {
  return value(
    input.createOrganizationVerificationEvaluationContext({
      contextContractVersion: input.EVALUATION_CONTEXT_CONTRACT_VERSION,
      requestedAt: "2026-07-28T00:06:00.000Z",
      effectiveAt: "2026-07-28T00:06:00.000Z",
      sourceCutoffAt: "2026-07-28T00:04:30.000Z",
      executionReference: value(
        input.createOrganizationVerificationEvaluationExecutionReference(
          "execution-input-1",
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
        input.createOrganizationVerificationEvaluationProvenanceReference(
          "provenance-context-input-1",
        ),
      ),
      correlationReference: value(
        input.createOrganizationVerificationEvaluationCorrelationReference(
          "correlation-context-input-1",
        ),
      ),
      integrityReference: value(
        input.createOrganizationVerificationEvaluationIntegrityReference(
          "integrity-context-input-1",
        ),
      ),
    }),
  );
}

function evaluationScope(
  sections: readonly string[] = [
    "registry_facts",
    "submission_facts",
    "evidence_facts",
  ],
  declared: readonly string[] = ["organization"],
  categories: readonly string[] = ["legal.identity"],
) {
  return value(
    input.createOrganizationVerificationEvaluationScope({
      scopeContractVersion: input.EVALUATION_SCOPE_CONTRACT_VERSION,
      capability: input.ORGANIZATION_VERIFICATION_EVALUATION_CAPABILITY,
      authorizedProjectionSections: sections,
      authorizedEvidenceCategories: categories,
      authorizedDeclaredFactSections: declared,
      provenanceReference: value(
        input.createOrganizationVerificationEvaluationProvenanceReference(
          "provenance-scope-input-1",
        ),
      ),
      integrityReference: value(
        input.createOrganizationVerificationEvaluationIntegrityReference(
          "integrity-scope-input-1",
        ),
      ),
    }),
  );
}

function policyBinding(id = "synthetic-policy-set-1", version = "policy-v1") {
  return value(
    input.createOrganizationVerificationPolicySetBinding({
      policySetId: value(
        policy.createOrganizationVerificationPolicySetId(id),
      ),
      policySetVersion: value(
        policy.createOrganizationVerificationPolicySetVersion(version),
      ),
      policyContractVersion: policy.POLICY_CONTRACT_VERSION,
      provenanceReference: value(
        policy.createOrganizationVerificationPolicyProvenanceReference(
          "provenance-policy-input-1",
        ),
      ),
      integrityReference: value(
        policy.createOrganizationVerificationPolicySetIntegrityReference(
          "integrity-policy-input-1",
        ),
      ),
    }),
  );
}

function buildOptions(options?: {
  readonly source?: projection.OrganizationVerificationEvaluationProjection;
  readonly attemptId?: string;
  readonly id?: string;
  readonly policy?: input.OrganizationVerificationPolicySetBinding;
  readonly scope?: input.OrganizationVerificationEvaluationScope;
  readonly context?: input.OrganizationVerificationEvaluationContext;
  readonly existingInput?: unknown;
}) {
  const source = options?.source ?? authenticProjection();
  return {
    policyEvaluationInputId: value(
      input.createOrganizationVerificationPolicyEvaluationInputId(
        options?.id ?? "policy-evaluation-input-1",
      ),
    ),
    policyEvaluationInputVersion: value(
      input.createOrganizationVerificationPolicyEvaluationInputVersion(
        "policy-evaluation-input-version-1",
      ),
    ),
    inputContractVersion: input.POLICY_EVALUATION_INPUT_CONTRACT_VERSION,
    inputBuilderVersion: input.POLICY_EVALUATION_INPUT_BUILDER_VERSION,
    createdAt: "2026-07-28T00:07:00.000Z",
    evaluationProjection: source,
    policySetBinding: options?.policy ?? policyBinding(),
    evaluationContext:
      options?.context ??
      evaluationContext(source, options?.attemptId ?? "attempt-input-1"),
    evaluationScope: options?.scope ?? evaluationScope(),
    ...(options && "existingInput" in options
      ? { existingInput: options.existingInput }
      : {}),
  } satisfies input.BuildOrganizationVerificationPolicyEvaluationInput;
}

function build(options?: Parameters<typeof buildOptions>[0]) {
  return input.buildOrganizationVerificationPolicyEvaluationInput(
    buildOptions(options),
  );
}

test("constructs one authentic immutable Policy Evaluation Input", () => {
  const result = value(build());
  assert.equal(result.projectionBinding.organizationId, "org-input-1");
  assert.equal(result.projectionBinding.attemptId, "attempt-input-1");
  assert.equal(result.policySetBinding.policySetVersion, "policy-v1");
  assert.match(result.inputFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(input.isOrganizationVerificationPolicyEvaluationInput(result), true);
});

for (const invalid of ["", " ", "latest", "current", "head", "default"]) {
  test(`rejects invalid or mutable Evaluation Input ID: ${JSON.stringify(invalid)}`, () => {
    assert.equal(
      input.createOrganizationVerificationPolicyEvaluationInputId(invalid).ok,
      false,
    );
  });
}

test("accepts only exact Input contract and Builder versions", () => {
  assert.equal(input.parsePolicyEvaluationInputContractVersion(input.POLICY_EVALUATION_INPUT_CONTRACT_VERSION).ok, true);
  assert.equal(input.parsePolicyEvaluationInputBuilderVersion(input.POLICY_EVALUATION_INPUT_BUILDER_VERSION).ok, true);
  for (const invalid of ["v0", "v2", "latest", undefined]) {
    assert.equal(input.parsePolicyEvaluationInputContractVersion(invalid).ok, false);
    assert.equal(input.parsePolicyEvaluationInputBuilderVersion(invalid).ok, false);
  }
});

test("rejects an arbitrary object impersonating Evaluation Projection", () => {
  const buildInput = buildOptions();
  buildInput.evaluationProjection = Object.freeze({
    evaluationProjectionId: "projection-input-1",
  }) as never;
  const result = input.buildOrganizationVerificationPolicyEvaluationInput(buildInput);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "unauthentic_evaluation_projection");
});

for (const [label, mutation, code] of [
  ["Projection identity", { evaluationProjectionId: "projection-other" }, "evaluation_projection_mismatch"],
  ["Projection fingerprint", { evaluationProjectionFingerprint: "b".repeat(64) }, "evaluation_projection_fingerprint_mismatch"],
  ["Snapshot ID", { sourceSnapshotId: "snapshot-other" }, "snapshot_reference_mismatch"],
  ["Snapshot fingerprint", { sourceSnapshotFingerprint: "c".repeat(64) }, "snapshot_reference_mismatch"],
  ["Organization", { organizationId: "org-other" }, "organization_id_mismatch"],
  ["Record", { recordId: "record-other" }, "verification_record_id_mismatch"],
  ["Revision", { revisionId: "revision-other" }, "verification_revision_id_mismatch"],
  ["Profile Revision", { profileRevisionId: "profile-other" }, "profile_revision_id_mismatch"],
] as const) {
  test(`rejects ${label} binding mismatch`, () => {
    const source = authenticProjection();
    const context = Object.freeze({ ...evaluationContext(source), ...mutation });
    const result = build({ source, context: context as never });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
  });
}

test("Attempt binding is mandatory", () => {
  const source = authenticProjection();
  const result = input.createOrganizationVerificationEvaluationContext({
    ...evaluationContext(source),
    attemptId: "" as never,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "attempt_id_required");
});

test("Projection without Attempt may be explicitly bound once", () => {
  const result = value(build());
  assert.equal(result.projectionBinding.attemptId, "attempt-input-1");
  assert.equal(result.evaluationContext.attemptId, "attempt-input-1");
});

test("Projection-bound Attempt must match explicit Evaluation Input Attempt", () => {
  const source = authenticProjection("attempt-bound-1");
  const result = build({ source, attemptId: "attempt-other" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "attempt_id_mismatch");
});

test("Evaluation Input cannot be rebound to another Attempt", () => {
  const existing = value(build());
  const result = build({
    attemptId: "attempt-other",
    existingInput: existing,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "conflicting_policy_evaluation_input");
});

test("Builder creates no Attempt state and performs no lifecycle transition", () => {
  const result = value(build());
  assert.equal("processState" in result, false);
  assert.equal("transition" in result, false);
});

test("creates one exact immutable Policy Set binding", () => {
  const binding = policyBinding();
  assert.equal(binding.policySetId, "synthetic-policy-set-1");
  assert.equal(binding.policySetVersion, "policy-v1");
  assert.equal(Object.isFrozen(binding), true);
});

for (const pointer of ["latest", "current", "head", "default"]) {
  test(`rejects mutable Policy Set version pointer: ${pointer}`, () => {
    const result = input.createOrganizationVerificationPolicySetBinding({
      ...policyBinding(),
      policySetVersion: pointer as never,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "mutable_policy_set_pointer_rejected");
  });
}

test("rejects malformed or unsupported Policy Set binding", () => {
  const malformed = input.createOrganizationVerificationPolicySetBinding({
    ...policyBinding(),
    policySetId: "" as never,
  });
  assert.equal(malformed.ok, false);
  const unsupported = input.createOrganizationVerificationPolicySetBinding({
    ...policyBinding(),
    policyContractVersion: "policy.v2",
  });
  assert.equal(unsupported.ok, false);
  if (!unsupported.ok) assert.equal(unsupported.code, "unsupported_policy_set_version");
});

test("Evaluation Context retains every explicit timestamp and uses no hidden clock", () => {
  const context = evaluationContext(authenticProjection());
  assert.equal(context.requestedAt, "2026-07-28T00:06:00.000Z");
  assert.equal(context.effectiveAt, "2026-07-28T00:06:00.000Z");
  assert.equal(context.sourceCutoffAt, "2026-07-28T00:04:30.000Z");
  assert.equal(Object.isFrozen(context), true);
});

test("retrospective evaluation is not supported in v1", () => {
  const source = authenticProjection();
  const result = input.createOrganizationVerificationEvaluationContext({
    ...evaluationContext(source),
    effectiveAt: "2026-07-28T00:05:30.000Z",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "invalid_evaluation_input_chronology");
});

for (const [label, mutation] of [
  ["request before Projection", { requestedAt: "2026-07-28T00:04:30.000Z" }],
  ["effective time before Snapshot", { effectiveAt: "2026-07-28T00:03:00.000Z", requestedAt: "2026-07-28T00:03:00.000Z" }],
  ["creation before request", { createdAt: "2026-07-28T00:05:30.000Z" }],
  ["source cut-off before Snapshot", { sourceCutoffAt: "2026-07-28T00:03:00.000Z" }],
] as const) {
  test(`rejects invalid chronology: ${label}`, () => {
    const buildInput = buildOptions();
    if ("createdAt" in mutation) {
      buildInput.createdAt = mutation.createdAt;
    } else {
      buildInput.evaluationContext = Object.freeze({
        ...buildInput.evaluationContext,
        ...mutation,
      });
    }
    const result = input.buildOrganizationVerificationPolicyEvaluationInput(buildInput);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_evaluation_input_chronology");
  });
}

test("creates an exact immutable capability scope", () => {
  const scope = evaluationScope();
  assert.equal(scope.capability, "organization_verification");
  assert.deepEqual(scope.authorizedProjectionSections, [
    "evidence_facts",
    "registry_facts",
    "submission_facts",
  ]);
  assert.equal(Object.isFrozen(scope.authorizedProjectionSections), true);
});

test("scope cannot request unknown Projection section or category", () => {
  const section = input.createOrganizationVerificationEvaluationScope({
    ...evaluationScope(),
    authorizedProjectionSections: ["snapshot_manifest"],
  });
  assert.equal(section.ok, false);
  const broad = build({
    scope: evaluationScope(
      ["evidence_facts"],
      [],
      ["unsupported.category"],
    ),
  });
  assert.equal(broad.ok, false);
  if (!broad.ok) assert.equal(broad.code, "evaluation_scope_exceeds_projection");
});

test("scope narrows declared sections and never broadens Projection", () => {
  const result = value(build({
    scope: evaluationScope(["submission_facts"], ["organization"], []),
  }));
  assert.equal(result.factSurface.registryFacts, undefined);
  assert.equal(result.factSurface.evidenceFacts, undefined);
  assert.deepEqual(
    result.factSurface.submissionFacts?.declaredSections.map((section) => section.key),
    ["organization"],
  );
});

for (const forbidden of [
  "documentValid",
  "documentExpired",
  "riskScore",
  "riskClassification",
  "complianceStatus",
  "supportedJurisdiction",
  "complete",
  "authentic",
  "requiredEvidence",
  "sufficientEvidence",
  "normalizedClassification",
]) {
  test(`contains no derived business conclusion: ${forbidden}`, () => {
    assert.equal(JSON.stringify(value(build())).includes(`"${forbidden}"`), false);
  });
}

test("arbitrary object cannot impersonate Evaluation Input", () => {
  assert.equal(
    input.isOrganizationVerificationPolicyEvaluationInput(
      Object.freeze({ policyEvaluationInputId: "policy-evaluation-input-1" }),
    ),
    false,
  );
});

test("Evaluation Input and every nested contract are deeply immutable", () => {
  const result = value(build());
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.projectionBinding), true);
  assert.equal(Object.isFrozen(result.policySetBinding), true);
  assert.equal(Object.isFrozen(result.evaluationContext), true);
  assert.equal(Object.isFrozen(result.evaluationScope), true);
  assert.equal(Object.isFrozen(result.factSurface), true);
  assert.equal(Object.isFrozen(result.factSurface.evidenceFacts), true);
  assert.equal(Object.isFrozen(result.factSurface.evidenceFacts?.[0]?.attributes), true);
});

test("Projection, Context, Scope, and Policy binding are defensively copied", () => {
  const buildInput = buildOptions();
  const result = value(
    input.buildOrganizationVerificationPolicyEvaluationInput(buildInput),
  );
  assert.notEqual(result.policySetBinding, buildInput.policySetBinding);
  assert.notEqual(result.evaluationContext, buildInput.evaluationContext);
  assert.notEqual(result.evaluationScope, buildInput.evaluationScope);
  assert.notEqual(
    result.factSurface.evidenceFacts,
    buildInput.evaluationProjection.evidenceFacts,
  );
});

test("scope collection order cannot alter semantics or fingerprint", () => {
  const left = value(build());
  const right = value(build({
    scope: evaluationScope(
      ["evidence_facts", "submission_facts", "registry_facts"],
      ["organization"],
      ["legal.identity"],
    ),
  }));
  assert.deepEqual(left, right);
  assert.equal(left.inputFingerprint, right.inputFingerprint);
});

test("object key order cannot alter deterministic fingerprint", () => {
  const first = buildOptions();
  const second = {
    ...first,
    policySetBinding: Object.freeze({
      integrityReference: first.policySetBinding.integrityReference,
      provenanceReference: first.policySetBinding.provenanceReference,
      policyContractVersion: first.policySetBinding.policyContractVersion,
      policySetVersion: first.policySetBinding.policySetVersion,
      policySetId: first.policySetBinding.policySetId,
    }),
  };
  const left = value(input.buildOrganizationVerificationPolicyEvaluationInput(first));
  const right = value(input.buildOrganizationVerificationPolicyEvaluationInput(second));
  assert.equal(left.inputFingerprint, right.inputFingerprint);
});

test("changed semantic input changes fingerprint", () => {
  const left = value(build());
  const right = value(build({ policy: policyBinding("synthetic-policy-set-2") }));
  assert.notEqual(left.inputFingerprint, right.inputFingerprint);
});

test("expected Input fingerprint mismatch fails closed", () => {
  const buildInput = {
    ...buildOptions(),
    expectedInputFingerprint: "f".repeat(64) as never,
  };
  const result =
    input.buildOrganizationVerificationPolicyEvaluationInput(buildInput);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "invalid_evaluation_input_fingerprint");
  }
});

test("identical reconstruction is idempotent", () => {
  const existing = value(build());
  const result = build({ existingInput: existing });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value, existing);
});

test("same Input ID with changed semantics is rejected", () => {
  const existing = value(build());
  const result = build({
    policy: policyBinding("synthetic-policy-set-2"),
    existingInput: existing,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "conflicting_policy_evaluation_input");
});

test("duplicate semantic Input under another identity is rejected", () => {
  const existing = value(build());
  const result = build({
    id: "policy-evaluation-input-2",
    existingInput: existing,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "duplicate_policy_evaluation_input");
});

test("earlier immutable Input remains unchanged after later construction", () => {
  const earlier = value(build());
  const fingerprint = earlier.inputFingerprint;
  const policySetId = earlier.policySetBinding.policySetId;
  value(build({ policy: policyBinding("synthetic-policy-set-2") }));
  assert.equal(earlier.inputFingerprint, fingerprint);
  assert.equal(earlier.policySetBinding.policySetId, policySetId);
});

for (const forbidden of [
  "finding",
  "ruleEvaluationResult",
  "policyEvaluationCompletion",
  "normalizedEvaluationClassification",
  "decision",
  "trustStatus",
  "eligibility",
  "workflow",
  "attemptProcessState",
  "policyExecutionResult",
]) {
  test(`creates no downstream result or authority: ${forbidden}`, () => {
    assert.equal(JSON.stringify(value(build())).includes(`"${forbidden}"`), false);
  });
}

for (const forbidden of [
  "usersVerified",
  "companyName",
  "userId",
  "role",
  "buyer",
  "seller",
  "offerOwnership",
  "offerVerification",
  "registryLifecycle",
  "documentPresent",
  "reviewerResult",
  "approved",
  "trusted",
  "participationEligibility",
  "uiSelectedPolicy",
  "seedLabel",
]) {
  test(`legacy field has no Evaluation Input authority: ${forbidden}`, () => {
    assert.equal(JSON.stringify(value(build())).includes(`"${forbidden}"`), false);
  });
}

test("public surface is explicit and excludes seals, constructors, readers, and helpers", () => {
  const publicSurface = input as Record<string, unknown>;
  assert.equal(typeof publicSurface.buildOrganizationVerificationPolicyEvaluationInput, "function");
  assert.equal(typeof publicSurface.isOrganizationVerificationPolicyEvaluationInput, "function");
  for (const forbidden of [
    "policyEvaluationInputSeal",
    "createOrganizationVerificationPolicyEvaluationInputInternal",
    "readOrganizationVerificationPolicyEvaluationInputInternal",
    "canonicalizePolicyEvaluationInputInternal",
    "computePolicyEvaluationInputFingerprintInternal",
  ]) {
    assert.equal(forbidden in publicSurface, false);
  }
  const source = fs.readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  assert.equal(/export\s+\*\s+from/.test(source), false);
});

test("Evaluation Input binds Projection facts without consuming Snapshot", () => {
  const result = value(build());
  assert.equal("evidenceSnapshot" in result, false);
  assert.equal("sourceManifest" in result, false);
  assert.equal(result.projectionBinding.sourceSnapshotId, "snapshot-input-1");
});
