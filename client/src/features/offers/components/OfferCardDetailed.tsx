import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MapPin, 
  Shield, 
  ShieldCheck,
  Star, 
  Eye, 
  Heart,
  Package,
  User,
  Calendar,
  FileCheck,
  Building2
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CommodityIcon, { CommodityIcon as NewCommodityIcon } from "@/components/ui/CommodityIcon";
import { toNum, isNum } from "@/lib/insights";
import { BarSpec, toOz, CATEGORY_LABEL, fmtMoney, fmtMoneyCompact, UNIT_LABEL, Unit } from "@/lib/formatting";
import { PackagingSpec, toKg, toOz as packageToOz } from "@/lib/packaging";

// Number utilities
const toNumber = (v: any) =>
  typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));

interface Offer {
  id: string;
  userId: string;
  commodityId: string;
  commodity?: {
    id: string;
    name: string;
    type: string;
    category: string;
    description?: string;
  };
  type: "buy" | "sell";
  quantity: number;
  unit: string;
  pricePerUnit: number;
  currency: string;
  // REQUIRED: Min Order Quantity
  minOrderQty: number;
  
  // Bar Specification for Metals
  barSpec?: BarSpec;
  
  // Packaging Specification for Agricultural
  packaging?: PackagingSpec;
  
  // Company/Organization info
  sellerOrgId?: string;
  sellerOrgName?: string;
  sellerOrgVerified?: boolean;
  sellerOrgRating?: number;
  sellerOrgLocation?: string;
  sellerOrgCountry?: string;
  
  // Delegate info
  delegateId?: string;
  delegateFullName?: string;
  delegateRoleTitle?: string;
  delegateIsAuthorized?: boolean;
  location: string;
  deliveryTerms?: string;
  paymentTerms?: string;
  status: string;
  verified: boolean;
  specifications?: string;
  deliveryOptions?: string;
  validUntil?: string;

  createdAt: string;
  updatedAt: string;
  // Legacy compatibility
  title?: string;
  description?: string;
  price?: string;
  minOrderQuantity?: string;
  tradingTerms?: {
    incoterm?: string;
    paymentTags?: string[];
    deliveryWindow?: string;
    inspection?: string;
  };
}

interface OfferCardDetailedProps {
  offer: Offer;
  onView?: () => void;
  onToggleInterested?: (offerId: string, isCurrentlyInterested: boolean) => void;
  isInterested?: boolean;
}

