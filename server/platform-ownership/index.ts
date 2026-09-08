export type { OwnershipMutationContext, PlatformOwnershipAssignment, PlatformOwnershipResolution } from "./contracts.js";
export type { PlatformOwnershipMutationPort, PlatformOwnershipReadPort } from "./ports.js";
export { createPlatformOwnershipService, isAuthenticPlatformOwnershipResolution } from "./service.js";
export { createPostgresPlatformOwnershipRepository, type ControlledOwnerIdentityCorrectionInput, type OwnershipPool } from "./postgresRepository.js";
