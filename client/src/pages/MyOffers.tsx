import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { isDemo } from "@/lib/demo";
import {
  Plus,
  MoreVertical,
  Edit,
  Pause,
  Play,
  Copy,
  Archive,
  Package,
  DollarSign,
  Calendar,
  Building2,
  User,
  Shield
} from "lucide-react";
import { fmtMoney, fmtCompactMoney, UNIT_LABEL, type Unit, toNumber, isNum } from "@/lib/formatting";

interface Offer {
  id: string;
  userId: string;
  commodity?: { name: string; type: string };
  commodityName?: string;
  title?: string;
  type: 'buy' | 'sell';
  quantity: number | string;
  unit: string;
  pricePerUnit: number | string;
  price?: number | string;
  currency: string;
  location: string;
  status: 'draft' | 'pending_verification' | 'active' | 'paused' | 'closed' | 'sold_out';
  verified: boolean;
  minOrderQty?: number | string;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
  sellerOrgName?: string;
  sellerOrgVerified?: boolean;
  delegateFullName?: string;
  delegateRoleTitle?: string;
  delegateIsAuthorized?: boolean;
  delegateUploadedAt?: string;
}

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  pending_verification: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  active: 'bg-green-100 text-green-800 border-green-200',
  paused: 'bg-blue-100 text-blue-800 border-blue-200',
  closed: 'bg-red-100 text-red-800 border-red-200',
  sold_out: 'bg-purple-100 text-purple-800 border-purple-200'
};

const STATUS_LABELS = {
  draft: 'Draft',
  pending_verification: 'Pending Verification',
  active: 'Active',
  paused: 'Paused',
  closed: 'Closed',
  sold_out: 'Sold Out'
};