export default function OfferCardDetailed({ 
  offer, 
  onView,
  onToggleInterested,
  isInterested = false
}: OfferCardDetailedProps) {
  // Get numbers safely
  const p = toNumber(offer.pricePerUnit || offer.price || 0);
  const q = toNumber(offer.quantity || 0);
  const u = UNIT_LABEL[offer.unit as Unit] ?? offer.unit;
  const ccy = offer.currency ?? 'USD';
  
  // Guard: if numbers are invalid, don't continue with modal
  if (!isNum(p) || !isNum(q) || p <= 0 || q <= 0) {
    console.warn('Invalid offer numbers:', { offerId: offer.id, p: offer.pricePerUnit, q: offer.quantity });
    // Could add Sentry logging here if needed
  }
  
  // MOQ from policy when needed
  let moq = toNumber(offer.minOrderQty || offer.minOrderQuantity || 0);
  if (!isNum(moq) || moq <= 0) {
    // Use basic defaults based on commodity type
    if (offer.unit === 'barrel' || offer.unit === 'bbl') {
      moq = 1000; // 1,000 barrels
    } else if (offer.unit === 'metric_ton' || offer.unit === 'MT') {
      moq = 500; // 500 MT
    } else if (offer.unit === 'troy_ounce') {
      moq = 10; // 10 troy oz
    } else {
      moq = Math.max(1, Math.floor(q * 0.1)); // 10% of available
    }
  }
  
  // Use safe values for display
  const unitPrice = p;
  const quantity = q;
  const totalValue = p * q;
  const minOrderQty = moq;
  const unitLabel = u;
  
  // Use canonical unit system
  const unit = offer.unit as Unit;

  // Safety check for display
  const commodityName = offer.commodity?.name || offer.title || 'Commodity';
  const categoryDisplay = offer.commodity?.category || 'Category';
  
  // Organization info with fallbacks
  const companyName = offer.sellerOrgName || 'Company';
  const companyRating = offer.sellerOrgRating;
  const delegateName = offer.delegateFullName || 'Delegate';
  const delegateRole = offer.delegateRoleTitle;
  const isAuthorized = offer.delegateIsAuthorized ?? false;
  
  // Verified-only guard - don't show modal for unverified offers
  const isVerified = offer.verified && offer.sellerOrgVerified;
  if (!isVerified) {
    return null; // Don't render unverified offers
  }

  // Format upload date for delegate tooltip
  const formatUploadDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Recently';
    }
  };

  return (
    <TooltipProvider>
      <Card className="tutela-metric-card hover:shadow-lg transition-all duration-200 border-gray-200 tabular-nums">
      <CardHeader className="pb-3">
        {/* CARD HEADER */}
        <div className="flex items-start justify-between gap-3">
          {/* Left cluster */}
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <NewCommodityIcon name={commodityName} category={categoryDisplay} />
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold leading-tight line-clamp-2 break-words" title={commodityName}>
                {commodityName}
              </h3>
              {offer.commodity?.type && (
                <div className="text-sm text-muted-foreground">{CATEGORY_LABEL[offer.commodity.type as keyof typeof CATEGORY_LABEL] || offer.commodity.type}</div>
              )}
            </div>
          </div>

          {/* Right cluster: badges stacked, never overlapping */}
          <div className="shrink-0 flex flex-col items-end gap-1">
            {offer.sellerOrgVerified ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="default" className="bg-emerald-100 text-emerald-700 border-emerald-200 leading-none">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      ✓ Verified <span className="opacity-70">(KYB)</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>KYB verification completed. Company identity and business registration verified.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 leading-none">
                      <Shield className="w-3 h-3 mr-1" />
                      ⏳ Pending KYB
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>KYB verification in progress. Company documents under review.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {companyRating && (
              <span className="inline-flex items-center gap-1 text-amber-600 text-xs md:text-sm xs:hidden sm:inline-flex" title={`${companyRating} rating`}>
                ★ {typeof companyRating === 'number' ? companyRating.toFixed(1) : parseFloat(String(companyRating) || '0').toFixed(1)}
              </span>
            )}
            {offer.barSpec?.label && (
              <Badge variant="outline" className="text-xs">
                {offer.barSpec.label}
              </Badge>
            )}
          </div>
        </div>

        {/* PRICE / TOTAL */}
        <div className="flex items-start justify-between gap-4 mt-3">
          {/* Price (primary + secondary for metals) */}
          <div className="basis-1/2 min-w-0 max-w-[50%]">
            <div className="text-xs text-muted-foreground leading-normal">Price</div>
            <div className="font-semibold tabular-nums leading-normal break-words">
              <span className="inline-block">{fmtMoney(unitPrice, ccy)}</span>
              <span className="mx-1">/</span>
              <span className="inline-block truncate">{UNIT_LABEL[unit] || offer.unit}</span>
            </div>
            {/* Secondary price conversions */}
            {unit === 'bar' && offer.barSpec && (
              <div className="text-xs text-muted-foreground">
                ≈ {fmtMoney(unitPrice / toOz(offer.barSpec.weight)!, ccy)} / troy oz
              </div>
            )}
            {unit === 'bag' && offer.packaging && (
              <div className="text-xs text-muted-foreground">
                ≈ {fmtMoney(unitPrice / toKg(offer.packaging)!, ccy)} / kg
              </div>
            )}
          </div>

          {/* Total Value (currency only) */}
          <div className="basis-1/2 min-w-0 max-w-[50%] text-right" title={fmtMoney(totalValue, ccy)}>
            <div className="text-xs text-muted-foreground leading-normal">Total Value</div>
            <div className="font-semibold tabular-nums leading-normal truncate">
              {fmtMoneyCompact(totalValue, ccy)}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Quantity / MOQ (primary + secondary for metals) */}
        <div className="grid grid-cols-2 gap-4 tabular-nums mb-4">
          <div>
            <div className="text-xs text-muted-foreground">Available</div>
            <div className="font-medium">{quantity.toLocaleString()} {UNIT_LABEL[unit] || offer.unit}</div>
            {/* Secondary quantity conversions */}
            {unit === 'bar' && offer.barSpec && (
              <div className="text-xs text-muted-foreground">≈ {(quantity * toOz(offer.barSpec.weight)!).toLocaleString()} troy oz</div>
            )}
            {unit === 'bag' && offer.packaging && (
              <div className="text-xs text-muted-foreground">≈ {(quantity * toKg(offer.packaging)!).toLocaleString()} kg</div>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Min Order</div>
            <div className="font-medium">{minOrderQty.toLocaleString()} {UNIT_LABEL[unit] || offer.unit}</div>
            {/* Secondary MOQ conversions */}
            {unit === 'bar' && offer.barSpec && (
              <div className="text-xs text-muted-foreground">≈ {(minOrderQty * toOz(offer.barSpec.weight)!).toLocaleString()} troy oz</div>
            )}
            {unit === 'bag' && offer.packaging && (
              <div className="text-xs text-muted-foreground">≈ {(minOrderQty * toKg(offer.packaging)!).toLocaleString()} kg</div>
            )}
          </div>
        </div>

        {/* Company and Delegate Identity Line */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm">
            <MapPin className="w-4 h-4 mr-2 text-gray-500" />
            <span className="text-gray-700">{offer.location}</span>
          </div>
          
          {/* Identity block (fixed two lines) */}
          <div className="mt-2">
            <div className="font-medium truncate" title={companyName}>
              {companyName}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="truncate"
                    title={`${delegateName}${delegateRole ? ` (${delegateRole})` : ''}`}>
                {delegateName}{delegateRole ? ` (${delegateRole})` : ''}
              </span>
              {isAuthorized && (
                <ShieldCheck className="h-4 w-4 text-emerald-600" aria-label="Authorized delegate" />
              )}
            </div>
          </div>
        </div>

        {/* Terms as chips (max 2) */}
        <div className="mt-3 flex flex-wrap gap-2 mb-4">
          {(() => {
            const incotermLabel = ({ incoterm, port, city }: { incoterm?: string; port?: string; city?: string }) => {
              if (!incoterm) return null;
              const label = port || city || '';
              return !label || label === city ? incoterm : `${incoterm} ${label}`;
            };
            
            const deliveryTerm = offer.deliveryTerms || 'FOB Origin';
            
            const paymentTerm = offer.paymentTerms || 'Irrevocable LC';
            
            return (
              <>
                <span className="px-2 py-1 rounded-full bg-gray-100 text-xs">
                  {deliveryTerm}
                </span>
                <span className="px-2 py-1 rounded-full bg-gray-100 text-xs">
                  {paymentTerm}
                </span>
              </>
            );
          })()}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <Button 
            onClick={onView}
            className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            aria-label={`View Offer Details — ${commodityName}`}
          >
            <Eye className="w-4 h-4 mr-2" />
            View Offer Details
          </Button>
          
          {onToggleInterested && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleInterested(offer.id, isInterested)}
              className={`px-3 ${isInterested ? 'text-red-600 hover:text-red-700' : 'text-gray-400 hover:text-red-600'}`}
            >
              <Heart className={`w-4 h-4 ${isInterested ? 'fill-current' : ''}`} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  </TooltipProvider>
  );
}