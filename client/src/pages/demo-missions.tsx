import React from "react";
import { useLocation } from "wouter";
import { ArrowRight, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { demoApi } from "@/features/demo/api";
import { demoRoutes } from "@/features/demo/routes";
import type { DemoMissionView } from "@/features/demo/types";

export default function DemoMissions() {
  const [, navigate] = useLocation();
  const [missions, setMissions] = React.useState<DemoMissionView[]>([]);
  React.useEffect(() => { void demoApi.listMissions().then(setMissions); }, []);
  const start = async (mission: DemoMissionView) => { await demoApi.startMission(mission.definition.missionId); const offer = await demoApi.getOffer(mission.definition.offerId).catch(() => null); if (offer) navigate(demoRoutes.organization(offer.organizationId, mission.definition.missionId)); };
  return <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6"><p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Guided scenarios</p><h1 className="mt-2 text-4xl font-semibold">Choose your trade journey</h1><p className="mt-3 text-slate-600">Every step is driven by the isolated server simulation, never by browser-local authority.</p><div className="mt-8 grid gap-6 md:grid-cols-3">{missions.map((mission) => <Card key={mission.definition.missionId} className="overflow-hidden"><div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500" /><CardContent className="p-6"><Badge variant="outline">Guided Scenario</Badge><h2 className="mt-4 text-xl font-semibold">{mission.definition.title}</h2><p className="mt-3 min-h-20 text-sm leading-6 text-slate-600">{mission.definition.purpose}</p><p className="mt-5 flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4" />~{mission.definition.estimatedMinutes} minutes</p><Button className="mt-5 w-full" onClick={() => void start(mission)}>{mission.progress ? "Continue scenario" : "Start scenario"}<ArrowRight className="ml-2 h-4 w-4" /></Button></CardContent></Card>)}</div></div>;
}
