import type {
  GrantPlatformRoleCommand,
  PlatformAuthorityAuditRecord,
  PlatformPermission,
  PlatformPrincipalRecord,
  PlatformRole,
  PlatformRoleAssignmentRecord,
  PlatformRoleMutationResult,
  RevokePlatformRoleCommand,
} from "./contracts.js";
import type {
  PlatformAuthorityMutationPort,
  PlatformAuthorityReadPort,
  PlatformRoleAdministrationPolicy,
} from "./ports.js";
import { isPlatformRole } from "./policy.js";
import {
  hasPlatformPermission,
  resolvePlatformAuthority,
} from "./resolver.js";

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validSessionAssurance(value: unknown): boolean {
  return (
    value === "authenticated" ||
    value === "mfa" ||
    value === "recent_step_up"
  );
}

function validCommandContext(
  command: GrantPlatformRoleCommand | RevokePlatformRoleCommand,
  expectedRole?: PlatformRole,
): boolean {
  const context = command.context;
  const scope = context?.authorizationScope;
  return (
    typeof context === "object" &&
    context !== null &&
    nonEmpty(context.requestId) &&
    nonEmpty(context.correlationId) &&
    validSessionAssurance(context.sessionAssurance) &&
    typeof scope === "object" &&
    scope !== null &&
    scope.resource === "platform_role_assignment" &&
    scope.targetPrincipalId === command.targetPrincipalId &&
    isPlatformRole(scope.targetRole) &&
    (expectedRole === undefined || scope.targetRole === expectedRole)
  );
}

function activePrincipal(
  value: PlatformPrincipalRecord | undefined,
  expectedPrincipalId: string,
): value is PlatformPrincipalRecord {
  return Boolean(
    value &&
      value.principalId === expectedPrincipalId &&
      nonEmpty(value.principalId) &&
      nonEmpty(value.userId) &&
      value.status === "active" &&
      timestamp(value.createdAt),
  );
}

function validMutationMetadata(
  input: GrantPlatformRoleCommand | RevokePlatformRoleCommand,
): boolean {
  return (
    nonEmpty(input.actorUserId) &&
    nonEmpty(input.targetPrincipalId) &&
    nonEmpty(input.reason) &&
    nonEmpty(input.auditEventId) &&
    validCommandContext(input) &&
    timestamp(input.occurredAt)
  );
}

function audit(input: {
  readonly command:
    | GrantPlatformRoleCommand
    | RevokePlatformRoleCommand;
  readonly actorPrincipalId: string;
  readonly role: PlatformRole;
  readonly action: PlatformAuthorityAuditRecord["action"];
  readonly effectivePermission: Extract<
    PlatformPermission,
    "platform.roles.grant" | "platform.roles.revoke"
  >;
  readonly before: Readonly<Record<string, unknown>>;
  readonly after: Readonly<Record<string, unknown>>;
}): PlatformAuthorityAuditRecord {
  return Object.freeze({
    auditEventId: input.command.auditEventId,
    requestId: input.command.context.requestId,
    correlationId: input.command.context.correlationId,
    actorUserId: input.command.actorUserId,
    actorPrincipalId: input.actorPrincipalId,
    targetPrincipalId: input.command.targetPrincipalId,
    role: input.role,
    action: input.action,
    before: Object.freeze({ ...input.before }),
    after: Object.freeze({ ...input.after }),
    reason: input.command.reason.trim(),
    effectivePermission: input.effectivePermission,
    sessionAssurance: input.command.context.sessionAssurance,
    authorizationScope: Object.freeze({
      ...input.command.context.authorizationScope,
    }),
    securitySeverity: "high",
    occurredAt: input.command.occurredAt,
  });
}

