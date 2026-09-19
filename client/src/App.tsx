import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StatusBar } from "@/components/ui/status-bar";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

import { isDemo } from "@/lib/demo";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AppLayout } from "@/components/layout/AppLayout";
import { VerifiedRoute, PartnerRoute, AdminRoute } from "@/components/navigation/RouteGuard";

// Public Pages
import NotFound from "@/pages/NotFound";
import Home from "@/pages/home";
import HowItWorks from "@/pages/how-it-works";
import Pricing from "@/pages/pricing";
import FAQ from "@/pages/faq";
import Login from "@/pages/login";
import Register from "@/pages/register";
import RegistrationPending from "@/pages/registration-pending";
import VerifyEmail from "@/pages/verify-email";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import OrganizationSetup from "@/pages/organization-setup";
import OrganizationWorkspace from "@/pages/organization";
import ActionCenter from "@/pages/action-center";

// App Pages  
import Dashboard from "@/pages/dashboard";
import Offers from "@/pages/offers";
import Marketplace from "@/pages/marketplace";
import Commodities from "@/pages/commodities";
import Orders from "@/pages/orders";
import Contracts from "@/pages/contracts";
import Verification from "@/pages/verification";
import Checkout from "@/pages/checkout";
import MyDrafts from "@/pages/MyDrafts";
import CheckoutSuccess from "@/pages/checkout-success";
import SecureAdminControlPlane from "@/pages/SecureAdminControlPlane";
import { MonitoringDashboard } from "@/components/MonitoringDashboard";
import { MfaSecuritySettings } from "@/features/security/MfaSecuritySettings";
import { EmailVerificationSettings } from "@/features/security/EmailVerificationSettings";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const demoMode = isDemo();
  const { context: organizationContext, isLoading: organizationLoading } =
    useOrganizationContext(isAuthenticated);
  
  // Determine if user should see app interface
  const showAppInterface = isAuthenticated;

  useEffect(() => {
    const publicPath = [
      "/login",
      "/register",
      "/registration-pending",
      "/verify-email",
      "/forgot-password",
      "/reset-password",
      "/home",
      "/how-it-works",
      "/pricing",
      "/faq",
      "/demo",
      "/checkout",
    ].some((path) => location === path || location.startsWith(`${path}/`));
    if (
      !isLoading &&
      !organizationLoading &&
      !publicPath &&
      location !== "/organization/setup" &&
      !location.startsWith("/admin") &&
      !["/settings", "/orders", "/contracts"].includes(location) &&
      organizationContext?.state === "setup_required" &&
      isAuthenticated &&
      !demoMode
    ) {
      navigate("/organization/setup");
    }
  }, [
    demoMode,
    isAuthenticated,
    isLoading,
    location,
    navigate,
    organizationContext,
    organizationLoading,
  ]);

  return (
    <Switch>
      <Route path="/login">
        <PublicLayout><Login /></PublicLayout>
      </Route>
      <Route path="/register">
        <PublicLayout><Register /></PublicLayout>
      </Route>
      <Route path="/registration-pending">
        <PublicLayout><RegistrationPending /></PublicLayout>
      </Route>
      <Route path="/verify-email">
        <PublicLayout><VerifyEmail /></PublicLayout>
      </Route>
      <Route path="/forgot-password"><PublicLayout><ForgotPassword /></PublicLayout></Route>
      <Route path="/reset-password"><PublicLayout><ResetPassword /></PublicLayout></Route>

      {/* Public Marketing Pages */}
      <Route path="/how-it-works">
        <PublicLayout>
          <HowItWorks />
        </PublicLayout>
      </Route>
      
      <Route path="/pricing">
        <PublicLayout>
          <Pricing />
        </PublicLayout>
      </Route>
      
      <Route path="/faq">
        <PublicLayout>
          <FAQ />
        </PublicLayout>
      </Route>
      

      {/* Checkout Flow - Available to all users */}
      <Route path="/checkout">
        <PublicLayout>
          <Checkout />
        </PublicLayout>
      </Route>
      
      <Route path="/checkout/success">
        <PublicLayout>
          <CheckoutSuccess />
        </PublicLayout>
      </Route>

      {/* Homepage - always accessible to see marketing content */}
      <Route path="/home">
        <PublicLayout>
          <Home />
        </PublicLayout>
      </Route>

      {/* App Interface Routes */}
      {showAppInterface ? (
        <>
          <Route path="/organization/setup">
            <AppLayout>
              <OrganizationSetup />
            </AppLayout>
          </Route>

          <Route path="/organization">
            <AppLayout><OrganizationWorkspace /></AppLayout>
          </Route>

          <Route path="/action-center">
            <AppLayout><ActionCenter /></AppLayout>
          </Route>

          {/* Dashboard - accessible to all logged in users */}
          <Route path="/">
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </Route>
          
          <Route path="/dashboard">
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </Route>

          {/* Verification - accessible to all logged in users */}
          <Route path="/verification">
            <AppLayout>
              <Verification />
            </AppLayout>
          </Route>

          {/* Marketplace - canonical route for browsing offers */}
          <Route path="/marketplace">
            <AppLayout>
              <Marketplace />
            </AppLayout>
          </Route>

          {/* Personal Offers Management */}
          <Route path="/offers">
            <AppLayout>
              <Offers />
            </AppLayout>
          </Route>

          {/* Private owner-only offer drafts */}
          <Route path="/my-offers">
            <AppLayout>
              <MyDrafts />
            </AppLayout>
          </Route>
          
          {/* Commodities redirect route */}
          <Route path="/commodities">
            <Commodities />
          </Route>

          {/* Verified User Routes */}
          <Route path="/negotiations">
            <VerifiedRoute>
              <AppLayout>
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-neutral-900 mb-4">Negotiations</h1>
                  <p className="text-neutral-600">NOT YET ACTIVATED — Negotiation is outside the current V2 order and contract-draft workflow.</p>
                </div>
              </AppLayout>
            </VerifiedRoute>
          </Route>

          <Route path="/contracts">
            <VerifiedRoute>
              <AppLayout>
                <Contracts />
              </AppLayout>
            </VerifiedRoute>
          </Route>

          <Route path="/payments">
            <VerifiedRoute>
              <AppLayout>
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-neutral-900 mb-4">Payments</h1>
                  <p className="text-neutral-600">NOT YET ACTIVATED — No trade payment, wallet or settlement capability is offered here.</p>
                </div>
              </AppLayout>
            </VerifiedRoute>
          </Route>

          <Route path="/logistics">
            <VerifiedRoute>
              <AppLayout>
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-neutral-900 mb-4">Logistics</h1>
                  <p className="text-neutral-600">NOT YET ACTIVATED — Shipment and logistics operations are deferred.</p>
                </div>
              </AppLayout>
            </VerifiedRoute>
          </Route>

          <Route path="/orders">
            <VerifiedRoute>
              <AppLayout>
                <Orders />
              </AppLayout>
            </VerifiedRoute>
          </Route>

          <Route path="/analytics">
            <VerifiedRoute>
              <AppLayout>
                <p className="p-8">NOT YET ACTIVATED — Trading analytics are deferred.</p>
              </AppLayout>
            </VerifiedRoute>
          </Route>

          <Route path="/monitoring">
            <AdminRoute>
              <AppLayout>
                <MonitoringDashboard />
              </AppLayout>
            </AdminRoute>
          </Route>

          <Route path="/partners">
            <VerifiedRoute>
              <AppLayout>
                <p className="p-8">NOT YET ACTIVATED — Partner operations are deferred.</p>
              </AppLayout>
            </VerifiedRoute>
          </Route>

          {/* Partner Routes */}
          <Route path="/partner/requests">
            <PartnerRoute>
              <AppLayout>
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-neutral-900 mb-4">Partner Requests</h1>
                  <p className="text-neutral-600">Manage partnership requests and applications</p>
                </div>
              </AppLayout>
            </PartnerRoute>
          </Route>

          <Route path="/partner/contracts">
            <PartnerRoute>
              <AppLayout>
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-neutral-900 mb-4">Partner Contracts</h1>
                  <p className="text-neutral-600">View and manage partner-specific contracts</p>
                </div>
              </AppLayout>
            </PartnerRoute>
          </Route>

          <Route path="/partner/billing">
            <PartnerRoute>
              <AppLayout>
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-neutral-900 mb-4">Partner Billing</h1>
                  <p className="text-neutral-600">Manage billing and revenue sharing</p>
                </div>
              </AppLayout>
            </PartnerRoute>
          </Route>

          {/* Admin Routes */}
          <Route path="/admin/:section?">
            <AdminRoute>
              <SecureAdminControlPlane />
            </AdminRoute>
          </Route>
          
          <Route path="/admin/review-queue">
            <AdminRoute>
              <AppLayout>
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-neutral-900 mb-4">Review Queue</h1>
                  <p className="text-neutral-600">Use the active Verification module in the secure Admin Control Plane.</p>
                </div>
              </AppLayout>
            </AdminRoute>
          </Route>

          <Route path="/compliance/audit-log">
            <AdminRoute>
              <AppLayout>
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-neutral-900 mb-4">Audit Log</h1>
                  <p className="text-neutral-600">Use the active Security Audit module in the secure Admin Control Plane.</p>
                </div>
              </AppLayout>
            </AdminRoute>
          </Route>

          <Route path="/compliance/reports">
            <AdminRoute>
              <AppLayout>
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-neutral-900 mb-4">Compliance Reports</h1>
                  <p className="text-neutral-600">NOT YET ACTIVATED — Compliance report generation is deferred.</p>
                </div>
              </AppLayout>
            </AdminRoute>
          </Route>

          {/* Support and Settings - accessible to all logged in users */}
          <Route path="/support">
            <AppLayout>
              <div className="text-center py-12">
                <h1 className="text-2xl font-bold text-neutral-900 mb-4">Support Center</h1>
                <p className="text-neutral-600">NOT YET ACTIVATED — No operational support case workflow is available in the current system.</p>
              </div>
            </AppLayout>
          </Route>

          <Route path="/settings">
            <AppLayout>
              <div className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold text-neutral-900 mb-6">Settings</h1>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900 mb-4">Account Settings</h2>
                    <p className="text-neutral-600 mb-4">Manage your account settings and preferences</p>
                    <EmailVerificationSettings />
                    <div className="mt-6" />
                    <MfaSecuritySettings />
                  </div>
                </div>
              </div>
            </AppLayout>
          </Route>
        </>
      ) : (
        /* Public Home Page for unauthenticated users */
        <Route path="/">
          <PublicLayout>
            <Home />
          </PublicLayout>
        </Route>
      )}

      {/* Fallback route for authenticated users to access homepage */}
      {showAppInterface && (
        <Route path="/marketing">
          <PublicLayout>
            <Home />
          </PublicLayout>
        </Route>
      )}

      {/* 404 Not Found - Catch all routes */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <StatusBar />
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
