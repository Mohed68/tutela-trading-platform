import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import MetricsCards from "@/components/dashboard/MetricsCards";
import ActiveOffers from "@/components/dashboard/ActiveOffers";
import RecentActivity from "@/components/dashboard/RecentActivity";
import AIInsights from "@/components/dashboard/AIInsights";
import AIRecommendations from "@/components/dashboard/AIRecommendations";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import KybWizard from "@/components/kyb/KybWizard";
import { AnimatedButton } from "@/components/animations/AnimatedButton";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { SecureDataExample } from "@/components/SecureDataExample";

export default function Dashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const [isKybWizardOpen, setIsKybWizardOpen] = useState(false);

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
    <div className="space-y-6">
        <VerifiedBadge />
        
        {/* Dashboard Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: 'var(--tutela-secondary)' }}>Trading Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Monitor your commodity trading activities and market opportunities
              </p>
            </div>
            <div className="flex gap-3 mt-4 sm:mt-0">
              <AnimatedButton 
                animation="sparkle"
                onClick={() => setLocation('/marketplace')} 
                className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-medium"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Browse Marketplace
              </AnimatedButton>
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <MetricsCards 
          metrics={metrics as any} 
          isLoading={metricsLoading} 
          onContinueVerification={() => setIsKybWizardOpen(true)}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Active Offers Section */}
          <div className="lg:col-span-2">
            <ActiveOffers />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <RecentActivity />
            <AIRecommendations />
            <AIInsights />
          </div>
        </div>
        
        {/* Secure Data Management Demo */}
        <div className="mt-12">
          <SecureDataExample />
        </div>

      {/* KYB Verification Wizard */}
      <KybWizard
        isOpen={isKybWizardOpen}
        onClose={() => setIsKybWizardOpen(false)}
        onSubmitted={() => {
          toast({
            title: "KYB Verification Submitted",
            description: "Your documents have been submitted for review. We'll notify you once the verification is complete.",
          });
        }}
      />
    </div>
  );
}
