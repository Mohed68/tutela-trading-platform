import { createHash } from "node:crypto";

import type { ReadonlyPostgresPort, ReadonlyPostgresRow } from "../infrastructure/readonlyPostgres.js";
import {
  REGISTRY_CONTRACT_VERSION,
  createOrganizationId,
  createOrganizationProfileRevisionId,
  createPostgresOrganizationRegistryProfileRevisionAdapter,
  type OrganizationId,
  type OrganizationProfileRevisionId,
} from "../organization-registry/index.js";
import { createPostgresOrganizationMembershipReadAdapter } from "../organization-membership/index.js";
import {
  createOrganizationVerificationReplayRequest,
  replayOrganizationVerificationWorkflow,
} from "../organization-verification/application/replay-runtime/index.js";
import {
  createOrganizationVerificationWorkflowStreamIdentity,
  type OrganizationVerificationEvidenceStreamLoadPort,
  type OrganizationVerificationWorkflowStreamIdentity,
} from "../organization-verification/application/persistence-contract/index.js";
import { createOrganizationParticipationEligibilityRequest } from "./eligibilityContracts.js";
import type { OrganizationParticipationEligibilityResult } from "./eligibilityContracts.js";
import type { OrganizationVerificationParticipationStatePort } from "./eligibilityPorts.js";
import { createOrganizationParticipationEligibilityService } from "./eligibilityService.js";

export interface OrganizationParticipationRuntimeBinding {
  readonly bindingId: string;
  readonly organizationId: OrganizationId;
  readonly userId: string;
  readonly membershipId: string;
  readonly organizationProfileRevisionId: OrganizationProfileRevisionId;
  readonly verificationStreamIdentity: OrganizationVerificationWorkflowStreamIdentity;
  readonly bindingVersion: number;
  readonly integrityReference: string;
  readonly bindingFingerprint: string;
}

export type OrganizationParticipationRuntimeBindingResolution =
  | Readonly<{ status: "resolved"; binding: OrganizationParticipationRuntimeBinding }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "integrity_failure" }>;

export interface OrganizationParticipationRuntimeBindingReadPort {
  resolveCurrentBinding(input: Readonly<{
    organizationId: string;
    userId: string;
  }>): Promise<OrganizationParticipationRuntimeBindingResolution>;
}

type CurrentParticipationQuery = Readonly<{
  organizationId: string;
  userId: string;
}>;

export interface OrganizationParticipationRuntimeClock {
  now(): string;
}

export type CurrentOrganizationParticipationEligibilityResolution =
  | Readonly<{
      status: "resolved";
      result: OrganizationParticipationEligibilityResult;
    }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "unavailable" }>
  | Readonly<{ status: "integrity_failure" }>;

export interface CurrentOrganizationParticipationEligibilityReadPort {
  resolveCurrentOrganizationParticipationEligibility(input: Readonly<{
    organizationId: string;
    userId: string;
  }>): Promise<CurrentOrganizationParticipationEligibilityResolution>;
}

const SELECT_CURRENT_BINDING = `/* organization-participation:resolve-runtime-binding */
SELECT binding.binding_id, binding.organization_id, binding.user_id,
       binding.membership_id, binding.organization_profile_revision_id,
       binding.binding_version, binding.integrity_reference,
       binding.binding_fingerprint, stream.workflow_execution_id,
       stream.record_id, stream.revision_id, stream.attempt_id,
       stream.stream_identity_fingerprint
FROM public.organization_participation_runtime_bindings AS binding
INNER JOIN public.organization_verification_persistence_streams AS stream
  ON stream.stream_identity_fingerprint = binding.verification_stream_identity_fingerprint
WHERE binding.organization_id = $1 AND binding.user_id = $2`;

