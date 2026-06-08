import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  FileText,
  LockKeyhole,
  MapPin,
  Package,
  Plus,
  Search,
  Shield,
  Star,
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

type TrustSignal = {
  label: string;
  status: "verified" | "restricted" | "pending";
};

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

  const getMaskedCompanyLabel = (type?: string) => {
    switch (type) {
      case "fuel_hydrocarbons":
        return "Verified Energy Supplier";
      case "metals_precious":
        return "Verified Metals Supplier";
      case "agricultural":
        return "Verified Agricultural Exporter";
      default:
        return "Verified GCC Trader";
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

  const getTrustSignals = (offer: any): TrustSignal[] => [
    { label: "Offer data", status: "verified" },
    { label: offer.commodity?.type ? "Commodity category" : "Commodity category pending", status: offer.commodity?.type ? "verified" : "pending" },
    { label: canSeeDocuments ? "Documents available" : "Documents locked", status: canSeeDocuments ? "verified" : "restricted" },
    { label: canSeePrices ? "Pricing visible" : "Pricing restricted", status: canSeePrices ? "verified" : "restricted" },
  ];

  const getSignalClassName = (status: TrustSignal["status"]) => {
    switch (status) {
      case "verified":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "restricted":
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
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
              (offers as any[]).map((offer: any) => {
                const trustScore = getTrustScore(offer);
                const trustSignals = getTrustSignals(offer);
                return (
                  <Card key={offer.id} className="tutela-metric-card hover:shadow-xl transition-all duration-300 border-0 overflow-hidden">
                    <CardHeader className="pb-3 relative">
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
                      <div className="space-y-4">
                        <div className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">TUTELA Trust Score</p>
                            <p className="mt-1 text-sm text-emerald-800">Offer readiness based on submitted data and visible verification signals.</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-emerald-700">{trustScore}</p>
                            <p className="text-xs text-emerald-700">/ 100</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {trustSignals.map((signal) => (
                            <div key={signal.label} className={`rounded-lg border px-3 py-2 text-xs font-medium ${getSignalClassName(signal.status)}`}>
                              <div className="flex items-center gap-2">
                                {signal.status === "verified" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />}
                                {signal.label}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="p-4 rounded-lg border" style={{ background: "linear-gradient(135deg, var(--tutela-blue-50) 0%, var(--tutela-gray-50) 100%)" }}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Price per {offer.unit}</span>
                            <span className="font-bold text-xl" style={{ color: "var(--tutela-primary)" }}>
                              {canSeePrices ? formatPrice(offer.pricePerUnit, offer.currency) : "Price hidden"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm text-gray-600">Total Value</span>
                            <span className="font-semibold text-lg text-gray-800">
                              {canSeePrices
                                ? formatPrice((parseFloat(offer.pricePerUnit) * parseFloat(offer.quantity)).toString(), offer.currency)
                                : "Restricted"}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold" style={{ color: "var(--tutela-secondary)" }}>
                              {parseFloat(offer.quantity).toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-600">{offer.unit}</div>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-sm text-gray-600">Min Order</div>
                            <div className="text-lg font-semibold text-gray-800">
                              {offer.minQuantity ? parseFloat(offer.minQuantity).toLocaleString() : "N/A"}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="mr-2 h-4 w-4 text-gray-400" />
                            <span className="font-medium">{offer.location}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center text-gray-600">
                              <Shield className="mr-2 h-4 w-4 text-green-500" />
                              <span>{canSeePrices ? "Verified Counterparty" : getMaskedCompanyLabel(offer.commodity?.type)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              {[...Array(5)].map((_, index) => (
                                <Star key={index} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              ))}
                            </div>
                          </div>
                          <div className="text-sm text-gray-700 font-medium">
                            {canSeePrices
                              ? `${offer.user?.firstName ?? ""} ${offer.user?.lastName ?? ""} • ${offer.user?.companyName || "Independent Trader"}`
                              : "Counterparty identity hidden until verification"}
                          </div>
                        </div>

                        {canSeeDocuments && (offer.deliveryTerms || offer.paymentTerms) && (
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5" />
                              TRADING TERMS
                            </div>
                            {offer.deliveryTerms && (
                              <div className="text-xs text-gray-600 mb-1">
                                <strong>Delivery:</strong> {offer.deliveryTerms.substring(0, 45)}...
                              </div>
                            )}
                            {offer.paymentTerms && (
                              <div className="text-xs text-gray-600">
                                <strong>Payment:</strong> {offer.paymentTerms.substring(0, 45)}...
                              </div>
                            )}
                          </div>
                        )}

                        {!canSeeDocuments && (
                          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600">
                            Documents, detailed terms, and contact channels unlock after KYB/KYC verification.
                          </div>
                        )}

                        <div className="space-y-2 pt-3 border-t">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full text-sm font-semibold py-2.5"
                            disabled={!canStartNegotiation}
                            onClick={() => openQuickNegotiation(offer)}
                          >
                            {canStartNegotiation ? "Quick Negotiate" : getMarketplaceCta()}
                          </Button>
                          <Button className="w-full tutela-btn-primary text-sm font-semibold py-2.5" disabled={!canStartNegotiation}>
                            <TrendingUp className="mr-2 h-4 w-4" />
                            {canStartNegotiation ? "View Details & Contact" : getMarketplaceCta()}
                          </Button>
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
