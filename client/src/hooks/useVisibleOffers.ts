import { useMemo } from 'react';

interface Offer {
  id: string;
  verified: boolean;
  sellerOrgVerified?: boolean;
  status: string;
  commodity?: { name: string; type: string };
  commodityType?: string;
  commodityName?: string;
  title?: string;
  pricePerUnit?: number | string;
  price?: number | string;
  quantity: number | string;
  sellerOrgName?: string;
  sellerOrgId?: string;
  userId?: string;
  sellerOrg?: { id: string; verified: boolean };
}

function matchesSearch(offer: Offer, search: string): boolean {
  const query = search.toLowerCase().trim();
  if (!query) return true;
  
  return (
    offer.commodity?.name?.toLowerCase().includes(query) ||
    offer.commodityName?.toLowerCase().includes(query) ||
    offer.title?.toLowerCase().includes(query) ||
    offer.sellerOrgName?.toLowerCase().includes(query) ||
    false
  );
}

export function useVisibleOffers({ 
  data, 
  search, 
  category 
}: {
  data: Offer[];
  search: string;
  category: string | null;
}) {
  const filtered = useMemo(() => {
    // Start with verified, active offers only (single source of truth)
    const base = (data ?? []).filter(offer => 
      offer.verified === true && 
      (offer.sellerOrg?.verified === true || offer.sellerOrgVerified === true) &&
      offer.status === 'active'
    );
    
    // Apply category filter if specified
    const byCategory = category && category !== 'all' 
      ? base.filter(offer => 
          offer.commodity?.type === category || 
          offer.commodityType === category
        )
      : base;
    
    // Apply search filter if specified
    const bySearch = search
      ? byCategory.filter(offer => matchesSearch(offer, search))
      : byCategory;
    
    return bySearch;
  }, [data, search, category]);

  return filtered;
}