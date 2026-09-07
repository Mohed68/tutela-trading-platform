export type PlatformOwnershipStatus = "active" | "revoked";
export type PlatformOwnershipAuthoritySource = "initial_bootstrap" | "owner_succession";

export interface PlatformOwnershipAssignment {
  readonly assignmentId: string;
  readonly principalId: string;
  readonly status: PlatformOwnershipStatus;
  readonly authoritySource: PlatformOwnershipAuthoritySource;
  readonly grantedByPrincipalId: string | null;
  readonly grantedAt: string;
  readonly grantReason: string;
  readonly revokedByPrincipalId: string | null;
  readonly revokedAt: string | null;
  readonly revocationReason: string | null;
  readonly version: number;
}

export interface PlatformOwnershipResolution {
  readonly userId: string;
  readonly principalId: string | null;
  readonly state: "active_owner" | "not_owner" | "invalid_ownership_state";
}

export interface OwnershipMutationContext {
  readonly actorUserId: string;
  readonly actorPrincipalId: string;
  readonly sessionAssurance: "authenticated" | "mfa" | "recent_step_up";
  readonly reason: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly auditEventId: string;
  readonly occurredAt: string;
}
