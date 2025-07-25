import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, TrendingUp, Package, MapPin, Shield, Star } from "lucide-react";
import CreateOfferModal from "@/components/offers/CreateOfferModal";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Commodities() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isCreateOfferOpen, setIsCreateOfferOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["/api/offers/search", searchQuery, selectedCategory !== "all" ? selectedCategory : undefined],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (selectedCategory !== "all") params.append('category', selectedCategory);
      
      const response = await fetch(`/api/offers/search?${params.toString()}`);
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    retry: false,
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ["/api/commodities"],
    retry: false,
  });

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "fuel_hydrocarbons", label: "Fuel & Hydrocarbons" },
    { value: "metals_precious", label: "Metals & Precious Metals" },
    { value: "agricultural", label: "Agricultural Products" },
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(parseFloat(price));
  };

  const formatCommodityType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <AppShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--tutela-secondary)' }}>Commodity Marketplace</h1>
            <p className="mt-2 text-gray-600">
              Discover and trade physical commodities with verified partners worldwide
            </p>
          </div>
          <Button onClick={() => setIsCreateOfferOpen(true)} className="tutela-btn-primary mt-4 sm:mt-0">
            <Plus className="mr-2 h-4 w-4" />
            Create Offer
          </Button>
        </div>

        {/* Market Overview */}
        {!isLoading && offers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="tutela-metric-card">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 rounded-lg" style={{ background: 'var(--tutela-blue-100)' }}>
                    <Package className="h-5 w-5" style={{ color: 'var(--tutela-primary)' }} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Offers</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--tutela-secondary)' }}>{offers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="tutela-metric-card">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 rounded-lg" style={{ background: 'var(--tutela-gray-100)' }}>
                    <TrendingUp className="h-5 w-5" style={{ color: 'var(--tutela-accent)' }} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Value</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--tutela-secondary)' }}>
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        notation: 'compact',
                        maximumFractionDigits: 1
                      }).format(
                        offers.reduce((total: number, offer: any) => 
                          total + (parseFloat(offer.pricePerUnit) * parseFloat(offer.quantity)), 0
                        )
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="tutela-metric-card">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 rounded-lg" style={{ background: 'var(--tutela-blue-50)' }}>
                    <Shield className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Verified Traders</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--tutela-secondary)' }}>
                      {[...new Set(offers.map((offer: any) => offer.user?.id))].length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filter Bar */}
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
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
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

        {/* Offers Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="tutela-metric-card">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full loading-pulse"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded loading-pulse mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded loading-pulse w-2/3"></div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-200 rounded loading-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded loading-pulse w-3/4"></div>
                    <div className="h-8 bg-gray-200 rounded loading-pulse"></div>
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
                <p className="text-gray-600">
                  Try adjusting your search terms or create a new offer to get started.
                </p>
              </div>
            ) : (
              (offers as any[]).map((offer: any) => (
                <Card key={offer.id} className="tutela-metric-card hover:shadow-xl transition-all duration-300 border-0 overflow-hidden">
                  <CardHeader className="pb-3 relative">
                    <div className="absolute top-4 right-4">
                      <Badge 
                        className={`${offer.type === "buy" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"} font-semibold`}
                      >
                        {offer.type.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-3 pr-16">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'var(--tutela-blue-100)' }}>
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
                      {/* Price Section */}
                      <div className="p-4 rounded-lg border" style={{ background: 'linear-gradient(135deg, var(--tutela-blue-50) 0%, var(--tutela-gray-50) 100%)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Price per {offer.unit}</span>
                          <span className="font-bold text-xl" style={{ color: 'var(--tutela-primary)' }}>
                            {formatPrice(offer.pricePerUnit, offer.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm text-gray-600">Total Value</span>
                          <span className="font-semibold text-lg text-gray-800">
                            {formatPrice((parseFloat(offer.pricePerUnit) * parseFloat(offer.quantity)).toString(), offer.currency)}
                          </span>
                        </div>
                      </div>

                      {/* Quantity & Details */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-2xl font-bold" style={{ color: 'var(--tutela-secondary)' }}>
                            {parseFloat(offer.quantity).toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-600">{offer.unit}</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-600">Min Order</div>
                          <div className="text-lg font-semibold text-gray-800">
                            {offer.minQuantity ? parseFloat(offer.minQuantity).toLocaleString() : 'N/A'}
                          </div>
                        </div>
                      </div>

                      {/* Location & Trader Info */}
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="mr-2 h-4 w-4 text-gray-400" />
                          <span className="font-medium">{offer.location}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center text-gray-600">
                            <Shield className="mr-2 h-4 w-4 text-green-500" />
                            <span>Verified Trader</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            ))}
                          </div>
                        </div>
                        <div className="text-sm text-gray-700 font-medium">
                          {offer.user?.firstName} {offer.user?.lastName} • {offer.user?.companyName || 'Independent Trader'}
                        </div>
                      </div>

                      {/* Terms Preview */}
                      {(offer.deliveryTerms || offer.paymentTerms) && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <div className="text-xs font-semibold text-gray-700 mb-2">TRADING TERMS</div>
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

                      <div className="pt-3 border-t">
                        <Button className="w-full tutela-btn-primary text-sm font-semibold py-2.5">
                          <TrendingUp className="mr-2 h-4 w-4" />
                          View Details & Contact
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Create Offer Modal */}
        <CreateOfferModal
          isOpen={isCreateOfferOpen}
          onClose={() => setIsCreateOfferOpen(false)}
          commodities={commodities as any[]}
        />
      </div>
    </AppShell>
  );
}
