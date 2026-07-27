import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Package } from "lucide-react";
import OfferCardDetailed from "../components/OfferCardDetailed";
import { useAuth } from "@/hooks/useAuth";

interface OfferListProps {
  offers?: any[]; // Direct offers array
  variant?: 'detailed' | 'compact';
  filter?: 'marketplace' | 'user' | 'interested';
  searchQuery?: string;
  selectedCategory?: string;
  onOfferView?: (offer: any) => void;
  onToggleInterested?: (offerId: string, isCurrentlyInterested: boolean) => void;
}

export default function OfferList({
  offers: directOffers,
  variant = 'detailed',
  filter = 'marketplace',
  searchQuery = '',
  selectedCategory = 'all',
  onOfferView,
  onToggleInterested
}: OfferListProps) {
  const { isAuthenticated } = useAuth();

  // Use direct offers if provided, otherwise fetch
  const shouldFetch = !directOffers;
  const { data: fetchedOffers = [], isLoading } = useQuery({
    queryKey: ["/api/offers", filter, selectedCategory],
    queryFn: async () => {
      let url = "/api/offers";
      if (filter !== 'marketplace') {
        url += `?filter=${filter}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    retry: false,
    enabled: shouldFetch,
  });

  // Fetch commodities for additional data
  const { data: commodities = [] } = useQuery({
    queryKey: ["/api/commodities"],
    retry: false,
  });

  // Use direct offers or fetched offers
  const baseOffers = directOffers || fetchedOffers;

  // Filter offers based on search and category (only if not using direct offers)
  const filteredOffers = directOffers ? baseOffers : baseOffers.filter((offer: any) => {
    const matchesSearch = !searchQuery || 
      offer.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offer.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offer.commodity?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesCategory = selectedCategory === 'all' || 
      offer.commodity?.type === selectedCategory ||
      offer.commodity?.category === selectedCategory;
      
    return matchesSearch && matchesCategory;
  });

  // Enrich offers with commodity data
  const enrichedOffers = filteredOffers.map((offer: any) => {
    const commodity = (commodities as any[]).find((c: any) => c.id === offer.commodityId);
    return {
      ...offer,
      commodity: commodity || {
        id: offer.commodityId,
        name: offer.title,
        type: 'unknown',
        category: 'Other'
      }
    };
  });

  if (isLoading) {
    return (
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
    );
  }

  if (enrichedOffers.length === 0) {
    return (
      <div className="col-span-full text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No offers found</h3>
        <p className="text-gray-600">
          {filter === 'marketplace' ? 
            "Try adjusting your search terms or check back later for new offers." :
            filter === 'user' ?
            "Create your first offer to get started with trading." :
            "Browse marketplace to find interesting offers to track."
          }
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {enrichedOffers.map((offer: any) => (
        <OfferCardDetailed
          key={offer.id}
          offer={offer}
          onView={() => onOfferView?.(offer)}
          onToggleInterested={onToggleInterested}
          isInterested={filter === 'interested'}
        />
      ))}
    </div>
  );
}