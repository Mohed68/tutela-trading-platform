import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, Users, DollarSign, Clock, AlertCircle } from "lucide-react";
import { fmtMoney, fmtNumber } from "@/lib/formatting";
import clsx from "clsx";

interface MarketplaceInsightsProps {
  offers: any[];
  category?: string;
  searchQuery?: string;
  commodityKey?: string;
  unit?: string;
  variant?: 'hero' | 'compact';
}

interface OffersSummary {
  activeOffers: number;
  marketValueUsd: number;
  verifiedTraders: number;
}

export function MarketplaceInsights({ 
  offers, 
  category, 
  searchQuery, 
  commodityKey, 
  unit, 
  variant = 'compact' 
}: MarketplaceInsightsProps) {
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // Fetch complete summary from backend
  const { data: summary, isLoading, error } = useQuery<OffersSummary>({
    queryKey: ['/api/offers/summary', category, commodityKey, unit, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.set('category', category);
      if (commodityKey) params.set('commodityKey', commodityKey);
      if (unit) params.set('unit', unit);
      if (searchQuery?.trim()) params.set('q', searchQuery.trim());
      
      // Build full URL for deployment compatibility
      const baseUrl = window.location.origin;
      const apiUrl = `${baseUrl}/api/offers/summary?${params}`;
      
      const response = await fetch(apiUrl, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        console.error('API call failed:', response.status, response.statusText);
        // For deployment, fall back to offers-based calculation
        throw new Error(`API Error: ${response.status}`);
      }
      return response.json();
    },
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000, // 30 seconds
  });

  // Update timestamp and verify count consistency (dev only)
  useEffect(() => {
    if (summary) {
      setUpdatedAt(new Date());
      
      // DEV ASSERTION: Verify summary count matches list count
      if (process.env.NODE_ENV === 'development') {
        console.assert(
          summary.activeOffers === offers.length, 
          'Insights/list mismatch', 
          {
            summary: { activeOffers: summary.activeOffers, marketValueUsd: summary.marketValueUsd },
            list: { totalCount: offers.length },
            category,
            commodityKey,
            unit,
            searchQuery
          }
        );
      }
    }
  }, [summary, offers.length, category, commodityKey, unit, searchQuery]);

  if (isLoading) {
    return (
      <Card className={clsx(
        "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200",
        variant === 'hero' ? 'col-span-full' : ''
      )}>
        <CardContent className={clsx("p-6", variant === 'hero' ? 'py-8' : '')}>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    // Fallback: Calculate basic metrics from offers data
    const fallbackSummary = {
      activeOffers: offers.length,
      marketValueUsd: offers.reduce((sum, offer) => {
        const price = parseFloat(offer.price || '0');
        const qty = parseFloat(offer.quantity || '0');
        return sum + (price * qty);
      }, 0),
      verifiedTraders: new Set(offers.filter(o => o.verified).map(o => o.seller || o.userId)).size
    };

    return (
      <TooltipProvider>
        <Card className={clsx(
          "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200",
          variant === 'hero' ? 'col-span-full' : ''
        )}>
          <CardContent className={clsx("p-6", variant === 'hero' ? 'py-8' : 'py-4')}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={clsx(
                "font-semibold text-gray-700 flex items-center gap-2",
                variant === 'hero' ? 'text-lg' : 'text-sm'
              )}>
                <TrendingUp className={clsx("text-amber-600", variant === 'hero' ? 'w-5 h-5' : 'w-4 h-4')} />
                Market Overview
              </h3>
              <div className="flex items-center text-xs text-amber-600 gap-1">
                <Clock className="w-3 h-3" />
                Estimated
              </div>
            </div>

            <div className={clsx(
              "grid gap-6",
              variant === 'hero' 
                ? 'grid-cols-1 md:grid-cols-3' 
                : 'grid-cols-3'
            )}>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className={clsx(
                    "text-green-600 mr-2",
                    variant === 'hero' ? 'w-6 h-6' : 'w-4 h-4'
                  )} />
                  <span className={clsx(
                    "text-gray-600",
                    variant === 'hero' ? 'text-sm' : 'text-xs'
                  )}>Active Offers</span>
                </div>
                <div className={clsx(
                  "font-bold text-green-700",
                  variant === 'hero' ? 'text-3xl' : 'text-lg'
                )}>
                  {fmtNumber(fallbackSummary.activeOffers)}
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <DollarSign className={clsx(
                    "text-blue-600 mr-2",
                    variant === 'hero' ? 'w-6 h-6' : 'w-4 h-4'
                  )} />
                  <span className={clsx(
                    "text-gray-600",
                    variant === 'hero' ? 'text-sm' : 'text-xs'
                  )}>Market Value</span>
                </div>
                <div className={clsx(
                  "font-bold text-blue-700",
                  variant === 'hero' ? 'text-3xl' : 'text-lg'
                )}>
                  {fmtMoney(fallbackSummary.marketValueUsd)}
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Users className={clsx(
                    "text-purple-600 mr-2",
                    variant === 'hero' ? 'w-6 h-6' : 'w-4 h-4'
                  )} />
                  <span className={clsx(
                    "text-gray-600",
                    variant === 'hero' ? 'text-sm' : 'text-xs'
                  )}>Verified Traders</span>
                </div>
                <div className={clsx(
                  "font-bold text-purple-700",
                  variant === 'hero' ? 'text-3xl' : 'text-lg'
                )}>
                  {fmtNumber(fallbackSummary.verifiedTraders)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>
    );
  }

  const hasOffers = summary && summary.activeOffers > 0;

  return (
    <TooltipProvider>
      <Card className={clsx(
        "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200",
        variant === 'hero' ? 'col-span-full' : ''
      )}>
        <CardContent className={clsx("p-6", variant === 'hero' ? 'py-8' : 'py-4')}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={clsx(
              "font-semibold text-gray-700 flex items-center gap-2",
              variant === 'hero' ? 'text-lg' : 'text-sm'
            )}>
              <TrendingUp className={clsx("text-blue-600", variant === 'hero' ? 'w-5 h-5' : 'w-4 h-4')} />
              Live Market Insights
            </h3>
            <div className="flex items-center text-xs text-gray-500 gap-1">
              <Clock className="w-3 h-3" />
              Updated {updatedAt?.toLocaleTimeString() || '—'}
            </div>
          </div>

          {!hasOffers ? (
            <div className="flex items-center justify-center py-6 text-sm text-gray-500">
              <AlertCircle className="w-4 h-4 mr-2" />
              No offers match current filters
            </div>
          ) : (
            <div className={clsx(
              "grid gap-6",
              variant === 'hero' 
                ? 'grid-cols-1 md:grid-cols-3' 
                : 'grid-cols-3'
            )}>
              {/* Active Offers */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <TrendingUp className={clsx(
                        "text-green-600 mr-2",
                        variant === 'hero' ? 'w-6 h-6' : 'w-4 h-4'
                      )} />
                      <span className={clsx(
                        "text-gray-600",
                        variant === 'hero' ? 'text-sm' : 'text-xs'
                      )}>Active Offers</span>
                    </div>
                    <div className={clsx(
                      "font-bold text-green-700",
                      variant === 'hero' ? 'text-3xl' : 'text-lg'
                    )}>
                      {fmtNumber(summary.activeOffers)}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Verified & active offers matching current filters</p>
                  <p className="text-xs text-gray-500">Total in marketplace: {summary.activeOffers}</p>
                </TooltipContent>
              </Tooltip>

              {/* Market Value */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <DollarSign className={clsx(
                        "text-blue-600 mr-2",
                        variant === 'hero' ? 'w-6 h-6' : 'w-4 h-4'
                      )} />
                      <span className={clsx(
                        "text-gray-600",
                        variant === 'hero' ? 'text-sm' : 'text-xs'
                      )}>Market Value</span>
                    </div>
                    <div className={clsx(
                      "font-bold text-blue-700",
                      variant === 'hero' ? 'text-3xl' : 'text-lg'
                    )}>
                      {fmtMoney(summary.marketValueUsd)}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sum of price × quantity for all filtered offers</p>
                </TooltipContent>
              </Tooltip>

              {/* Verified Traders */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Users className={clsx(
                        "text-purple-600 mr-2",
                        variant === 'hero' ? 'w-6 h-6' : 'w-4 h-4'
                      )} />
                      <span className={clsx(
                        "text-gray-600",
                        variant === 'hero' ? 'text-sm' : 'text-xs'
                      )}>Verified Traders</span>
                    </div>
                    <div className={clsx(
                      "font-bold text-purple-700",
                      variant === 'hero' ? 'text-3xl' : 'text-lg'
                    )}>
                      {fmtNumber(summary.verifiedTraders)}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Unique verified traders offering these commodities</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}