import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, TrendingUp, Package } from "lucide-react";
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
    queryKey: ["/api/offers/search", { q: searchQuery, category: selectedCategory !== "all" ? selectedCategory : undefined }],
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
            <h1 className="text-3xl font-bold text-gray-900">Commodity Marketplace</h1>
            <p className="mt-2 text-gray-600">
              Discover and trade physical commodities with verified partners
            </p>
          </div>
          <Button onClick={() => setIsCreateOfferOpen(true)} className="tutela-btn-primary mt-4 sm:mt-0">
            <Plus className="mr-2 h-4 w-4" />
            Create Offer
          </Button>
        </div>

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
                <Card key={offer.id} className="tutela-metric-card hover:shadow-lg transition-shadow duration-200">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-2xl">
                            {getCommodityIcon(offer.commodity?.type)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{offer.commodity?.name}</CardTitle>
                          <p className="text-sm text-gray-600">{offer.location}</p>
                        </div>
                      </div>
                      <Badge className={`status-badge ${offer.type}`}>
                        {offer.type}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Quantity:</span>
                        <span className="font-medium">
                          {parseFloat(offer.quantity).toLocaleString()} {offer.unit}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Price:</span>
                        <span className="font-medium text-lg">
                          {formatPrice(offer.pricePerUnit, offer.currency)}/{offer.unit}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Status:</span>
                        <Badge className={`status-badge ${offer.status}`}>
                          {offer.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Trader:</span>
                        <span className="text-sm">
                          {offer.user?.firstName} {offer.user?.lastName}
                        </span>
                      </div>
                      <div className="pt-3 border-t">
                        <Button className="w-full tutela-btn-primary">
                          <TrendingUp className="mr-2 h-4 w-4" />
                          View Details
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
