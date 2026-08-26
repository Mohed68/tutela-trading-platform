import React from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Clock3, Compass, PlayCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { demoApi } from "@/features/demo/api";
import { useDemoSession } from "@/features/demo/DemoContext";
import type { DemoMissionView } from "@/features/demo/types";

export default function DemoLanding() {
  const { session } = useDemoSession();
  const [, navigate] = useLocation();
  const [missions, setMissions] = React.useState<DemoMissionView[]>([]);
  React.useEffect(() => { void demoApi.listMissions().then(setMissions); }, []);
  if (!session) return null;
  const startWti = async () => {
    const mission = missions.find((item) => item.definition.offerId === "demo:offer:wti-houston") ?? missions[0];
    if (!mission) return;
    await demoApi.startMission(mission.definition.missionId);
    navigate(`/demo/organizations/demo:org:aster-gulf-energy?mission=${encodeURIComponent(mission.definition.missionId)}`);
  };
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 px-7 py-10 text-white sm:px-12 sm:py-14">
      <div className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Welcome, {session.visitor.firstName}</p><h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Welcome to the TUTELA Interactive Demo</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">A tailored simulation for {session.visitor.company}, shown from a <span className="capitalize">{session.visitor.tradeRole}</span> perspective. No real organization or trading account has been created.</p></div>
      <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Button size="lg" onClick={() => void startWti()} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"><PlayCircle className="mr-2 h-5 w-5" />Start guided trade</Button><Button size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white" asChild><Link href="/demo/marketplace"><Compass className="mr-2 h-5 w-5" />Explore marketplace</Link></Button></div>
    </section>
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
      <Card className="border-slate-200"><CardContent className="p-7 sm:p-8"><div className="flex items-center gap-3 text-emerald-700"><ShieldCheck className="h-6 w-6" /><span className="font-semibold">Featured guided scenario</span></div><h2 className="mt-4 text-2xl font-semibold">Experience a complete TUTELA trade</h2><p className="mt-3 leading-7 text-slate-600">Follow a simulated transaction from organization trust and offer evidence through order acceptance and a non-binding contract.</p><div className="mt-6 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" />Estimated time: ~5–7 minutes</div><Button variant="link" className="mt-4 px-0 text-emerald-700" onClick={() => void startWti()}>Begin with WTI Crude Oil <ArrowRight className="ml-2 h-4 w-4" /></Button></CardContent></Card>
      <Card><CardContent className="p-7"><p className="text-sm font-medium text-slate-500">Demo workspace</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-slate-500">Qualified visitor</dt><dd className="font-semibold">{session.visitor.firstName} {session.visitor.lastName}</dd></div><div><dt className="text-slate-500">Company context</dt><dd className="font-semibold">{session.visitor.company}</dd></div><div><dt className="text-slate-500">Session expires</dt><dd className="font-semibold">{new Date(session.expiresAt).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</dd></div></dl></CardContent></Card>
    </div>
  </div>;
}
