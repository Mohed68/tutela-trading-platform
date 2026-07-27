import { useState, useEffect } from "react";
import { Check, AlertTriangle, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { marketStore, type Reservation } from "@/lib/marketStore";
import { useToast } from "@/hooks/use-toast";

interface AcceptNowDialogProps {
  isOpen: boolean;
  onClose: () => void;
  offer: {
    id: string;
    commodity?: string;
    specifications?: any;
    price: string;
    currency: string;
    unit: string;
    quantity: string;
    minQuantity?: string;
    minOrderQty?: number;
    location: string;
    seller?: string;
    availableQty?: number;
  };
  buyerId?: string;
  onSuccess?: (reservation: Reservation) => void;
}

export function AcceptNowDialog({ 
  isOpen, 
  onClose, 
  offer, 
  buyerId, 
  onSuccess 
}: AcceptNowDialogProps) {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState<number>(0);
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate lot size and bounds
  const lotSize = 100; // Default lot size
  const minQty = offer.minOrderQty || parseFloat(offer.minQuantity || "0") || 100;
  const maxQty = offer.availableQty || parseFloat(offer.quantity) || 10000;
  const availableQty = Math.min(maxQty, offer.availableQty || maxQty);

  useEffect(() => {
    if (isOpen) {
      // Set default quantity to minimum valid amount in multiples of lot size
      const defaultQty = Math.ceil(minQty / lotSize) * lotSize;
      setQuantity(Math.min(defaultQty, availableQty));
      setConfirmed(false);
    }
  }, [isOpen, minQty, lotSize, availableQty]);

  const handleQuantityChange = (value: string) => {
    const num = parseFloat(value) || 0;
    setQuantity(num);
  };

  const isValidQuantity = () => {
    return quantity >= minQty && 
           quantity <= availableQty && 
           quantity % lotSize === 0;
  };

  const calculateTotal = () => {
    const price = parseFloat(offer.price);
    if (isNaN(price) || isNaN(quantity)) return 0;
    return quantity * price;
  };

  const handleAccept = async () => {
    if (!buyerId) {
      toast({
        title: "Authentication Required",
        description: "Please verify your account to continue",
        variant: "destructive",
      });
      return;
    }

    if (!isValidQuantity()) {
      toast({
        title: "Invalid Quantity",
        description: `Quantity must be between ${minQty} and ${availableQty} in multiples of ${lotSize}`,
        variant: "destructive",
      });
      return;
    }

    if (!confirmed) {
      toast({
        title: "Confirmation Required",
        description: "Please confirm your acceptance of the terms",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create reservation
      const reservation: Reservation = {
        id: crypto.randomUUID(),
        offerId: offer.id,
        buyerId,
        qty: quantity,
        createdAt: marketStore.now(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
        status: "active"
      };

      // Save to store
      const reservations = marketStore.reservations();
      marketStore.saveReservations([...reservations, reservation]);

      toast({
        title: "Offer Reserved",
        description: `Successfully reserved ${quantity.toLocaleString()} ${offer.unit} for 30 minutes`,
      });

      onSuccess?.(reservation);
      onClose();
    } catch (error) {
      console.error("Failed to create reservation:", error);
      toast({
        title: "Reservation Failed",
        description: "Unable to reserve this offer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextValidQuantity = Math.ceil(quantity / lotSize) * lotSize;
  const prevValidQuantity = Math.floor(quantity / lotSize) * lotSize;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-blue-600" />
            <span>Accept Now</span>
          </DialogTitle>
          <DialogDescription>
            Reserve this offer instantly with a 30-minute hold
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Offer Summary */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm font-medium">
              {(typeof offer.commodity === 'string' ? offer.commodity : (offer.commodity as any)?.name) || 
               (typeof offer.specifications?.grade === 'string' ? offer.specifications.grade : '') || 
               "Commodity"}
            </div>
            <div className="text-xs text-gray-600">{offer.seller} • {offer.location}</div>
            <div className="text-lg font-bold text-green-700 mt-1">
              ${isNaN(parseFloat(offer.price)) ? "0" : parseFloat(offer.price).toLocaleString()} per {offer.unit}
            </div>
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity ({offer.unit})</Label>
            <div className="flex space-x-2">
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                min={minQty}
                max={availableQty}
                step={lotSize}
                className={!isValidQuantity() ? "border-red-300" : ""}
              />
              <div className="flex flex-col space-y-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(Math.min(nextValidQuantity, availableQty))}
                  disabled={nextValidQuantity > availableQty}
                >
                  +{lotSize}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(Math.max(prevValidQuantity, minQty))}
                  disabled={prevValidQuantity < minQty}
                >
                  -{lotSize}
                </Button>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Min: {minQty.toLocaleString()} • Max: {availableQty.toLocaleString()} • Lot Size: {lotSize.toLocaleString()}
            </div>
          </div>

          {/* Validation Messages */}
          {!isValidQuantity() && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {quantity < minQty && `Minimum quantity is ${minQty.toLocaleString()} ${offer.unit}`}
                {quantity > availableQty && `Maximum available is ${availableQty.toLocaleString()} ${offer.unit}`}
                {quantity % lotSize !== 0 && `Quantity must be in multiples of ${lotSize.toLocaleString()}`}
              </AlertDescription>
            </Alert>
          )}

          {/* Total Calculation */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Value:</span>
              <span className="text-lg font-bold text-blue-700">
                ${calculateTotal().toLocaleString()} {offer.currency}
              </span>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="confirm" 
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <Label 
              htmlFor="confirm" 
              className="text-sm cursor-pointer"
            >
              I confirm this reservation and agree to complete contracting within 30 minutes
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleAccept}
            disabled={!isValidQuantity() || !confirmed || isSubmitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? "Reserving..." : "Accept Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}