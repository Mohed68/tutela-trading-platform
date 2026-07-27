import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Heart, MapPin, Shield, Star, Package, Truck, CreditCard, Clock, FileCheck } from "lucide-react";

interface OfferCardDetailedProps {
  offer: any;
  onViewDetails: (offer: any) => void;
  onToggleInterested?: (offerId: string, isCurrentlyInterested: boolean) => void;
  isInterested?: boolean;
  variant?: 'detailed' | 'compact';
}

export default function OfferCardDetailed({ 
  offer, 
  onViewDetails, 
  onToggleInterested,
  isInterested = false,
  variant = 'detailed'
}: OfferCardDetailedProps) {
  const [isTermsExpanded, setIsTermsExpanded] = useState(true);

  // Helper functions
  const formatPrice = (price: string | number, currency: string = 'USD') => {
    const num = parseFloat(price.toString());
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const formatLargeNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const getCommodityIcon = (category: string) => {
    switch (category) {
      case 'fuel_hydrocarbons': return '⛽';
      case 'metals_precious': return '🥇';
      case 'agricultural': return '🌾';
      default: return '📦';
    }
  };

  const formatCommodityType = (type: string) => {
    switch (type) {
      case 'fuel_hydrocarbons': return 'Fuel • Hydrocarbons';
      case 'metals_precious': return 'Metals • Precious';
      case 'agricultural': return 'Agricultural';
      default: return type;
    }
  };

  // Calculate values
  const unitPrice = parseFloat(offer.pricePerUnit || offer.price || '0');
  const quantity = parseFloat(offer.quantity || '0');
  const totalValue = unitPrice * quantity;
  const category = offer.commodity?.type || 'fuel_hydrocarbons';

  if (variant === 'compact') {
    // Return compact version (existing layout)
    return (
      <Card className="tutela-metric-card hover:shadow-lg transition-all duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl bg-blue-50">
                {getCommodityIcon(category)}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {offer.description || offer.commodity?.name || 'Unknown Commodity'}
                </h3>
                <p className="text-sm text-gray-600">{formatCommodityType(category)}</p>
              </div>
            </div>
            {offer.verified && (
              <Badge variant="default" className="bg-green-100 text-green-800">
                Verified
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <p className="text-gray-500">Quantity</p>
              <p className="font-semibold text-gray-900">
                {quantity.toLocaleString()} {offer.unit || 'units'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Price</p>
              <p className="font-semibold text-gray-900">
                {formatPrice(unitPrice, offer.currency)}
              </p>
            </div>
          </div>
          <Button onClick={() => onViewDetails(offer)} className="w-full" size="sm">
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Detailed variant
  return (
    <Card className="tutela-metric-card hover:shadow-xl transition-all duration-300 border-0 overflow-hidden">
      {/* Header with Title & Type */}
      <CardHeader className="pb-3 relative">
        <div className="absolute top-4 right-4">
          <Badge className={`${offer.type === "buy" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"} font-semibold`}>
            {offer.type?.toUpperCase() || 'SELL'}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-3 pr-16">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl bg-blue-50">
            {getCommodityIcon(category)}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 leading-tight">
              {offer.commodity?.name || offer.description || 'Unknown Commodity'}
            </h3>
            <p className="text-sm text-gray-600 font-medium mt-1">
              {formatCommodityType(category)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Price & Total Value Section */}
        <div className="p-4 rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Price per {offer.unit || 'unit'}</span>
            <span className="font-bold text-2xl text-blue-800">
              {formatPrice(unitPrice, offer.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-gray-600">Total Value</span>
            <span className="font-bold text-xl text-gray-800">
              {formatPrice(totalValue, offer.currency)} ({formatLargeNumber(totalValue)})
            </span>
          </div>
        </div>

        {/* Quantity & Minimum Order */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-4 bg-gray-50 rounded-lg border">
            <div className="text-xs text-gray-600 font-medium mb-1">AVAILABLE QTY</div>
            <div className="text-2xl font-bold text-gray-900">
              {quantity.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 font-medium">{offer.unit || 'units'}</div>
          </div>
          
          {offer.minQuantity && (
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-xs text-blue-600 font-medium mb-1">MIN ORDER QTY</div>
              <div className="text-2xl font-bold text-blue-800">
                {parseFloat(offer.minQuantity).toLocaleString()}
              </div>
              <div className="text-sm text-blue-600 font-medium">{offer.unit || 'units'}</div>
            </div>
          )}
        </div>

        {/* Location, Seller, Trust Signals */}
        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
          {/* Location */}
          <div className="flex items-center text-sm text-gray-700">
            <MapPin className="mr-2 h-4 w-4 text-gray-500" />
            <span className="font-medium">{offer.location || 'Location TBD'}</span>
          </div>

          {/* Seller Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center text-sm">
              <Package className="mr-2 h-4 w-4 text-gray-500" />
              <span className="font-semibold text-gray-800">
                {offer.user?.companyName || offer.seller?.name || 'Gulf Energy Trading LLC'}
              </span>
            </div>
            
            {/* Verified Badge */}
            {(offer.verified || offer.seller?.verified) && (
              <div className="flex items-center space-x-2">
                <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
                  <Shield className="mr-1 h-3 w-3" />
                  Verified
                </Badge>
              </div>
            )}
          </div>

          {/* Rating */}
          {offer.seller?.rating && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`h-3 w-3 ${i < Math.floor(offer.seller.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                    />
                  ))}
                </div>
                <span className="font-medium text-gray-700">
                  {offer.seller.rating} ({offer.seller.reviews || 0} reviews)
                </span>
              </div>
            </div>
          )}

          {/* TUTELA Verified Trader */}
          <div className="text-sm text-gray-700">
            <strong>{offer.user?.firstName || 'Demo'} {offer.user?.lastName || 'Trader'}</strong> • TUTELA Verified Trader
          </div>
        </div>

        {/* Trading Terms */}
        <div className={`bg-amber-50 border border-amber-200 rounded-lg transition-all duration-200 ${!isTermsExpanded && window.innerWidth < 768 ? 'cursor-pointer' : ''}`}
             onClick={() => window.innerWidth < 768 && setIsTermsExpanded(!isTermsExpanded)}>
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-amber-800 tracking-wide">TRADING TERMS</div>
              {window.innerWidth < 768 && (
                <button className="text-amber-600 text-xs">
                  {isTermsExpanded ? 'Collapse' : 'Expand'}
                </button>
              )}
            </div>
            
            {(isTermsExpanded || window.innerWidth >= 768) && (
              <div className="space-y-2">
                {/* Incoterm */}
                {offer.deliveryTerms && (
                  <div className="flex items-center text-sm">
                    <Truck className="mr-2 h-4 w-4 text-amber-600" />
                    <span className="font-medium text-amber-800">
                      {offer.deliveryTerms.split(' ')[0]} {/* Extract incoterm like "FOB" */}
                    </span>
                    <span className="text-amber-700 ml-1">
                      {offer.deliveryTerms}
                    </span>
                  </div>
                )}

                {/* Payment Terms */}
                {offer.paymentTerms && (
                  <div className="flex items-center text-sm">
                    <CreditCard className="mr-2 h-4 w-4 text-amber-600" />
                    <div className="flex flex-wrap gap-1">
                      {offer.paymentTerms.split(',').map((term: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs border-amber-300 text-amber-800">
                          {term.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delivery Window */}
                {offer.deliveryWindow && (
                  <div className="flex items-center text-sm">
                    <Clock className="mr-2 h-4 w-4 text-amber-600" />
                    <span className="text-amber-700">{offer.deliveryWindow}</span>
                  </div>
                )}

                {/* Inspection */}
                {offer.inspection && (
                  <div className="flex items-center text-sm">
                    <FileCheck className="mr-2 h-4 w-4 text-amber-600" />
                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-800">
                      {offer.inspection}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button 
            onClick={() => onViewDetails(offer)}
            className="flex-1 tutela-btn-primary font-semibold"
          >
            <Eye className="mr-2 h-4 w-4" />
            View Offer Details
          </Button>
          
          {onToggleInterested && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onToggleInterested(offer.id, isInterested)}
              className="px-3 text-gray-400 hover:text-red-500 transition-colors"
              title={isInterested ? "Remove from interested" : "Add to interested"}
            >
              <Heart className={`h-5 w-5 ${isInterested ? 'fill-red-500 text-red-500' : ''}`} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}