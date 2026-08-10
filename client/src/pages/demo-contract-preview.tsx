import { useLocation, useRoute } from "wouter";
import { AlertTriangle, ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildDemoContractPreview, isDemo } from "@/lib/demo";
import { marketStore } from "@/lib/marketStore";

export default function DemoContractPreviewPage() {
  const [, params] = useRoute("/demo/contracts/:reservationId");
  const [, navigate] = useLocation();
  const reservation = isDemo()
    ? marketStore
        .reservations()
        .find((candidate) => candidate.id === params?.reservationId)
    : undefined;
  const preview = reservation
    ? buildDemoContractPreview(reservation, new Date())
    : undefined;

  if (!preview) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Demo contract unavailable
            </CardTitle>
            <CardDescription>
              This demo reservation is missing, inactive, or has been cleared by
              a new demo session.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/marketplace")}>Return to marketplace</Button>
            <Button variant="outline" onClick={() => navigate("/demo")}>Restart demo</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: preview.currency,
    maximumFractionDigits: 2,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate("/marketplace")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Marketplace
        </Button>
        <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
          Simulation only
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            Demo Contract Preview
          </CardTitle>
          <CardDescription>
            A browser-local preview generated from your demo reservation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            This is not a legal contract and creates no database record, payment,
            order, blockchain transaction, or obligation between parties.
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Detail label="Status" value="Draft preview" />
            <Detail label="Commodity" value={preview.commodityName} />
            <Detail label="Buyer" value={preview.buyerDisplayName} />
            <Detail label="Seller" value={preview.sellerDisplayName} />
            <Detail
              label="Quantity"
              value={`${preview.quantity.toLocaleString()} ${preview.unit}`}
            />
            <Detail
              label="Unit price"
              value={`${money.format(preview.amountPerUnit)} per ${preview.unit}`}
            />
            <Detail label="Total preview value" value={money.format(preview.totalAmount)} />
            <Detail label="Delivery terms" value={preview.deliveryTerms} />
            <Detail label="Payment terms" value={preview.paymentTerms} />
            <Detail
              label="Reservation expires"
              value={new Date(preview.reservationExpiresAt).toLocaleString()}
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            The production contracting workflow remains fail-closed until
            server-side authorization, lifecycle transitions, and both-party
            approval are implemented.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 font-medium text-gray-900">{value}</div>
    </div>
  );
}
