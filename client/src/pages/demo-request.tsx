import React from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoApi, DemoApiError } from "@/features/demo/api";
import type { DemoQualification } from "@/features/demo/types";

const interests = [
  "Energy / Petroleum Products", "Chemicals / Fertilizers", "Metals",
  "Agriculture / Soft Commodities", "General Commodity Trading",
  "Partnership / Investment", "Other",
];

const initial: DemoQualification = {
  firstName: "", lastName: "", businessEmail: "", company: "", country: "",
  jobRole: "", tradeRole: "both", primaryInterest: "General Commodity Trading",
};

export default function DemoRequest() {
  const [, navigate] = useLocation();
  const [form, setForm] = React.useState(initial);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (key: keyof DemoQualification, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError("");
    try {
      await demoApi.requestAccess(form);
      navigate("/demo/check-email");
    } catch (reason) {
      setError(reason instanceof DemoApiError && reason.code === "business_email_required"
        ? "Please use your business email address to request qualified demo access."
        : "We could not process the request right now. Please check the details and try again.");
    } finally { setSubmitting(false); }
  };

  return <div className="min-h-screen bg-slate-950 px-4 py-10 sm:py-16">
    <div className="mx-auto max-w-6xl">
      <Link href="/home" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to TUTELA</Link>
      <div className="mt-8 grid overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[0.85fr_1.15fr]">
        <section className="bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 p-8 text-white sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Qualified Interactive Demo</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight">Experience TUTELA in action</h1>
          <p className="mt-5 leading-7 text-slate-300">Explore a complete simulated commodity trade — from a verified organization and eligible offer through order acceptance and a non-binding contract.</p>
          <div className="mt-10 space-y-4 text-sm text-slate-200">
            {["15 realistic commodity opportunities", "Three guided trade scenarios", "No production account or binding transaction"].map((item) => <div key={item} className="flex gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-400" />{item}</div>)}
          </div>
        </section>
        <form onSubmit={submit} className="p-8 sm:p-12">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700"><ShieldCheck className="h-5 w-5" />Business email verification required</div>
          <h2 className="mt-3 text-2xl font-semibold">Request interactive demo</h2>
          <p className="mt-2 text-sm text-slate-500">Short qualification helps us tailor the simulation. This does not create a trading account.</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {([["firstName","First name"],["lastName","Last name"],["businessEmail","Business email"],["company","Company"],["country","Country"],["jobRole","Job role"]] as const).map(([key,label]) => <div key={key} className={key === "businessEmail" ? "sm:col-span-2" : ""}><Label htmlFor={key}>{label}</Label><Input id={key} type={key === "businessEmail" ? "email" : "text"} value={form[key]} onChange={(e) => set(key,e.target.value)} required className="mt-2" /></div>)}
            <div><Label htmlFor="tradeRole">Trade role</Label><select id="tradeRole" value={form.tradeRole} onChange={(e) => set("tradeRole",e.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="buyer">Buyer</option><option value="seller">Seller</option><option value="both">Both</option></select></div>
            <div><Label htmlFor="primaryInterest">Primary interest</Label><select id="primaryInterest" value={form.primaryInterest} onChange={(e) => set("primaryInterest",e.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-white px-3 text-sm">{interests.map((value) => <option key={value}>{value}</option>)}</select></div>
          </div>
          {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <Button disabled={submitting} className="mt-7 w-full bg-emerald-700 hover:bg-emerald-800" size="lg">{submitting ? "Submitting…" : "Request interactive demo"}</Button>
          <p className="mt-4 text-center text-xs text-slate-500">Your link is valid for 24 hours. Demo access remains isolated from production trading.</p>
        </form>
      </div>
    </div>
  </div>;
}
