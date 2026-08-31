import React from "react";
import { Link } from "wouter";
import { ArrowRight, MapPin, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { demoApi } from "@/features/demo/api";
import { filterDemoOffers, formatUnit, HERO_OFFER_IDS } from "@/features/demo/presentation";
import { demoRoutes } from "@/features/demo/routes";
import type { DemoOffer } from "@/features/demo/types";

export default function DemoMarketplace() {
  const [offers, setOffers] = React.useState<DemoOffer[]>([]);
  const [filters, setFilters] = React.useState({ search:"", category:"", side:"", location:"" });
  React.useEffect(() => { void demoApi.listOffers().then(setOffers); }, []);
  const visible = filterDemoOffers(offers, filters);
  const update = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]:value }));
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Simulated marketplace</p><h1 className="mt-2 text-4xl font-semibold">15 Active Opportunities</h1><p className="mt-3 text-slate-600">Explore credible commodity opportunities across energy, chemicals, metals, and agriculture.</p></div><Button variant="outline" asChild><Link href="/demo/missions">View guided scenarios <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
    <div className="mt-8 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1.5fr_1fr_1fr_1fr]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input aria-label="Search opportunities" placeholder="Commodity or location" value={filters.search} onChange={(e) => update("search",e.target.value)} className="pl-9" /></div>{[["category","All categories",["energy","chemicals","metals","agriculture"]],["side","Buy & Sell",["buy","sell"]]] .map(([key,label,values]) => <select key={key as string} aria-label={label as string} value={filters[key as "category"|"side"]} onChange={(e) => update(key as "category"|"side",e.target.value)} className="h-10 rounded-md border border-input bg-white px-3 text-sm"><option value="">{label as string}</option>{(values as string[]).map((value) => <option key={value} value={value} className="capitalize">{value}</option>)}</select>)}<Input aria-label="Filter by location" placeholder="Location" value={filters.location} onChange={(e) => update("location",e.target.value)} /></div>
    <p className="mt-5 text-sm text-slate-500">Showing {visible.length} of {offers.length || 15} opportunities</p>
    <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map((offer) => <Card key={offer.offerId} className="group transition hover:-translate-y-0.5 hover:shadow-lg"><CardContent className="p-6"><div className="flex items-center justify-between"><div className="flex gap-2"><Badge className={offer.side === "sell" ? "bg-blue-100 text-blue-800 hover:bg-blue-100" : "bg-violet-100 text-violet-800 hover:bg-violet-100"}>{offer.side.toUpperCase()}</Badge>{HERO_OFFER_IDS.has(offer.offerId) && <Badge variant="outline" className="border-emerald-200 text-emerald-700">Guided Scenario</Badge>}</div><span className="text-xs capitalize text-slate-400">{offer.category}</span></div><h2 className="mt-5 text-xl font-semibold">{offer.commodity}</h2><div className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin className="h-4 w-4" />{offer.location}</div><div className="mt-6 grid grid-cols-2 gap-4 border-y border-slate-100 py-4 text-sm"><div><p className="text-slate-500">Quantity</p><p className="mt-1 font-semibold">{Number(offer.quantity).toLocaleString()} {formatUnit(offer.unit)}</p></div><div><p className="text-slate-500">Price</p><p className="mt-1 font-semibold">{offer.currency} {Number(offer.pricePerUnit).toLocaleString()}</p></div></div><div className="mt-4 flex items-center justify-between"><span className="flex items-center gap-1 text-xs text-emerald-700"><ShieldCheck className="h-4 w-4" />{offer.assuranceLabel}</span><Button variant="ghost" size="sm" asChild><Link href={demoRoutes.offer(offer.offerId)}>View details <ArrowRight className="ml-1 h-4 w-4" /></Link></Button></div></CardContent></Card>)}</div>
    {visible.length === 0 && <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">No opportunities match these filters.</div>}
  </div>;
}
