import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Package } from "lucide-react";
import OfferCardDetailed from "../components/OfferCardDetailed";
import { useAuth } from "@/hooks/useAuth";
import type {
  PublicMarketplaceOffer,
  PublicMarketplaceOffersResponse,
} from "@shared/marketplace";

interface OfferListProps {
  offers?: PublicMarketplaceOffer[];
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
  const { data: fetchedResponse, isLoading } =
    useQuery<PublicMarketplaceOffersResponse>({
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

  const baseOffers = directOffers ?? fetchedResponse?.offers ?? [];

  // Filter offers based on search and category (only if not using direct offers)
  const filteredOffers = directOffers ? baseOffers : baseOffers.filter((offer) => {
    const matchesSearch = !searchQuery || 
      offer.commodity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offer.location.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesCategory = selectedCategory === 'all' || 
      offer.commodity.category === selectedCategory;
      
    return matchesSearch && matchesCategory;
  });

  // The legacy card receives only public fields, and only after both explicit
  // verification states are proven. Unknown states are not converted to
  // boolean false and cannot enter the render path.
  const publishedOffers = filteredOffers.flatMap((offer) => {
    if (
      offer.trust.offerVerification.state !== "verified" ||
      offer.trust.sellerOrganizationVerification.state !== "verified" ||
      offer.visibility.state !== "published"
    ) {
      return [];
    }

    return [{
      id: offer.id,
      commodityId: offer.commodity.id,
      commodity: {
        ...offer.commodity,
        type: offer.commodity.category,
      },
      type: offer.offerType,
      quantity: Number(offer.quantity.value),
      unit: offer.quantity.unit,
      pricePerUnit: Number(offer.pricing.amountPerUnit),
      currency: offer.pricing.currency,
      minOrderQty: offer.terms.minimumQuantity
        ? Number(offer.terms.minimumQuantity)
        : 0,
      location: offer.location,
      deliveryTerms: offer.terms.delivery ?? undefined,
      paymentTerms: offer.terms.payment ?? undefined,
      status: offer.status,
      verified: true,
      sellerOrgVerified: true,
      validUntil: offer.terms.validUntil ?? undefined,
      createdAt: offer.createdAt ?? "",
      updatedAt: offer.updatedAt ?? "",
    }];
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

  if (publishedOffers.length === 0) {
    return (
      <div className="col-span-full text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No verified offers are currently available
        </h3>
        <p className="text-gray-600">
          {filter === 'marketplace' ? 
            "Offers appear only after both offer and seller-organization verification are confirmed." :
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
      {publishedOffers.map((offer) => (
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
