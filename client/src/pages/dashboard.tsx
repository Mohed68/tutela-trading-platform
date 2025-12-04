import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AppShell from "@/components/layout/AppShell";
import MetricsCards from "@/components/dashboard/MetricsCards";
import ActiveOffers from "@/components/dashboard/ActiveOffers";
import RecentActivity from "@/components/dashboard/RecentActivity";
import AIInsights from "@/components/dashboard/AIInsights";
import { Button } from "@/components/ui/button";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ROUTES } from "@/config/routes";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
    retry: false,
  });

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <AppShell>
      <div className="p-6">
        {/* Dashboard Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: "var(--tutela-secondary)" }}>
                Trading Dashboard
              </h1>
              <p className="mt-2 text-gray-600">
                Monitor your commodity trading activities and market opportunities
              </p>
            </div>
            <div className="flex gap-3 mt-4 sm:mt-0">
              <Button onClick={() => navigate(ROUTES.marketplace)} className="tutela-btn-primary">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Browse Marketplace
              </Button>
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <MetricsCards metrics={metrics as any} isLoading={metricsLoading} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Active Offers Section */}
          <div className="lg:col-span-2">
            <ActiveOffers />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <RecentActivity />
            <AIInsights />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
