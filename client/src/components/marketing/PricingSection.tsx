import React from "react";
import { Check, Star, Info } from "lucide-react";
import { useLocation } from "wouter";
import { FairUseModal } from "./FairUseModal";

type KYBState = "none" | "in_progress" | "pending_review" | "verified";
type PlanId = "market_access" | "trading_desk" | "clearing_suite";
type Billing = "annual" | "monthly";

interface UserState {
  loggedIn: boolean;
  kyb: KYBState;
  currentPlan: PlanId | "none";
  onFreemium: boolean;
}

function inferUserState(): UserState {
  const loggedIn = !!localStorage.getItem("tutela_user");
  const kyb = (localStorage.getItem("tutela_kyb_state") as KYBState) || "none";
  const currentPlan = (localStorage.getItem("tutela_plan") as PlanId) || "none";
  const onFreemium = localStorage.getItem("tutela_freemium") === "1";
  return { loggedIn, kyb, currentPlan, onFreemium };
}

type Plan = {
  id: PlanId;
  name: string;
  tag?: "popular" | "freemium";
  priceYear: number;
  monthlyMarkup: number;
  features: string[];
  feeNote: string;
};

const PLANS: Plan[] = [
  {
    id: "market_access",
    name: "Market Access",
    tag: "freemium",
    priceYear: 2400,
    monthlyMarkup: 1.20,
    features: [
      "Full KYB verification",
      "Access to qualified marketplace",
      "Request negotiations",
      "3 seats · 6 Verification Stamps / year",
      "Basic contract templates",
      "Standard support",
      "Freemium 3 months · auto-convert · fair-use caps",
    ],
    feeNote: "Platform fee: 0.18% or $1,000 min per deal (higher applies).",
  },
  {
    id: "trading_desk",
    name: "Trading Desk",
    tag: "popular",
    priceYear: 6000,
    monthlyMarkup: 1.20,
    features: [
      "Everything in Market Access",
      "Create spot & futures offers",
      "Priority document/KYB review",
      "Roles & permissions (10 seats)",
      "Operational analytics (basic)",
      "24 Verification Stamps / year",
      "12 Insights reports / year",
      "Dedicated success contact",
    ],
    feeNote: "0.14% or $1,500 min per deal (higher applies).",
  },
  {
    id: "clearing_suite",
    name: "Clearing Suite",
    priceYear: 15000,
    monthlyMarkup: 1.20,
    features: [
      "Everything in Trading Desk",
      "SSO & API access",
      "Custom workflow automation",
      "Logistics integrations",
      "Compliance toolkit",
      "24/7 premium support (SLA)",
      "60 Verification Stamps / year",
      "Unlimited seats*",
    ],
    feeNote: "0.10% or $2,500 min per deal (higher applies).",
  },
];

