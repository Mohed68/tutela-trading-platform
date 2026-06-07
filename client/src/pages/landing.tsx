import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  Eye,
  Factory,
  FileCheck2,
  FileSignature,
  Fuel,
  Gem,
  Globe2,
  Handshake,
  Landmark,
  LockKeyhole,
  Search,
  ShieldCheck,
  Ship,
  Truck,
  Users,
  Wheat,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TutelaLogo from "@/components/common/TutelaLogo";
import { ROUTES } from "@/config/routes";

const categories = [
  { label: "Energy & Petroleum", icon: Fuel, examples: "EN590, Jet A1, fuel oils" },
  { label: "Agricultural Commodities", icon: Wheat, examples: "Wheat, sugar, rice, grains" },
  { label: "Industrial Minerals", icon: Factory, examples: "Copper, aluminum, iron ore" },
  { label: "Precious Metals & Gold", icon: Gem, examples: "Gold dore, bullion, silver" },
];

const marketplaceMetrics = [
  { label: "Marketplace Value", value: "$113M+", note: "Visible pipeline" },
  { label: "Active Offers", value: "15+", note: "Across core commodities" },
  { label: "Verified Traders", value: "9+", note: "Early network" },
  { label: "GCC Focus", value: "40%", note: "Target trade flow" },
];

const previewOffers = [
  {
    commodity: "Urea 46%",
    volume: "50,000 MT",
    origin: "UAE",
    status: "AI checked",
    counterparty: "Gulf Fertilizers Trading LLC",
  },
  {
    commodity: "EN590 10ppm",
    volume: "100,000 MT",
    origin: "Saudi Arabia",
    status: "KYB verified",
    counterparty: "Eastern Energy Supply Co.",
  },
  {
    commodity: "Copper Cathodes",
    volume: "5,000 MT",
    origin: "DRC",
    status: "Docs pending",
    counterparty: "Central Africa Metals Ltd.",
  },
  {
    commodity: "Gold Dore",
    volume: "250 KG",
    origin: "Ghana",
    status: "Restricted",
    counterparty: "Accra Precious Metals Export",
  },
];

const workflow = [
  {
    title: "Corporate Registration",
    description: "Companies register using official business identity and access a controlled non-verified marketplace preview.",
    icon: Building2,
  },
  {
    title: "KYB & KYC Verification",
    description: "Bank-style company and representative verification unlocks real market visibility and counterparty details.",
    icon: ShieldCheck,
  },
  {
    title: "Offer & Counterparty Validation",
    description: "AI checks documents and offer data, while external verification providers can validate critical records through APIs.",
    icon: FileCheck2,
  },
  {
    title: "Trading & Negotiation",
    description: "Verified parties move into secure negotiation with structured deal terms, risk visibility, and transaction context.",
    icon: Handshake,
  },
  {
    title: "Contracts & Shipment Tracking",
    description: "Generate contracts, follow approval status, and track logistics milestones from execution to delivery.",
    icon: Truck,
  },
];

const trustLayer = [
  "AI document validation",
  "KYB / KYC verification",
  "Compliance screening",
  "Counterparty risk flags",
  "Smart contract readiness",
  "Escrow / LC / CAD support",
];

const ecosystem = [
  { label: "Inspection", icon: Eye },
  { label: "Logistics", icon: Ship },
  { label: "Escrow", icon: LockKeyhole },
  { label: "Finance", icon: Landmark },
  { label: "Verification", icon: BadgeCheck },
];

