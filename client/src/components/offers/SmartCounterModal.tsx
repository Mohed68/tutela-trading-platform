import { useState, useEffect } from "react";
import { TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { marketStore, type Negotiation, type Reservation, canAutoAccept, type Incoterm } from "@/lib/marketStore";
import { useToast } from "@/hooks/use-toast";

interface SmartCounterModalProps {
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
    deliveryTerms?: string;
    validUntil?: string;
  };
  buyerId?: string;
  onSuccess?: (result: { type: 'auto-accepted' | 'negotiation'; data: Reservation | Negotiation }) => void;
}

export function SmartCounterModal({ 
  isOpen, 
  onClose, 
  offer, 
  buyerId, 
  onSuccess 
}: SmartCounterModalProps) {
  const { toast } = useToast();
  const [priceUsd, setPriceUsd] = useState<number>(0);
  const [qty, setQty] = useState<number>(0);
  const [incoterm, setIncoterm] = useState<Incoterm>("FOB");
  const [windowStart, setWindowStart] = useState<string>("");
  const [windowEnd, setWindowEnd] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [willAutoAccept, setWillAutoAccept] = useState(false);

  // Mock offer data for validation
  const mockOffer = {
    id: offer.id,
    commodity: offer.commodity || "Commodity",
    priceUsd: parseFloat(offer.price),
    uom: offer.unit as "MT" | "BBL",
    minQty: offer.minOrderQty || parseFloat(offer.minQuantity || "0") || 100,
    maxQty: parseFloat(offer.quantity),
    lotSize: 100,
    incoterm: "FOB" as Incoterm,
    delivery: {
      windowStart: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      windowEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    availableQty: parseFloat(offer.quantity),
    autoRules: {
      priceDeltaPct: 2.0, // ±2%
      qtyRange: [offer.minOrderQty || 100, parseFloat(offer.quantity)] as [number, number],
      allowedIncoterms: ["FOB", "CIF", "CFR", "EXW"] as Incoterm[],
      windowToleranceDays: 7,
    },
    sellerId: "seller1"
  };

  useEffect(() => {
    if (isOpen) {
      // Set default values with proper validation
      const price = parseFloat(offer.price);
      setPriceUsd(isNaN(price) ? 0 : price);
      setQty(mockOffer.minQty);
      setIncoterm("FOB");
      
      const today = new Date();
      const start = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const end = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      setWindowStart(start.toISOString().split('T')[0]);
      setWindowEnd(end.toISOString().split('T')[0]);
    }
  }, [isOpen, offer]);

  useEffect(() => {
    // Check if current proposal would auto-accept
    if (priceUsd && qty && windowStart && windowEnd) {
      const proposal = {
        priceUsd,
        qty,
        incoterm,
        windowStart: new Date(windowStart).toISOString(),
        windowEnd: new Date(windowEnd).toISOString(),
      };
      
      setWillAutoAccept(canAutoAccept(mockOffer, proposal));
    }
  }, [priceUsd, qty, incoterm, windowStart, windowEnd]);

  const existingNegotiation = buyerId ? 
    marketStore.negotiations().find(n => 
      n.offerId === offer.id && 
      n.buyerId === buyerId && 
      n.status === "open"
    ) : null;

  const isValidProposal = () => {
    return priceUsd > 0 &&
           qty >= mockOffer.minQty &&
           qty <= mockOffer.maxQty &&
           qty % mockOffer.lotSize === 0 &&
           windowStart &&
           windowEnd &&
           new Date(windowStart) <= new Date(windowEnd);
  };

  const handleSubmit = async () => {
    if (!buyerId) {
      toast({
        title: "Authentication Required",
        description: "Please verify your account to continue",
        variant: "destructive",
      });
      return;
    }

    if (!isValidProposal()) {
      toast({
        title: "Invalid Proposal",
        description: "Please check all fields and ensure they meet the requirements",
        variant: "destructive",
      });
      return;
    }

    // Check round limit
    if (existingNegotiation && existingNegotiation.round >= 2) {
      toast({
        title: "Negotiation limit reached",
        description: "Maximum 2 rounds allowed per negotiation",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const proposal = {
        priceUsd,
        qty,
        incoterm,
        windowStart: new Date(windowStart).toISOString(),
        windowEnd: new Date(windowEnd).toISOString(),
      };

      if (willAutoAccept) {
        // Auto-accept: create reservation and mark negotiation as accepted
        const reservation: Reservation = {
          id: crypto.randomUUID(),
          offerId: offer.id,
          buyerId,
          qty,
          createdAt: marketStore.now(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          status: "active"
        };

        const negotiation: Negotiation = {
          id: crypto.randomUUID(),
          offerId: offer.id,
          buyerId,
          round: 1,
          status: "accepted",
          proposed: proposal,
          decision: { autoAccepted: true, reason: "Within auto-accept parameters" },
          expiresAt: marketStore.now()
        };

        // Save to store
        const reservations = marketStore.reservations();
        const negotiations = marketStore.negotiations();
        
        marketStore.saveReservations([...reservations, reservation]);
        marketStore.saveNegotiations([...negotiations, negotiation]);

        toast({
          title: "Auto-Accepted!",
          description: "Your counter-offer was automatically accepted",
        });

        onSuccess?.({ type: 'auto-accepted', data: reservation });
      } else {
        // Create or advance negotiation
        const currentRound = existingNegotiation ? existingNegotiation.round + 1 : 1;
        
        const negotiation: Negotiation = {
          id: existingNegotiation?.id || crypto.randomUUID(),
          offerId: offer.id,
          buyerId,
          round: currentRound as 1 | 2,
          status: "open",
          proposed: proposal,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
        };

        // Update store
        const negotiations = marketStore.negotiations();
        const updatedNegotiations = existingNegotiation
          ? negotiations.map(n => n.id === existingNegotiation.id ? negotiation : n)
          : [...negotiations, negotiation];
        
        marketStore.saveNegotiations(updatedNegotiations);

        toast({
          title: "Counter sent",
          description: `Awaiting seller response (Round ${currentRound}/2)`,
        });

        onSuccess?.({ type: 'negotiation', data: negotiation });
      }

      onClose();
    } catch (error) {
      console.error("Failed to submit counter:", error);
      toast({
        title: "Submission Failed",
        description: "Unable to submit your counter-offer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const originalPrice = parseFloat(offer.price);
  const priceDelta = isNaN(originalPrice) || originalPrice === 0 ? 0 : ((priceUsd - originalPrice) / originalPrice) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span>Smart Counter</span>
            {existingNegotiation && (
              <Badge variant="outline">Round {existingNegotiation.round + 1}/2</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Negotiate terms - auto-acceptance within seller's parameters
          </DialogDescription>
        </DialogHeader>

        {willAutoAccept && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              This offer will be auto-accepted instantly!
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">Price (USD per {offer.unit})</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="price"
                type="number"
                value={priceUsd}
                onChange={(e) => setPriceUsd(parseFloat(e.target.value) || 0)}
                min={0}
                step={0.01}
              />
              {priceDelta !== 0 && (
                <Badge variant={Math.abs(priceDelta) <= 2 ? "default" : "destructive"}>
                  {priceDelta > 0 ? "+" : ""}{priceDelta.toFixed(1)}%
                </Badge>
              )}
            </div>
            <div className="text-xs text-gray-500">
              Original: ${isNaN(originalPrice) ? "0" : originalPrice.toLocaleString()} • Auto-accept range: ±2%
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="qty">Quantity ({offer.unit})</Label>
            <Input
              id="qty"
              type="number"
              value={qty}
              onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
              min={mockOffer.minQty}
              max={mockOffer.maxQty}
              step={mockOffer.lotSize}
            />
            <div className="text-xs text-gray-500">
              Range: {mockOffer.minQty.toLocaleString()} - {mockOffer.maxQty.toLocaleString()} • Lot: {mockOffer.lotSize.toLocaleString()}
            </div>
          </div>

          {/* Incoterm */}
          <div className="space-y-2">
            <Label htmlFor="incoterm">Incoterm</Label>
            <Select value={incoterm} onValueChange={(value) => setIncoterm(value as Incoterm)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FOB">FOB - Free on Board</SelectItem>
                <SelectItem value="CIF">CIF - Cost, Insurance & Freight</SelectItem>
                <SelectItem value="CFR">CFR - Cost & Freight</SelectItem>
                <SelectItem value="EXW">EXW - Ex Works</SelectItem>
                <SelectItem value="DAP">DAP - Delivered at Place</SelectItem>
                <SelectItem value="DDP">DDP - Delivered Duty Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Shipment Window */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="windowStart">Window Start</Label>
              <Input
                id="windowStart"
                type="date"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="windowEnd">Window End</Label>
              <Input
                id="windowEnd"
                type="date"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
                min={windowStart}
              />
            </div>
          </div>

          {/* Validation Messages */}
          {!isValidProposal() && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please ensure all fields are valid and quantity is within allowed range
              </AlertDescription>
            </Alert>
          )}

          {/* Total Calculation */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Value:</span>
              <span className="text-lg font-bold text-blue-700">
                ${isNaN(priceUsd) || isNaN(qty) ? "0" : (priceUsd * qty).toLocaleString()} {offer.currency}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!isValidProposal() || isSubmitting}
            className={willAutoAccept ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}
          >
            {isSubmitting ? "Submitting..." : willAutoAccept ? "Accept (Auto)" : "Send Counter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}