import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Truck,
  Clock,
  Calculator,
  AlertCircle,
  CheckCircle,
  ShoppingCart
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PlaceOrderModalProps {
  offer: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function PlaceOrderModal({ offer, isOpen, onClose }: PlaceOrderModalProps) {
  const [orderQuantity, setOrderQuantity] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [deliveryTimeframe, setDeliveryTimeframe] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("blockchain_escrow");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!offer) return null;

  const minQuantity = parseFloat(offer.minQuantity || offer.minOrderQty || "1");
  const maxQuantity = parseFloat(offer.quantity);
  const unitPrice = parseFloat(offer.price);
  const orderQty = parseFloat(orderQuantity) || 0;
  const totalValue = orderQty * unitPrice;
  const isValidQuantity = orderQty >= minQuantity && orderQty <= maxQuantity;

  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return apiRequest("POST", "/api/orders", orderData);
    },
    onSuccess: () => {
      toast({
        title: "Order Placed Successfully",
        description: "Your order has been submitted and smart contract is being deployed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to place order. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handlePlaceOrder = () => {
    if (!isValidQuantity) {
      toast({
        title: "Invalid Quantity",
        description: `Minimum order quantity is ${minQuantity.toLocaleString()} ${offer.unit}`,
        variant: "destructive",
      });
      return;
    }

    if (!deliveryAddress || !deliveryMethod || !deliveryTimeframe) {
      toast({
        title: "Missing Information",
        description: "Please fill in all delivery details.",
        variant: "destructive",
      });
      return;
    }

    if (!agreeToTerms) {
      toast({
        title: "Terms Required",
        description: "Please agree to the trading terms to proceed.",
        variant: "destructive",
      });
      return;
    }

    const orderData = {
      offerId: offer.id,
      type: offer.type === "sell" ? "buy" : "sell",
      quantity: orderQuantity,
      agreedPrice: offer.price,
      currency: offer.currency,
      totalValue: totalValue.toString(),
      deliveryAddress,
      deliveryMethod,
      deliveryTimeframe,
      paymentMethod,
      notes: specialInstructions,
    };

    placeOrderMutation.mutate(orderData);
  };

  const deliveryOptions = offer.deliveryOptions ? 
    offer.deliveryOptions.split(',').map((opt: string) => opt.trim()) : 
    ["Standard Shipping", "Express Delivery", "Bulk Transport"];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShoppingCart className="h-5 w-5" />
            Place Order - {offer.commodity?.name || "Commodity"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Configuration */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Quantity Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="h-4 w-4" />
                  Quantity & Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity">Order Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(e.target.value)}
                      placeholder={`Min: ${minQuantity.toLocaleString()}`}
                      min={minQuantity}
                      max={maxQuantity}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Min: {minQuantity.toLocaleString()} • Max: {maxQuantity.toLocaleString()} {offer.unit}
                    </div>
                  </div>
                  <div>
                    <Label>Unit Price</Label>
                    <div className="text-2xl font-bold text-green-600">
                      ${unitPrice.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">per {offer.unit}</div>
                  </div>
                </div>

                {/* Quantity Slider */}
                <div className="space-y-2">
                  <Label>Quick Quantity Selection</Label>
                  <Slider
                    value={[orderQty]}
                    onValueChange={([value]) => setOrderQuantity(value.toString())}
                    max={maxQuantity}
                    min={minQuantity}
                    step={Math.max(1, minQuantity / 10)}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Min: {minQuantity.toLocaleString()}</span>
                    <span>Max: {maxQuantity.toLocaleString()}</span>
                  </div>
                </div>

                {/* Validation Status */}
                <div className="flex items-center gap-2">
                  {isValidQuantity ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">Quantity is valid</span>
                    </div>
                  ) : orderQty > 0 ? (
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">
                        {orderQty < minQuantity 
                          ? `Below minimum quantity (${minQuantity.toLocaleString()})` 
                          : `Exceeds available quantity (${maxQuantity.toLocaleString()})`}
                      </span>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Delivery Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-4 w-4" />
                  Delivery Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="delivery-method">Delivery Method</Label>
                    <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select delivery method" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryOptions.map((option: string) => (
                          <SelectItem key={option} value={option.toLowerCase().replace(/\s+/g, '_')}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="delivery-timeframe">Delivery Timeframe</Label>
                    <Select value={deliveryTimeframe} onValueChange={setDeliveryTimeframe}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timeframe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7_days">Within 7 days</SelectItem>
                        <SelectItem value="14_days">Within 14 days</SelectItem>
                        <SelectItem value="30_days">Within 30 days</SelectItem>
                        <SelectItem value="60_days">Within 60 days</SelectItem>
                        <SelectItem value="90_days">Within 90 days</SelectItem>
                        <SelectItem value="flexible">Flexible timing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="delivery-address">Delivery Address</Label>
                  <Textarea
                    id="delivery-address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter complete delivery address including port, warehouse, or facility details"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment & Terms */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="h-4 w-4" />
                  Payment & Terms
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="payment-method">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blockchain_escrow">Smart Contract Escrow (Recommended)</SelectItem>
                      <SelectItem value="letter_of_credit">Letter of Credit</SelectItem>
                      <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                      <SelectItem value="trade_finance">Trade Finance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="special-instructions">Special Instructions</Label>
                  <Textarea
                    id="special-instructions"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="Any special handling requirements, documentation needs, or other instructions"
                    rows={3}
                  />
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="agree-terms"
                    checked={agreeToTerms}
                    onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
                  />
                  <Label htmlFor="agree-terms" className="text-sm">
                    I agree to the trading terms, delivery conditions, and payment requirements outlined in this offer. 
                    I understand this will create a binding smart contract.
                  </Label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Quantity</span>
                    <span className="font-medium">{orderQty.toLocaleString()} {offer.unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Unit Price</span>
                    <span className="font-medium">${unitPrice.toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-medium">Total Value</span>
                    <span className="text-xl font-bold text-green-600">
                      ${totalValue.toLocaleString()} {offer.currency}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    <span>{offer.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>{offer.deliveryTerms}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="h-3 w-3" />
                    <span>{offer.contractType} contract</span>
                  </div>
                </div>

                <Button 
                  className="w-full tutela-btn-primary" 
                  size="lg"
                  onClick={handlePlaceOrder}
                  disabled={!isValidQuantity || !deliveryAddress || !deliveryMethod || !deliveryTimeframe || !agreeToTerms || placeOrderMutation.isPending}
                >
                  {placeOrderMutation.isPending ? "Processing..." : "Place Order"}
                </Button>

                <div className="text-xs text-gray-500 text-center">
                  Secured by blockchain smart contract
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
