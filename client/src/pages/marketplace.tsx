import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  MapPin,
  Package,
  Plus,
  Search,
  Shield,
  TrendingUp,
} from "lucide-react";
import CreateOfferModal from "@/components/offers/CreateOfferModal";
import QuickNegotiationModal from "@/components/negotiation/QuickNegotiationModal";
import { useAuth } from "@/hooks/useAuth";
import {
  type AccessStatus,
  canNegotiate,
  canViewDocuments,
  canViewMarketplace,
  canViewPrices,
} from "@/lib/access";
import {
  getBadgeLabel,
  sortBadgesByPriority,
  type VerificationBadgeType,
} from "@/lib/badges";
import type { OfferPricingMode, OfferVisibilityMode } from "@/lib/offers";
import { getMaskedDisplayName } from "@/lib/privacy";
import { getTrustLevel, type TrustLevel } from "@/lib/trust";

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
  const canSeeDocuments = canViewDocuments(verificationStatus);
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

  const getTrustScore = (offer: any) => {
    const base = 72;
    const hasTerms = offer.deliveryTerms || offer.paymentTerms ? 8 : 0;
    const hasSeller = offer.user?.companyName ? 7 : 0;
    const hasMinOrder = offer.minQuantity ? 5 : 0;
    const categoryBoost = offer.commodity?.type ? 4 : 0;
    return Math.min(base + hasTerms + hasSeller + hasMinOrder + categoryBoost, 96);
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

  const getCommodityIcon = (type: string) => {
    switch (type) {
      case "fuel_hydrocarbons":
        return "⛽";
      case "metals_precious":
        return "🥇";
      case "agricultural":
        return "🌾";
      default:
        return "📦";
    }
  };

  const formatPrice = (price: string, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(parseFloat(price));
  };

  const formatCommodityType = (type: string) => {
    return type?.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? "Commodity";
  };

  const formatModelLabel = (value: string) => {
    return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const getMockOfferPricingMode = (index: number): OfferPricingMode => {
    const modes: OfferPricingMode[] = ["fixed", "negotiable", "indicative"];
    return modes[index % modes.length];
  };

  const getMockVisibilityMode = (index: number): OfferVisibilityMode => {
    const modes: OfferVisibilityMode[] = ["public", "semi_anonymous", "full_anonymous"];
    return modes[index % modes.length];
  };

  const getTrustBadgeClassName = (level: TrustLevel) => {
    switch (level) {
      case "platinum":
        return "border-sky-100 bg-sky-50 text-sky-700";
      case "gold":
        return "border-amber-100 bg-amber-50 text-amber-700";
      case "silver":
        return "border-slate-200 bg-slate-50 text-slate-700";
      case "bronze":
      default:
        return "border-orange-100 bg-orange-50 text-orange-700";
    }
  };

  const getMockVerificationBadges = () => {
    const badgeTypes: VerificationBadgeType[] = [
      "trusted_supplier",
      "verified_company",
      "verified_offer",
      "verified_documents",
    ];

    return sortBadgesByPriority(
      badgeTypes.map((type) => ({
        badgeId: type,
        type,
        status: "active",
        label: getBadgeLabel(type),
        issuedAt: new Date().toISOString(),
      })),
    );
  };

  const getDisabledActionLabel = () => getMarketplaceCta();

  const getCounterpartyLabel = (offer: any, visibilityMode: OfferVisibilityMode) => {
    const role = offer.type === "sell" ? "seller" : "buyer";

    if (visibilityMode === "public" && canSeePrices) {
      return `${offer.user?.firstName ?? ""} ${offer.user?.lastName ?? ""} • ${offer.user?.companyName || "Independent Trader"}`;
    }

    return getMaskedDisplayName(visibilityMode, role);
  };

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
              (offers as any[]).map((offer: any, index: number) => {
                const trustScore = getTrustScore(offer);
                const pricingMode = getMockOfferPricingMode(index);
                const visibilityMode = getMockVisibilityMode(index);
                const trustLevel = getTrustLevel(trustScore);
                const verificationBadges = getMockVerificationBadges();
                const isSellOffer = offer.type === "sell";
                const hasPriceData =
                  parseFloat(offer.pricePerUnit) > 0 && parseFloat(offer.quantity) > 0;
                const counterpartyLabel = getCounterpartyLabel(offer, visibilityMode);
                return (
                  <Card key={offer.id} className="tutela-metric-card hover:shadow-xl transition-all duration-300 border-0 overflow-hidden">
                    <CardHeader className="pb-2 relative">
                      <div className="absolute top-4 right-4">
                        <Badge className={`${offer.type === "buy" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"} font-semibold`}>
                          {offer.type.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-3 pr-16">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "var(--tutela-blue-100)" }}>
                          <span className="text-2xl">{getCommodityIcon(offer.commodity?.type)}</span>
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg font-bold text-gray-900">{offer.commodity?.name}</CardTitle>
                          <p className="text-sm text-gray-600 font-medium">{formatCommodityType(offer.commodity?.type)}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700">
                            {formatModelLabel(pricingMode)}
                          </Badge>
                          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                            {formatModelLabel(visibilityMode)}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                          <span>Trust {trustScore}/100</span>
                          <span className="h-1 w-1 rounded-full bg-emerald-500" />
                          <span className="capitalize">{trustLevel}</span>
                          <span className="h-1 w-1 rounded-full bg-emerald-500" />
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Verified
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {verificationBadges.map((badge) => (
                            <Badge
                              key={badge.badgeId}
                              variant="outline"
                              className="h-6 border-emerald-100 bg-white px-2 text-[11px] font-medium text-emerald-700"
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              {badge.label}
                            </Badge>
                          ))}
                        </div>

                        <div className="p-3 rounded-lg border" style={{ background: "linear-gradient(135deg, var(--tutela-blue-50) 0%, var(--tutela-gray-50) 100%)" }}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Price per {offer.unit}</span>
                            <span className="font-bold text-lg" style={{ color: "var(--tutela-primary)" }}>
                              {canSeePrices ? formatPrice(offer.pricePerUnit, offer.currency) : "Price hidden"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm text-gray-600">Total Value</span>
                            <span className="font-semibold text-gray-800">
                              {canSeePrices
                                ? formatPrice((parseFloat(offer.pricePerUnit) * parseFloat(offer.quantity)).toString(), offer.currency)
                                : "Restricted"}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-gray-50 p-3">
                            <div className="text-lg font-bold" style={{ color: "var(--tutela-secondary)" }}>
                              {parseFloat(offer.quantity).toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-600">{offer.unit}</div>
                          </div>
                          <div className="rounded-lg bg-gray-50 p-3">
                            <div className="flex items-center text-sm text-gray-600">
                              <MapPin className="mr-1.5 h-3.5 w-3.5 text-gray-400" />
                              Location
                            </div>
                            <div className="truncate text-sm font-semibold text-gray-800">{offer.location}</div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center text-sm text-gray-600">
                            <Shield className="mr-2 h-4 w-4 text-green-500" />
                            <span>{visibilityMode === "public" ? "Verified Counterparty" : "Identity protected"}</span>
                          </div>
                          <div className="text-sm text-gray-700 font-medium">
                            {counterpartyLabel}
                          </div>
                        </div>

                        {!canSeeDocuments && (
                          <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-2 text-xs text-gray-600">
                            Documents and detailed terms unlock after KYB/KYC verification.
                          </div>
                        )}

                        <div className="space-y-2 pt-3 border-t">
                          {isSellOffer &&
                            (pricingMode === "fixed" ||
                              pricingMode === "negotiable" ||
                              (pricingMode === "indicative" && hasPriceData)) && (
                            <Button
                              className="w-full tutela-btn-primary text-sm font-semibold py-2.5"
                              disabled={!canStartNegotiation}
                            >
                              <TrendingUp className="mr-2 h-4 w-4" />
                              {canStartNegotiation ? "Buy Now" : getDisabledActionLabel()}
                            </Button>
                          )}

                          {!isSellOffer && pricingMode === "fixed" && (
                            <Button
                              className="w-full tutela-btn-primary text-sm font-semibold py-2.5"
                              disabled={!canStartNegotiation}
                            >
                              <TrendingUp className="mr-2 h-4 w-4" />
                              {canStartNegotiation ? "View Details & Contact" : getDisabledActionLabel()}
                            </Button>
                          )}

                          {pricingMode === "negotiable" && (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full text-sm font-semibold py-2.5"
                                disabled={!canStartNegotiation}
                                onClick={() => openQuickNegotiation(offer)}
                              >
                                {canStartNegotiation ? "Quick Negotiate" : getDisabledActionLabel()}
                              </Button>
                              <Button
                                className="w-full tutela-btn-primary text-sm font-semibold py-2.5"
                                disabled={!canStartNegotiation}
                              >
                                <TrendingUp className="mr-2 h-4 w-4" />
                                {canStartNegotiation ? "Written Negotiation" : getDisabledActionLabel()}
                              </Button>
                            </>
                          )}

                          {pricingMode === "indicative" && (
                            <Button
                              className="w-full tutela-btn-primary text-sm font-semibold py-2.5"
                              disabled={!canStartNegotiation}
                            >
                              <TrendingUp className="mr-2 h-4 w-4" />
                              {canStartNegotiation ? "Request Discussion" : getDisabledActionLabel()}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
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