function text(row: ReadonlyPostgresRow, field: string): string | undefined {
  const value = row[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function integer(row: ReadonlyPostgresRow, field: string): number | undefined {
  const value = row[field];
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

interface RuntimeBindingFingerprintInput {
  readonly bindingId: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly organizationProfileRevisionId: string;
  readonly verificationStreamIdentityFingerprint: string;
  readonly bindingVersion: number;
  readonly integrityReference: string;
}

export function fingerprintOrganizationParticipationRuntimeBinding(
  input: RuntimeBindingFingerprintInput,
): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify({
      scope: "organization-participation-runtime-binding/v1",
      bindingId: input.bindingId,
      organizationId: input.organizationId,
      userId: input.userId,
      membershipId: input.membershipId,
      organizationProfileRevisionId: input.organizationProfileRevisionId,
      verificationStreamIdentityFingerprint:
        input.verificationStreamIdentityFingerprint,
      bindingVersion: input.bindingVersion,
      integrityReference: input.integrityReference,
    }))
    .digest("hex")}`;
}

export function createPostgresOrganizationParticipationRuntimeBindingAdapter(
  database: ReadonlyPostgresPort,
): OrganizationParticipationRuntimeBindingReadPort {
  return Object.freeze({
    async resolveCurrentBinding(input: CurrentParticipationQuery) {
      const result = await database.query(SELECT_CURRENT_BINDING, [
        input.organizationId,
        input.userId,
      ]);
      if (result.rowCount === 0) {
        return Object.freeze({ status: "not_found" as const });
      }
      if (result.rowCount !== 1 || result.rows.length !== 1) {
        return Object.freeze({ status: "integrity_failure" as const });
      }
      const row = result.rows[0];
      const organizationId = createOrganizationId(text(row, "organization_id"));
      const profileRevisionId = createOrganizationProfileRevisionId(
        text(row, "organization_profile_revision_id"),
      );
      const streamIdentity = createOrganizationVerificationWorkflowStreamIdentity({
        workflowExecutionId: text(row, "workflow_execution_id") ?? "",
        organizationId: text(row, "organization_id") ?? "",
        recordId: text(row, "record_id") ?? "",
        revisionId: text(row, "revision_id") ?? "",
        attemptId: text(row, "attempt_id") ?? "",
      });
      const bindingVersion = integer(row, "binding_version");
      const bindingId = text(row, "binding_id");
      const userId = text(row, "user_id");
      const membershipId = text(row, "membership_id");
      const integrityReference = text(row, "integrity_reference");
      if (
        !organizationId.ok ||
        !profileRevisionId.ok ||
        !streamIdentity.ok ||
        bindingVersion === undefined ||
        bindingId === undefined ||
        userId === undefined ||
        membershipId === undefined ||
        integrityReference === undefined ||
        streamIdentity.value.streamIdentityFingerprint !==
          text(row, "stream_identity_fingerprint")
      ) {
        return Object.freeze({ status: "integrity_failure" as const });
      }
      const expectedFingerprint =
        fingerprintOrganizationParticipationRuntimeBinding({
          bindingId,
          organizationId: organizationId.value,
          userId,
          membershipId,
          organizationProfileRevisionId: profileRevisionId.value,
          verificationStreamIdentityFingerprint:
            streamIdentity.value.streamIdentityFingerprint,
          bindingVersion,
          integrityReference,
        });
      if (
        expectedFingerprint !== text(row, "binding_fingerprint") ||
        organizationId.value !== input.organizationId ||
        userId !== input.userId
      ) {
        return Object.freeze({ status: "integrity_failure" as const });
      }
      return Object.freeze({
        status: "resolved" as const,
        binding: Object.freeze({
          bindingId,
          organizationId: organizationId.value,
          userId,
          membershipId,
          organizationProfileRevisionId: profileRevisionId.value,
          verificationStreamIdentity: streamIdentity.value,
          bindingVersion,
          integrityReference,
          bindingFingerprint: expectedFingerprint,
        }),
      });
    },
  });
}

function replayIdentity(
  scope: "request" | "execution",
  streamIdentityFingerprint: string,
  replayedAt: string,
): string {
  return `participation-replay-${scope}-${createHash("sha256")
    .update(`${streamIdentityFingerprint}:${replayedAt}:${scope}`)
    .digest("hex")}`;
}

export function createOrganizationVerificationParticipationStateAdapter(
  evidence: OrganizationVerificationEvidenceStreamLoadPort,
  clock: OrganizationParticipationRuntimeClock,
): OrganizationVerificationParticipationStatePort {
  return Object.freeze({
    async resolveAuthoritativeReplay(input: Readonly<{
      streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
    }>) {
      try {
        const loaded = await evidence.loadOrganizationVerificationEvidenceStream({
          streamIdentity: input.streamIdentity,
        });
        if (loaded.status === "not_found") {
          return Object.freeze({ status: "not_found" as const });
        }
        const replayedAt = clock.now();
        const request = createOrganizationVerificationReplayRequest({
          replayRequestId: replayIdentity(
            "request",
            input.streamIdentity.streamIdentityFingerprint,
            replayedAt,
          ),
          replayExecutionId: replayIdentity(
            "execution",
            input.streamIdentity.streamIdentityFingerprint,
            replayedAt,
          ),
          sourceEvidenceStream: loaded.stream,
          replayedAt,
          provenanceReferences: [
            `organization-participation-replay:${input.streamIdentity.streamIdentityFingerprint}`,
          ],
          integrityReferences: [loaded.stream.evidenceStreamFingerprint],
        });
        if (!request.ok) {
          return Object.freeze({ status: "unavailable" as const });
        }
        const replay = replayOrganizationVerificationWorkflow(request.value);
        return replay.outcome === "replay_completed"
          ? Object.freeze({
              status: "resolved" as const,
              replayExecution: replay.execution,
            })
          : Object.freeze({ status: "unavailable" as const });
      } catch {
        return Object.freeze({ status: "unavailable" as const });
      }
    },
  });
}

export function createMarketplaceOrganizationParticipationEligibilityAdapter(
  dependencies: Readonly<{
    binding: OrganizationParticipationRuntimeBindingReadPort;
    eligibilityService: ReturnType<typeof createOrganizationParticipationEligibilityService>;
    clock: OrganizationParticipationRuntimeClock;
  }>,
): CurrentOrganizationParticipationEligibilityReadPort {
  return Object.freeze({
    async resolveCurrentOrganizationParticipationEligibility(
      input: CurrentParticipationQuery,
    ) {
      try {
        const binding = await dependencies.binding.resolveCurrentBinding(input);
        if (binding.status !== "resolved") return binding;
        const evaluatedAt = dependencies.clock.now();
        const evaluationId = `participation-evaluation-${createHash("sha256")
          .update(`${binding.binding.bindingFingerprint}:${evaluatedAt}`)
          .digest("hex")}`;
        const request = createOrganizationParticipationEligibilityRequest({
          evaluationId,
          userId: binding.binding.userId,
          membershipId: binding.binding.membershipId,
          organizationId: binding.binding.organizationId,
          organizationProfileRevisionId:
            binding.binding.organizationProfileRevisionId,
          expectedRegistryContractVersion: REGISTRY_CONTRACT_VERSION,
          verificationStreamIdentity:
            binding.binding.verificationStreamIdentity,
          evaluatedAt,
        });
        if (!request.ok) {
          return Object.freeze({ status: "integrity_failure" as const });
        }
        const evaluation =
          await dependencies.eligibilityService.evaluateParticipationEligibility(
            request.value,
          );
        return evaluation.status === "evaluated"
          ? Object.freeze({
              status: "resolved" as const,
              result: evaluation.result,
            })
          : Object.freeze({ status: "integrity_failure" as const });
      } catch {
        return Object.freeze({ status: "unavailable" as const });
      }
    },
  });
}

export function createPostgresMarketplaceOrganizationParticipationEligibilityAdapter(
  dependencies: Readonly<{
    database: ReadonlyPostgresPort;
    evidenceStream: OrganizationVerificationEvidenceStreamLoadPort;
    clock: OrganizationParticipationRuntimeClock;
  }>,
): CurrentOrganizationParticipationEligibilityReadPort {
  const eligibilityService = createOrganizationParticipationEligibilityService({
    organizationRegistry:
      createPostgresOrganizationRegistryProfileRevisionAdapter(
        dependencies.database,
      ),
    organizationMembership: createPostgresOrganizationMembershipReadAdapter(
      dependencies.database,
    ),
    organizationVerificationState:
      createOrganizationVerificationParticipationStateAdapter(
        dependencies.evidenceStream,
        dependencies.clock,
      ),
  });
  return createMarketplaceOrganizationParticipationEligibilityAdapter({
    binding: createPostgresOrganizationParticipationRuntimeBindingAdapter(
      dependencies.database,
    ),
    eligibilityService,
    clock: dependencies.clock,
  });
}
