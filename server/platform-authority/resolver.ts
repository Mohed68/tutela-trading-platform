import {
  PLATFORM_AUTHORITY_CONTRACT_VERSION,
  type PlatformAuthorityResolution,
  type PlatformPermission,
  type PlatformPrincipalRecord,
  type PlatformRole,
  type PlatformRoleAssignmentRecord,
} from "./contracts.js";
import type { PlatformAuthorityReadPort } from "./ports.js";
import {
  isPlatformPermission,
  isPlatformRole,
  PLATFORM_ROLE_PERMISSION_MATRIX,
} from "./policy.js";

const authenticResolutions = new WeakSet<object>();

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validPrincipal(
  value: PlatformPrincipalRecord,
  authenticatedUserId?: string,
): boolean {
  return (
    nonEmpty(value.principalId) &&
    nonEmpty(value.userId) &&
    (value.status === "active" || value.status === "inactive") &&
    validTimestamp(value.createdAt) &&
    (authenticatedUserId === undefined || value.userId === authenticatedUserId)
  );
}

function validAssignment(
  value: PlatformRoleAssignmentRecord,
  principalId: string,
): boolean {
  const active =
    value.status === "active" &&
    value.revokedByPrincipalId === null &&
    value.revokedAt === null &&
    value.revocationReason === null;
  const revoked =
    value.status === "revoked" &&
    nonEmpty(value.revokedByPrincipalId) &&
    validTimestamp(value.revokedAt) &&
    nonEmpty(value.revocationReason);
  return (
    nonEmpty(value.assignmentId) &&
    value.principalId === principalId &&
    isPlatformRole(value.role) &&
    nonEmpty(value.grantedByPrincipalId) &&
    validTimestamp(value.grantedAt) &&
    nonEmpty(value.grantReason) &&
    (active || revoked)
  );
}

function resolution(input: {
  readonly state: PlatformAuthorityResolution["state"];
  readonly authenticatedUserId: string;
  readonly principalId: string | null;
  readonly activeRoles?: readonly PlatformRole[];
  readonly permissions?: readonly PlatformPermission[];
}): PlatformAuthorityResolution {
  const value: PlatformAuthorityResolution = Object.freeze({
    contractVersion: PLATFORM_AUTHORITY_CONTRACT_VERSION,
    state: input.state,
    authenticatedUserId: input.authenticatedUserId,
    principalId: input.principalId,
    activeRoles: Object.freeze([...(input.activeRoles ?? [])]),
    permissions: Object.freeze([...(input.permissions ?? [])]),
  });
  authenticResolutions.add(value);
  return value;
}

export async function resolvePlatformAuthority(
  authenticatedUserId: string,
  readPort: PlatformAuthorityReadPort,
): Promise<PlatformAuthorityResolution> {
  if (!nonEmpty(authenticatedUserId)) {
    return resolution({
      state: "invalid_authority_state",
      authenticatedUserId,
      principalId: null,
    });
  }
  const principal = await readPort.findPrincipalByUserId(authenticatedUserId);
  if (!principal) {
    return resolution({
      state: "no_platform_principal",
      authenticatedUserId,
      principalId: null,
    });
  }
  if (!validPrincipal(principal, authenticatedUserId)) {
    return resolution({
      state: "invalid_authority_state",
      authenticatedUserId,
      principalId: null,
    });
  }
  if (principal.status !== "active") {
    return resolution({
      state: "resolved",
      authenticatedUserId,
      principalId: principal.principalId,
    });
  }

  const assignments = await readPort.listRoleAssignments(principal.principalId);
  if (
    assignments.some(
      (assignment) => !validAssignment(assignment, principal.principalId),
    )
  ) {
    return resolution({
      state: "invalid_authority_state",
      authenticatedUserId,
      principalId: principal.principalId,
    });
  }

  const roles = new Set<PlatformRole>();
  for (const assignment of assignments) {
    if (assignment.status === "active" && isPlatformRole(assignment.role)) {
      roles.add(assignment.role);
    }
  }
  const activeRoles = [...roles].sort();
  const permissionSet = new Set<PlatformPermission>();
  for (const role of activeRoles) {
    for (const permission of PLATFORM_ROLE_PERMISSION_MATRIX[role]) {
      permissionSet.add(permission);
    }
  }
  const permissions = [...permissionSet].sort();
  return resolution({
    state: "resolved",
    authenticatedUserId,
    principalId: principal.principalId,
    activeRoles,
    permissions,
  });
}

export function isAuthenticPlatformAuthorityResolution(
  value: unknown,
): value is PlatformAuthorityResolution {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticResolutions.has(value) &&
    Object.isFrozen(value)
  );
}

export function hasPlatformPermission(
  authority: unknown,
  permission: unknown,
): boolean {
  return (
    isAuthenticPlatformAuthorityResolution(authority) &&
    authority.state === "resolved" &&
    isPlatformPermission(permission) &&
    authority.permissions.includes(permission)
  );
}
