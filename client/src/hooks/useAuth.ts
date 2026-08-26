import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { isDemo } from "@/lib/demo";
import type { CurrentUserDto } from "@shared/auth";

export const DEMO_CURRENT_USER: CurrentUserDto = {
  id: "demo-user",
  displayName: "Demo Trader",
  email: "demo@tutela.com",
  role: "trader",
  authenticated: true,
  accountState: "active",
  organizationDisplayName: "Tutela Demo Organization",
  emailVerified: "unknown",
  userVerified: "unknown",
  kybState: "unknown",
  organizationVerification: "unknown",
};

export function useAuth() {
  const demoMode = isDemo();
  const { data: user, isLoading } = useQuery<CurrentUserDto | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !demoMode,
    retry: false,
  });

  return {
    user: demoMode ? DEMO_CURRENT_USER : (user ?? null),
    isLoading: demoMode ? false : isLoading,
    isAuthenticated: demoMode || Boolean(user),
  };
}
