import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertCircle } from "lucide-react";
import { RecoveryDashboard } from "@/components/dashboard/RecoveryDashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import type { DashboardOverviewDto } from "@shared/dashboard";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

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
    enabled: isAuthenticated,
    retry: false,
  });

  if (isLoading || !isAuthenticated) {
    return null;
  }

  if (overviewLoading) {
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

  if (isError || !overview) {
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
    <RecoveryDashboard
      overview={overview}
      onBrowseMarketplace={() => setLocation("/marketplace")}
    />
  );
}
