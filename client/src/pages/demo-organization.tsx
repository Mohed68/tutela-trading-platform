import React from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowRight, Building2, CheckCircle2, Globe2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { demoApi } from "@/features/demo/api";
import { demoRoutes } from "@/features/demo/routes";
import { GuidedProgress } from "@/features/demo/GuidedProgress";
import type { DemoMissionView, DemoOrganization } from "@/features/demo/types";

export default function DemoOrganizationPage() {
  const [,params] = useRoute("/demo/organizations/:organizationId"); const [,navigate] = useLocation();
  const [organization,setOrganization] = React.useState<DemoOrganization|null>(null); const [mission,setMission] = React.useState<DemoMissionView|null>(null);
  const missionId = new URLSearchParams(window.location.search).get("mission");
  React.useEffect(() => { if (!params?.organizationId) return; void demoApi.getOrganization(params.organizationId).then(setOrganization); if (missionId) void demoApi.getMission(missionId).then(setMission); }, [params?.organizationId, missionId]);
  if (!organization) return <div className="p-12 text-center text-slate-500">Loading organization…</div>;
  const continueFlow = async () => { if (!mission) return navigate("/demo/marketplace"); const refreshed=await demoApi.getMission(mission.definition.missionId); setMission(refreshed); navigate(demoRoutes.offer(refreshed.definition.offerId, refreshed.definition.missionId)); };
  return <div className="mx-auto grid max-w-7xl gap-7 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_330px]">
    <div><Link href="/demo/marketplace" className="text-sm text-emerald-700">← Marketplace</Link><div className="mt-5 rounded-3xl bg-slate-950 p-8 text-white sm:p-10"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15"><Building2 className="h-7 w-7 text-emerald-300" /></div><div><Badge className="bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/15">Synthetic counterparty</Badge><h1 className="mt-2 text-3xl font-semibold">{organization.legalName}</h1></div></div><p className="mt-6 max-w-2xl text-slate-300">A simulation-safe commercial profile demonstrating why this counterparty appears trade-ready inside the interactive experience.</p></div>
    <div className="mt-7 grid gap-5 sm:grid-cols-2"><Card><CardContent className="p-6"><Globe2 className="h-5 w-5 text-emerald-700" /><h2 className="mt-4 font-semibold">Commercial profile</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-slate-500">Sector</dt><dd className="font-medium">{organization.sector}</dd></div><div><dt className="text-slate-500">Jurisdiction</dt><dd className="font-medium">{organization.jurisdiction}</dd></div><div><dt className="text-slate-500">Headquarters</dt><dd className="font-medium">{organization.headquarters}</dd></div><div><dt className="text-slate-500">Market role</dt><dd className="font-medium capitalize">{organization.role.replace("_"," & ")}</dd></div></dl></CardContent></Card><Card><CardContent className="p-6"><ShieldCheck className="h-5 w-5 text-emerald-700" /><h2 className="mt-4 font-semibold">Trade readiness</h2><div className="mt-4 space-y-3">{[["Organization Verification","Verified"],["Trust","Established"],["Trading Eligibility","Eligible"]].map(([label,value]) => <div key={label} className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm"><span>{label}</span><span className="flex items-center gap-1 font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{value}</span></div>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">These states belong only to this synthetic scenario and do not represent production authority.</p></CardContent></Card></div>
    {mission && <Button className="mt-7" onClick={() => void continueFlow()}>Continue to offer <ArrowRight className="ml-2 h-4 w-4" /></Button>}</div>
    <div>{mission && <GuidedProgress mission={mission} onExit={() => navigate("/demo/marketplace")} />}</div>
  </div>;
}
