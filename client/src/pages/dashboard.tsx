import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CheckCircle2,
  FileCheck2,
  LockKeyhole,
  Package,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/layout/AppShell";
import MetricsCards from "@/components/dashboard/MetricsCards";
import ActiveOffers from "@/components/dashboard/ActiveOffers";
import RecentActivity from "@/components/dashboard/RecentActivity";
import AIInsights from "@/components/dashboard/AIInsights";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type AccessStatus } from "@/lib/access";
import { ROUTES } from "@/config/routes";

const marketplaceSnapshot = [
  { label: "Marketplace Value", value: "$113M+", icon: TrendingUp },
  { label: "Active Opportunities", value: "15+", icon: Package },
  { label: "Verified Traders", value: "9+", icon: Users },
  { label: "Core Categories", value: "4", icon: BadgeCheck },
];

const unlockBenefits = [
  "Real pricing and deal values",
  "Verified company identities",
  "Counterparty documents",
  "Negotiation workspace",
  "Contracts and shipment tracking",
];

const verificationSteps = [
  { label: "Company account created", status: "Complete", complete: true },
  { label: "Company profile", status: "Pending", complete: false },
  { label: "Legal documents", status: "Pending", complete: false },
  { label: "KYB review", status: "Locked", complete: false },
];

function AccessStateCard({
  title,
  description,
  cta,
  onClick,
  children,
}: {
  title: string;
  description: string;
  cta: string;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <Card className="border-gray-200 bg-white shadow-sm">
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="mt-2 text-gray-600">{description}</p>
        {children && <div className="mt-6">{children}</div>}
        <Button onClick={onClick} className="tutela-btn-primary mt-6">
          {cta}
        </Button>
      </CardContent>
    </Card>
  );
}

function SnapshotCards() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {marketplaceSnapshot.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="border-gray-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-black text-gray-900">{item.value}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function VerificationProgress() {
  return (
    <Card className="border-gray-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          Verification progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {verificationSteps.map((step) => (
          <div key={step.label} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-3">
              {step.complete ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <div className="h-5 w-5 rounded-full border border-gray-300" />
              )}
              <span className="text-sm font-medium text-gray-800">{step.label}</span>
            </div>
            <span className="text-sm text-gray-600">{step.status}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function UnlockBenefits() {
  return (
    <Card className="border-gray-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
          <LockKeyhole className="h-5 w-5 text-amber-600" />
          Unlock after verification
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {unlockBenefits.map((benefit) => (
          <div key={benefit} className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
            <LockKeyhole className="h-4 w-4 text-gray-400" />
            {benefit}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RestrictedDashboard({
  status,
  onMarketplace,
  onVerification,
}: {
  status: AccessStatus;
  onMarketplace: () => void;
  onVerification: () => void;
}) {
  const title =
    status === "pending"
      ? "Verification submitted"
      : status === "rejected"
        ? "Verification action required"
        : status === "suspended"
          ? "Account suspended"
          : status === "guest"
            ? "Restricted dashboard preview"
            : "Welcome to TUTELA";

  const description =
    status === "pending"
      ? "Your company verification is under review. Marketplace access remains restricted until approval."
      : status === "rejected"
        ? "Your verification needs attention. Resolve the issue to unlock full marketplace access."
        : status === "suspended"
          ? "Your account is currently suspended. Marketplace transaction actions are disabled."
          : status === "guest"
            ? "Create a company account to begin the verification journey and access restricted marketplace previews."
            : "Your company account is ready. Complete KYB/KYC verification to unlock pricing, counterparties, documents, and negotiation.";

  const cta =
    status === "pending"
      ? "View verification status"
      : status === "rejected"
        ? "Resolve verification issue"
        : status === "suspended"
          ? "Contact support"
          : status === "guest"
            ? "Create company account / Sign in"
            : "Start verification";

  const ctaAction =
    status === "suspended"
      ? () => {
          window.location.href = "mailto:support@tutela.example";
        }
      : status === "guest"
        ? () => {
            window.location.href = "/api/login";
          }
        : onVerification;

  return (
    <div className="space-y-6">
      <AccessStateCard title={title} description={description} cta={cta} onClick={ctaAction}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onMarketplace} variant="outline" className="border-gray-300">
            <ShoppingCart className="mr-2 h-4 w-4" />
            View restricted marketplace
          </Button>
          {status !== "guest" && status !== "suspended" && (
            <Button onClick={onVerification} variant="outline" className="border-gray-300">
              <FileCheck2 className="mr-2 h-4 w-4" />
              Open verification center
            </Button>
          )}
        </div>
      </AccessStateCard>

      <SnapshotCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VerificationProgress />
        <UnlockBenefits />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const verificationStatus: AccessStatus = !user
    ? "guest"
    : ((user as { verificationStatus?: AccessStatus }).verificationStatus ?? "registered");

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
    retry: false,
    enabled: verificationStatus === "verified",
  });

  if (isLoading) {
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
                {verificationStatus === "verified" ? "Trading Dashboard" : "Company Access Dashboard"}
              </h1>
              <p className="mt-2 text-gray-600">
                {verificationStatus === "verified"
                  ? "Monitor your commodity trading activities and market opportunities"
                  : "Complete company verification to unlock the full TUTELA marketplace workflow"}
              </p>
            </div>
            {verificationStatus === "verified" && (
              <div className="flex gap-3 mt-4 sm:mt-0">
                <Button onClick={() => navigate(ROUTES.marketplace)} className="tutela-btn-primary">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Browse Marketplace
                </Button>
              </div>
            )}
          </div>
        </div>

        {verificationStatus === "verified" ? (
          <>
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
          </>
        ) : (
          <RestrictedDashboard
            status={verificationStatus}
            onMarketplace={() => navigate(ROUTES.marketplace)}
            onVerification={() => navigate(ROUTES.verification)}
          />
        )}
      </div>
    </AppShell>
  );
}
