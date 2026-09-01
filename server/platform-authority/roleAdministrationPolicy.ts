import type {
  PlatformRoleAdministrationDecision,
  PlatformRoleAdministrationPolicyInput,
} from "./contracts.js";
import type {
  PlatformOwnershipGovernancePolicy,
  PlatformRoleAdministrationPolicy,
} from "./ports.js";
import { hasPlatformPermission } from "./resolver.js";

function deny(
  code: Extract<PlatformRoleAdministrationDecision, { authorized: false }>["code"],
): PlatformRoleAdministrationDecision {
  return Object.freeze({ authorized: false, code });
}

function contextMatches(input: PlatformRoleAdministrationPolicyInput): boolean {
  return (
    input.context.authorizationScope.resource === "platform_role_assignment" &&
    input.context.authorizationScope.targetPrincipalId ===
      input.targetPrincipalId &&
    input.context.authorizationScope.targetRole === input.targetRole
  );
}

export function createPlatformRoleAdministrationPolicy(dependencies: {
  readonly platformOwnership: PlatformOwnershipGovernancePolicy;
}): PlatformRoleAdministrationPolicy {
  return Object.freeze({
    async authorizeRoleAdministration(
      input: PlatformRoleAdministrationPolicyInput,
    ): Promise<PlatformRoleAdministrationDecision> {
      if (!contextMatches(input)) {
        return deny("invalid_authorization_context");
      }
      const effectivePermission =
        input.operation === "grant"
          ? "platform.roles.grant"
          : "platform.roles.revoke";
      if (!hasPlatformPermission(input.actorAuthority, effectivePermission)) {
        return deny(
          input.operation === "grant"
            ? "platform_role_grant_denied"
            : "platform_role_revocation_denied",
        );
      }
      if (input.targetRole === "PLATFORM_ADMIN") {
        if (input.context.sessionAssurance !== "recent_step_up") {
          return deny("recent_step_up_required");
        }
        const ownerAuthorized =
          await dependencies.platformOwnership.authorizePlatformAdminRoleMutation(
            input,
          );
        if (!ownerAuthorized) {
          return deny("platform_owner_authority_required");
        }
      }
      return Object.freeze({ authorized: true, effectivePermission });
    },
  });
}