function formatUSD(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

type CTA =
  | { label: string; onClick: () => void; subtle?: boolean }
  | { label: string; href: string; subtle?: boolean };

type CTASet = { primary: CTA; secondary?: CTA; microcopy?: string };

function useCTAs(
  plan: Plan,
  billing: Billing,
  u: UserState,
  navigate: (path: string) => void
) {
  const goto = (path: string) => navigate(path);

  const tryDemo = () => {
    localStorage.setItem("tutela_demo", "1");
    localStorage.setItem("tutela_kyb_state", "verified");
    navigate("/offers");
  };

  // Not logged in
  if (!u.loggedIn) {
    if (plan.id === "market_access") {
      return {
        primary: { label: "Start Free (3 months)", onClick: () => window.location.href = "/api/login" },
        secondary: { label: "Try Demo", onClick: tryDemo, subtle: true },
        microcopy: "Creates an account & opens KYB (3–5 min).",
      } as CTASet;
    }
    if (plan.id === "trading_desk") {
      return {
        primary: { label: "Book 15-min Call", href: "mailto:sales@tutela.trade?subject=Trading%20Desk%20Call" },
        secondary: { label: "Start Free on Market Access", onClick: () => window.location.href = "/api/login", subtle: true },
      } as CTASet;
    }
    return {
      primary: { label: "Request Proposal", href: "mailto:sales@tutela.trade?subject=Clearing%20Suite%20Proposal" },
      secondary: { label: "Book 15-min Call", href: "mailto:sales@tutela.trade?subject=Scoping%20Call", subtle: true },
    } as CTASet;
  }

  // Logged-in, not yet verified
  if (u.kyb !== "verified") {
    return {
      primary: { label: "Continue Verification", onClick: () => goto("/verification") },
      secondary:
        plan.id === "market_access"
          ? undefined
          : plan.id === "clearing_suite"
          ? { label: "Request Proposal", href: "mailto:sales@tutela.trade?subject=Clearing%20Suite%20Proposal", subtle: true }
          : { label: "Book 15-min Call", href: "mailto:sales@tutela.trade?subject=Trading%20Desk%20Call", subtle: true },
      microcopy: "Finish KYB to activate access.",
    } as CTASet;
  }

  // Verified and already on this plan
  if (u.currentPlan === plan.id) {
    return {
      primary: { label: "Go to Dashboard", onClick: () => goto("/dashboard") },
      secondary: { label: "Change plan", onClick: () => goto("/settings?tab=billing"), subtle: true },
    } as CTASet;
  }

  // Verified — switching / buying
  if (plan.id === "market_access") {
    if (u.onFreemium) {
      return {
        primary: { label: "Upgrade now — $2,400/yr", onClick: () => goto("/checkout?plan=ma&term=annual") },
        secondary: { label: "Keep Freemium", onClick: () => goto("/dashboard"), subtle: true },
      } as CTASet;
    }
    const annualLabel = "Activate — $2,400/yr";
    const monthlyLabel = "Activate — $240/mo (+20%)";
    return {
      primary:
        billing === "annual"
          ? { label: annualLabel, onClick: () => goto("/checkout?plan=ma&term=annual") }
          : { label: monthlyLabel, onClick: () => goto("/checkout?plan=ma&term=monthly") },
      secondary: { label: "Compare plans", onClick: () => goto("/pricing#compare"), subtle: true },
    } as CTASet;
  }

  if (plan.id === "trading_desk") {
    const termParam = billing === "annual" ? "annual" : "monthly";
    return {
      primary:
        u.currentPlan === "market_access"
          ? { label: `Upgrade to Trading Desk — $${billing === "annual" ? "6,000/yr" : "600/mo (+20%)"}`, onClick: () => goto(`/checkout?plan=td&term=${termParam}`) }
          : { label: `Buy Trading Desk — $${billing === "annual" ? "6,000/yr" : "600/mo (+20%)"}`, onClick: () => goto(`/checkout?plan=td&term=${termParam}`) },
      secondary: { label: "Book 15-min Call", href: "mailto:sales@tutela.trade?subject=Trading%20Desk%20Call", subtle: true },
      microcopy: "Instant activation after payment.",
    } as CTASet;
  }

  return {
    primary: { label: "Request Proposal", href: "mailto:sales@tutela.trade?subject=Clearing%20Suite%20Proposal" },
    secondary: { label: "Schedule Scoping Call", href: "mailto:sales@tutela.trade?subject=Scoping%20Call", subtle: true },
    microcopy: "We'll confirm scope & timelines in 15 minutes.",
  } as CTASet;
}

export default function PricingSection() {
  const [, setLocation] = useLocation();
  const [billing, setBilling] = React.useState<Billing>("annual");
  const [user, setUser] = React.useState<UserState>(() => inferUserState());
  const [isFairUseModalOpen, setIsFairUseModalOpen] = React.useState(false);

  React.useEffect(() => {
    const onFocus = () => setUser(inferUserState());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const pricePerMonth = (p: Plan) =>
    billing === "annual" ? p.priceYear / 12 : (p.priceYear * p.monthlyMarkup) / 12;

  const billingLine = (p: Plan) =>
    billing === "annual"
      ? `Billed annually — ${formatUSD(p.priceYear)}/yr`
      : `Billed monthly (+20%) — ${formatUSD(Math.round((p.priceYear * p.monthlyMarkup) / 12))}/mo`;

  return (
    <section className="py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-3 flex items-center justify-end text-xs text-gray-600">
          IP Registered — UAE Ministry of Economy #1129-2024
        </div>

        <header className="text-center mb-12">
          <h2 className="text-4xl font-bold tracking-tight text-neutral-900 mb-4">Simple, transparent pricing</h2>
          <p className="text-lg text-neutral-600 font-light max-w-2xl mx-auto">
            Annual plans with a monthly option (+20%). Freemium available for Market Access.
          </p>
        </header>

        <div className="flex items-center justify-center gap-4 mb-8">
          <span className={`text-sm font-medium transition-colors ${billing === "annual" ? "text-emerald-600" : "text-neutral-500"}`}>Annual</span>
          <button
            className="relative inline-flex h-6 w-11 items-center rounded-full bg-gradient-to-r from-emerald-100 to-emerald-200 hover:from-emerald-200 hover:to-emerald-300 transition-all duration-200"
            onClick={() => setBilling((b) => (b === "annual" ? "monthly" : "annual"))}
            aria-label="Toggle billing period"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-all duration-200 ${
                billing === "annual" ? "translate-x-1" : "translate-x-5"
              }`}
            />
          </button>
          <span className={`text-sm font-medium transition-colors ${billing === "monthly" ? "text-emerald-600" : "text-neutral-500"}`}>Monthly (+20%)</span>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => {
            const perMonth = Math.round(pricePerMonth(p));
            const ctas = useCTAs(p, billing, user, setLocation);
            const highlight = p.tag === "popular";
            const isFreemium = p.tag === "freemium";

            return (
              <div
                key={p.id}
                className={`relative rounded-2xl border bg-white p-6 shadow-lg hover:shadow-xl transition-all duration-300 ${
                  highlight ? "ring-2 ring-emerald-600 shadow-emerald-100" : "hover:border-emerald-200"
                }`}
              >
                {highlight && (
                  <div className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
                    <Star size={14} fill="currentColor" /> Most Popular
                  </div>
                )}
                {isFreemium && (
                  <div className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
                    Freemium 3 months
                  </div>
                )}

                <h3 className="text-xl font-semibold text-neutral-900 mb-3">{p.name}</h3>
                <div className="mb-4">
                  <div className="text-3xl font-bold text-neutral-900">
                    {formatUSD(perMonth)}<span className="text-lg font-normal text-neutral-600">/mo</span>
                  </div>
                  <div className="text-sm text-neutral-500 font-medium">{billingLine(p)}</div>
                </div>

                <ul className="mt-5 space-y-2 text-sm">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-xs text-gray-600 flex items-start gap-1">
                  <Info className="mt-0.5 h-4 w-4" />
                  <span>{p.feeNote}</span>
                </p>

                {/* Fair-use link for Market Access */}
                {p.id === "market_access" && (
                  <div className="mt-2">
                    <button
                      onClick={() => setIsFairUseModalOpen(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 underline"
                    >
                      View Fair-Use
                    </button>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-3">
                  {"onClick" in ctas.primary ? (
                    <button
                      className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 px-4 py-3 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                      onClick={ctas.primary.onClick}
                    >
                      {ctas.primary.label}
                    </button>
                  ) : (
                    <a
                      className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 px-4 py-3 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                      href={ctas.primary.href}
                    >
                      {ctas.primary.label}
                    </a>
                  )}

                  {ctas.secondary &&
                    ("onClick" in ctas.secondary ? (
                      <button
                        className={`inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 hover:border-neutral-400 px-4 py-3 hover:bg-neutral-50 font-medium transition-all duration-200 ${
                          ctas.secondary.subtle ? "text-neutral-600" : "text-neutral-900"
                        }`}
                        onClick={ctas.secondary.onClick}
                      >
                        {ctas.secondary.label}
                      </button>
                    ) : (
                      <a
                        className={`inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 hover:border-neutral-400 px-4 py-3 hover:bg-neutral-50 font-medium transition-all duration-200 ${
                          ctas.secondary.subtle ? "text-neutral-600" : "text-neutral-900"
                        }`}
                        href={ctas.secondary.href}
                      >
                        {ctas.secondary.label}
                      </a>
                    ))}
                </div>

                {ctas.microcopy && (
                  <p className="mt-2 text-[11px] text-gray-500">{ctas.microcopy}</p>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-gray-500">
          All prices in USD. VAT may apply. Unlimited seats subject to fair-use; contact sales for &gt;200 seats.
        </p>

        {/* Fair Use Modal */}
        <FairUseModal
          isOpen={isFairUseModalOpen}
          onClose={() => setIsFairUseModalOpen(false)}
        />
      </div>
    </section>
  );
}