import assert from "node:assert/strict";
import test from "node:test";

import {
  REGISTRY_CONTRACT_VERSION,
  createOrganizationId,
  createOrganizationProfileRevisionId,
  parseOrganizationProfileRevisionContract,
  type OrganizationLifecycleProjection,
} from "../organization-registry/index.js";
import {
  createOrganizationMembership,
  type OrganizationMembership,
} from "../organization-membership/index.js";
import {
  createOrganizationVerificationEvidenceStream,
} from "../organization-verification/application/persistence-contract/index.js";
import {
  createOrganizationVerificationReplayRequest,
  replayOrganizationVerificationWorkflow,
  type OrganizationVerificationReplayExecution,
} from "../organization-verification/application/replay-runtime/index.js";
import {
  buildEvidenceChain,
} from "../organization-verification/infrastructure/persistence/in-memory/persistenceAdapterConformance.test.js";
import {
  createOrganizationParticipationEligibilityRequest,
  createOrganizationParticipationEligibilityService,
  isOrganizationParticipationEligibilityResult,
  type OrganizationParticipationEligibilityDependencies,
  type OrganizationParticipationEligibilityRequest,
} from "./index.js";
import { participationReasonForTrustStatusInternal } from "./eligibilityService.js";

const PROFILE_REVISION_ID = "eligibility-profile-revision-1";

function must<T>(result: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: string }>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function evidenceReplay(entryCount?: number): OrganizationVerificationReplayExecution {
  const chain = buildEvidenceChain();
  const entries =
    entryCount === undefined ? chain.entries : chain.entries.slice(0, entryCount);
  const stream = must(
    createOrganizationVerificationEvidenceStream({
      streamIdentity: chain.streamIdentity,
      entries,
    }),
  );
  const request = must(
    createOrganizationVerificationReplayRequest({
      replayRequestId: `eligibility-replay-request-${entryCount ?? "full"}`,
      replayExecutionId: `eligibility-replay-execution-${entryCount ?? "full"}`,
      sourceEvidenceStream: stream,
      replayedAt: "2026-09-02T00:00:00.000Z",
      provenanceReferences: ["eligibility-replay-provenance"],
      integrityReferences: ["eligibility-replay-integrity"],
    }),
  );
  const replay = replayOrganizationVerificationWorkflow(request);
  assert.equal(replay.outcome, "replay_completed");
  if (replay.outcome !== "replay_completed") throw new Error(replay.failure.code);
  return replay.execution;
}

function organizationContract(
  replay: OrganizationVerificationReplayExecution,
  lifecycle: OrganizationLifecycleProjection = "active",
) {
  return must(
    parseOrganizationProfileRevisionContract({
      organization_id: replay.streamIdentity.organizationId,
      organization_profile_revision_id: PROFILE_REVISION_ID,
      organization_profile_revision_sequence: 1,
      organization_profile_fingerprint:
        "sha256:eligibility-organization-profile-fingerprint",
      legal_identity_projection: {
        legal_name: "Eligibility Test Organization",
        trading_names: [],
        registration_jurisdiction: "US",
        registration_identifiers: [{ scheme: "test", value: "eligibility-1" }],
      },
      organization_type: "company",
      jurisdiction: "US",
      declared_activity_projection: { activities: [] },
      organization_lifecycle: lifecycle,
      registry_contract_version: REGISTRY_CONTRACT_VERSION,
      published_at: "2026-09-01T00:00:00.000Z",
    }),
  );
}

function membership(
  replay: OrganizationVerificationReplayExecution,
  overrides: Partial<{
    organizationId: OrganizationVerificationReplayExecution["streamIdentity"]["organizationId"];
    status: "active" | "inactive";
  }> = {},
): OrganizationMembership {
  return must(
    createOrganizationMembership({
      membershipId: "eligibility-membership-1",
      userId: "eligibility-user-1",
      organizationId: overrides.organizationId ?? replay.streamIdentity.organizationId,
      role: "owner",
      status: overrides.status ?? "active",
      membershipVersion: 1,
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      provenanceReference: "eligibility-membership-provenance",
      integrityReference: "eligibility-membership-integrity",
    }),
  );
}

