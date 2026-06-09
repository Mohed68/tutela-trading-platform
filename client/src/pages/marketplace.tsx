import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Package,
  Plus,
  Search,
  Shield,
  TrendingUp,
} from "lucide-react";
import OfferCard from "@/components/marketplace/OfferCard";
import CreateOfferModal from "@/components/offers/CreateOfferModal";
import QuickNegotiationModal from "@/components/negotiation/QuickNegotiationModal";
import { useAuth } from "@/hooks/useAuth";
import {
  type AccessStatus,
  canNegotiate,
  canViewMarketplace,
  canViewPrices,
} from "@/lib/access";

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isCreateOfferOpen, setIsCreateOfferOpen] = useState(false);
  const [selectedQuickOffer, setSelectedQuickOffer] = useState<any | null>(null);
  const [isQuickNegotiationOpen, setIsQuickNegotiationOpen] = useState(false);
  const { user } = useAuth();
  const isDemoUser =
  (user as { id?: string } | null | undefined)?.id === "local-admin";

  const verificationStatus: AccessStatus = isDemoUser
  ? "verified"
  : !user
    ? "guest"
    : ((user as { verificationStatus?: AccessStatus }).verificationStatus ?? "registered");

  const canSeeMarketplace = canViewMarketplace(verificationStatus);
  const canSeePrices = canViewPrices(verificationStatus);
  const canStartNegotiation = canNegotiate(verificationStatus);

  const getMarketplaceCta = () => {
    switch (verificationStatus) {
      case "guest":
        return "Create company account / Sign in";
      case "registered":
        return "Complete KYB/KYC";
      case "pending":
        return "Verification pending";
      case "rejected":
        return "Resolve verification issue";
      case "suspended":
        return "Account suspended";
      case "verified":
      default:
        return "View Details & Contact";
    }
  };

  const { data: offers = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/offers/search", searchQuery, selectedCategory !== "all" ? selectedCategory : undefined],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (selectedCategory !== "all") params.append("category", selectedCategory);

      const response = await fetch(`/api/offers/search?${params.toString()}`);
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    retry: false,
  });

  const { data: commodities = [] } = useQuery<any[]>({
    queryKey: ["/api/commodities"],
    retry: false,
  });

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "fuel_hydrocarbons", label: "Energy & Petroleum" },
    { value: "agricultural", label: "Agricultural Commodities" },
    { value: "metals_precious", label: "Precious Metals & Gold" },
  ];

  const getDisabledActionLabel = () => getMarketplaceCta();

  const openQuickNegotiation = (offer: any) => {
    if (!canStartNegotiation) {
      return;
    }

    setSelectedQuickOffer(offer);
    setIsQuickNegotiationOpen(true);
  };

  const closeQuickNegotiation = () => {
    setIsQuickNegotiationOpen(false);
    setSelectedQuickOffer(null);
  };

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--tutela-secondary)" }}>
              Commodity Marketplace
            </h1>
            <p className="mt-2 text-gray-600">
              Discover verified commodity opportunities with structured trust signals and controlled access.
            </p>
          </div>
          <Button
            onClick={() => setIsCreateOfferOpen(true)}
            className="tutela-btn-primary mt-4 sm:mt-0"
            disabled={!canStartNegotiation}
          >
            <Plus className="mr-2 h-4 w-4" />
            {canStartNegotiation ? "Create Offer" : getMarketplaceCta()}
          </Button>
        </div>

        {verificationStatus === "registered" && (
          <Card className="mb-6 border-blue-100 bg-blue-50">
            <CardContent className="py-3 text-sm text-blue-800">
              Complete KYB/KYC verification to unlock real pricing, counterparty details, documents, and negotiation.
            </CardContent>
          </Card>
        )}
        {verificationStatus === "pending" && (
          <Card className="mb-6 border-yellow-100 bg-yellow-50">
            <CardContent className="py-3 text-sm text-yellow-800">
              Verification is pending. Marketplace preview remains available, but transaction actions are restricted.
            </CardContent>
          </Card>
        )}
        {verificationStatus === "rejected" && (
          <Card className="mb-6 border-red-100 bg-red-50">
            <CardContent className="py-3 text-sm text-red-800">
              Verification was rejected. Resolve the issue to unlock full marketplace access.
            </CardContent>
          </Card>
        )}
        {verificationStatus === "suspended" && (
          <Card className="mb-6 border-red-100 bg-red-50">
            <CardContent className="py-3 text-sm text-red-800">
              Account suspended. Marketplace is visible, but transaction actions are disabled.
            </CardContent>
          </Card>
        )}
        {verificationStatus === "guest" && (
          <Card className="mb-6 border-slate-200 bg-slate-50">
            <CardContent className="py-3 text-sm text-slate-700">
              You are viewing a restricted marketplace preview. Create a company account and complete verification to unlock protected deal data.
            </CardContent>
          </Card>
        )}

        {!isLoading && offers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="tutela-metric-card">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 rounded-lg" style={{ background: "var(--tutela-blue-100)" }}>
                    <Package className="h-5 w-5" style={{ color: "var(--tutela-primary)" }} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Offers</p>
                    <p className="text-2xl font-bold" style={{ color: "var(--tutela-secondary)" }}>{offers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="tutela-metric-card">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 rounded-lg" style={{ background: "var(--tutela-gray-100)" }}>
                    <TrendingUp className="h-5 w-5" style={{ color: "var(--tutela-accent)" }} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Visible Value</p>
                    <p className="text-2xl font-bold" style={{ color: "var(--tutela-secondary)" }}>
                      {new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
}).format(
  offers.reduce(
    (total: number, offer: any) =>
      total + parseFloat(offer.pricePerUnit) * parseFloat(offer.quantity),
    0,
  ),
)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="tutela-metric-card">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 rounded-lg" style={{ background: "var(--tutela-blue-50)" }}>
                    <Shield className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Verified Traders</p>
                    <p className="text-2xl font-bold" style={{ color: "var(--tutela-secondary)" }}>
                      {Array.from(new Set(offers.map((offer: any) => offer.user?.id))).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search commodities..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="tutela-form-select w-full sm:w-auto"
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {!canSeeMarketplace ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Marketplace unavailable</h3>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <Card key={index} className="tutela-metric-card">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full loading-pulse" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded loading-pulse mb-2" />
                      <div className="h-3 bg-gray-200 rounded loading-pulse w-2/3" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-200 rounded loading-pulse" />
                    <div className="h-3 bg-gray-200 rounded loading-pulse w-3/4" />
                    <div className="h-8 bg-gray-200 rounded loading-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(offers as any[]).length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No offers found</h3>
                <p className="text-gray-600">Try adjusting your search terms or create a new offer to get started.</p>
              </div>
            ) : (
              (offers as any[]).map((offer: any, index: number) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  index={index}
                  canSeePrices={canSeePrices}
                  canStartNegotiation={canStartNegotiation}
                  disabledActionLabel={getDisabledActionLabel()}
                  onQuickNegotiate={openQuickNegotiation}
                />
              ))
            )}
          </div>
        )}

        <CreateOfferModal
          isOpen={isCreateOfferOpen}
          onClose={() => setIsCreateOfferOpen(false)}
          commodities={commodities as any[]}
        />

        {selectedQuickOffer && (
          <QuickNegotiationModal
            isOpen={isQuickNegotiationOpen}
            onClose={closeQuickNegotiation}
            offerId={selectedQuickOffer.id}
            originalPrice={parseFloat(selectedQuickOffer.pricePerUnit)}
            originalQuantity={parseFloat(selectedQuickOffer.quantity)}
            currency={selectedQuickOffer.currency}
            unit={selectedQuickOffer.unit}
          />
        )}
      </div>
    </AppShell>
  );
}
