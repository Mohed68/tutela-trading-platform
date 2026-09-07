import type { OwnershipMutationContext, PlatformOwnershipAssignment, PlatformOwnershipResolution } from "./contracts.js";
import type { PlatformOwnershipMutationPort, PlatformOwnershipReadPort } from "./ports.js";

const authenticOwnership = new WeakSet<object>();
const validTime = (value: string) => Number.isFinite(Date.parse(value));
const nonEmpty = (value: string) => value.trim().length > 0;

function resolution(value: PlatformOwnershipResolution): PlatformOwnershipResolution {
  const frozen = Object.freeze(value); authenticOwnership.add(frozen); return frozen;
}

export function isAuthenticPlatformOwnershipResolution(value: unknown): value is PlatformOwnershipResolution {
  return typeof value === "object" && value !== null && authenticOwnership.has(value) && Object.isFrozen(value);
}

export function createPlatformOwnershipService(dependencies: { read: PlatformOwnershipReadPort; mutations: PlatformOwnershipMutationPort }) {
  async function resolveOwner(userId: string): Promise<PlatformOwnershipResolution> {
    if (!nonEmpty(userId)) return resolution({ userId, principalId: null, state: "invalid_ownership_state" });
    const principalId = await dependencies.read.findPrincipalIdByUserId(userId);
    if (!principalId) return resolution({ userId, principalId: null, state: "not_owner" });
    const assignments = await dependencies.read.listOwnershipAssignments(principalId);
    if (assignments.some((a) => a.principalId !== principalId || !validTime(a.grantedAt)) || assignments.filter((a) => a.status === "active").length > 1) return resolution({ userId, principalId, state: "invalid_ownership_state" });
    return resolution({ userId, principalId, state: assignments.some((a) => a.status === "active") ? "active_owner" : "not_owner" });
  }
  function validContext(context: OwnershipMutationContext) {
    return context.sessionAssurance === "recent_step_up" && [context.actorUserId, context.actorPrincipalId, context.reason, context.requestId, context.correlationId, context.auditEventId].every(nonEmpty) && validTime(context.occurredAt);
  }
  return Object.freeze({
    resolveOwner,
    async grantPlatformOwnership(input: { targetPrincipalId: string; assignmentId: string; context: OwnershipMutationContext }) {
      if (!validContext(input.context) || !nonEmpty(input.targetPrincipalId) || !nonEmpty(input.assignmentId)) return Object.freeze({ status: "denied", code: "recent_step_up_and_reason_required" });
      const actor = await resolveOwner(input.context.actorUserId);
      if (actor.state !== "active_owner" || actor.principalId !== input.context.actorPrincipalId) return Object.freeze({ status: "denied", code: "platform_owner_required" });
      const assignment: PlatformOwnershipAssignment = Object.freeze({ assignmentId: input.assignmentId, principalId: input.targetPrincipalId, status: "active", authoritySource: "owner_succession", grantedByPrincipalId: actor.principalId, grantedAt: input.context.occurredAt, grantReason: input.context.reason.trim(), revokedByPrincipalId: null, revokedAt: null, revocationReason: null, version: 1 });
      try { await dependencies.mutations.commitOwnershipGrant({ assignment, actorUserId: input.context.actorUserId, auditEventId: input.context.auditEventId, requestId: input.context.requestId, correlationId: input.context.correlationId, sessionAssurance: "recent_step_up", occurredAt: input.context.occurredAt }); return Object.freeze({ status: "completed", assignment }); }
      catch { return Object.freeze({ status: "failed", code: "ownership_grant_commit_failed" }); }
    },
    async revokePlatformOwnership(input: { assignmentId: string; targetPrincipalId: string; context: OwnershipMutationContext }) {
      if (!validContext(input.context)) return Object.freeze({ status: "denied", code: "recent_step_up_and_reason_required" });
      const actor = await resolveOwner(input.context.actorUserId);
      if (actor.state !== "active_owner" || actor.principalId !== input.context.actorPrincipalId) return Object.freeze({ status: "denied", code: "platform_owner_required" });
      const current = (await dependencies.read.listOwnershipAssignments(input.targetPrincipalId)).find((a) => a.assignmentId === input.assignmentId && a.status === "active");
      if (!current) return Object.freeze({ status: "not_found", code: "active_ownership_required" });
      const after: PlatformOwnershipAssignment = Object.freeze({ ...current, status: "revoked", revokedByPrincipalId: actor.principalId, revokedAt: input.context.occurredAt, revocationReason: input.context.reason.trim(), version: current.version + 1 });
      try { await dependencies.mutations.commitOwnershipRevocation({ before: current, after, actorUserId: input.context.actorUserId, auditEventId: input.context.auditEventId, requestId: input.context.requestId, correlationId: input.context.correlationId, sessionAssurance: "recent_step_up", occurredAt: input.context.occurredAt }); return Object.freeze({ status: "completed", assignment: after }); }
      catch (error) { return Object.freeze({ status: "failed", code: error instanceof Error && error.message === "FINAL_PLATFORM_OWNER" ? "final_platform_owner_cannot_be_revoked" : "ownership_revocation_commit_failed" }); }
    },
  });
}