const plans = [
  {
    name: "Explorer",
    description: "For companies evaluating market access.",
    features: ["Marketplace preview", "Commodity categories", "Limited offer visibility", "Demo access"],
  },
  {
    name: "Trader",
    description: "For verified companies ready to negotiate.",
    features: ["Full marketplace access", "Counterparty visibility", "Verified offer details", "Negotiation workspace"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    description: "For larger trading teams and institutions.",
    features: ["Multi-user workflows", "Custom verification rules", "API integrations", "Dedicated onboarding"],
  },
];

export default function Landing() {
  const navigate = useNavigate();

  const goToPlatform = () => navigate(ROUTES.dashboard);
  const goToMarketplace = () => navigate(ROUTES.marketplace);

  return (
    <div className="min-h-screen overflow-hidden bg-[#050915] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,1))]" />
        <div className="absolute left-0 top-0 h-full w-full bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <div className="rounded-2xl bg-white px-3 py-2 shadow-lg shadow-black/30">
            <TutelaLogo size="md" showText />
          </div>
          <div className="hidden items-center gap-7 text-sm font-medium text-slate-300 lg:flex">
            <a href="#marketplace" className="hover:text-white">Marketplace</a>
            <a href="#workflow" className="hover:text-white">How it works</a>
            <a href="#trust" className="hover:text-white">Verification</a>
            <a href="#plans" className="hover:text-white">Subscriptions</a>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={goToMarketplace} variant="outline" className="hidden border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white sm:inline-flex">
              Explore Demo
            </Button>
            <Button onClick={goToPlatform} className="bg-emerald-400 font-bold text-slate-950 hover:bg-emerald-300">
              Enter Platform
            </Button>
          </div>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1fr_0.96fr] lg:px-8 lg:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">
              <Globe2 className="h-4 w-4" />
              Verified Commodity Trading Infrastructure
            </div>

            <h1 className="max-w-5xl text-5xl font-black tracking-tight text-white md:text-7xl">
              Access verified commodity opportunities and trade with confidence.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
              Verified companies. Verified offers. Verified documents. One secure workspace for physical commodity discovery, negotiation, contracting, and execution.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <div key={category.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur transition hover:border-emerald-300/40 hover:bg-white/[0.09]">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-emerald-300/10 p-2 text-emerald-300">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-white">{category.label}</p>
                        <p className="mt-1 text-sm text-slate-400">{category.examples}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button onClick={goToMarketplace} size="lg" className="group bg-emerald-400 px-7 text-base font-black text-slate-950 hover:bg-emerald-300">
                Explore Marketplace Preview
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button onClick={goToPlatform} size="lg" variant="outline" className="border-white/20 bg-white/5 px-7 text-base font-bold text-white hover:bg-white/10 hover:text-white">
                Book / Open Demo
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-emerald-400/25 via-cyan-400/10 to-amber-300/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-black/50 backdrop-blur-xl">
              <div className="mb-5 rounded-3xl border border-white/10 bg-slate-950/70 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-300">Live Marketplace Snapshot</p>
                    <h2 className="mt-2 text-2xl font-black text-white">Commodity deal flow preview</h2>
                  </div>
                  <BarChart3 className="h-9 w-9 text-cyan-300" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {marketplaceMetrics.map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-2xl font-black text-white">{metric.value}</p>
                      <p className="mt-1 text-sm font-medium text-slate-300">{metric.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{metric.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-bold text-white">Restricted preview</p>
                  <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-bold text-amber-200">Non-verified view</span>
                </div>
                <div className="space-y-3">
                  {previewOffers.slice(0, 3).map((offer) => (
                    <div key={offer.commodity} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-white">{offer.commodity}</p>
                          <p className="mt-1 text-sm text-slate-400">{offer.volume} • Origin: {offer.origin}</p>
                        </div>
                        <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">{offer.status}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-sm">
                        <span className="text-slate-400">Counterparty</span>
                        <span className="select-none rounded-md bg-slate-200/15 px-2 py-1 text-slate-300 blur-[3px]">{offer.counterparty}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-sm">
                        <span className="text-slate-400">Price</span>
                        <span className="font-bold text-slate-500">Available after verification</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="marketplace" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">Marketplace Preview</p>
              <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">See the opportunity. Unlock the counterparty.</h2>
              <p className="mt-4 text-lg leading-8 text-slate-300">
                Non-verified companies can view commodity type, volume, origin, and status. Company identity, pricing, documents, and contact channels stay restricted until KYB/KYC is complete.
              </p>
            </div>
            <Button onClick={goToPlatform} className="bg-white text-slate-950 hover:bg-slate-200">
              Complete Verification
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/30">
            <div className="grid grid-cols-5 border-b border-white/10 bg-white/[0.04] px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              <div>Commodity</div>
              <div>Volume</div>
              <div>Origin</div>
              <div>Status</div>
              <div>Counterparty / Price</div>
            </div>
            {previewOffers.map((offer) => (
              <div key={offer.commodity} className="grid grid-cols-5 items-center border-b border-white/10 px-5 py-5 text-sm last:border-b-0">
                <div className="font-black text-white">{offer.commodity}</div>
                <div className="text-slate-300">{offer.volume}</div>
                <div className="text-slate-300">{offer.origin}</div>
                <div>
                  <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">{offer.status}</span>
                </div>
                <div>
                  <div className="w-fit select-none rounded-md bg-slate-300/15 px-2 py-1 text-slate-300 blur-[3px]">{offer.counterparty}</div>
                  <p className="mt-1 text-xs text-amber-200">Price hidden until verified</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="mb-10 max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">How TUTELA Works</p>
            <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">From company registration to shipment execution.</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-5">
            {workflow.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 transition hover:-translate-y-1 hover:bg-white/[0.09]">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-300 text-slate-950">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-black text-slate-500">0{index + 1}</span>
                  </div>
                  <h3 className="text-lg font-black text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{step.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="trust" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-white/10 bg-emerald-300 p-8 text-slate-950">
              <ShieldCheck className="h-10 w-10" />
              <h2 className="mt-6 text-3xl font-black md:text-5xl">Trust is the product.</h2>
              <p className="mt-4 text-lg leading-8 text-slate-900/80">
                TUTELA is designed around controlled visibility, verified access, offer validation, and structured transaction execution — not open marketplace noise.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {trustLayer.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  <span className="font-semibold text-slate-200">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8">
            <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">Partner Ecosystem</p>
                <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">Built to connect with the trade infrastructure around the deal.</h2>
              </div>
              <p className="max-w-xl text-slate-300">Inspection, logistics, escrow, verification, and financial partners can extend the platform into a full transaction operating layer.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {ecosystem.map((partner) => {
                const Icon = partner.icon;
                return (
                  <div key={partner.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 text-center">
                    <Icon className="mx-auto h-7 w-7 text-cyan-300" />
                    <p className="mt-4 font-bold text-white">{partner.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-cyan-400/15 to-emerald-400/10 p-8">
              <Search className="h-10 w-10 text-cyan-300" />
              <h2 className="mt-6 text-3xl font-black text-white md:text-5xl">Explore a live demo marketplace.</h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                Test the MVP using controlled demo data, inspect marketplace flow, and validate what verified users would unlock after corporate verification.
              </p>
              <Button onClick={goToMarketplace} size="lg" className="mt-7 bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200">
                Explore Live Demo Marketplace
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div id="plans" className="grid gap-4">
              {plans.map((plan) => (
                <div key={plan.name} className={`rounded-3xl border p-5 ${plan.highlighted ? "border-emerald-300/50 bg-emerald-300/10" : "border-white/10 bg-white/[0.06]"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black text-white">{plan.name}</h3>
                      <p className="mt-1 text-sm text-slate-400">{plan.description}</p>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">Contact Sales</span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 pb-24 lg:px-8">
          <div className="rounded-[2rem] border border-white/10 bg-white p-8 text-slate-950 md:p-12">
            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">Final step</p>
                <h2 className="mt-3 text-3xl font-black md:text-5xl">Join the verified commodity trading network.</h2>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                  Start with marketplace preview, complete corporate verification, then unlock verified opportunities, counterparties, and transaction workflows.
                </p>
              </div>
              <Button onClick={goToPlatform} size="lg" className="bg-slate-950 px-8 font-black text-white hover:bg-slate-800">
                Start Verification
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
