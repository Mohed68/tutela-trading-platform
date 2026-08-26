import React from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoApi, DemoApiError } from "@/features/demo/api";

export default function DemoVerify() {
  const [, navigate] = useLocation();
  const [state, setState] = React.useState<"working"|"failed">("working");
  const [message, setMessage] = React.useState("");
  React.useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setState("failed"); setMessage("This verification link is invalid or incomplete."); return; }
    void (async () => {
      try {
        await demoApi.verifyAccess(token);
        await demoApi.createSession();
        navigate("/demo");
      } catch (error) {
        setState("failed");
        setMessage(error instanceof DemoApiError && ["invalid_or_expired_token","grant_expired"].includes(error.code ?? "")
          ? "This verification link is invalid, expired, or has already been used."
          : "We could not start the interactive demo. The temporary grant may have been lost after a server restart.");
      }
    })();
  }, [navigate]);
  return <div className="min-h-screen grid place-items-center bg-slate-950 px-4"><div className="max-w-lg rounded-3xl bg-white p-9 text-center shadow-2xl">
    {state === "working" ? <><Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-700" /><h1 className="mt-5 text-2xl font-semibold">Verifying secure demo access</h1><p className="mt-3 text-slate-600">We’re preparing your isolated TUTELA simulation.</p></> : <><ShieldAlert className="mx-auto h-10 w-10 text-amber-600" /><h1 className="mt-5 text-2xl font-semibold">Demo access could not be verified</h1><p className="mt-3 text-slate-600">{message}</p><Button className="mt-6" asChild><Link href="/demo/request">Request a new demo link</Link></Button></>}
    <span className="sr-only"><CheckCircle2 />Verification result</span>
  </div></div>;
}
