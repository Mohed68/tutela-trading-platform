import React from "react";
import { useLocation } from "wouter";
import { getAuth, canAccessRoute } from "@/lib/session";

interface RouteGuardProps {
  children: React.ReactNode;
  requireVerified?: boolean;
  requireRoles?: string[];
  fallbackPath?: string;
}

export function RouteGuard({ 
  children, 
  requireVerified = false, 
  requireRoles = [],
  fallbackPath = "/verification"
}: RouteGuardProps) {
  const [location, setLocation] = useLocation();
  const { verified, role } = getAuth();

  React.useEffect(() => {
    // Check if verification is required but user is not verified
    if (requireVerified && !verified) {
      setLocation(fallbackPath);
      return;
    }

    // Check if specific roles are required
    if (requireRoles.length > 0) {
      if (!verified || !requireRoles.includes(role)) {
        setLocation("/dashboard");
        return;
      }
    }

    // Check general route access
    if (!canAccessRoute(location)) {
      if (!verified) {
        setLocation("/verification");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [location, verified, role, requireVerified, requireRoles, fallbackPath, setLocation]);

  // Allow access if all checks pass
  if (requireVerified && !verified) {
    return null;
  }

  if (requireRoles.length > 0 && (!verified || !requireRoles.includes(role))) {
    return null;
  }

  return <>{children}</>;
}

// Convenient wrapper components for common guard patterns
export function VerifiedRoute({ children, fallbackPath }: { 
  children: React.ReactNode; 
  fallbackPath?: string; 
}) {
  return (
    <RouteGuard requireVerified={true} fallbackPath={fallbackPath}>
      {children}
    </RouteGuard>
  );
}

export function PartnerRoute({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard requireVerified={true} requireRoles={["partner", "admin"]}>
      {children}
    </RouteGuard>
  );
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [state, setState] = React.useState<"loading" | "allowed" | "denied">("loading");

  React.useEffect(() => {
    let current = true;
    fetch("/admin/auth/info", { credentials: "include" }).then((response) => {
      if (!current) return;
      if (response.ok) setState("allowed");
      else {
        setState("denied");
        setLocation(response.status === 401 ? "/login" : "/dashboard");
      }
    }).catch(() => {
      if (current) {
        setState("denied");
        setLocation("/dashboard");
      }
    });
    return () => { current = false; };
  }, [setLocation]);

  if (state !== "allowed") {
    return state === "loading" ? <p className="p-8 text-sm text-neutral-600">Checking platform authority…</p> : null;
  }
  return <>{children}</>;
}

export function ComplianceRoute({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard requireVerified={true} requireRoles={["admin", "partner"]}>
      {children}
    </RouteGuard>
  );
}
