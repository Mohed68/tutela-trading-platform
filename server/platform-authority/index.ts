export {
  PLATFORM_AUTHORITY_CONTRACT_VERSION,
  PLATFORM_PERMISSIONS,
  PLATFORM_ROLES,
  type GrantPlatformRoleCommand,
  type PlatformAuthorityAuditRecord,
  type PlatformAuthorityResolution,
  type PlatformPermission,
  type PlatformPrincipalRecord,
  type PlatformRole,
  type PlatformRoleAdministrationDecision,
  type PlatformRoleAdministrationOperation,
  type PlatformRoleAdministrationPolicyInput,
  type PlatformRoleAuthorizationScope,
  type PlatformRoleAssignmentRecord,
  type PlatformRoleMutationResult,
  type PrivilegedCommandContext,
  type RevokePlatformRoleCommand,
  type SessionAssurance,
} from "./contracts.js";
export {
  type PlatformAuthorityMutationPort,
  type PlatformAuthorityReadPort,
  type PlatformOwnershipGovernancePolicy,
  type PlatformRoleAdministrationPolicy,
} from "./ports.js";
export {
  isPlatformPermission,
  isPlatformRole,
  PLATFORM_ROLE_PERMISSION_MATRIX,
} from "./policy.js";
export {
  hasPlatformPermission,
  isAuthenticPlatformAuthorityResolution,
  resolvePlatformAuthority,
} from "./resolver.js";
export { createPlatformRoleAdministrationPolicy } from "./roleAdministrationPolicy.js";
export { createPlatformAuthorityService } from "./service.js";
