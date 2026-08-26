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

import { getAuth } from "@/lib/session";
import { isDemo } from "@/lib/demo";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AppLayout } from "@/components/layout/AppLayout";
import { RouteGuard, VerifiedRoute, PartnerRoute, AdminRoute } from "@/components/navigation/RouteGuard";
import { PaymentSimulation } from "@/components/payment/PaymentSimulation";

// Public Pages
import NotFound from "@/pages/NotFound";
import Home from "@/pages/home";
import HowItWorks from "@/pages/how-it-works";
import Pricing from "@/pages/pricing";
import FAQ from "@/pages/faq";
import Demo from "@/pages/demo";
import Login from "@/pages/login";
import Register from "@/pages/register";
import RegistrationPending from "@/pages/registration-pending";
import VerifyEmail from "@/pages/verify-email";
import OrganizationSetup from "@/pages/organization-setup";

// App Pages  
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Offers from "@/pages/offers";
import Marketplace from "@/pages/marketplace";
import Commodities from "@/pages/commodities";
import Orders from "@/pages/orders";
import Contracts from "@/pages/contracts";
import Partners from "@/pages/partners";
import Verification from "@/pages/verification";
import Insights from "@/pages/insights";
import Checkout from "@/pages/checkout";
import MyDrafts from "@/pages/MyDrafts";
import DemoContractPreview from "@/pages/demo-contract-preview";
import CheckoutSuccess from "@/pages/checkout-success";
import AdminDashboard from "@/pages/AdminDashboard";
import { AnimationShowcase } from "@/components/demo/AnimationShowcase";
import { MonitoringDashboard } from "@/components/MonitoringDashboard";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const demoMode = isDemo();
  const { context: organizationContext, isLoading: organizationLoading } =
    useOrganizationContext(isAuthenticated);
  const { verified } = getAuth();
  
  // Determine if user should see app interface
  const showAppInterface = isAuthenticated;

  useEffect(() => {
    const publicPath = [
      "/login",
      "/register",
      "/registration-pending",
      "/verify-email",
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
      
      <Route path="/demo">
        <PublicLayout>
          <Demo />
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

          {/* Browser-local simulation; never backed by the real contracts API. */}
          <Route path="/demo/contracts/:reservationId">
            <AppLayout>
              <DemoContractPreview />
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
                  <p className="text-neutral-600">Manage your active negotiations and proposals</p>
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
                  <p className="text-neutral-600">Track payments, manage wallet, and view transaction history</p>
                </div>
              </AppLayout>
            </VerifiedRoute>
          </Route>

          <Route path="/logistics">
            <VerifiedRoute>
              <AppLayout>
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-neutral-900 mb-4">Logistics</h1>
                  <p className="text-neutral-600">Manage shipments and logistics partners</p>
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
                <Insights />
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
                <Partners />
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
              <AdminDashboard />
            </AdminRoute>
          </Route>
          
          <Route path="/admin/review-queue">
            <AdminRoute>
              <AppLayout>
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-neutral-900 mb-4">Review Queue</h1>
                  <p className="text-neutral-600">Review pending verifications and applications</p>
                </div>
              </AppLayout>
            </AdminRoute>
          </Route>

          <Route path="/compliance/audit-log">
            <AdminRoute>
              <AppLayout>
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-neutral-900 mb-4">Audit Log</h1>
                  <p className="text-neutral-600">View comprehensive audit trail and system logs</p>
                </div>
              </AppLayout>
            </AdminRoute>
          </Route>

          <Route path="/compliance/reports">
            <AdminRoute>
              <AppLayout>
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-neutral-900 mb-4">Compliance Reports</h1>
                  <p className="text-neutral-600">Generate and view compliance reports</p>
                </div>
              </AppLayout>
            </AdminRoute>
          </Route>

          {/* Support and Settings - accessible to all logged in users */}
          <Route path="/support">
            <AppLayout>
              <div className="text-center py-12">
                <h1 className="text-2xl font-bold text-neutral-900 mb-4">Support Center</h1>
                <p className="text-neutral-600">Get help and contact our support team</p>
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
                  </div>
                  <PaymentSimulation />
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