function request(replay: OrganizationVerificationReplayExecution): OrganizationParticipationEligibilityRequest {
  return must(
    createOrganizationParticipationEligibilityRequest({
      evaluationId: "eligibility-evaluation-1",
      userId: "eligibility-user-1",
      membershipId: "eligibility-membership-1",
      organizationId: replay.streamIdentity.organizationId,
      organizationProfileRevisionId: must(
        createOrganizationProfileRevisionId(PROFILE_REVISION_ID),
      ),
      expectedRegistryContractVersion: REGISTRY_CONTRACT_VERSION,
      verificationStreamIdentity: replay.streamIdentity,
      evaluatedAt: "2026-09-02T00:00:00.000Z",
    }),
  );
}

function dependencies(
  replay: OrganizationVerificationReplayExecution,
  options: Readonly<{
    lifecycle?: OrganizationLifecycleProjection;
    membership?: OrganizationMembership;
    organizationStatus?: "resolved" | "not_found" | "integrity_failure";
    membershipStatus?: "resolved" | "not_found" | "integrity_failure";
    verificationReplay?: OrganizationVerificationReplayExecution;
    verificationStatus?: "resolved" | "not_found" | "unavailable";
  }> = {},
): OrganizationParticipationEligibilityDependencies {
  const member = options.membership ?? membership(replay);
  return Object.freeze({
    organizationRegistry: Object.freeze({
      async resolveExactProfileRevision() {
        if (options.organizationStatus === "not_found") {
          return Object.freeze({
            status: "not_found" as const,
            code: "profile_revision_not_found" as const,
          });
        }
        if (options.organizationStatus === "integrity_failure") {
          return Object.freeze({
            status: "integrity_failure" as const,
            code: "profile_revision_integrity_failure" as const,
          });
        }
        return Object.freeze({
          status: "resolved" as const,
          contract: organizationContract(replay, options.lifecycle),
        });
      },
    }),
    organizationMembership: Object.freeze({
      async resolveExactMembership() {
        if (options.membershipStatus === "not_found") {
          return Object.freeze({ status: "not_found" as const });
        }
        if (options.membershipStatus === "integrity_failure") {
          return Object.freeze({ status: "integrity_failure" as const });
        }
        return Object.freeze({ status: "resolved" as const, membership: member });
      },
    }),
    organizationVerificationState: Object.freeze({
      async resolveAuthoritativeReplay() {
        if (options.verificationStatus === "not_found") {
          return Object.freeze({ status: "not_found" as const });
        }
        if (options.verificationStatus === "unavailable") {
          return Object.freeze({ status: "unavailable" as const });
        }
        return Object.freeze({
          status: "resolved" as const,
          replayExecution: options.verificationReplay ?? replay,
        });
      },
    }),
  });
}

async function evaluate(
  replay: OrganizationVerificationReplayExecution,
  configured = dependencies(replay),
) {
  const service = createOrganizationParticipationEligibilityService(configured);
  return service.evaluateParticipationEligibility(request(replay));
}

test("trusted Organization plus valid membership is eligible", async () => {
  const replay = evidenceReplay();
  const evaluation = await evaluate(replay);
  assert.equal(evaluation.status, "evaluated");
  if (evaluation.status !== "evaluated") return;
  assert.equal(evaluation.result.outcome, "eligible");
  assert.deepEqual(evaluation.result.reasonCodes, []);
  assert.equal(isOrganizationParticipationEligibilityResult(evaluation.result), true);
  assert.equal(evaluation.result.verificationReference?.trustStatus, "trusted");
});

test("missing Organization is ineligible without consulting inferred user state", async () => {
  const replay = evidenceReplay();
  const evaluation = await evaluate(
    replay,
    dependencies(replay, { organizationStatus: "not_found" }),
  );
  assert.equal(evaluation.status, "evaluated");
  if (evaluation.status !== "evaluated") return;
  assert.equal(evaluation.result.outcome, "ineligible");
  assert.deepEqual(evaluation.result.reasonCodes, ["organization_not_found"]);
});

test("missing and inactive memberships are ineligible", async () => {
  const replay = evidenceReplay();
  const missing = await evaluate(
    replay,
    dependencies(replay, { membershipStatus: "not_found" }),
  );
  const inactive = await evaluate(
    replay,
    dependencies(replay, {
      membership: membership(replay, { status: "inactive" }),
    }),
  );
  assert.equal(missing.status, "evaluated");
  assert.equal(inactive.status, "evaluated");
  if (missing.status !== "evaluated" || inactive.status !== "evaluated") return;
  assert.deepEqual(missing.result.reasonCodes, ["membership_required"]);
  assert.deepEqual(inactive.result.reasonCodes, ["membership_inactive"]);
});

