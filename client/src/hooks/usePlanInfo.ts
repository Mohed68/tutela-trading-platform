import { useQuery } from "@tanstack/react-query";
import { isDemo } from "@/lib/demo";

interface PlanInfo {
  currentPlan: 'freemium' | 'professional' | 'enterprise';
  planStatus: 'active' | 'cancelled' | 'past_due' | 'suspended';
  subscriptionId?: string;
  billingCycle: 'monthly' | 'annual';
  nextBillingDate?: string;
  features: {
    contractsPerMonth: number;
    documentsUpload: boolean;
    basicSupport: boolean;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
    customIntegrations: boolean;
  };
  usage: {
    contractsThisMonth: number;
    documentsUploaded: number;
    partnersConnected: number;
  };
}

export function usePlanInfo() {
  const demoMode = isDemo();
  
  const { data: planInfo, isLoading, error } = useQuery<PlanInfo>({
    queryKey: ["/api/auth/plan"],
    retry: false,
    enabled: !demoMode, // Don't fetch in demo mode
  });

  // Demo mode fallback data
  const demoPlanInfo: PlanInfo = {
    currentPlan: 'professional',
    planStatus: 'active',
    billingCycle: 'monthly',
    features: {
      contractsPerMonth: 50,
      documentsUpload: true,
      basicSupport: true,
      advancedAnalytics: true,
      prioritySupport: true,
      customIntegrations: false
    },
    usage: {
      contractsThisMonth: 12,
      documentsUploaded: 8,
      partnersConnected: 5
    }
  };

  return {
    planInfo: demoMode ? demoPlanInfo : planInfo,
    isLoading: demoMode ? false : isLoading,
    error: demoMode ? null : error,
    isDemoMode: demoMode
  };
}