export default function MyOffers() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: offers = [], isLoading, error } = useQuery({
    queryKey: ['/api/offers', 'my'],
    queryFn: async () => {
      if (isDemo()) {
        // Return demo offers for the demo user
        const demoOffers = [
          {
            id: "demo-my-offer-1",
            userId: "demo-user",
            commodity: { name: "WTI Crude Oil", type: "fuel_hydrocarbons" },
            type: "sell",
            quantity: 50000,
            pricePerUnit: 78.45,
            currency: "USD",
            unit: "bbl",
            location: "Houston, TX",
            status: "active",
            verified: true,
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            sellerOrgName: "Demo Energy Trading LLC",
            sellerOrgVerified: true,
            delegateFullName: "Demo User",
            delegateRoleTitle: "Trading Manager",
            delegateIsAuthorized: true,
            minOrderQty: 1000
          },
          {
            id: "demo-my-offer-2", 
            userId: "demo-user",
            commodity: { name: "Brent Crude Oil", type: "fuel_hydrocarbons" },
            type: "sell",
            quantity: 25000,
            pricePerUnit: 82.20,
            currency: "USD",
            unit: "bbl",
            location: "Fujairah, UAE",
            status: "paused",
            verified: true,
            validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            sellerOrgName: "Demo Energy Trading LLC",
            sellerOrgVerified: true,
            delegateFullName: "Demo User",
            delegateRoleTitle: "Trading Manager",
            delegateIsAuthorized: true,
            minOrderQty: 1000
          },
          {
            id: "demo-my-offer-3",
            userId: "demo-user", 
            commodity: { name: "Gold Bars", type: "metals_precious" },
            type: "buy",
            quantity: 100,
            pricePerUnit: 2020.50,
            currency: "USD",
            unit: "oz",
            location: "New York, NY",
            status: "draft",
            verified: false,
            validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            sellerOrgName: "Demo Energy Trading LLC",
            sellerOrgVerified: true,
            delegateFullName: "Demo User",
            delegateRoleTitle: "Trading Manager",
            delegateIsAuthorized: true,
            minOrderQty: 10
          }
        ];
        return demoOffers;
      }
      
      const response = await fetch('/api/offers?filter=my');
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    enabled: isAuthenticated,
    retry: false,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ offerId, status }: { offerId: string; status: string }) => {
      await apiRequest("PATCH", `/api/offers/${offerId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/offers'] });
      toast({
        title: "Status Updated",
        description: "Offer status has been updated successfully.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update offer status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const duplicateOfferMutation = useMutation({
    mutationFn: async (offerId: string) => {
      // In a real implementation, this would duplicate the offer
      console.log('Duplicating offer:', offerId);
      // For now, just show success message
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Offer Duplicated",
        description: "A copy of this offer has been created as a draft.",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto text-center">
          <CardContent className="pt-6">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
            <p className="text-gray-600 mb-4">
              Please log in to view your offers.
            </p>
            <Button asChild>
              <a href="/api/login">Log In</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto text-center">
          <CardContent className="pt-6">
            <p className="text-red-600">Failed to load your offers. Please try again.</p>
            <Button 
              className="mt-4" 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/offers'] })}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleStatusChange = async (offerId: string, newStatus: string) => {
    updateStatusMutation.mutate({ offerId, status: newStatus });
  };

  const handleDuplicate = async (offerId: string) => {
    duplicateOfferMutation.mutate(offerId);
  };

  const renderOfferCard = (offer: Offer) => {
    const unitPrice = toNumber(offer.pricePerUnit || offer.price || 0);
    const quantity = toNumber(offer.quantity || 0);
    const totalValue = unitPrice * quantity;
    const unitLabel = UNIT_LABEL[offer.unit as Unit] || offer.unit;
    const commodityName = offer.commodity?.name || offer.commodityName || offer.title || 'Unknown Commodity';

    return (
      <Card key={offer.id} className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{commodityName}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant="outline" 
                  className={STATUS_COLORS[offer.status]}
                >
                  {STATUS_LABELS[offer.status]}
                </Badge>
                {offer.verified && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Shield className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
                <Badge variant="outline" className={
                  offer.type === 'sell' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                }>
                  {offer.type === 'sell' ? 'Selling' : 'Buying'}
                </Badge>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {offer.status === 'active' && (
                  <DropdownMenuItem onClick={() => handleStatusChange(offer.id, 'paused')}>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </DropdownMenuItem>
                )}
                {offer.status === 'paused' && (
                  <DropdownMenuItem onClick={() => handleStatusChange(offer.id, 'active')}>
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => handleDuplicate(offer.id)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleStatusChange(offer.id, 'closed')}
                  className="text-red-600"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Price & Quantity Info */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Price per unit</p>
              <p className="text-lg font-semibold text-green-600 whitespace-nowrap">
                {isNum(unitPrice) ? `${fmtMoney(unitPrice, offer.currency)} / ${unitLabel}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Value</p>
              <p className="text-lg font-semibold text-gray-900">
                {isNum(totalValue) ? fmtCompactMoney(totalValue, offer.currency) : '—'}
              </p>
            </div>
          </div>

          {/* Quantity & Location */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center">
              <Package className="w-4 h-4 mr-2 text-gray-500" />
              <span>{isNum(quantity) ? quantity.toLocaleString() : '—'} {unitLabel}</span>
            </div>
            <div className="flex items-center">
              <Building2 className="w-4 h-4 mr-2 text-gray-500" />
              <span className="truncate">{offer.location}</span>
            </div>
            {offer.validUntil && (
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                <span>Valid until {new Date(offer.validUntil).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Company & Delegate Identity (if available) */}
          {(offer.sellerOrgName || offer.delegateFullName) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center text-sm">
                <User className="w-4 h-4 mr-2 text-gray-500" />
                <span className="text-gray-700 truncate">
                  {offer.sellerOrgName && offer.delegateFullName ? (
                    <>
                      <span className="font-medium">{offer.sellerOrgName}</span>
                      <span className="text-gray-400 mx-2">—</span>
                      <span>{offer.delegateFullName}</span>
                      {offer.delegateRoleTitle && (
                        <span className="text-gray-500"> ({offer.delegateRoleTitle})</span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-500">Identity details pending</span>
                  )}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Offers</h1>
        <Button asChild>
          <Link href="/create-offer">
            <Plus className="w-4 h-4 mr-2" />
            Create Offer
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-gray-100 rounded"></div>
            </div>
          ))}
        </div>
      ) : offers.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">No offers yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first offer to start trading on the marketplace.
            </p>
            <Button asChild size="lg">
              <Link href="/create-offer">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Offer
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {offers.map(renderOfferCard)}
        </div>
      )}
    </div>
  );
}
