import React from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { demoApi } from "@/features/demo/api";
import { GuidedProgress } from "@/features/demo/GuidedProgress";
import { formatUnit } from "@/features/demo/presentation";
import type { DemoMissionView, DemoOffer, DemoOrder } from "@/features/demo/types";

export default function DemoOrderPage() {
  const [,params]=useRoute("/demo/orders/:orderId"); const [,navigate]=useLocation(); const missionId=new URLSearchParams(window.location.search).get("mission");
  const [order,setOrder]=React.useState<DemoOrder|null>(null); const [offer,setOffer]=React.useState<DemoOffer|null>(null); const [mission,setMission]=React.useState<DemoMissionView|null>(null); const [busy,setBusy]=React.useState(false);
  const refresh=React.useCallback(async()=>{if(!params?.orderId)return;const current=await demoApi.getOrder(params.orderId);setOrder(current);setOffer(await demoApi.getOffer(current.offerId));if(missionId)setMission(await demoApi.getMission(missionId));},[params?.orderId,missionId]);
  React.useEffect(()=>{void refresh();},[refresh]);
  if(!order||!offer)return <div className="p-12 text-center text-slate-500">Loading simulated order…</div>;
  const accept=async()=>{setBusy(true);await demoApi.acceptOrder(order.orderId);await refresh();setBusy(false);};
  const contract=async()=>{setBusy(true);const value=await demoApi.createContract(order.orderId);navigate(`/demo/contracts/${encodeURIComponent(value.contractId)}?mission=${encodeURIComponent(order.scenarioId)}`);};
  return <div className="mx-auto grid max-w-6xl gap-7 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_330px]"><div><p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Simulated order</p><div className="mt-4 flex items-center justify-between"><h1 className="text-3xl font-semibold">Order review</h1><Badge className={order.status==="accepted"?"bg-emerald-100 text-emerald-800 hover:bg-emerald-100":"bg-amber-100 text-amber-800 hover:bg-amber-100"}>{order.status}</Badge></div><Card className="mt-6"><CardContent className="p-7"><h2 className="text-xl font-semibold">{offer.commodity}</h2><p className="mt-1 text-sm text-slate-500">Reference {order.orderId}</p><div className="mt-6 grid gap-5 border-y border-slate-100 py-5 sm:grid-cols-3"><div><p className="text-sm text-slate-500">Quantity</p><p className="font-semibold">{Number(order.quantity).toLocaleString()} {formatUnit(order.unit)}</p></div><div><p className="text-sm text-slate-500">Unit price</p><p className="font-semibold">{order.currency} {Number(order.pricePerUnit).toLocaleString()}</p></div><div><p className="text-sm text-slate-500">Terms</p><p className="font-semibold">{offer.incoterm}</p></div></div><p className="mt-5 text-sm text-slate-600">{offer.paymentTerms}</p></CardContent></Card>
    {order.status==="submitted"?<Card className="mt-6 border-blue-200 bg-blue-50/50"><CardContent className="p-6"><Clock3 className="h-6 w-6 text-blue-700"/><h2 className="mt-3 text-xl font-semibold">Awaiting counterparty response</h2><p className="mt-2 text-sm text-slate-600">No real seller receives this order. Continue to simulate the deterministic counterparty response.</p><Button className="mt-5" disabled={busy} onClick={()=>void accept()}>{busy?"Simulating response…":"Simulate seller acceptance"}</Button></CardContent></Card>:<Card className="mt-6 border-emerald-200 bg-emerald-50/50"><CardContent className="p-6"><CheckCircle2 className="h-7 w-7 text-emerald-700"/><h2 className="mt-3 text-xl font-semibold">Counterparty response simulated</h2><p className="mt-2 text-sm text-slate-600">The order is accepted inside this isolated simulation. It creates no commercial obligation.</p><Button className="mt-5" disabled={busy} onClick={()=>void contract()}>Generate non-binding contract <ArrowRight className="ml-2 h-4 w-4"/></Button></CardContent></Card>}</div><div>{mission&&<GuidedProgress mission={mission} onExit={()=>navigate("/demo/marketplace")}/>}</div></div>;
}
