import type { CurrentUserDto } from "@shared/auth";

export interface AuthenticatedIdentityPresentation {
  displayName: string;
  email: string;
}

export function authenticatedIdentityPresentation(
  user: CurrentUserDto | null,
): AuthenticatedIdentityPresentation {
  const email = user?.email?.trim() || null;
  const displayName = user?.displayName?.trim() || email || "TUTELA User";

  return {
    displayName,
    email: email ?? "Email unavailable",
  };
}
