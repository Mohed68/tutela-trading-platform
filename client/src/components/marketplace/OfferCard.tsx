import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OfferPricingMode, OfferVisibilityMode } from "@/lib/offers";
import { getMaskedDisplayName } from "@/lib/privacy";
import { getTrustLevel, type TrustLevel } from "@/lib/trust";
import { CheckCircle2, Info, MapPin, Shield, TrendingUp } from "lucide-react";

type OfferCardProps = {
  offer: any;
  index: number;
  canSeePrices: boolean;
  canStartNegotiation: boolean;
  disabledActionLabel: string;
  onQuickNegotiate: (offer: any) => void;
};

const getTrustScore = (offer: any) => {
  const base = 72;
  const hasTerms = offer.deliveryTerms || offer.paymentTerms ? 8 : 0;
  const hasSeller = offer.user?.companyName ? 7 : 0;
  const hasMinOrder = offer.minQuantity ? 5 : 0;
  const categoryBoost = offer.commodity?.type ? 4 : 0;
  return Math.min(base + hasTerms + hasSeller + hasMinOrder + categoryBoost, 96);
};

const getCommodityIcon = (type: string) => {
  switch (type) {
    case "fuel_hydrocarbons":
      return "⛽";
    case "metals_precious":
      return "🥇";
    case "agricultural":
      return "🌾";
    default:
      return "📦";
  }
};

const formatPrice = (price: string, currency: string) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(parseFloat(price));
};

const formatCommodityType = (type: string) => {
  return type?.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? "Commodity";
};

const formatModelLabel = (value: string) => {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return "Not specified";
  }

  return String(value);
};

const getMockOfferPricingMode = (index: number): OfferPricingMode => {
  const modes: OfferPricingMode[] = ["fixed", "negotiable", "indicative"];
  return modes[index % modes.length];
};

const getMockVisibilityMode = (index: number): OfferVisibilityMode => {
  const modes: OfferVisibilityMode[] = ["public", "semi_anonymous", "full_anonymous"];
  return modes[index % modes.length];
};

const getTrustBadgeClassName = (level: TrustLevel) => {
  switch (level) {
    case "platinum":
      return "border-sky-100 bg-sky-50 text-sky-700";
    case "gold":
      return "border-amber-100 bg-amber-50 text-amber-700";
    case "silver":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "bronze":
    default:
      return "border-orange-100 bg-orange-50 text-orange-700";
  }
};

const verificationCount = 4;

const getCounterpartyLabel = (
  offer: any,
  visibilityMode: OfferVisibilityMode,
  canSeePrices: boolean,
) => {
  const role = offer.type === "sell" ? "seller" : "buyer";

  if (visibilityMode === "public" && canSeePrices) {
    return `${offer.user?.firstName ?? ""} ${offer.user?.lastName ?? ""} • ${offer.user?.companyName || "Independent Trader"}`;
  }

  return getMaskedDisplayName(visibilityMode, role);
};

