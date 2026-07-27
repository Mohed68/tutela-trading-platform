import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { CurrentUserDto } from "@shared/auth";

export function useAuth() {
  const { data: user, isLoading } = useQuery<CurrentUserDto | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: Boolean(user),
  };
}
