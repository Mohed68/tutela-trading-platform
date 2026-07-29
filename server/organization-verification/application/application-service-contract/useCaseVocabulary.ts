export const ORGANIZATION_VERIFICATION_APPLICATION_USE_CASES = Object.freeze([
  "start_organization_verification",
  "advance_organization_verification_workflow",
  "load_organization_verification_state",
  "replay_organization_verification_history",
] as const);

export type OrganizationVerificationApplicationUseCase =
  (typeof ORGANIZATION_VERIFICATION_APPLICATION_USE_CASES)[number];

export const ORGANIZATION_VERIFICATION_APPLICATION_COMMANDS = Object.freeze([
  "start_organization_verification",
  "advance_organization_verification_workflow",
] as const);

export type OrganizationVerificationApplicationCommand =
  (typeof ORGANIZATION_VERIFICATION_APPLICATION_COMMANDS)[number];

export const ORGANIZATION_VERIFICATION_APPLICATION_QUERIES = Object.freeze([
  "load_organization_verification_state",
  "replay_organization_verification_history",
] as const);

export type OrganizationVerificationApplicationQuery =
  (typeof ORGANIZATION_VERIFICATION_APPLICATION_QUERIES)[number];

export function isOrganizationVerificationApplicationUseCase(
  value: unknown,
): value is OrganizationVerificationApplicationUseCase {
  return (
    typeof value === "string" &&
    ORGANIZATION_VERIFICATION_APPLICATION_USE_CASES.some(
      (candidate) => candidate === value,
    )
  );
}

export function isOrganizationVerificationApplicationCommand(
  value: unknown,
): value is OrganizationVerificationApplicationCommand {
  return (
    typeof value === "string" &&
    ORGANIZATION_VERIFICATION_APPLICATION_COMMANDS.some(
      (candidate) => candidate === value,
    )
  );
}

export function isOrganizationVerificationApplicationQuery(
  value: unknown,
): value is OrganizationVerificationApplicationQuery {
  return (
    typeof value === "string" &&
    ORGANIZATION_VERIFICATION_APPLICATION_QUERIES.some(
      (candidate) => candidate === value,
    )
  );
}
