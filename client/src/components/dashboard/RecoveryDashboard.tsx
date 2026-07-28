import {
  AlertCircle,
  CheckCircle2,
  CircleSlash2,
  PackageSearch,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  DashboardModule,
  DashboardModuleState,
  DashboardOverviewDto,
} from "@shared/dashboard";

const STATE_LABELS: Record<DashboardModuleState, string> = {
  available: "Available",
  empty: "No records",
  unavailable: "Unavailable",
  error: "Temporarily unavailable",
};

function StateBadge({ state }: { state: DashboardModuleState }) {
  const className =
    state === "available"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : state === "empty"
        ? "border-slate-200 bg-slate-50 text-slate-700"
        : state === "error"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-gray-200 bg-gray-50 text-gray-600";

  return (
    <Badge variant="outline" className={className}>
      {STATE_LABELS[state]}
    </Badge>
  );
}

function UnavailableModule({
  title,
  module,
}: {
  title: string;
  module: DashboardModule<never>;
}) {
  const Icon = module.state === "error" ? AlertCircle : CircleSlash2;
  const message =
    module.state === "error"
      ? "This module could not be loaded safely."
      : "This module is not yet available in the controlled recovery environment.";

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 text-gray-500" aria-hidden="true" />
        <div>
          <p className="font-medium text-gray-900">{title}</p>
          <p className="mt-1 text-sm text-gray-600">{message}</p>
        </div>
      </div>
      <StateBadge state={module.state} />
    </div>
  );
}

export function RecoveryDashboard({
  overview,
  onBrowseMarketplace,
}: {
  overview: DashboardOverviewDto;
  onBrowseMarketplace: () => void;
}) {
  const account = overview.account.data;
  const ownedOffers = overview.myOffers.data;
  const marketplace = overview.publicMarketplace.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">
            Trading Dashboard
          </h1>
          <p className="mt-2 text-gray-600">
            Safe account and marketplace summaries for the recovery environment.
          </p>
        </div>
        <button
          type="button"
          onClick={onBrowseMarketplace}
          className="inline-flex items-center justify-center rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          <Store className="mr-2 h-4 w-4" aria-hidden="true" />
          Browse Marketplace
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <UserRound className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                <CardTitle className="text-lg">Account</CardTitle>
              </div>
              <StateBadge state={overview.account.state} />
            </div>
            <CardDescription>
              Authenticated account identity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {account ? (
              <dl className="grid gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-600">Display name</dt>
                  <dd className="font-medium text-gray-900">
                    {account.displayName ?? "Not provided"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-600">Role</dt>
                  <dd className="font-medium capitalize text-gray-900">
                    {account.role}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-600">Account state</dt>
                  <dd className="font-medium capitalize text-gray-900">
                    {account.accountState}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-gray-600">
                Account summary is temporarily unavailable.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                <CardTitle className="text-lg">Session</CardTitle>
              </div>
              <StateBadge state={overview.session.state} />
            </div>
            <CardDescription>
              Current server-authenticated session
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            Authenticated access is active.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <PackageSearch className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                <CardTitle className="text-lg">My Offers</CardTitle>
              </div>
              <StateBadge state={overview.myOffers.state} />
            </div>
            <CardDescription>
              Offers owned by this authenticated account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ownedOffers ? (
              <>
                <p className="text-3xl font-semibold text-gray-950">
                  {ownedOffers.count}
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  {ownedOffers.count === 0
                    ? "No offers are associated with this account."
                    : "Owned offers are associated with this account."}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-600">
                The owned-offer summary could not be loaded safely.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                <CardTitle className="text-lg">Public Marketplace</CardTitle>
              </div>
              <StateBadge state={overview.publicMarketplace.state} />
            </div>
            <CardDescription>
              Offers meeting the strict publication policy
            </CardDescription>
          </CardHeader>
          <CardContent>
            {marketplace ? (
              <>
                <p className="text-3xl font-semibold text-gray-950">
                  {marketplace.publishedOffers}
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  {marketplace.publishedOffers === 0
                    ? "No offers currently have complete publication proof."
                    : "Published offers are available to browse."}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-600">
                The marketplace summary could not be loaded safely.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Feature Availability</CardTitle>
          <CardDescription>
            Modules remain unavailable until their data authority and workflows
            are recovered.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <UnavailableModule title="Contracts" module={overview.contracts} />
          <UnavailableModule title="Orders" module={overview.orders} />
          <UnavailableModule title="Recent activity" module={overview.activity} />
          <UnavailableModule title="KYB" module={overview.kyb} />
          <UnavailableModule title="Verification" module={overview.verification} />
          <UnavailableModule title="Subscription" module={overview.subscription} />
          <UnavailableModule
            title="Performance insights"
            module={overview.performanceInsights}
          />
          <UnavailableModule
            title="AI recommendations"
            module={overview.aiRecommendations}
          />
        </CardContent>
      </Card>
    </div>
  );
}
