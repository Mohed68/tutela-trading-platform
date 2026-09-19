import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorPresentation } from "@/lib/authApiError";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isDemo } from "@/lib/demo";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import type {
  OrganizationRegistrationCreatedResponse,
  OrganizationRegistrationRequest,
} from "@shared/organizationOnboarding";

const REGISTRATION_NUMBER_SCHEME = "company_registration_number";

export default function OrganizationSetup() {
  const [, navigate] = useLocation();
  const demoMode = isDemo();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    context,
    isLoading: organizationLoading,
    isError: organizationError,
  } = useOrganizationContext(isAuthenticated);
  const [form, setForm] = useState({
    legalName: "",
    jurisdiction: "",
    organizationType: "",
    registrationNumber: "",
    activityCode: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolution, setResolution] = useState<any>(null);
  const [creationConfirmed, setCreationConfirmed] = useState(false);
  const invitationToken = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("invitation") ?? "";

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/login");
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!demoMode && context?.state === "available") navigate("/dashboard");
  }, [context, demoMode, navigate]);

  const set = (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const payload: OrganizationRegistrationRequest = {
      legalName: form.legalName.trim(),
      tradingNames: [],
      organizationType: form.organizationType.trim(),
      jurisdiction: form.jurisdiction.trim(),
      registrationIdentifiers: [
        {
          scheme: REGISTRATION_NUMBER_SCHEME,
          value: form.registrationNumber.trim(),
        },
      ],
      declaredActivities: [{ code: form.activityCode.trim() }],
    };
    try {
      if (!creationConfirmed) {
        const response = await apiRequest("POST", "/api/organization-resolution", {
          legalName: form.legalName.trim(),
          jurisdiction: form.jurisdiction.trim(),
          registrationIdentifier: form.registrationNumber.trim(),
        });
        const resolved = await response.json();
        setResolution(resolved);
        if (resolved.outcome !== "NO_MATCH") return;
        setCreationConfirmed(true);
        return;
      }
      const response = await apiRequest("POST", "/api/organizations", payload);
      const created =
        (await response.json()) as OrganizationRegistrationCreatedResponse;
      if (
        created.status !== "created" ||
        created.membershipRole !== "owner" ||
        created.membershipStatus !== "active"
      ) {
        throw new Error("Organization creation did not return its authority binding.");
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/organizations/current"],
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] }),
        queryClient.invalidateQueries({
          queryKey: ["/api/dashboard/overview"],
        }),
      ]);
      navigate("/dashboard?organizationCreated=1");
    } catch (caught) {
      const presentation = authErrorPresentation(
        caught,
        "Organization setup is temporarily unavailable.",
      );
      setError(
        presentation.message === "Authority state conflicts with this request."
          ? "An active primary organization already exists for this account."
          : presentation.message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function join(organizationId: string) {
    setSubmitting(true); setError("");
    try {
      const response=await apiRequest("POST",`/api/organizations/${organizationId}/join`,{});const result=await response.json();
      await queryClient.invalidateQueries({queryKey:["/api/organizations/current"]});
      if(result.outcome==="JOINED")navigate("/organization");else setResolution({...resolution,outcome:"MEMBERSHIP_PENDING"});
    } catch(caught){setError(authErrorPresentation(caught,"The membership request could not be completed.").message);} finally{setSubmitting(false)}
  }
  async function acceptInvitation(){setSubmitting(true);setError("");try{await apiRequest("POST","/api/organization-invitations/redeem",{token:invitationToken});await queryClient.invalidateQueries({queryKey:["/api/organizations/current"]});navigate("/organization");}catch(caught){setError(authErrorPresentation(caught,"This invitation could not be accepted.").message);}finally{setSubmitting(false)}}

  if (authLoading || organizationLoading || !isAuthenticated) return null;

  if (demoMode) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Organization setup is not used in demo mode</CardTitle>
          <CardDescription>
            Exit demo mode to create an authoritative organization profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/dashboard">Return to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (organizationError || context?.state === "unavailable") {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Organization setup unavailable</CardTitle>
          <CardDescription>
            TUTELA could not safely resolve your current organization context.
            No organization data has been changed.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <Building2 className="mb-2 h-10 w-10 text-emerald-700" />
        <CardTitle>Set up your organization</CardTitle>
        <CardDescription>
          Find and join your company first. Register a new organization only
          when no authoritative match exists.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invitationToken&&<div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold text-emerald-950">Organization invitation</p><p className="mt-1 text-sm text-emerald-900">Accept only if this invitation was sent to your verified business email. It grants basic Member only.</p><Button type="button" className="mt-3" disabled={submitting} onClick={()=>void acceptInvitation()}>Accept invitation</Button></div>}
        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label htmlFor="legalName">Organization / company name</Label>
            <Input
              id="legalName"
              value={form.legalName}
              onChange={set("legalName")}
              maxLength={255}
              required
            />
            <p className="mt-1 text-xs text-neutral-500">
              This is a user-provided profile name until Organization
              Verification confirms legal identity evidence.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="jurisdiction">Country / jurisdiction</Label>
              <Input
                id="jurisdiction"
                value={form.jurisdiction}
                onChange={set("jurisdiction")}
                maxLength={255}
                required
              />
            </div>
            <div>
              <Label htmlFor="organizationType">Organization type</Label>
              <Input
                id="organizationType"
                placeholder="e.g. corporation"
                value={form.organizationType}
                onChange={set("organizationType")}
                maxLength={255}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="registrationNumber">
              Company registration number
            </Label>
            <Input
              id="registrationNumber"
              value={form.registrationNumber}
              onChange={set("registrationNumber")}
              maxLength={255}
              required
            />
          </div>
          <div>
            <Label htmlFor="activityCode">
              Business activity / industry code
            </Label>
            <Input
              id="activityCode"
              placeholder="Enter the code used by your organization"
              value={form.activityCode}
              onChange={set("activityCode")}
              maxLength={255}
              required
            />
            <p className="mt-1 text-xs text-neutral-500">
              TUTELA stores the code you provide and does not infer an industry
              classification.
            </p>
          </div>
          {error && (
            <p
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900"
              role="alert"
            >
              {error}
            </p>
          )}
          {resolution?.candidates?.length>0&&<div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div><p className="font-semibold text-emerald-950">{resolution.outcome==="MATCHED"?"We found your organization":"Possible organization match"}</p><p className="text-sm text-emerald-900">Candidate matches never create membership or ownership automatically.</p></div>{resolution.candidates.map((candidate:any)=><div key={candidate.organizationId} className="rounded-lg border bg-white p-3"><p className="font-medium">{candidate.legalName}</p><p className="text-sm text-neutral-600">{candidate.jurisdiction} · {candidate.verifiedDomainMatch?"Verified company-domain match":"Candidate match"}</p><Button type="button" className="mt-3" onClick={()=>void join(candidate.organizationId)} disabled={submitting}>Join this organization</Button></div>)}<Button type="button" variant="ghost" onClick={()=>{setResolution(null);setCreationConfirmed(true)}}>This is not my company</Button></div>}
          {resolution?.outcome==="MEMBERSHIP_PENDING"&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">Your membership request is pending organization approval. No role or signing authority has been granted.</p>}
          {creationConfirmed&&<p className="rounded-lg border bg-neutral-50 p-3 text-sm">No authoritative match was selected. Review the legal details, then create a new organization. The creator becomes Owner only for this newly registered organization.</p>}
          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? "Checking organization..." : creationConfirmed ? "Create new organization" : "Find my organization"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
