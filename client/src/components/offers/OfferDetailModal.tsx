import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PlaceOrderModal from "@/components/orders/PlaceOrderModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Package, 
  MapPin, 
  DollarSign, 
  Calendar, 
  Building, 
  Shield, 
  Star,
  MessageCircle,
  FileText,
  Truck,
  TrendingUp
} from "lucide-react";
import { AcceptNowDialog } from "./AcceptNowDialog";
import { SmartCounterModal } from "./SmartCounterModal";
import { AskSellerSheet } from "./AskSellerSheet";
import { DeliveryTermsSummary } from "./DeliveryTermsSummary";
import { OfferStateBar } from "./OfferStateBar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isDemo } from "@/lib/demo";
import { useLocation } from "wouter";
import { extractOfferNumbers, fmtMoney, fmtMoneyCompact } from "@/lib/offerUtils";
import CommodityIcon, { CommodityIcon as NewCommodityIcon } from "@/components/ui/CommodityIcon";

interface OfferDetailModalProps {
  offer: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function OfferDetailModal({ offer, isOpen, onClose }: OfferDetailModalProps) {
  const [isPlaceOrderOpen, setIsPlaceOrderOpen] = useState(false);
  const [isAcceptNowOpen, setIsAcceptNowOpen] = useState(false);
  const [isSmartCounterOpen, setIsSmartCounterOpen] = useState(false);
  const [isAskSellerOpen, setIsAskSellerOpen] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const demoMode = isDemo();

  if (!offer) return null;

  // Extract numbers safely using shared utilities
  const numbers = extractOfferNumbers(offer);
  const demoActionOffer = {
    ...offer,
    commodity: offer.commodity?.name || offer.title || "Commodity",
    price: String(numbers.price),
    currency: numbers.currency,
    unit: numbers.unit,
    quantity: String(numbers.quantity),
    minOrderQty: numbers.minOrderQty,
    seller: "Verified demo seller",
  };
  
  // Guard against invalid data
  if (!numbers.isValid) {
    console.error('Invalid offer data in modal:', { offerId: offer.id, numbers });
    // Could show error banner or close modal
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 text-xl">
            <NewCommodityIcon name={offer.commodity?.name || offer.title || ""} category={offer.commodity?.category || ""} />
            <h2 className="text-xl font-semibold leading-tight line-clamp-2" title={offer.commodity?.name || offer.title || "Commodity"}>
              {offer.commodity?.name || offer.title || "Commodity"}
            </h2>
          </DialogTitle>
          <DialogDescription>
            Complete offer details and trading terms
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Offer State Bar */}
          <OfferStateBar 
            offerId={offer.id || offer.offerId || ""} 
            buyerId={(user as any)?.id}
            onProceedToContracting={(reservationId) => {
              if (demoMode && reservationId) {
                onClose();
                navigate(`/demo/contracts/${reservationId}`);
                return;
              }
              toast({
                title: "Contract preview unavailable",
                description: "Create an active demo reservation before opening its preview.",
              });
            }}
          />

          {/* Delivery Terms Summary */}
          <DeliveryTermsSummary 
            offer={offer}
            incoterm={offer.deliveryTerms}
          />

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Quantity</div>
              <div className="text-lg font-bold text-gray-800 tabular-nums">
                {numbers.quantity.toLocaleString()} {numbers.unit}
              </div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-green-600">Price</div>
              <div className="text-lg font-bold text-green-800 tabular-nums">
                {fmtMoney(numbers.price, numbers.currency)}
              </div>
              <div className="text-xs text-green-600">per {numbers.unit}</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-xs text-blue-600 font-medium">MIN ORDER QTY</div>
              <div className="text-lg font-bold text-blue-800 tabular-nums">
                {numbers.minOrderQty.toLocaleString()} {numbers.unit}
              </div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-purple-600">Total Value</div>
              <div className="text-lg font-bold text-purple-800 tabular-nums">
                {fmtMoneyCompact(numbers.totalValue, numbers.currency)}
              </div>
              <div className="text-xs text-purple-600">{numbers.currency}</div>
            </div>
          </div>

          <Separator />

          {/* Public verification information */}
          <div>
            <h3 className="font-semibold text-lg mb-2">
              Marketplace verification
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">
                  Offer verification confirmed
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Building className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">
                  Seller-organization verification confirmed
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Seller identity and personal contact information are not
                included in the public listing.
              </p>
            </div>
          </div>

          <Separator />

          {/* Location & Logistics */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Location & Logistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600">Location</div>
                  <div className="font-medium">{offer.location}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600">Valid Until</div>
                  <div className="font-medium">
                    {offer.validUntil ? new Date(offer.validUntil).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Specifications */}
          {(offer.specifications || offer.description) && (
            <div>
              <h3 className="font-semibold text-lg mb-2">Technical Specifications</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                {typeof offer.specifications === 'object' ? (
                  <div className="space-y-2">
                    {Object.entries(offer.specifications).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-sm font-medium text-gray-700 capitalize">{key}:</span>
                        <span className="text-sm text-gray-600">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-700">
                    {typeof offer.specifications === 'string' ? offer.specifications : 
                     typeof offer.description === 'string' ? offer.description : 
                     'No specifications available'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Trading Terms */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Trading Terms</h3>
            <div className="space-y-3">
              {offer.deliveryTerms && (
                <div className="flex items-start gap-3">
                  <Truck className="h-4 w-4 text-gray-400 mt-1" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">Delivery Terms</div>
                    <div className="text-sm text-gray-600">
                      {typeof offer.deliveryTerms === 'string' ? offer.deliveryTerms : 'Not specified'}
                    </div>
                  </div>
                </div>
              )}
              
              {offer.deliveryOptions && (
                <div className="flex items-start gap-3">
                  <Package className="h-4 w-4 text-gray-400 mt-1" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">Delivery Options</div>
                    <div className="text-sm text-gray-600">
                      {typeof offer.deliveryOptions === 'string' ? offer.deliveryOptions : 'Not specified'}
                    </div>
                  </div>
                </div>
              )}

              {offer.paymentTerms && (
                <div className="flex items-start gap-3">
                  <DollarSign className="h-4 w-4 text-gray-400 mt-1" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">Payment Terms</div>
                    <div className="text-sm text-gray-600">
                      {typeof offer.paymentTerms === 'string' ? offer.paymentTerms : 'Not specified'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {offer.description && (
            <div>
              <h3 className="font-semibold text-lg mb-2">Description</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700">
                  {typeof offer.description === 'string' ? offer.description : 'Description not available'}
                </p>
              </div>
            </div>
          )}

          {/* Instant Trading Actions */}
          {demoMode ? <div className="space-y-3 pt-4 border-t">
            <div className="flex gap-3">
              <Button 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" 
                size="lg"
                onClick={() => setIsAcceptNowOpen(true)}
              >
                <Package className="mr-2 h-4 w-4" />
                Accept Now
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50" 
                size="lg"
                onClick={() => setIsSmartCounterOpen(true)}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Smart Counter
              </Button>
            </div>
            <Button 
              variant="link" 
              className="w-full text-blue-600 hover:text-blue-800"
              onClick={() => setIsAskSellerOpen(true)}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Ask Seller
            </Button>
          </div> : (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Live trading actions remain unavailable until the server-authoritative
              reservation and contracting workflow is completed. You can explore
              these interactions safely in Demo mode.
            </div>
          )}
        </div>

        {/* Place Order Modal */}
        <PlaceOrderModal
          offer={offer}
          isOpen={isPlaceOrderOpen}
          onClose={() => setIsPlaceOrderOpen(false)}
        />

        {/* Instant Trading Modals */}
        {demoMode && <AcceptNowDialog
          isOpen={isAcceptNowOpen}
          onClose={() => setIsAcceptNowOpen(false)}
          offer={demoActionOffer}
          buyerId={(user as any)?.id}
          onSuccess={(reservation) => {
            toast({
              title: "Offer Reserved",
              description: `Successfully reserved ${reservation.qty.toLocaleString()} ${offer.unit}`,
            });
            setIsAcceptNowOpen(false);
            onClose();
            navigate(`/demo/contracts/${reservation.id}`);
          }}
        />}

        {demoMode && <SmartCounterModal
          isOpen={isSmartCounterOpen}
          onClose={() => setIsSmartCounterOpen(false)}
          offer={demoActionOffer}
          buyerId={(user as any)?.id}
          onSuccess={(result) => {
            if (result.type === 'auto-accepted') {
              toast({
                title: "Auto-Accepted!",
                description: "Your counter-offer was automatically accepted",
              });
            } else {
              toast({
                title: "Counter Sent",
                description: "Your counter-offer has been submitted to the seller",
              });
            }
            setIsSmartCounterOpen(false);
          }}
        />}

        {demoMode && <AskSellerSheet
          isOpen={isAskSellerOpen}
          onClose={() => setIsAskSellerOpen(false)}
          offer={demoActionOffer}
          buyerId={(user as any)?.id}
        />}
      </DialogContent>
    </Dialog>
  );
}
