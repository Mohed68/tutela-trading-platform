import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TotpCodeInput } from "@/components/security/TotpCodeInput";
import { apiRequest } from "@/lib/queryClient";

type Maturity = "DEFINED" | "ACTIVE_BASELINE" | "FULL";
type ModuleStatus = { id: string; maturity: Maturity };
type Overview = { principals: number; owners: number; assignments: number; audit_events: number; health: string; modules: readonly ModuleStatus[] };
type AdminIdentity = { user: { id: string; roles: readonly string[]; permissions: readonly string[]; assurance: string; isPlatformOwner: boolean } };
type Principal = { principalId: string; userId: string; status: string; createdAt: string };
type Owner = { assignmentId: string; principalId: string; userId: string; status: string; authoritySource: string; grantedAt: string; version: number };
type RoleAssignment = { assignmentId: string; principalId: string; role: string; status: string; grantedAt: string; revokedAt: string | null };
type AuditEvent = { id?: string; action: string; targetType: string; targetId: string; occurredAt: string; severity: string };
type SafeUser = { userId: string; email: string | null; accountStatus: string; emailVerified: boolean; platformPrincipal: boolean; declaredCompanyName: string | null };

const navigation = [
  ["overview", "Overview"], ["organizations-users", "Organizations & Users"], ["verification", "Verification"],
  ["risk", "Risk"], ["enforcement", "Enforcement"], ["trade-operations", "Trade Operations"],
  ["documents", "Documents"], ["shipping-fulfilment", "Shipping & Fulfilment"],
  ["settlement-finance", "Settlement & Finance"], ["claims-disputes", "Claims & Disputes"],
  ["support", "Support"], ["platform", "Platform Administration"], ["security", "Security & Audit"],
] as const;

const moduleId = (section: string) => section.replaceAll("-", "_").replace("platform", "platform_administration").replace("security", "security_audit");

async function json<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json();
}

