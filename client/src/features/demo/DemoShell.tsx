import React from "react";
import { Link, useLocation } from "wouter";
import { Building2, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DemoSessionProvider, useDemoSession } from "./DemoContext";
import { demoApi } from "./api";

function Shell({ children }: { children: React.ReactNode }) {
  const { session, loading, expired, reset } = useDemoSession();
  const [, navigate] = useLocation();
  const [menu, setMenu] = React.useState(false);

  if (loading) return <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-600">Preparing your interactive demo…</div>;
  if (expired) return (
    <div className="min-h-screen grid place-items-center bg-slate-950 px-4">
      <div className="max-w-lg rounded-2xl bg-white p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-semibold text-slate-950">Your interactive demo session has expired.</h1>
        <p className="mt-3 text-slate-600">Request a new secure demo link to start another simulation. You will not be signed into the production platform.</p>
        <Button className="mt-6" onClick={() => void demoApi.createSession().then(() => window.location.assign("/demo")).catch(() => navigate("/demo/request"))}>Start a new demo session</Button>
      </div>
    </div>
  );
  if (!session) return null;

  const resetDemo = async () => {
    if (!window.confirm("Reset simulation? This removes current simulated orders, contracts, and guided progress.")) return;
    await reset();
    navigate("/demo");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-semibold tracking-wide text-amber-950">
        INTERACTIVE DEMO <span className="mx-2 text-amber-400">•</span> SIMULATION — NON-BINDING
      </div>
      <header className="sticky top-8 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/demo" className="flex items-center gap-3">
            <img src="/tutela-logo.png" alt="TUTELA" className="h-8 w-8 object-contain" />
            <span className="font-bold tracking-tight">TUTELA</span>
            <Badge variant="outline" className="hidden sm:inline-flex">Interactive Demo</Badge>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/demo/marketplace" className="text-sm text-slate-600 hover:text-slate-950">Marketplace</Link>
            <Link href="/demo/missions" className="text-sm text-slate-600 hover:text-slate-950">Guided trades</Link>
          </nav>
          <div className="relative">
            <button onClick={() => setMenu(!menu)} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-left hover:bg-slate-50">
              <div className="hidden sm:block">
                <p className="text-sm font-semibold leading-tight">{session.visitor.firstName} {session.visitor.lastName}</p>
                <p className="max-w-40 truncate text-xs text-slate-500">{session.visitor.company}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            {menu && <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
              <div className="flex gap-3 border-b border-slate-100 pb-3">
                <Building2 className="mt-1 h-5 w-5 text-emerald-600" />
                <div><p className="font-medium">{session.visitor.company}</p><p className="text-xs capitalize text-slate-500">Trade role: {session.visitor.tradeRole}</p></div>
              </div>
              <button onClick={() => void resetDemo()} className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"><RotateCcw className="h-4 w-4" />Reset simulation</button>
            </div>}
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

export function DemoShell({ children }: { children: React.ReactNode }) {
  return <DemoSessionProvider><Shell>{children}</Shell></DemoSessionProvider>;
}
