import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";

type Status = { enrolled: boolean; status: "not_enrolled" | "pending_enrollment" | "active"; factorType: "totp" | null };
type Enrollment = { credentialId: string; secret: string; otpauthUri: string };

async function message(error: unknown) {
  if (!(error instanceof Error)) return "The security request failed.";
  const match = error.message.match(/^\d+:\s*(.*)$/s);
  if (!match) return error.message;
  try { return JSON.parse(match[1]).message ?? "The security request failed."; } catch { return match[1]; }
}

export function MfaSecuritySettings() {
  const [status,setStatus]=useState<Status|null>(null),[enrollment,setEnrollment]=useState<Enrollment|null>(null),[qr,setQr]=useState<string|null>(null),[code,setCode]=useState(""),[challenge,setChallenge]=useState(""),[recovery,setRecovery]=useState<readonly string[]|null>(null),[ack,setAck]=useState(false),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
  const refresh=async()=>{const response=await fetch("/api/auth/mfa/status",{credentials:"include"});if(response.ok)setStatus(await response.json())};
  useEffect(()=>{void refresh()},[]);
  useEffect(()=>{let current=true;if(enrollment)QRCode.toDataURL(enrollment.otpauthUri,{errorCorrectionLevel:"M",margin:2,width:220}).then(value=>{if(current)setQr(value)});return()=>{current=false}},[enrollment]);
  const act=async(action:()=>Promise<void>)=>{setBusy(true);setNotice("");try{await action()}catch(error){setNotice(await message(error))}finally{setBusy(false)}};
  const begin=()=>act(async()=>{const response=await apiRequest("POST","/api/auth/mfa/enrollment",{});setEnrollment(await response.json());setRecovery(null);setAck(false)});
  const confirm=()=>act(async()=>{if(!enrollment)return;const response=await apiRequest("POST","/api/auth/mfa/enrollment/confirm",{credentialId:enrollment.credentialId,code});const result=await response.json();setRecovery(result.recoveryCodes);setEnrollment(null);setQr(null);setCode("");await refresh()});
  const verify=(stepUp:boolean)=>act(async()=>{await apiRequest("POST",stepUp?"/api/auth/mfa/step-up":"/api/auth/mfa/challenge",{code:challenge});setChallenge("");setNotice(stepUp?"Privileged step-up is active for a short period.":"MFA challenge completed for this session.")});
  return <Card data-testid="mfa-security-settings">
    <CardHeader><CardTitle>Security</CardTitle><CardDescription>Protect privileged actions with an authenticator app.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <p className="text-sm text-neutral-700">MFA status: <strong>{status?.enrolled?"Active":status?.status==="pending_enrollment"?"Enrollment pending":"Not enrolled"}</strong></p>
      {!status?.enrolled&&!enrollment&&!recovery&&<Button disabled={busy} onClick={begin}>Set up authenticator</Button>}
      {enrollment&&<div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm">Scan this QR code in your authenticator app. Starting enrollment does not enable MFA until confirmation succeeds.</p>
        {qr&&<img src={qr} alt="Authenticator enrollment QR code" width={220} height={220}/>} 
        <div><p className="text-xs text-neutral-500">Manual setup key</p><code className="break-all select-all">{enrollment.secret}</code></div>
        <Input aria-label="Authenticator confirmation code" inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/>
        <Button disabled={busy||code.length!==6} onClick={confirm}>Confirm and activate MFA</Button>
      </div>}
      {recovery&&<div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <p className="font-medium">Save these recovery codes now</p><p className="text-sm">They are displayed once and are not saved in this browser.</p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm">{recovery.map(value=><li key={value}>{value}</li>)}</ul>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={ack} onCheckedChange={value=>setAck(value===true)}/>I saved the recovery codes securely.</label>
        <Button disabled={!ack} onClick={()=>setRecovery(null)}>Finish</Button>
      </div>}
      {status?.enrolled&&!recovery&&<div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm">Enter a current authenticator code for this session. Privileged step-up always requires TOTP and must be explicitly requested.</p>
        <Input aria-label="MFA challenge code" inputMode="numeric" maxLength={32} value={challenge} onChange={e=>setChallenge(e.target.value.trim())}/>
        <div className="flex gap-2"><Button disabled={busy||challenge.length<6} onClick={()=>verify(false)}>Verify session</Button><Button variant="outline" disabled={busy||!/^\d{6}$/.test(challenge)} onClick={()=>verify(true)}>Privileged step-up</Button></div>
      </div>}
      {notice&&<p role="status" className="text-sm text-neutral-700">{notice}</p>}
    </CardContent>
  </Card>;
}
