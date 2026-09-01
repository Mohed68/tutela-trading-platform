import type {
  PlatformAuthorityAuditRecord,
  PlatformAuthorityResolution,
  PlatformPrincipalRecord,
  PlatformRole,
  PlatformRoleAdministrationDecision,
  PlatformRoleAdministrationOperation,
  PlatformRoleAdministrationPolicyInput,
  PlatformRoleAssignmentRecord,
  PrivilegedCommandContext,
} from "./contracts.js";

export interface PlatformAuthorityReadPort {
  findPrincipalByUserId(
    authenticatedUserId: string,
  ): Promise<PlatformPrincipalRecord | undefined>;
  findPrincipalById(
    principalId: string,
  ): Promise<PlatformPrincipalRecord | undefined>;
  listRoleAssignments(
    principalId: string,
  ): Promise<readonly PlatformRoleAssignmentRecord[]>;
  findRoleAssignmentById(
    assignmentId: string,
  ): Promise<PlatformRoleAssignmentRecord | undefined>;
}

export interface AuditedPlatformRoleGrant {
  readonly assignment: PlatformRoleAssignmentRecord;
  readonly audit: PlatformAuthorityAuditRecord;
}

export interface AuditedPlatformRoleRevocation {
  readonly before: PlatformRoleAssignmentRecord;
  readonly after: PlatformRoleAssignmentRecord;
  readonly audit: PlatformAuthorityAuditRecord;
}

/**
 * Implementations must persist the role mutation and its security audit record
 * atomically. A partial authority change is a contract failure, not a
 * best-effort logging condition.
 */
export interface PlatformAuthorityMutationPort {
  commitRoleGrant(input: AuditedPlatformRoleGrant): Promise<void>;
  commitRoleRevocation(input: AuditedPlatformRoleRevocation): Promise<void>;
}

/**
 * Platform Owner is a future durable ownership assignment, never a Platform
 * Role or boolean flag. A future implementation of this policy must enforce:
 * at least one active owner, grant-new/confirm/revoke-old succession, no final
 * owner removal, recent MFA, audited server-side recovery, and no HTTP
 * self-promotion. Ownership never grants canonical domain truth authority.
 */
export interface PlatformOwnershipGovernancePolicy {
  authorizePlatformAdminRoleMutation(input: Readonly<{
    actorAuthority: PlatformAuthorityResolution;
    operation: PlatformRoleAdministrationOperation;
    targetPrincipalId: string;
    targetRole: PlatformRole;
    context: PrivilegedCommandContext;
  }>): Promise<boolean>;
}

export interface PlatformRoleAdministrationPolicy {
  authorizeRoleAdministration(
    input: PlatformRoleAdministrationPolicyInput,
  ): Promise<PlatformRoleAdministrationDecision>;
}
