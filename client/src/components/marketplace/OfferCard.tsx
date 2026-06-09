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

const summarizeTerm = (value: unknown, allowedCodes: string[]) => {
  const text = formatValue(value);

  if (text === "Not specified") {
    return text;
  }

  const normalized = text.toUpperCase();
  const compact = normalized.replace(/[^A-Z0-9]/g, "");
  const matchedCode = allowedCodes.find((code) => normalized.includes(code) || compact.includes(code));
  return matchedCode ?? text.split(/\s|\/|-/)[0].toUpperCase();
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

const getCardCounterpartyLabel = (
  offer: any,
  visibilityMode: OfferVisibilityMode,
) => {
  const isSeller = offer.type === "sell";

  if (visibilityMode === "full_anonymous") {
    return isSeller ? "Anonymous Supplier" : "Anonymous Buyer";
  }

  return isSeller ? "Verified Supplier" : "Verified Buyer";
};

const getDetailsCounterpartyLabel = (
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
  const cardCounterpartyLabel = getCardCounterpartyLabel(offer, visibilityMode);
  const detailsCounterpartyLabel = getDetailsCounterpartyLabel(offer, visibilityMode, canSeePrices);
  const paymentTerms = formatValue(offer.paymentTerms);
  const deliveryTerms = formatValue(offer.deliveryTerms);
  const paymentSummary = summarizeTerm(offer.paymentTerms, ["SBLC", "CAD", "TT", "LC"]);
  const shippingSummary = summarizeTerm(offer.deliveryTerms, ["FOB", "CIF", "CFR", "DAP", "EXW"]);
  const pricePerUnit = canSeePrices
    ? formatPrice(offer.pricePerUnit, offer.currency)
    : "Price hidden";
  const totalValue = canSeePrices
    ? formatPrice((parseFloat(offer.pricePerUnit) * parseFloat(offer.quantity)).toString(), offer.currency)
    : "Restricted";
  return (
    <>
      <Card className="tutela-metric-card overflow-hidden border-0 transition-all duration-300 hover:shadow-lg">
        <CardHeader className="px-4 pb-2 pt-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-lg font-bold leading-tight text-gray-950">
                {formatValue(offer.commodity?.name)}
              </CardTitle>
              <p className="mt-0.5 truncate text-xs font-medium uppercase tracking-wide text-gray-500">
                {formatCommodityType(offer.commodity?.type)}
              </p>
            </div>
            <Badge className={`${offer.type === "buy" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"} shrink-0 font-semibold`}>
              {offer.type?.toUpperCase() ?? "OFFER"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="border-blue-100 bg-blue-50 px-2 py-0 text-[11px] font-semibold text-blue-700">
              {formatModelLabel(pricingMode)}
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 px-2 py-0 text-[11px] font-semibold text-slate-700">
              {formatModelLabel(visibilityMode)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Price</div>
                  <div className="mt-0.5 text-base font-bold text-slate-950">{pricePerUnit}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase text-slate-500">Quantity</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {parseFloat(offer.quantity).toLocaleString()} {offer.unit}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex min-w-0 items-center text-xs font-medium text-slate-600">
                <MapPin className="mr-1.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{formatValue(offer.location)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-slate-50 px-2.5 py-2">
                <div className="font-semibold text-slate-500">Payment</div>
                <div className="mt-0.5 truncate font-bold text-slate-900">{paymentSummary}</div>
              </div>
              <div className="rounded-md bg-slate-50 px-2.5 py-2">
                <div className="font-semibold text-slate-500">Shipping</div>
                <div className="mt-0.5 truncate font-bold text-slate-900">{shippingSummary}</div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-y border-slate-100 py-2 text-xs">
              <div className="flex min-w-0 items-center gap-2 text-slate-700">
                <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="truncate font-semibold">{cardCounterpartyLabel}</span>
              </div>
              <div className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 font-semibold ${getTrustBadgeClassName(trustLevel)}`}>
                <CheckCircle2 className="h-3 w-3" />
                <span>Trust {trustScore}/100</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>{verificationCount} Verifications</span>
              <span>Total {totalValue}</span>
            </div>

            <div className="space-y-2 pt-1">
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

              {pricingMode === "indicative" && (
                <Button
                  className="w-full tutela-btn-primary text-sm font-semibold py-2.5"
                  disabled={!canStartNegotiation}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  {canStartNegotiation ? "Request Discussion" : disabledActionLabel}
                </Button>
              )}

              {pricingMode === "negotiable" && (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant={isSellOffer ? "outline" : "default"}
                    className={`w-full text-sm font-semibold py-2.5 ${!isSellOffer ? "tutela-btn-primary" : ""}`}
                    disabled={!canStartNegotiation}
                    onClick={() => onQuickNegotiate(offer)}
                  >
                    {canStartNegotiation ? "Quick Negotiate" : disabledActionLabel}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-sm font-semibold py-2.5"
                    disabled={!canStartNegotiation}
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    {canStartNegotiation ? "Written Negotiation" : disabledActionLabel}
                  </Button>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm font-semibold text-slate-700 hover:text-slate-950"
                onClick={() => setIsDetailsOpen(true)}
              >
                <Info className="mr-2 h-4 w-4" />
                Details
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="z-[60] max-h-[90vh] overflow-y-auto border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl sm:max-w-3xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="text-xl">{formatValue(offer.commodity?.name)}</DialogTitle>
                <DialogDescription className="mt-1">
                  {formatCommodityType(offer.commodity?.type)} commercial offer summary.
                </DialogDescription>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge className={`${offer.type === "buy" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"} font-semibold`}>
                  {offer.type?.toUpperCase() ?? "OFFER"}
                </Badge>
                <Badge variant="outline">{formatModelLabel(pricingMode)}</Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 px-6 py-5">
            <section>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Commercial Summary</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                  <div className="text-xs font-semibold uppercase text-slate-500">Counterparty</div>
                  <div className="mt-1 text-base font-bold text-slate-950">{detailsCounterpartyLabel}</div>
                  <div className="mt-2 text-sm text-slate-600">{formatValue(offer.location)}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">Total Value</div>
                  <div className="mt-1 text-lg font-bold text-slate-950">{totalValue}</div>
                  <div className="mt-2 text-sm text-slate-600">{pricePerUnit} / {offer.unit}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">Quantity</div>
                  <div className="mt-1 text-base font-bold text-slate-950">
                    {parseFloat(offer.quantity).toLocaleString()} {offer.unit}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">Origin</div>
                  <div className="mt-1 text-base font-bold text-slate-950">{formatValue(offer.location)}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">Visibility</div>
                  <div className="mt-1 text-base font-bold text-slate-950">{formatModelLabel(visibilityMode)}</div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Commercial Terms</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">Payment Terms</div>
                  <div className="mt-1 text-base font-bold text-slate-950">{paymentSummary}</div>
                  <div className="mt-2 text-sm text-slate-600">{paymentTerms}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">Delivery Terms</div>
                  <div className="mt-1 text-base font-bold text-slate-950">{shippingSummary}</div>
                  <div className="mt-2 text-sm text-slate-600">{deliveryTerms}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">Pricing Mode</div>
                  <div className="mt-1 text-base font-bold text-slate-950">{formatModelLabel(pricingMode)}</div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Verification</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className={`rounded-lg border p-4 ${getTrustBadgeClassName(trustLevel)}`}>
                  <div className="text-xs font-semibold uppercase">Trust Score</div>
                  <div className="mt-1 text-lg font-bold">{trustScore}/100</div>
                  <div className="mt-1 text-sm capitalize">{trustLevel}</div>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
                  <div className="text-xs font-semibold uppercase">Verification Count</div>
                  <div className="mt-1 text-lg font-bold">{verificationCount}</div>
                  <div className="mt-1 text-sm">Commercial checks active</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">Status</div>
                  <div className="mt-1 flex items-center gap-2 text-base font-bold text-slate-950">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Verified
                  </div>
                </div>
              </div>
            </section>

            <section className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Actions</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {isSellOffer &&
                  (pricingMode === "fixed" ||
                    pricingMode === "negotiable" ||
                    (pricingMode === "indicative" && hasPriceData)) && (
                  <Button className="tutela-btn-primary" disabled={!canStartNegotiation}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    {canStartNegotiation ? "Buy Now" : disabledActionLabel}
                  </Button>
                )}
                {pricingMode === "negotiable" && (
                  <Button
                    variant="outline"
                    disabled={!canStartNegotiation}
                    onClick={() => onQuickNegotiate(offer)}
                  >
                    {canStartNegotiation ? "Start Negotiation" : disabledActionLabel}
                  </Button>
                )}
                {pricingMode === "indicative" && (
                  <Button className="tutela-btn-primary" disabled={!canStartNegotiation}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    {canStartNegotiation ? "Request Discussion" : disabledActionLabel}
                  </Button>
                )}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
