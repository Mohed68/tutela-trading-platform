import type { CurrentOrganizationContextDto } from "@shared/organizationOnboarding";

export function organizationVerificationLabel(
  context: CurrentOrganizationContextDto | null | undefined,
): string {
  if (context?.state !== "available") return "Verification not started";
  const verification = context.organization.verification;
  if (verification.phase === "not_started") return "Verification not started";
  if (verification.phase === "in_progress") return "Verification in progress";
  if (verification.phase === "unavailable") {
    return "Verification status unavailable";
  }
  switch (verification.canonicalTrustStatus) {
    case "trusted":
      return "Verified";
    case "unestablished":
      return "Verification review required";
    case "not_trusted":
      return "Not verified";
    case "expired":
      return "Verification expired";
    case "invalidated":
      return "Verification invalidated";
    default:
      return "Verification status unavailable";
  }
}

export function shouldRequireOrganizationSetup(input: Readonly<{
  authenticated: boolean;
  demoMode: boolean;
  context: CurrentOrganizationContextDto | null | undefined;
}>): boolean {
  return (
    input.authenticated &&
    !input.demoMode &&
    input.context?.state === "setup_required"
  );
}
