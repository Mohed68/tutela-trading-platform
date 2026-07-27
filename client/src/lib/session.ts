// Session management and authentication state
export type UserRole = "buyer" | "seller" | "partner" | "admin";

export interface AuthState {
  loggedIn: boolean;
  role: UserRole;
  verified: boolean;
}

// Mock user session for demo purposes
const MOCK_SESSION = {
  loggedIn: true,
  role: "buyer" as UserRole,
  verified: false
};

export function getAuth(): AuthState {
  // Check if user is logged in (simplified - would normally check session/token)
  const loggedIn = true; // For demo, assume always logged in
  
  // Check verification status from body class or localStorage
  const verified = document.body.classList.contains("state-verified") || 
                  localStorage.getItem("tutela_kyb_state") === "verified";
  
  // Get role from localStorage or default to buyer
  const role = (localStorage.getItem("tutela_user_role") as UserRole) || "buyer";
  
  return {
    loggedIn,
    role,
    verified
  };
}

export function setUserRole(role: UserRole): void {
  localStorage.setItem("tutela_user_role", role);
}

export function isVerified(): boolean {
  return getAuth().verified;
}

export function hasRole(requiredRoles: UserRole[]): boolean {
  const { role, verified } = getAuth();
  return verified && requiredRoles.includes(role);
}

// Route guard helpers
export function requireVerified(): boolean {
  return isVerified();
}

export function requireRole(...roles: UserRole[]): boolean {
  return hasRole(roles);
}

export function canAccessRoute(path: string): boolean {
  const { verified } = getAuth();
  
  // Public routes - always accessible
  const publicRoutes = [
    "/", "/how-it-works", "/pricing", "/faq", "/demo", 
    "/login", "/register"
  ];
  
  // Unverified user routes
  const unverifiedRoutes = [
    "/dashboard", "/verification", "/offers", "/marketplace", "/support", "/settings"
  ];
  
  // Verified user routes
  const verifiedRoutes = [
    "/negotiations", "/contracts", "/payments", "/logistics", 
    "/orders", "/analytics", "/shipments", "/partners"
  ];
  
  // Role-specific routes
  const partnerRoutes = ["/partner"];
  const adminRoutes = ["/admin"];
  const complianceRoutes = ["/compliance"];
  
  if (publicRoutes.some(route => path.startsWith(route))) {
    return true;
  }
  
  if (unverifiedRoutes.some(route => path.startsWith(route))) {
    return true; // Always allow these for logged in users
  }
  
  if (verifiedRoutes.some(route => path.startsWith(route))) {
    return verified;
  }
  
  if (partnerRoutes.some(route => path.startsWith(route))) {
    return requireRole("partner");
  }
  
  if (adminRoutes.some(route => path.startsWith(route))) {
    return requireRole("admin");
  }
  
  if (complianceRoutes.some(route => path.startsWith(route))) {
    return requireRole("admin", "partner");
  }
  
  return true; // Default allow
}