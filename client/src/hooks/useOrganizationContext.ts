import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { isDemo } from "@/lib/demo";
import type { CurrentOrganizationContextDto } from "@shared/organizationOnboarding";

export const DEMO_ORGANIZATION_CONTEXT: CurrentOrganizationContextDto =
  Object.freeze({
    state: "available" as const,
    organization: Object.freeze({
      organizationId: "demo-organization",
      profileRevisionId: "demo-organization-profile",
      displayName: "Tutela Demo Organization",
      jurisdiction: "Demo jurisdiction",
      registrationIdentifiers: Object.freeze([
        Object.freeze({ scheme: "demo", value: "demo-registration" }),
      ]),
      lifecycle: "active",
      membership: Object.freeze({
        membershipId: "demo-membership",
        role: "owner" as const,
        status: "active" as const,
      }),
      verification: Object.freeze({
        phase: "not_started" as const,
        canonicalTrustStatus: null,
      }),
    }),
  });

export function useOrganizationContext(enabled = true) {
  const demoMode = isDemo();
  const query = useQuery<CurrentOrganizationContextDto | null>({
    queryKey: ["/api/organizations/current"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: enabled && !demoMode,
    retry: false,
  });

  return {
    context: demoMode ? DEMO_ORGANIZATION_CONTEXT : query.data,
    isLoading: demoMode ? false : query.isLoading,
    isError: demoMode ? false : query.isError,
  };
}
