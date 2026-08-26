import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertCircle, Building2, CheckCircle2 } from "lucide-react";
import { RecoveryDashboard } from "@/components/dashboard/RecoveryDashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { DEMO_CURRENT_USER } from "@/hooks/useAuth";
import { organizationVerificationLabel } from "@/features/organization/organizationOnboarding";
import { getDemoMarketplaceOffers, isDemo } from "@/lib/demo";
import type { DashboardOverviewDto } from "@shared/dashboard";

function demoDashboardOverview(): DashboardOverviewDto {
  const unavailable = { state: "unavailable" as const, data: null };
  return {
    account: { state: "available", data: DEMO_CURRENT_USER },
    session: { state: "available", data: { authenticated: true } },
    myOffers: { state: "available", data: { count: 3 } },
    publicMarketplace: {
      state: "available",
      data: {
        publishedOffers: getDemoMarketplaceOffers().length,
        publicationPolicy: "verified_offer_and_verified_seller_organization",
      },
    },
    contracts: unavailable,
    orders: unavailable,
    activity: unavailable,
    kyb: unavailable,
    verification: unavailable,
    subscription: unavailable,
    performanceInsights: unavailable,
    aiRecommendations: unavailable,
  };
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { context: organizationContext } =
    useOrganizationContext(isAuthenticated);
  const demoMode = isDemo();
  const organization =
    organizationContext?.state === "available"
      ? organizationContext.organization
      : null;
  const organizationCreated =
    new URLSearchParams(window.location.search).get("organizationCreated") ===
    "1";

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const {
    data: overview,
    isLoading: overviewLoading,
    isError,
  } = useQuery<DashboardOverviewDto>({
    queryKey: ["/api/dashboard/overview"],
    enabled: isAuthenticated && !demoMode,
    retry: false,
  });

  const displayedOverview = demoMode ? demoDashboardOverview() : overview;

  if (isLoading || !isAuthenticated) {
    return null;
  }

  if (!demoMode && overviewLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2" aria-label="Loading dashboard">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item}>
            <CardContent className="p-6">
              <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
              <div className="mt-5 h-9 w-20 animate-pulse rounded bg-gray-200" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-gray-100" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!demoMode && (isError || !displayedOverview)) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Dashboard temporarily unavailable</AlertTitle>
        <AlertDescription>
          Your session remains active, but the dashboard summary could not be
          loaded safely. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {organizationCreated && organization && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle2
            className="h-4 w-4 text-emerald-700"
            aria-hidden="true"
          />
          <AlertTitle>Organization created</AlertTitle>
          <AlertDescription>
            Your organization profile has been created. Complete organization
            verification to progress toward trading eligibility.
          </AlertDescription>
        </Alert>
      )}
      {organization && (
        <Card>
          <CardContent className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <Building2
                className="mt-0.5 h-5 w-5 text-emerald-700"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold text-neutral-950">
                  {organization.displayName}
                </p>
                <p className="mt-1 text-sm capitalize text-neutral-600">
                  {organization.membership.role} · {organization.lifecycle}
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  {organizationVerificationLabel(organizationContext)}
                </p>
              </div>
            </div>
            {organization.verification.canonicalTrustStatus !== "trusted" &&
              !demoMode && (
                <Button onClick={() => setLocation("/verification")}>
                  Complete Organization Verification
                </Button>
              )}
          </CardContent>
        </Card>
      )}
      <RecoveryDashboard
        overview={displayedOverview!}
        onBrowseMarketplace={() => setLocation("/marketplace")}
      />
    </div>
  );
}
