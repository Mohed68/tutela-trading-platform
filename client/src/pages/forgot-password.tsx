import { useState } from "react";
import { Link } from "wouter";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
export default function ForgotPassword(){
  const[email,setEmail]=useState(""),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError("");try{await apiRequest("POST","/api/auth/password/forgot",{email});setSent(true);}catch{setError("Password recovery is temporarily unavailable. Please try again later.");}finally{setBusy(false);}}
  return <div className="flex min-h-[70vh] items-center justify-center px-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>Reset your password</CardTitle><CardDescription>Enter your account email. For your security, TUTELA gives the same response whether or not an eligible account exists.</CardDescription></CardHeader><CardContent>{sent?<div className="space-y-4"><p role="status" className="rounded bg-emerald-50 p-3 text-sm">If an eligible account exists, a one-time reset link will arrive shortly. The link expires after 60 minutes.</p><Link href="/login" className="text-sm underline">Return to sign in</Link></div>:<form className="space-y-4" onSubmit={submit}><div><Label htmlFor="recovery-email">Email</Label><Input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={busy}>{busy?"Requesting…":"Send reset link"}</Button></form>}</CardContent></Card></div>;
}
