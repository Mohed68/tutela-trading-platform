import type { PlatformOwnershipAssignment } from "./contracts.js";

export interface PlatformOwnershipReadPort {
  findPrincipalIdByUserId(userId: string): Promise<string | undefined>;
  listOwnershipAssignments(principalId?: string): Promise<readonly PlatformOwnershipAssignment[]>;
}

export interface PlatformOwnershipMutationPort {
  commitOwnershipGrant(input: { assignment: PlatformOwnershipAssignment; actorUserId: string; auditEventId: string; requestId: string; correlationId: string; sessionAssurance: "recent_step_up"; occurredAt: string }): Promise<void>;
  commitOwnershipRevocation(input: { before: PlatformOwnershipAssignment; after: PlatformOwnershipAssignment; actorUserId: string; auditEventId: string; requestId: string; correlationId: string; sessionAssurance: "recent_step_up"; occurredAt: string }): Promise<void>;
}
