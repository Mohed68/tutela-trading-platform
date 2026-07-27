import { useQuery } from "@tanstack/react-query";
import { isDemo } from "@/lib/demo";

interface KybStatus {
  kybStatus: 'pending' | 'in_review' | 'verified' | 'rejected';
  verificationLevel: 'unverified' | 'basic' | 'full';
  hasCompletedKyb: boolean;
  requiredDocuments: {
    businessRegistration: 'pending' | 'uploaded' | 'verified' | 'rejected';
    taxCertificate: 'pending' | 'uploaded' | 'verified' | 'rejected';
    bankStatement: 'pending' | 'uploaded' | 'verified' | 'rejected';
    identityVerification: 'pending' | 'uploaded' | 'verified' | 'rejected';
  };
}

export function useKybStatus() {
  const demoMode = isDemo();
  
  const { data: kybStatus, isLoading, error } = useQuery<KybStatus>({
    queryKey: ["/api/auth/kyb-status"],
    retry: false,
    enabled: !demoMode, // Don't fetch in demo mode
  });

  // Demo mode fallback data
  const demoKybStatus: KybStatus = {
    kybStatus: 'verified',
    verificationLevel: 'full',
    hasCompletedKyb: true,
    requiredDocuments: {
      businessRegistration: 'verified',
      taxCertificate: 'verified',
      bankStatement: 'verified',
      identityVerification: 'verified'
    }
  };

  return {
    kybStatus: demoMode ? demoKybStatus : kybStatus,
    isLoading: demoMode ? false : isLoading,
    error: demoMode ? null : error,
    isDemoMode: demoMode
  };
}