test("wrong Organization membership and structural impersonation fail closed", async () => {
  const replay = evidenceReplay();
  const wrongOrganization = membership(replay, {
    organizationId: must(createOrganizationId("eligibility-other-org")),
  });
  const wrong = await evaluate(
    replay,
    dependencies(replay, { membership: wrongOrganization }),
  );
  const fake = Object.freeze({ ...membership(replay) });
  const impersonated = await evaluate(
    replay,
    dependencies(replay, { membership: fake as OrganizationMembership }),
  );
  assert.equal(wrong.status, "evaluated");
  assert.equal(impersonated.status, "evaluated");
  if (wrong.status !== "evaluated" || impersonated.status !== "evaluated") return;
  assert.deepEqual(wrong.result.reasonCodes, ["membership_scope_mismatch"]);
  assert.deepEqual(impersonated.result.reasonCodes, ["membership_integrity_failure"]);
});

test("incomplete authoritative Replay is ineligible", async () => {
  const replay = evidenceReplay();
  const incomplete = evidenceReplay(1);
  const evaluation = await evaluate(
    replay,
    dependencies(replay, { verificationReplay: incomplete }),
  );
  assert.equal(evaluation.status, "evaluated");
  if (evaluation.status !== "evaluated") return;
  assert.deepEqual(evaluation.result.reasonCodes, [
    "organization_verification_incomplete",
  ]);
});

test("unacceptable Trust states map to ineligible reasons independently", () => {
  assert.equal(participationReasonForTrustStatusInternal("trusted"), undefined);
  assert.equal(
    participationReasonForTrustStatusInternal("unestablished"),
    "organization_verification_incomplete",
  );
  for (const status of ["not_trusted", "expired", "invalidated"]) {
    assert.equal(
      participationReasonForTrustStatusInternal(status),
      "organization_not_trusted",
    );
  }
});

test("suspended and otherwise inactive Organizations are ineligible", async () => {
  const replay = evidenceReplay();
  const suspended = await evaluate(
    replay,
    dependencies(replay, { lifecycle: "suspended" }),
  );
  const registered = await evaluate(
    replay,
    dependencies(replay, { lifecycle: "registered" }),
  );
  assert.equal(suspended.status, "evaluated");
  assert.equal(registered.status, "evaluated");
  if (suspended.status !== "evaluated" || registered.status !== "evaluated") return;
  assert.deepEqual(suspended.result.reasonCodes, ["organization_suspended"]);
  assert.deepEqual(registered.result.reasonCodes, ["organization_inactive"]);
});

test("Trust remains an input reference and is never returned as Eligibility", async () => {
  const replay = evidenceReplay();
  const trust =
    replay.reconstructedWorkflowExecution.decisionTrustIntegrationExecution
      ?.trustStatus;
  assert.ok(trust);
  const evaluation = await evaluate(replay);
  assert.equal(evaluation.status, "evaluated");
  if (evaluation.status !== "evaluated") return;
  assert.notEqual(evaluation.result, trust);
  assert.equal("trustStatus" in evaluation.result, false);
  assert.equal(Object.isFrozen(trust), true);
  assert.equal(Object.isFrozen(evaluation.result), true);
  assert.equal(Object.isFrozen(evaluation.result.reasonCodes), true);
});

test("structural request impersonation is rejected before any authority call", async () => {
  const replay = evidenceReplay();
  const authentic = request(replay);
  let calls = 0;
  const base = dependencies(replay);
  const service = createOrganizationParticipationEligibilityService({
    ...base,
    organizationRegistry: {
      async resolveExactProfileRevision(query) {
        calls += 1;
        return base.organizationRegistry.resolveExactProfileRevision(query);
      },
    },
  });
  const result = await service.evaluateParticipationEligibility({
    ...authentic,
  });
  assert.deepEqual(result, {
    status: "rejected",
    code: "invalid_eligibility_request",
  });
  assert.equal(calls, 0);
});

test("same authoritative inputs produce the same Eligibility fingerprint", async () => {
  const replay = evidenceReplay();
  const first = await evaluate(replay);
  const second = await evaluate(replay);
  assert.equal(first.status, "evaluated");
  assert.equal(second.status, "evaluated");
  if (first.status !== "evaluated" || second.status !== "evaluated") return;
  assert.equal(
    first.result.eligibilityFingerprint,
    second.result.eligibilityFingerprint,
  );
  assert.notEqual(first.result, second.result);
});
