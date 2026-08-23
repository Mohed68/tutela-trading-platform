import { useMemo } from 'react';

interface Offer {
  id: string;
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
    // The server-side Publication Eligibility gate is the sole publication
    // authority. Client filtering is presentation-only.
    const base = data ?? [];
    
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
