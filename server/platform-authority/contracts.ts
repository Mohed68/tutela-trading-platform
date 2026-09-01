export const PLATFORM_AUTHORITY_CONTRACT_VERSION =
  "platform-authority/v1" as const;

export const PLATFORM_ROLES = [
  "PLATFORM_ADMIN",
  "VERIFICATION_REVIEWER",
  "OPERATIONS",
  "SUPPORT",
] as const;

export const PLATFORM_PERMISSIONS = [
  "platform.roles.view",
  "platform.roles.grant",
  "platform.roles.revoke",
  "verification.queue.view",
  "verification.evidence.view",
  "verification.review.submit",
  "offers.moderate",
  "commodity.catalog.manage",
  "users.support.view",
  "users.support.remediate",
  "security.audit.view",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];
export type PlatformPrincipalStatus = "active" | "inactive";
export type PlatformRoleAssignmentStatus = "active" | "revoked";
export type SessionAssurance = "authenticated" | "mfa" | "recent_step_up";
export type PlatformRoleAdministrationOperation = "grant" | "revoke";

export interface PlatformRoleAuthorizationScope {
  readonly resource: "platform_role_assignment";
  readonly targetPrincipalId: string;
  readonly targetRole: PlatformRole;
}

/**
 * This context must eventually be assembled from trusted server-side request
 * and session state. A caller-provided claim is never session assurance.
 */
export interface PrivilegedCommandContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly sessionAssurance: SessionAssurance;
  readonly authorizationScope: PlatformRoleAuthorizationScope;
}

export interface PlatformPrincipalRecord {
  readonly principalId: string;
  readonly userId: string;
  readonly status: string;
  readonly createdAt: string;
}

export interface PlatformRoleAssignmentRecord {
  readonly assignmentId: string;
  readonly principalId: string;
  readonly role: string;
  readonly status: string;
  readonly grantedByPrincipalId: string;
  readonly grantedAt: string;
  readonly grantReason: string;
  readonly revokedByPrincipalId: string | null;
  readonly revokedAt: string | null;
  readonly revocationReason: string | null;
}

export interface PlatformAuthorityAuditRecord {
  readonly auditEventId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly actorUserId: string;
  readonly actorPrincipalId: string;
  readonly targetPrincipalId: string;
  readonly role: PlatformRole;
  readonly action: "platform_role_granted" | "platform_role_revoked";
  readonly before: Readonly<Record<string, unknown>>;
  readonly after: Readonly<Record<string, unknown>>;
  readonly reason: string;
  readonly effectivePermission:
    | "platform.roles.grant"
    | "platform.roles.revoke";
  readonly sessionAssurance: SessionAssurance;
  readonly authorizationScope: PlatformRoleAuthorizationScope;
  readonly securitySeverity: "high";
  readonly occurredAt: string;
}

export type PlatformAuthorityResolutionState =
  | "resolved"
  | "no_platform_principal"
  | "invalid_authority_state";

export interface PlatformAuthorityResolution {
  readonly contractVersion: typeof PLATFORM_AUTHORITY_CONTRACT_VERSION;
  readonly state: PlatformAuthorityResolutionState;
  readonly authenticatedUserId: string;
  readonly principalId: string | null;
  readonly activeRoles: readonly PlatformRole[];
  readonly permissions: readonly PlatformPermission[];
}

export interface GrantPlatformRoleCommand {
  readonly actorUserId: string;
  readonly targetPrincipalId: string;
  readonly role: string;
  readonly reason: string;
  readonly assignmentId: string;
  readonly auditEventId: string;
  readonly context: PrivilegedCommandContext;
  readonly occurredAt: string;
}

export interface RevokePlatformRoleCommand {
  readonly actorUserId: string;
  readonly targetPrincipalId: string;
  readonly assignmentId: string;
  readonly reason: string;
  readonly auditEventId: string;
  readonly context: PrivilegedCommandContext;
  readonly occurredAt: string;
}

export type PlatformRoleAdministrationDecision =
  | Readonly<{
      authorized: true;
      effectivePermission:
        | "platform.roles.grant"
        | "platform.roles.revoke";
    }>
  | Readonly<{
      authorized: false;
      code:
        | "platform_role_grant_denied"
        | "platform_role_revocation_denied"
        | "recent_step_up_required"
        | "platform_owner_authority_required"
        | "invalid_authorization_context";
    }>;

export interface PlatformRoleAdministrationPolicyInput {
  readonly actorAuthority: PlatformAuthorityResolution;
  readonly operation: PlatformRoleAdministrationOperation;
  readonly targetPrincipalId: string;
  readonly targetRole: PlatformRole;
  readonly context: PrivilegedCommandContext;
}

export type PlatformRoleMutationResult =
  | Readonly<{
      status: "completed";
      assignment: PlatformRoleAssignmentRecord;
      audit: PlatformAuthorityAuditRecord;
    }>
  | Readonly<{
      status: "denied" | "invalid_request" | "not_found" | "conflict";
      code: string;
    }>
  | Readonly<{
      status: "failed";
      code: "authority_commit_failed";
    }>;
