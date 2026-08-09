import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import OfferDetailModal from "@/components/offers/OfferDetailModal";
import OfferList from "@/features/offers/views/OfferList";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { MarketplaceInsights } from "@/components/MarketplaceInsights";
import { MarketplaceFilters } from "@/components/MarketplaceFilters";
import { VWAPTile } from "@/components/VWAPTile";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import clsx from "clsx";
import type {
  PublicMarketplaceOffersResponse,
  PublicMarketplaceSummary,
} from "@shared/marketplace";
import {
  getDemoMarketplaceOffers,
  getDemoMarketplaceSummary,
  isDemo,
} from "@/lib/demo";

export default function Marketplace() {
  const demoMode = isDemo();
  // URL state management
  const [location, navigate] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  
  const [searchQuery, setSearchQuery] = useState(urlParams.get('q') || "");
  const [selectedCategory, setSelectedCategory] = useState(urlParams.get('category') || "all");
  const [commodityKey, setCommodityKey] = useState(urlParams.get('commodity') || "");
  const [unit, setUnit] = useState(urlParams.get('unit') || "");
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [isOfferDetailOpen, setIsOfferDetailOpen] = useState(false);
  
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
    if (commodityKey) params.set('commodity', commodityKey);
    if (unit) params.set('unit', unit);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    
    const newUrl = params.toString() ? `/marketplace?${params.toString()}` : '/marketplace';
    if (location !== newUrl) {
      navigate(newUrl, { replace: true });
    }
  }, [selectedCategory, commodityKey, unit, searchQuery, location, navigate]);

  // Fetch offers with cross-unit normalization
  const buildApiUrl = async () => {
    const { canon } = await import('@shared/constants/units');
    const params = new URLSearchParams();
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
    if (commodityKey) params.set('commodityKey', commodityKey);
    if (unit) params.set('normalizeUnit', canon(unit) || unit); // Canonicalize normalize unit
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    
    // Dev assertion to catch unit leaks
    if (process.env.NODE_ENV === 'development') {
      console.assert(!params.has('unit'), 'UNIT LEAK: offers params contain unit filter');
    }
    
    return `/api/offers?${params.toString()}`;
  };

  const { data: offersResponse } =
    useQuery<PublicMarketplaceOffersResponse>({
    queryKey: ['/api/offers', selectedCategory, commodityKey, unit, searchQuery],
    queryFn: async () => {
      const url = await buildApiUrl();
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    retry: false,
    enabled: !demoMode,
  });

  const demoOffers = demoMode ? getDemoMarketplaceOffers() : [];
  const offers = demoMode ? demoOffers : (offersResponse?.offers ?? []);

  // Fetch enhanced summary with VWAP data
  const { data: summary } = useQuery<PublicMarketplaceSummary>({
    queryKey: ['/api/offers/summary', selectedCategory, commodityKey, unit, searchQuery],
    queryFn: async () => {
      const { canon } = await import('@shared/constants/units');
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
      if (commodityKey) params.set('commodityKey', commodityKey);
      if (unit) params.set('targetUnit', canon(unit) || unit); // Canonicalize target unit
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      
      // Dev assertion to catch unit leaks
      if (process.env.NODE_ENV === 'development') {
        console.assert(!params.has('unit'), 'UNIT LEAK: summary params contain unit filter');
      }
      
      const response = await fetch(`/api/offers/summary?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch summary');
      return response.json();
    },
    enabled: !demoMode,
  });
  const displayedSummary = demoMode ? getDemoMarketplaceSummary() : summary;

  // Handle filter changes
  const handleFilterChange = (filters: { category?: string; commodityKey?: string; unit?: string }) => {
    if (filters.category !== undefined) {
      setSelectedCategory(filters.category);
      // Clear commodity and unit when category changes
      if (filters.category === 'all' || filters.category !== selectedCategory) {
        setCommodityKey("");
        setUnit("");
      }
    }
    if (filters.commodityKey !== undefined) {
      setCommodityKey(filters.commodityKey);
      // Clear unit when commodity changes  
      if (filters.commodityKey !== commodityKey) {
        setUnit("");
      }
    }
    if (filters.unit !== undefined) {
      setUnit(filters.unit);
    }
  };

  // Handle offer interactions
  const handleOfferView = (offer: any) => {
    setSelectedOffer(offer);
    setIsOfferDetailOpen(true);
  };

  const handleToggleInterested = async (offerId: string, isCurrentlyInterested: boolean) => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required", 
        description: "Please log in to save offers",
        variant: "destructive",
      });
      return;
    }

    if (demoMode) {
      toast({
        title: isCurrentlyInterested ? "Removed from demo list" : "Saved in demo",
        description: "This demo action stays only in your browser.",
      });
      return;
    }

    try {
      const response = await fetch(`/api/offers/${offerId}/interested`, {
        method: isCurrentlyInterested ? 'DELETE' : 'POST',
      });

      if (!response.ok) throw new Error('Failed to update interest');

      toast({
        title: isCurrentlyInterested ? "Removed from interested" : "Added to interested",
        description: isCurrentlyInterested ? 
          "Offer removed from your interested list" : 
          "Offer added to your interested list",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update offer interest",
        variant: "destructive",
      });
    }
  };

  // State management for interactive layout
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Determine layout state: hero when no filters and panel closed, compact otherwise
  const layoutState = (!commodityKey && !unit && !filtersOpen) ? 'hero' : 'compact';
  
  // Always show VWAP tile when commodity and unit are both selected
  const showVWAP = Boolean(commodityKey && unit);

  // Close filters panel when switching to "all" category  
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFiltersOpen(false);
    }
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Marketplace
          </h1>
          <p className="text-gray-600">
            Only offers with confirmed offer and seller-organization
            verification are published.
          </p>
        </div>

        {/* Interactive Insights Layout */}
        <section className={clsx(
          'transition-all duration-300',
          layoutState === 'hero' ? 'py-6' : 'py-2'
        )}>
          <div className={clsx(
            'grid gap-4 transition-all duration-300',
            layoutState === 'hero' 
              ? 'grid-cols-1' 
              : 'grid-cols-2 xl:grid-cols-3'
          )}>
            {/* Blue Insights Core */}
            <MarketplaceInsights 
              offers={offers}
              category={selectedCategory}
              searchQuery={searchQuery}
              commodityKey={commodityKey}
              unit={unit}
              variant={layoutState}
            />
            
            {/* VWAP tile renders independently based on summary response */}
            {showVWAP && displayedSummary && (
              <VWAPTile
                avgPrice={displayedSummary.avgPrice!}
                avgPriceUnit={displayedSummary.avgPriceUnit!}
                avgPriceCount={displayedSummary.avgPriceCount!}
                avgPriceCoverage={displayedSummary.avgPriceCoverage}
                median={displayedSummary.median}
                p25={displayedSummary.p25}
                p75={displayedSummary.p75}
                variant={layoutState}
              />
            )}
          </div>
        </section>

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search offers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={selectedCategory}
              onChange={(e) => handleFilterChange({ category: e.target.value })}
              className="px-3 py-2 border rounded-md bg-white min-w-48"
            >
              <option value="all">All Categories</option>
              <option value="fuel_hydrocarbons">Fuel & Hydrocarbons</option>
              <option value="metals_precious">Metals & Precious</option>
              <option value="agricultural">Agricultural</option>
            </select>
          </div>
          
          {/* Advanced Filters Panel */}
          {selectedCategory !== 'all' && (
            <MarketplaceFilters
              category={selectedCategory}
              commodityKey={commodityKey}
              unit={unit}
              isOpen={filtersOpen}
              onFilterChange={(filters) => {
                handleFilterChange(filters);
                // Switch to compact when filters are applied
                if (filters.commodityKey || filters.unit) {
                  setFiltersOpen(true);
                }
              }}
              onToggle={() => setFiltersOpen(!filtersOpen)}
            />
          )}
        </div>

        {/* Offers List - using filtered offers from backend */}
        <OfferList
          offers={offers}
          variant="detailed"
          onOfferView={handleOfferView}
          onToggleInterested={handleToggleInterested}
        />

        {/* Offer Detail Modal */}
        <OfferDetailModal
          offer={selectedOffer}
          isOpen={isOfferDetailOpen}
          onClose={() => {
            setIsOfferDetailOpen(false);
            setSelectedOffer(null);
          }}
        />
      </div>
    </div>
  );
}
