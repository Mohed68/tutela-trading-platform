import { FormEvent, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analyzeNegotiation, NegotiationLimits } from "@/lib/negotiation";

interface QuickNegotiationModalProps {
  isOpen: boolean;
  onClose: () => void;
  offerId: string;
  originalPrice: number;
  originalQuantity: number;
  currency: string;
  unit: string;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

function getClassificationVariant(classification: string): "default" | "secondary" | "destructive" {
  if (classification === "high") {
    return "destructive";
  }

  if (classification === "moderate") {
    return "secondary";
  }

  return "default";
}

export default function QuickNegotiationModal({
  isOpen,
  onClose,
  offerId,
  originalPrice,
  originalQuantity,
  currency,
  unit,
}: QuickNegotiationModalProps) {
  const [counterPrice, setCounterPrice] = useState(originalPrice.toString());
  const [counterQuantity, setCounterQuantity] = useState(originalQuantity.toString());

  const parsedCounterPrice = Number(counterPrice);
  const parsedCounterQuantity = Number(counterQuantity);
  const isCounterPriceValid = parsedCounterPrice > 0;
  const isCounterQuantityValid = parsedCounterQuantity > 0;
  const isFormValid = isCounterPriceValid && isCounterQuantityValid;

  const analysis = useMemo(
    () =>
      analyzeNegotiation(
        originalPrice,
        originalQuantity,
        isCounterPriceValid ? parsedCounterPrice : 0,
        isCounterQuantityValid ? parsedCounterQuantity : 0,
      ),
    [
      isCounterPriceValid,
      isCounterQuantityValid,
      originalPrice,
      originalQuantity,
      parsedCounterPrice,
      parsedCounterQuantity,
    ],
  );

  const showUnrealisticWarning =
    analysis.overallDeltaPercent > NegotiationLimits.highDeviationThresholdPercent;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isFormValid) {
      return;
    }

    console.log("Quick negotiation counter offer", {
      offerId,
      originalPrice,
      originalQuantity,
      counterPrice: parsedCounterPrice,
      counterQuantity: parsedCounterQuantity,
      analysis,
    });
  };

  const handleClose = () => {
    setCounterPrice(originalPrice.toString());
    setCounterQuantity(originalQuantity.toString());
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="z-[60] max-h-[90vh] overflow-y-auto border border-slate-200 bg-white text-slate-950 shadow-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quick Negotiation</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 rounded-md border border-slate-100 bg-slate-50 p-3 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Original Price</p>
              <p className="font-medium">
                {currency} {formatNumber(originalPrice)} / {unit}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Original Quantity</p>
              <p className="font-medium">
                {formatNumber(originalQuantity)} {unit}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Original Deal Value</p>
              <p className="font-medium">
                {currency} {formatNumber(analysis.originalDealValue)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="counter-price">Counter Price</Label>
              <Input
                className="bg-white"
                id="counter-price"
                min="0"
                step="0.01"
                type="number"
                value={counterPrice}
                onChange={(event) => setCounterPrice(event.target.value)}
              />
              {!isCounterPriceValid && (
                <p className="text-sm text-destructive">Counter price must be greater than 0.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="counter-quantity">Counter Quantity</Label>
              <Input
                className="bg-white"
                id="counter-quantity"
                min="0"
                step="0.01"
                type="number"
                value={counterQuantity}
                onChange={(event) => setCounterQuantity(event.target.value)}
              />
              {!isCounterQuantityValid && (
                <p className="text-sm text-destructive">Counter quantity must be greater than 0.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-md border border-slate-100 bg-white p-3 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Counter Deal Value</p>
              <p className="font-medium">
                {currency} {formatNumber(analysis.counterDealValue)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Price Delta %</p>
              <p className="font-medium">{formatPercent(analysis.priceDeltaPercent)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Quantity Delta %</p>
              <p className="font-medium">{formatPercent(analysis.quantityDeltaPercent)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overall Delta %</p>
              <p className="font-medium">{formatPercent(analysis.overallDeltaPercent)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Negotiation Score</p>
              <p className="font-medium">{analysis.score}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Risk Level</p>
              <p className="font-medium capitalize">{analysis.risk}</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <span className="text-sm text-muted-foreground">Classification</span>
            <Badge variant={getClassificationVariant(analysis.classification)} className="capitalize">
              {analysis.classification}
            </Badge>
          </div>

          {showUnrealisticWarning && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              This counter-offer may be considered unrealistic.
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="tutela-btn-primary" disabled={!isFormValid}>
              Submit Counter Offer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
