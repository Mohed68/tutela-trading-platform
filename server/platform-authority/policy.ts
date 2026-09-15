import {
  PLATFORM_PERMISSIONS,
  PLATFORM_ROLES,
  type PlatformPermission,
  type PlatformRole,
} from "./contracts.js";

const supportedRoles = new Set<string>(PLATFORM_ROLES);
const supportedPermissions = new Set<string>(PLATFORM_PERMISSIONS);

function permissions(
  ...values: PlatformPermission[]
): readonly PlatformPermission[] {
  return Object.freeze(values);
}

export const PLATFORM_ROLE_PERMISSION_MATRIX: Readonly<
  Record<PlatformRole, readonly PlatformPermission[]>
> = Object.freeze({
  PLATFORM_ADMIN: permissions(
    "platform.roles.view",
    "platform.roles.grant",
    "platform.roles.revoke",
    "security.audit.view",
    "risk.view",
    "enforcement.view",
    "enforcement.case.open",
    "enforcement.decide",
  ),
  VERIFICATION_REVIEWER: permissions(
    "verification.queue.view",
    "verification.evidence.view",
    "verification.review.submit",
    "verification.reevaluate",
  ),
  OPERATIONS: permissions(
    "offers.moderate",
    "commodity.catalog.manage",
    "risk.view",
    "risk.signal.create",
    "risk.assess",
    "risk.dispose",
    "enforcement.view",
    "enforcement.case.open",
  ),
  SUPPORT: permissions(
    "users.support.view",
    "users.support.remediate",
  ),
});

export function isPlatformRole(value: unknown): value is PlatformRole {
  return typeof value === "string" && supportedRoles.has(value);
}

export function isPlatformPermission(
  value: unknown,
): value is PlatformPermission {
  return typeof value === "string" && supportedPermissions.has(value);
}
