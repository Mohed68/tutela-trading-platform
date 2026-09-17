import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiRequest,queryClient } from "@/lib/queryClient";
export default function ResetPassword(){
  const [token]=useState(()=>new URLSearchParams(window.location.search).get("token")??"");
  useEffect(()=>{window.history.replaceState({},"","/reset-password");},[]);
  const[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[done,setDone]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(event:React.FormEvent){event.preventDefault();if(password!==confirm){setError("Passwords do not match.");return;}setBusy(true);setError("");try{await apiRequest("POST","/api/auth/password/reset",{token,password});queryClient.clear();window.history.replaceState({},"","/reset-password");setDone(true);}catch{setError("This reset link is invalid or has expired.");}finally{setBusy(false);}}
  return <div className="flex min-h-[70vh] items-center justify-center px-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>{done?"Password reset complete":"Choose a new password"}</CardTitle><CardDescription>{done?"Existing sessions were signed out. Your authenticator enrollment was preserved.":"Use at least 12 characters with uppercase, lowercase, and a number."}</CardDescription></CardHeader><CardContent>{done?<Button asChild className="w-full"><Link href="/login">Sign in</Link></Button>:<form className="space-y-4" onSubmit={submit}><div><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></div><div><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></div>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={busy||!token}>{busy?"Resetting…":"Reset password"}</Button></form>}</CardContent></Card></div>;
}
