import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  FileCheck2,
  Globe2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TutelaLogo from "@/components/common/TutelaLogo";
import { ROUTES } from "@/config/routes";

const trustSignals = ["Verified counterparties", "AI document review", "Deal workflow visibility"];

const metrics = [
  { label: "Verified offers", value: "15+" },
  { label: "Target GCC flow", value: "40%" },
  { label: "MVP focus", value: "Urea 46" },
];

const features = [
  {
    icon: ShieldCheck,
    title: "Counterparty confidence",
    description: "Structure buyer and seller onboarding around KYB, trade documents, and verification signals before serious negotiation starts.",
  },
  {
    icon: FileCheck2,
    title: "Document intelligence",
    description: "Use AI-assisted review to flag missing, inconsistent, or risky documents across offers, contracts, and verification workflows.",
  },
  {
    icon: Workflow,
    title: "Deal operating layer",
    description: "Move from offer discovery to negotiation, documents, approvals, and contract status inside one controlled workspace.",
  },
];

const steps = [
  "Create or discover a verified commodity offer",
  "Review counterparty and transaction documents",
  "Move the deal toward contract, escrow, LC, or external settlement",
];

export default function Landing() {
  const navigate = useNavigate();

  const goToPlatform = () => {
    navigate(ROUTES.dashboard);
  };

  const goToMarketplace = () => {
    navigate(ROUTES.marketplace);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -left-32 top-[-120px] h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute right-[-160px] top-24 h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-[-180px] left-1/3 h-[30rem] w-[30rem] rounded-full bg-blue-600/20 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-slate-950/60 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <div className="rounded-2xl bg-white px-3 py-2 shadow-lg shadow-emerald-950/30">
            <TutelaLogo size="md" showText />
          </div>
          <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#workflow" className="hover:text-white">Workflow</a>
            <a href="#trust" className="hover:text-white">Trust Layer</a>
          </div>
          <Button onClick={goToPlatform} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
            Enter Platform
          </Button>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
              <Sparkles className="h-4 w-4" />
              AI-enabled marketplace for physical commodity deals
            </div>

            <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl">
              Trade real commodities with a smarter layer of trust.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
              TUTELA helps commodity buyers, sellers, and intermediaries move from scattered offers and uncertain documents into a structured, verified, and deal-ready workflow.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button onClick={goToPlatform} size="lg" className="group bg-emerald-500 px-7 text-base font-bold text-slate-950 hover:bg-emerald-400">
                Open Dashboard
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button onClick={goToMarketplace} size="lg" variant="outline" className="border-white/20 bg-white/5 px-7 text-base font-bold text-white hover:bg-white/10 hover:text-white">
                View Marketplace
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {trustSignals.map((signal) => (
                <div key={signal} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                  <BadgeCheck className="h-4 w-4 text-emerald-300" />
                  {signal}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-emerald-400/30 via-cyan-400/10 to-blue-600/30 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Live Deal Layer</p>
                  <p className="mt-1 font-semibold text-white">Urea 46 transaction workspace</p>
                </div>
                <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">Verified</div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Offer Status</p>
                      <p className="mt-1 text-2xl font-black">Ready for review</p>
                    </div>
                    <ShieldCheck className="h-10 w-10 text-emerald-300" />
                  </div>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                      <p className="text-2xl font-black text-white">{metric.value}</p>
                      <p className="mt-1 text-xs text-slate-400">{metric.label}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <BarChart3 className="h-4 w-4 text-cyan-300" />
                    Risk & readiness signals
                  </div>
                  <div className="space-y-3">
                    {["KYB documents received", "Commercial terms visible", "Settlement method pending"].map((item, index) => (
                      <div key={item} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{item}</span>
                        <span className={index < 2 ? "text-emerald-300" : "text-amber-300"}>{index < 2 ? "Clear" : "Next"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="mb-10 max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-300">What matters</p>
            <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">Built around the real blockers in commodity trading.</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="group rounded-3xl border border-white/10 bg-white/[0.06] p-6 transition hover:-translate-y-1 hover:bg-white/[0.09]">
                  <div className="mb-5 inline-flex rounded-2xl bg-emerald-400/10 p-3 text-emerald-300 ring-1 ring-emerald-400/20">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                  <p className="mt-3 leading-7 text-slate-300">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 md:p-10">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <div className="mb-4 inline-flex rounded-2xl bg-cyan-400/10 p-3 text-cyan-300 ring-1 ring-cyan-400/20">
                  <Globe2 className="h-6 w-6" />
                </div>
                <h2 className="text-3xl font-black text-white md:text-4xl">A cleaner path from market access to deal execution.</h2>
                <p className="mt-4 leading-7 text-slate-300">
                  TUTELA is not only a listing board. It is a practical operating layer for trade preparation, verification, and controlled deal progression.
                </p>
              </div>

              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={step} className="flex gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-sm font-black text-slate-950">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{step}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        Each step reduces uncertainty and makes the next commercial decision easier to defend.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="trust" className="mx-auto max-w-7xl px-5 py-16 pb-24 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-emerald-400 p-7 text-slate-950 md:col-span-2">
              <h2 className="text-3xl font-black md:text-4xl">Ready to test the operating layer?</h2>
              <p className="mt-3 max-w-2xl text-slate-900/80">
                Enter the dashboard, inspect current marketplace data, and use the MVP to validate the next build priorities before production deployment.
              </p>
              <Button onClick={goToPlatform} size="lg" className="mt-6 bg-slate-950 text-white hover:bg-slate-800">
                Continue to Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-7">
              <LockKeyhole className="h-8 w-8 text-emerald-300" />
              <h3 className="mt-5 text-xl font-bold text-white">Controlled access first</h3>
              <p className="mt-3 leading-7 text-slate-300">
                Designed for high-trust trade flows where counterparty quality matters more than open marketplace noise.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