export function createPlatformAuthorityService(dependencies: {
  readonly read: PlatformAuthorityReadPort;
  readonly mutations: PlatformAuthorityMutationPort;
  readonly roleAdministrationPolicy: PlatformRoleAdministrationPolicy;
}) {
  return Object.freeze({
    resolvePrincipal: (authenticatedUserId: string) =>
      resolvePlatformAuthority(authenticatedUserId, dependencies.read),

    listEffectivePermissions: async (authenticatedUserId: string) =>
      (await resolvePlatformAuthority(authenticatedUserId, dependencies.read))
        .permissions,

    grantRole: async (
      command: GrantPlatformRoleCommand,
    ): Promise<PlatformRoleMutationResult> => {
      if (
        !validMutationMetadata(command) ||
        !nonEmpty(command.assignmentId) ||
        !isPlatformRole(command.role)
      ) {
        return Object.freeze({
          status: "invalid_request",
          code: "invalid_role_grant",
        });
      }
      const authority = await resolvePlatformAuthority(
        command.actorUserId,
        dependencies.read,
      );
      const authorization =
        await dependencies.roleAdministrationPolicy.authorizeRoleAdministration({
          actorAuthority: authority,
          operation: "grant",
          targetPrincipalId: command.targetPrincipalId,
          targetRole: command.role,
          context: command.context,
        });
      if (!authorization.authorized || !authority.principalId) {
        return Object.freeze({
          status: "denied",
          code: authorization.authorized
            ? "platform_role_grant_denied"
            : authorization.code,
        });
      }
      const target = await dependencies.read.findPrincipalById(
        command.targetPrincipalId,
      );
      if (!activePrincipal(target, command.targetPrincipalId)) {
        return Object.freeze({
          status: "not_found",
          code: "active_target_principal_required",
        });
      }
      const targetAuthority = await resolvePlatformAuthority(
        target.userId,
        dependencies.read,
      );
      if (
        targetAuthority.state !== "resolved" ||
        targetAuthority.principalId !== command.targetPrincipalId
      ) {
        return Object.freeze({
          status: "conflict",
          code: "invalid_target_authority_state",
        });
      }
      if (
        await dependencies.read.findRoleAssignmentById(command.assignmentId)
      ) {
        return Object.freeze({
          status: "conflict",
          code: "role_assignment_identity_exists",
        });
      }
      const existing = await dependencies.read.listRoleAssignments(
        command.targetPrincipalId,
      );
      if (
        existing.some(
          (assignment) =>
            assignment.status === "active" && assignment.role === command.role,
        )
      ) {
        return Object.freeze({
          status: "conflict",
          code: "active_role_assignment_exists",
        });
      }
      const assignment: PlatformRoleAssignmentRecord = Object.freeze({
        assignmentId: command.assignmentId,
        principalId: command.targetPrincipalId,
        role: command.role,
        status: "active",
        grantedByPrincipalId: authority.principalId,
        grantedAt: command.occurredAt,
        grantReason: command.reason.trim(),
        revokedByPrincipalId: null,
        revokedAt: null,
        revocationReason: null,
      });
      const auditRecord = audit({
        command,
        actorPrincipalId: authority.principalId,
        role: command.role,
        action: "platform_role_granted",
        effectivePermission: authorization.effectivePermission,
        before: { active: false },
        after: { active: true, assignmentId: command.assignmentId },
      });
      try {
        await dependencies.mutations.commitRoleGrant({
          assignment,
          audit: auditRecord,
        });
      } catch {
        return Object.freeze({
          status: "failed",
          code: "authority_commit_failed",
        });
      }
      return Object.freeze({
        status: "completed",
        assignment,
        audit: auditRecord,
      });
    },

    revokeRole: async (
      command: RevokePlatformRoleCommand,
    ): Promise<PlatformRoleMutationResult> => {
      if (!validMutationMetadata(command) || !nonEmpty(command.assignmentId)) {
        return Object.freeze({
          status: "invalid_request",
          code: "invalid_role_revocation",
        });
      }
      const authority = await resolvePlatformAuthority(
        command.actorUserId,
        dependencies.read,
      );
      if (
        !authority.principalId ||
        !hasPlatformPermission(authority, "platform.roles.revoke")
      ) {
        return Object.freeze({
          status: "denied",
          code: "platform_role_revocation_denied",
        });
      }
      const existing = await dependencies.read.findRoleAssignmentById(
        command.assignmentId,
      );
      if (
        !existing ||
        existing.principalId !== command.targetPrincipalId ||
        existing.status !== "active" ||
        !isPlatformRole(existing.role)
      ) {
        return Object.freeze({
          status: "not_found",
          code: "active_role_assignment_required",
        });
      }
      if (!validCommandContext(command, existing.role)) {
        return Object.freeze({
          status: "invalid_request",
          code: "invalid_role_revocation",
        });
      }
      const authorization =
        await dependencies.roleAdministrationPolicy.authorizeRoleAdministration({
          actorAuthority: authority,
          operation: "revoke",
          targetPrincipalId: command.targetPrincipalId,
          targetRole: existing.role,
          context: command.context,
        });
      if (!authorization.authorized) {
        return Object.freeze({
          status: "denied",
          code: authorization.code,
        });
      }
      const target = await dependencies.read.findPrincipalById(
        command.targetPrincipalId,
      );
      if (!activePrincipal(target, command.targetPrincipalId)) {
        return Object.freeze({
          status: "not_found",
          code: "active_target_principal_required",
        });
      }
      const targetAuthority = await resolvePlatformAuthority(
        target.userId,
        dependencies.read,
      );
      if (
        targetAuthority.state !== "resolved" ||
        targetAuthority.principalId !== command.targetPrincipalId
      ) {
        return Object.freeze({
          status: "conflict",
          code: "invalid_target_authority_state",
        });
      }
      const revoked: PlatformRoleAssignmentRecord = Object.freeze({
        ...existing,
        status: "revoked",
        revokedByPrincipalId: authority.principalId,
        revokedAt: command.occurredAt,
        revocationReason: command.reason.trim(),
      });
      const auditRecord = audit({
        command,
        actorPrincipalId: authority.principalId,
        role: existing.role,
        action: "platform_role_revoked",
        effectivePermission: authorization.effectivePermission,
        before: { active: true, assignmentId: existing.assignmentId },
        after: { active: false, assignmentId: existing.assignmentId },
      });
      try {
        await dependencies.mutations.commitRoleRevocation({
          before: existing,
          after: revoked,
          audit: auditRecord,
        });
      } catch {
        return Object.freeze({
          status: "failed",
          code: "authority_commit_failed",
        });
      }
      return Object.freeze({
        status: "completed",
        assignment: revoked,
        audit: auditRecord,
      });
    },
  });
}
