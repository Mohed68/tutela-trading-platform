import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Package } from "lucide-react";
import CreateOfferModal from "@/components/offers/CreateOfferModal";

export default function ActiveOffers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isCreateOfferOpen, setIsCreateOfferOpen] = useState(false);

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["/api/offers"],
    retry: false,
  });

  const { data: commodities = [] } = useQuery({
    queryKey: ["/api/commodities"],
    retry: false,
  });

  const filteredOffers = offers.filter((offer: any) => {
    const matchesSearch = offer.commodity?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || offer.commodity?.type === categoryFilter;
    return matchesSearch && matchesCategory;
  }).slice(0, 5); // Show only top 5 offers

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

  return (
    <>
      <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Active Commodity Offers
          </CardTitle>
          <Button 
            onClick={() => setIsCreateOfferOpen(true)}
            className="tutela-btn-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Offer
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {/* Search and Filter Bar */}
          <div className="mb-4 flex flex-col sm:flex-row gap-4">
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
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="tutela-form-select"
            >
              <option value="all">All Categories</option>
              <option value="fuel_hydrocarbons">Fuel & Hydrocarbons</option>
              <option value="metals_precious">Metals & Precious Metals</option>
              <option value="agricultural">Agricultural Products</option>
            </select>
          </div>

          {/* Offers Table */}
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="w-8 h-8 bg-gray-200 rounded-full loading-pulse"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded loading-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded loading-pulse w-2/3"></div>
                    </div>
                    <div className="h-6 w-16 bg-gray-200 rounded loading-pulse"></div>
                  </div>
                ))}
              </div>
            ) : filteredOffers.length === 0 ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No offers found</h3>
                <p className="text-gray-600">
                  {searchQuery || categoryFilter !== "all" 
                    ? "Try adjusting your search or filter criteria."
                    : "Create your first offer to get started."
                  }
                </p>
              </div>
            ) : (
              <table className="tutela-table">
                <thead>
                  <tr>
                    <th>Commodity</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOffers.map((offer: any) => (
                    <tr key={offer.id}>
                      <td>
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-lg">
                              {getCommodityIcon(offer.commodity?.type)}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {offer.commodity?.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {offer.location}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge className={`status-badge ${offer.type}`}>
                          {offer.type}
                        </Badge>
                      </td>
                      <td>
                        {parseFloat(offer.quantity).toLocaleString()} {offer.unit}
                      </td>
                      <td>
                        {formatPrice(offer.pricePerUnit, offer.currency)}/{offer.unit}
                      </td>
                      <td>
                        <Badge className={`status-badge ${offer.status}`}>
                          {offer.status}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" className="text-primary hover:text-blue-700">
                            View
                          </Button>
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      <CreateOfferModal
        isOpen={isCreateOfferOpen}
        onClose={() => setIsCreateOfferOpen(false)}
        commodities={commodities}
      />
    </>
  );
}