export default function SecureAdminControlPlane() {
  const [, params] = useRoute("/admin/:section?");
  const section = params?.section ?? "overview";
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [principals, setPrincipals] = useState<readonly Principal[]>([]);
  const [owners, setOwners] = useState<readonly Owner[]>([]);
  const [roles, setRoles] = useState<readonly RoleAssignment[]>([]);
  const [auditEvents, setAuditEvents] = useState<readonly AuditEvent[]>([]);
  const [users, setUsers] = useState<readonly SafeUser[]>([]);
  const [notice, setNotice] = useState("");
  const [totp, setTotp] = useState("");
  const [targetPrincipalId, setTargetPrincipalId] = useState("");
  const [targetRole, setTargetRole] = useState("SUPPORT");
  const [reason, setReason] = useState("");
  const [ownerPrincipalId, setOwnerPrincipalId] = useState("");
  const [ownerReason, setOwnerReason] = useState("");

  const refresh = useCallback(async () => {
    const [auth, summary] = await Promise.all([json<AdminIdentity>("/admin/auth/info"), json<Overview>("/admin/control-plane/overview")]);
    setIdentity(auth); setOverview(summary);
    if (section === "platform") {
      const [principalRows, ownerRows, roleRows] = await Promise.all([
        json<Principal[]>("/admin/platform/principals"), json<Owner[]>("/admin/platform/owners"), json<RoleAssignment[]>("/admin/platform/role-assignments"),
      ]);
      setPrincipals(principalRows); setOwners(ownerRows); setRoles(roleRows);
    }
    if (section === "security") setAuditEvents(await json<AuditEvent[]>("/admin/audit?limit=25&offset=0"));
    if (section === "organizations-users") setUsers(await json<SafeUser[]>("/admin/control-plane/users"));
  }, [section]);

  useEffect(() => { void refresh().catch(() => setNotice("The secure Control Plane could not be loaded.")); }, [refresh]);
  const maturity = useMemo(() => overview?.modules.find((item) => item.id === moduleId(section))?.maturity ?? "DEFINED", [overview, section]);
  const title = navigation.find(([id]) => id === section)?.[1] ?? "Overview";

  const stepUp = async () => {
    try {
      await apiRequest("POST", "/api/auth/mfa/step-up", { code: totp });
      setTotp(""); setNotice("Recent step-up is active. Confirm the privileged action again when ready.");
      await refresh();
    } catch { setNotice("The code could not be verified. Wait for a new authenticator code and try again."); }
  };

  const grantRole = async () => {
    try {
      await apiRequest("POST", "/admin/platform/role-assignments", { targetPrincipalId, role: targetRole, reason });
      setNotice("Role assignment committed with Security Audit evidence."); setReason(""); await refresh();
    } catch (error) { setNotice(String(error).includes("recent_step_up_required") ? "Recent step-up is required. Complete it, then explicitly submit this action again." : "Role assignment was denied safely."); }
  };

  const grantOwner = async () => {
    try {
      await apiRequest("POST", "/admin/platform/owners", { targetPrincipalId: ownerPrincipalId, reason: ownerReason });
      setNotice("Platform Ownership succession committed with Security Audit evidence."); setOwnerReason(""); await refresh();
    } catch { setNotice("Ownership grant was denied. Recent step-up and existing Owner authority are required."); }
  };

  const revokeRole = async (assignment: RoleAssignment) => {
    const revocationReason = window.prompt(`Reason for revoking ${assignment.role} (at least 10 characters):`);
    if (!revocationReason || revocationReason.trim().length < 10 || !window.confirm("Confirm this privileged role revocation?")) return;
    try { await apiRequest("POST", `/admin/platform/role-assignments/${assignment.assignmentId}/revoke`, { reason: revocationReason }); setNotice("Role revoked and audited."); await refresh(); }
    catch { setNotice("Role revocation was denied safely."); }
  };

  const revokeOwner = async (assignment: Owner) => {
    const revocationReason = window.prompt("Reason for revoking Platform Ownership (at least 10 characters):");
    if (!revocationReason || revocationReason.trim().length < 10 || !window.confirm("Confirm Platform Ownership revocation? The final active Owner can never be revoked.")) return;
    try { await apiRequest("POST", `/admin/platform/owners/${assignment.assignmentId}/revoke`, { reason: revocationReason }); setNotice("Platform Ownership revoked and audited."); await refresh(); }
    catch { setNotice("Ownership revocation was denied safely; the final-owner invariant remains enforced."); }
  };

  return <AppLayout>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8" data-testid="secure-admin-control-plane">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">TUTELA Control Plane</p><h1 className="text-3xl font-bold">{title}</h1><p className="mt-1 text-sm text-neutral-600">Server-authoritative access · {maturity}</p></div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav className="space-y-1 rounded-xl border bg-white p-3" aria-label="Control Plane modules">
          {navigation.map(([id, label]) => <Link key={id} href={`/admin/${id}`} className={`block rounded-lg px-3 py-2 text-sm ${id === section ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}>{label}</Link>)}
        </nav>
        <main className="space-y-5">
          {notice && <p role="status" className="rounded-lg border bg-white p-3 text-sm">{notice}</p>}
          {section === "overview" && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[['Active owners', overview?.owners], ['Platform principals', overview?.principals], ['Active role assignments', overview?.assignments], ['Security audit events', overview?.audit_events]].map(([label, value]) => <Card key={String(label)}><CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{value ?? "—"}</CardContent></Card>)}
          </div>}
          {section === "platform" && <div className="space-y-5">
            <Card><CardHeader><CardTitle>Platform authority</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>Signed in as principal <code>{identity?.user.id}</code></p><p>Platform Owner: <strong>{identity?.user.isPlatformOwner ? "Yes" : "No"}</strong></p><p>Session assurance: <strong>{identity?.user.assurance ?? "unknown"}</strong></p><p>Privileged step-up: <strong>{identity?.user.assurance === "recent_step_up" ? "Active" : "Not active"}</strong></p></CardContent></Card>
            <Card><CardHeader><CardTitle>Privileged step-up</CardTitle></CardHeader><CardContent className="space-y-3"><TotpCodeInput label="Current authenticator code" value={totp} onChange={setTotp}/><Button disabled={!/^\d{6}$/.test(totp)} onClick={stepUp}>Verify step-up</Button></CardContent></Card>
            <Card><CardHeader><CardTitle>Grant Platform role</CardTitle></CardHeader><CardContent className="space-y-3"><Input aria-label="Target principal ID" value={targetPrincipalId} onChange={(event) => setTargetPrincipalId(event.target.value)}/><select className="h-10 w-full rounded-md border px-3" aria-label="Platform role" value={targetRole} onChange={(event) => setTargetRole(event.target.value)}>{["SUPPORT","VERIFICATION_REVIEWER","OPERATIONS","PLATFORM_ADMIN"].map((role) => <option key={role}>{role}</option>)}</select><Input aria-label="Explicit grant reason" placeholder="Reason (at least 10 characters)" value={reason} onChange={(event) => setReason(event.target.value)}/><Button disabled={!targetPrincipalId.trim() || reason.trim().length < 10} onClick={grantRole}>Confirm role grant</Button><p className="text-xs text-neutral-500">PLATFORM_ADMIN governance requires Platform Owner authority and recent step-up.</p></CardContent></Card>
            {identity?.user.isPlatformOwner && <Card><CardHeader><CardTitle>Grant Platform Ownership</CardTitle></CardHeader><CardContent className="space-y-3"><Input aria-label="Successor principal ID" value={ownerPrincipalId} onChange={(event) => setOwnerPrincipalId(event.target.value)}/><Input aria-label="Explicit ownership reason" placeholder="Reason (at least 10 characters)" value={ownerReason} onChange={(event) => setOwnerReason(event.target.value)}/><Button disabled={!ownerPrincipalId.trim() || ownerReason.trim().length < 10} onClick={grantOwner}>Confirm ownership grant</Button></CardContent></Card>}
            <Card><CardHeader><CardTitle>Platform Owners</CardTitle></CardHeader><CardContent>{owners.length ? <ul className="space-y-2 text-sm">{owners.map((owner) => <li key={owner.assignmentId} className="flex items-center justify-between gap-3 rounded border p-2"><code className="break-all">{owner.userId} · {owner.status} · {owner.authoritySource}</code>{owner.status === "active" && identity?.user.isPlatformOwner && <Button variant="outline" size="sm" onClick={() => revokeOwner(owner)}>Revoke</Button>}</li>)}</ul> : <p className="text-sm text-neutral-500">No records.</p>}</CardContent></Card>
            <Card><CardHeader><CardTitle>Platform Principals</CardTitle></CardHeader><CardContent><SafeRows rows={principals.map((principal) => `${principal.userId} · ${principal.status} · ${principal.principalId}`)}/></CardContent></Card>
            <Card><CardHeader><CardTitle>Role Assignments</CardTitle></CardHeader><CardContent>{roles.length ? <ul className="space-y-2 text-sm">{roles.map((role) => <li key={role.assignmentId} className="flex items-center justify-between gap-3 rounded border p-2"><code className="break-all">{role.principalId} · {role.role} · {role.status}</code>{role.status === "active" && <Button variant="outline" size="sm" onClick={() => revokeRole(role)}>Revoke</Button>}</li>)}</ul> : <p className="text-sm text-neutral-500">No records.</p>}</CardContent></Card>
          </div>}
          {section === "organizations-users" && <div className="space-y-5"><Card><CardHeader><CardTitle>Organizations</CardTitle></CardHeader><CardContent><p className="text-sm text-neutral-600">A canonical Organization Registry is not active in this baseline. Declared company names below are account metadata, not Organization Verification, Trust, or Eligibility authority.</p></CardContent></Card><Card><CardHeader><CardTitle>Users</CardTitle></CardHeader><CardContent><SafeRows rows={users.map((user) => `${user.email ?? user.userId} · ${user.accountStatus} · email ${user.emailVerified ? "verified" : "unverified"} · Platform Principal ${user.platformPrincipal ? "yes" : "no"}${user.declaredCompanyName ? ` · ${user.declaredCompanyName}` : ""}`)}/></CardContent></Card></div>}
          {section !== "overview" && section !== "platform" && section !== "organizations-users" && <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><p className="text-sm text-neutral-600">{maturity === "DEFINED" ? "DEFINED — NOT YET ACTIVATED" : `This module is ${maturity}. No unimplemented capability is presented as operational.`}</p>{section === "security" && <div className="mt-4"><p className="mb-3 text-sm">Security Audit access is protected by server permission and MFA assurance.</p><SafeRows rows={auditEvents.map((event) => `${event.occurredAt} · ${event.severity} · ${event.action} · ${event.targetType}:${event.targetId}`)}/></div>}</CardContent></Card>}
        </main>
      </div>
    </div>
  </AppLayout>;
}

function SafeRows({ rows }: { rows: readonly string[] }) {
  return rows.length ? <ul className="space-y-2 text-sm">{rows.map((row) => <li key={row} className="rounded border p-2"><code className="break-all">{row}</code></li>)}</ul> : <p className="text-sm text-neutral-500">No records.</p>;
}
