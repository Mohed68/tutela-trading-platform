import { Link } from "wouter";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DemoCheckEmail() {
  return <div className="min-h-screen grid place-items-center bg-slate-950 px-4"><div className="max-w-lg rounded-3xl bg-white p-9 text-center shadow-2xl">
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100"><MailCheck className="h-7 w-7 text-emerald-700" /></div>
    <h1 className="mt-6 text-3xl font-semibold">Check your business email</h1>
    <p className="mt-4 leading-7 text-slate-600">If the submitted address is eligible, a verification link has been sent. It remains valid for 24 hours.</p>
    <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No production trading account has been created. The link opens an isolated, non-binding simulation.</div>
    <Button variant="outline" className="mt-7" asChild><Link href="/demo/request">Return to request form</Link></Button>
  </div></div>;
}
