import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useKybStatus } from "@/hooks/useKybStatus";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { useSecurePreferences } from "@/hooks/useSecurePreferences";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Lock, Cookie, CheckCircle, AlertCircle, Clock } from "lucide-react";

export function SecureDataExample() {
  const { user, isAuthenticated } = useAuth();
  const { kybStatus, isLoading: kybLoading, isDemoMode: kybDemo } = useKybStatus();
  const { planInfo, isLoading: planLoading, isDemoMode: planDemo } = usePlanInfo();
  const { updatePreferences, isUpdating } = useSecurePreferences();

  if (!isAuthenticated) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Secure Data Management
          </CardTitle>
          <CardDescription>
            Please log in to view your secure data stored in HttpOnly cookies
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
      case 'in_review':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'rejected':
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'verified' || status === 'active' ? 'default' : 
                   status === 'pending' || status === 'in_review' ? 'secondary' : 'destructive';
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  const handleUpdateLanguage = () => {
    updatePreferences({
      language: 'es',
      timezone: 'Europe/Madrid'
    });
  };

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Secure Data Management Demo
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Cookie className="h-4 w-4" />
            All sensitive data stored in HttpOnly cookies instead of localStorage
          </CardDescription>
        </CardHeader>
      </Card>

      {/* KYB Status */}
      <Card>
        <CardHeader>
          <CardTitle>KYB Verification Status</CardTitle>
          <CardDescription>
            Business verification status managed securely via API
            {kybDemo && " (Demo Mode)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {kybLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="font-medium">Overall Status:</span>
                {getStatusBadge(kybStatus?.kybStatus || 'pending')}
              </div>
              
              <div className="flex items-center gap-4">
                <span className="font-medium">Verification Level:</span>
                {getStatusBadge(kybStatus?.verificationLevel || 'unverified')}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Required Documents:</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Business Registration:</span>
                      {getStatusBadge(kybStatus?.requiredDocuments.businessRegistration || 'pending')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Tax Certificate:</span>
                      {getStatusBadge(kybStatus?.requiredDocuments.taxCertificate || 'pending')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Bank Statement:</span>
                      {getStatusBadge(kybStatus?.requiredDocuments.bankStatement || 'pending')}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Identity Verification:</span>
                      {getStatusBadge(kybStatus?.requiredDocuments.identityVerification || 'pending')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Information */}
      <Card>
        <CardHeader>
          <CardTitle>Plan & Subscription</CardTitle>
          <CardDescription>
            Subscription details managed via secure API
            {planDemo && " (Demo Mode)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {planLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="font-medium">Current Plan:</span>
                <Badge variant="default">{planInfo?.currentPlan}</Badge>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="font-medium">Status:</span>
                {getStatusBadge(planInfo?.planStatus || 'active')}
              </div>

              <div className="flex items-center gap-4">
                <span className="font-medium">Billing Cycle:</span>
                <Badge variant="secondary">{planInfo?.billingCycle}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Features:</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Contracts/Month:</span>
                      <Badge variant="outline">
                        {planInfo?.features.contractsPerMonth === -1 ? 'Unlimited' : planInfo?.features.contractsPerMonth}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Advanced Analytics:</span>
                      <Badge variant={planInfo?.features.advancedAnalytics ? "default" : "secondary"}>
                        {planInfo?.features.advancedAnalytics ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Priority Support:</span>
                      <Badge variant={planInfo?.features.prioritySupport ? "default" : "secondary"}>
                        {planInfo?.features.prioritySupport ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Usage This Month:</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Contracts:</span>
                      <Badge variant="outline">{planInfo?.usage.contractsThisMonth}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Documents:</span>
                      <Badge variant="outline">{planInfo?.usage.documentsUploaded}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Partners:</span>
                      <Badge variant="outline">{planInfo?.usage.partnersConnected}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Secure Preferences Update */}
      <Card>
        <CardHeader>
          <CardTitle>Secure Preferences Management</CardTitle>
          <CardDescription>
            Update user preferences via HttpOnly cookie-based API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="font-medium">Current Language:</span>
              <Badge variant="outline">{(user as any)?.language || 'en'}</Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="font-medium">Timezone:</span>
              <Badge variant="outline">{(user as any)?.timezone || 'UTC'}</Badge>
            </div>

            <Button 
              onClick={handleUpdateLanguage}
              disabled={isUpdating}
              className="w-full"
            >
              {isUpdating ? 'Updating...' : 'Test: Update Language to Spanish'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Financial Benefits */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Financial & Commercial Benefits
          </CardTitle>
        </CardHeader>
        <CardContent className="text-green-700">
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Comprehensive fraud protection safeguards every transaction</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Verified partner network increases successful trade completion rates</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Faster payment processing and dispute resolution saves 2-3 weeks per trade</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Lower insurance costs and better credit terms from trusted platform usage</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}