export default function OfferCard({
  offer,
  index,
  canSeePrices,
  canStartNegotiation,
  disabledActionLabel,
  onQuickNegotiate,
}: OfferCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const trustScore = getTrustScore(offer);
  const pricingMode = getMockOfferPricingMode(index);
  const visibilityMode = getMockVisibilityMode(index);
  const trustLevel = getTrustLevel(trustScore);
  const isSellOffer = offer.type === "sell";
  const hasPriceData =
    parseFloat(offer.pricePerUnit) > 0 && parseFloat(offer.quantity) > 0;
  const counterpartyLabel = getCounterpartyLabel(offer, visibilityMode, canSeePrices);
  const paymentTerms = formatValue(offer.paymentTerms);
  const deliveryTerms = formatValue(offer.deliveryTerms);
  const pricePerUnit = canSeePrices
    ? formatPrice(offer.pricePerUnit, offer.currency)
    : "Price hidden";
  const totalValue = canSeePrices
    ? formatPrice((parseFloat(offer.pricePerUnit) * parseFloat(offer.quantity)).toString(), offer.currency)
    : "Restricted";
  const details = [
    ["Commodity", formatValue(offer.commodity?.name)],
    ["Category", formatCommodityType(offer.commodity?.type)],
    ["Buy/Sell", offer.type?.toUpperCase() ?? "Not specified"],
    ["Pricing mode", formatModelLabel(pricingMode)],
    ["Visibility mode", formatModelLabel(visibilityMode)],
    ["Price per unit", pricePerUnit],
    ["Total value", totalValue],
    ["Quantity", `${parseFloat(offer.quantity).toLocaleString()} ${offer.unit}`],
    ["Location", formatValue(offer.location)],
    ["Payment terms", paymentTerms],
    ["Delivery terms", deliveryTerms],
    ["Counterparty", counterpartyLabel],
    ["Trust score", `${trustScore}/100 ${formatModelLabel(trustLevel)}`],
    ["Verification stack", `${verificationCount} Verifications`],
  ];

  return (
    <>
      <Card className="tutela-metric-card hover:shadow-xl transition-all duration-300 border-0 overflow-hidden">
        <CardHeader className="pb-2 relative px-4 pt-4">
          <div className="absolute top-4 right-4">
            <Badge className={`${offer.type === "buy" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"} font-semibold`}>
              {offer.type.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center space-x-3 pr-16">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--tutela-blue-100)" }}>
              <span className="text-xl">{getCommodityIcon(offer.commodity?.type)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-lg font-bold text-gray-900">{offer.commodity?.name}</CardTitle>
              <p className="truncate text-sm text-gray-600 font-medium">{formatCommodityType(offer.commodity?.type)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700">
                {formatModelLabel(pricingMode)}
              </Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                {formatModelLabel(visibilityMode)}
              </Badge>
            </div>

            <div className={`flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-semibold ${getTrustBadgeClassName(trustLevel)}`}>
              <span>Trust {trustScore}/100</span>
              <span className="h-1 w-1 rounded-full bg-current" />
              <span className="capitalize">{trustLevel}</span>
              <span className="h-1 w-1 rounded-full bg-current" />
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Verified Stack · {verificationCount}
              </span>
            </div>

            <div className="p-2.5 rounded-lg border" style={{ background: "linear-gradient(135deg, var(--tutela-blue-50) 0%, var(--tutela-gray-50) 100%)" }}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-700">Price per {offer.unit}</span>
                <span className="text-base font-bold" style={{ color: "var(--tutela-primary)" }}>
                  {pricePerUnit}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">Total Value</span>
                <span className="font-semibold text-gray-800">
                  {totalValue}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-gray-50 p-2.5">
                <div className="text-base font-bold" style={{ color: "var(--tutela-secondary)" }}>
                  {parseFloat(offer.quantity).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">{offer.unit}</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-2.5">
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="mr-1.5 h-3.5 w-3.5 text-gray-400" />
                  Location
                </div>
                <div className="truncate text-sm font-semibold text-gray-800">{offer.location}</div>
              </div>
            </div>

            <div className="grid gap-1.5 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
              <div className="flex min-w-0 gap-1">
                <span className="font-semibold text-slate-600">Payment:</span>
                <span className="truncate">{paymentTerms}</span>
              </div>
              <div className="flex min-w-0 gap-1">
                <span className="font-semibold text-slate-600">Shipping:</span>
                <span className="truncate">{deliveryTerms}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center text-sm text-gray-600">
                <Shield className="mr-2 h-4 w-4 text-green-500" />
                <span>{visibilityMode === "public" ? "Verified Counterparty" : "Identity protected"}</span>
              </div>
              <div className="truncate text-sm font-medium text-gray-700">
                {counterpartyLabel}
              </div>
            </div>

            <div className="space-y-2 pt-2.5 border-t">
              {isSellOffer &&
                (pricingMode === "fixed" ||
                  pricingMode === "negotiable" ||
                  (pricingMode === "indicative" && hasPriceData)) && (
                <Button
                  className="w-full tutela-btn-primary text-sm font-semibold py-2.5"
                  disabled={!canStartNegotiation}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  {canStartNegotiation ? "Buy Now" : disabledActionLabel}
                </Button>
              )}

              {!isSellOffer && pricingMode === "fixed" && (
                <Button
                  className="w-full tutela-btn-primary text-sm font-semibold py-2.5"
                  disabled={!canStartNegotiation}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  {canStartNegotiation ? "View Details & Contact" : disabledActionLabel}
                </Button>
              )}

              {pricingMode === "negotiable" && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-sm font-semibold py-2.5"
                    disabled={!canStartNegotiation}
                    onClick={() => onQuickNegotiate(offer)}
                  >
                    {canStartNegotiation ? "Quick Negotiate" : disabledActionLabel}
                  </Button>
                  <Button
                    className="w-full tutela-btn-primary text-sm font-semibold py-2.5"
                    disabled={!canStartNegotiation}
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    {canStartNegotiation ? "Written Negotiation" : disabledActionLabel}
                  </Button>
                </>
              )}

              {pricingMode === "indicative" && (
                <Button
                  className="w-full tutela-btn-primary text-sm font-semibold py-2.5"
                  disabled={!canStartNegotiation}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  {canStartNegotiation ? "Request Discussion" : disabledActionLabel}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                className="w-full text-sm font-semibold py-2.5"
                onClick={() => setIsDetailsOpen(true)}
              >
                <Info className="mr-2 h-4 w-4" />
                Offer Details
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="z-[60] max-h-[88vh] overflow-y-auto border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formatValue(offer.commodity?.name)} Offer Details</DialogTitle>
            <DialogDescription>
              Commercial essentials and controlled counterparty information for this marketplace offer.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
                <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
