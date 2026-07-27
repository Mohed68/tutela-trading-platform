import React from "react";
import { useLocation } from "wouter";
import { Check } from "lucide-react";

type PlanId = "ma" | "td" | "cs"; // ma=Market Access, td=Trading Desk, cs=Clearing Suite
type Term = "annual" | "monthly";

const PLAN_COPY: Record<PlanId, { name: string; year: number; monthlyMarkup: number; feeNote: string }> = {
  ma: { name: "Market Access", year: 2400, monthlyMarkup: 1.20, feeNote: "Platform fee: 0.18% or $1,000 min per deal (higher applies)." },
  td: { name: "Trading Desk", year: 6000, monthlyMarkup: 1.20, feeNote: "0.14% or $1,500 min per deal (higher applies)." },
  cs: { name: "Clearing Suite", year: 15000, monthlyMarkup: 1.20, feeNote: "0.10% or $2,500 min per deal (higher applies)." },
};

function fmt(n: number) { 
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function getSearchParam(url: string, param: string): string | null {
  const urlObj = new URL(url, window.location.origin);
  return urlObj.searchParams.get(param);
}

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  
  // Parse URL parameters manually since wouter doesn't have useSearchParams
  const currentUrl = window.location.href;
  const plan = (getSearchParam(currentUrl, "plan") as PlanId) || "ma";
  const term = (getSearchParam(currentUrl, "term") as Term) || "annual";
  
  const info = PLAN_COPY[plan];
  const priceMonthly = Math.round((info.year * info.monthlyMarkup) / 12);
  const dueToday = term === "annual" ? info.year : priceMonthly;

  const [accepted, setAccepted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const payAndActivate = async () => {
    if (!accepted || loading) return;
    setLoading(true);
    
    try {
      const response = await fetch("/api/checkout/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, term }),
      });
      
      const data = await response.json();
      
      if (data?.url) {
        // Redirect to Stripe-hosted checkout
        window.location.href = data.url;
        return;
      }
      
      throw new Error(data?.error || "No session URL returned");
    } catch (error) {
      setLoading(false);
      console.error("Payment initialization failed:", error);
      alert(`Payment initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please check server configuration.`);
    }
  };

  const planFeatures = {
    ma: [
      "Full KYB, verified market access",
      "3 seats · 6 Verification Stamps / year",
      "Basic contract templates",
      "Standard support"
    ],
    td: [
      "Everything in Market Access",
      "Create spot & futures offers · Priority review",
      "Roles & permissions (10 seats) · 24 Stamps / year",
      "Operational analytics & 12 Insights reports / year"
    ],
    cs: [
      "Everything in Trading Desk",
      "SSO & API · Custom workflows · Logistics integrations",
      "24/7 premium support (SLA) · 60 Stamps / year",
      "Unlimited seats with fair-use policy"
    ]
  };

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <button 
          onClick={() => setLocation("/pricing")} 
          className="text-sm text-gray-600 hover:underline"
        >
          ← Back to Pricing
        </button>
        
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Checkout</h1>
        <p className="text-gray-600">Review your plan and complete activation.</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Order summary */}
          <section className="lg:col-span-2 rounded-2xl border bg-white p-6">
            <h2 className="text-lg font-semibold">Order Summary</h2>
            
            <div className="mt-4 flex items-start justify-between">
              <div>
                <div className="font-medium text-lg">{info.name}</div>
                <div className="text-sm text-gray-600">
                  {term === "annual"
                    ? `Billed annually — ${fmt(info.year)}/yr`
                    : `Billed monthly (+20%) — ${fmt(priceMonthly)}/mo`}
                </div>
                <div className="mt-2 text-xs text-gray-500">{info.feeNote}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{fmt(dueToday)}</div>
                <div className="text-xs text-gray-500">Due today</div>
              </div>
            </div>

            {term === "monthly" && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-800">
                  Monthly plan carries a +20% premium vs annual equivalent to account for flexibility.
                </p>
              </div>
            )}

            <div className="mt-6 rounded-xl bg-neutral-50 p-4">
              <h3 className="text-sm font-semibold">What you'll get</h3>
              <ul className="mt-2 space-y-1">
                {planFeatures[plan].map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="mt-0.5 h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <label className="mt-6 flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input 
                type="checkbox" 
                className="mt-1" 
                checked={accepted} 
                onChange={(e) => setAccepted(e.target.checked)} 
              />
              <span>I agree to the Terms, fair-use policy, and platform fees on executed deals.</span>
            </label>

            <div className="mt-6 flex flex-col gap-3">
              <button
                className={`inline-flex items-center justify-center rounded-lg px-6 py-3 text-white font-semibold text-lg shadow-lg transition-all duration-200 ${
                  accepted && !loading 
                    ? "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 hover:shadow-xl" 
                    : "bg-emerald-300 cursor-not-allowed"
                }`}
                disabled={!accepted || loading}
                onClick={payAndActivate}
              >
                {loading ? "Activating…" : "Pay & Activate"}
              </button>
              <span className="text-xs text-neutral-500 text-center">🔒 Powered by Stripe</span>
            </div>
          </section>

          {/* Price box */}
          <aside className="rounded-2xl border bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Total</h3>
            <div className="mt-2 text-3xl font-bold">{fmt(dueToday)}</div>
            <div className="text-xs text-gray-500">Due today</div>
            
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="text-xs text-gray-500 space-y-1">
                <div>All prices in USD</div>
                <div>VAT may apply</div>
                <div>Instant activation</div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-emerald-50 rounded-lg">
              <div className="text-xs text-emerald-700">
                ✓ 30-day money-back guarantee
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}