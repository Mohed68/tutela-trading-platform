import { useEffect, useState } from "react";
import { Building2, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { organizationVerificationLabel } from "@/features/organization/organizationOnboarding";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { authErrorPresentation } from "@/lib/authApiError";
import { isDemo } from "@/lib/demo";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

type VerificationExecutionResponse = Readonly<{
  status: "completed";
  workflowStage: string;
  trustState: string;
  replayFingerprint: string;
}>;

export default function Verification() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const demoMode = isDemo();
  const {
    context,
    isLoading: organizationLoading,
    isError: organizationError,
  } = useOrganizationContext(isAuthenticated);
  const [documentType, setDocumentType] = useState("business_registration");
  const [representativeReference, setRepresentativeReference] = useState("");
  const [associationConfirmed, setAssociationConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/login");
  }, [authLoading, isAuthenticated, navigate]);

  const organization =
    context?.state === "available" ? context.organization : null;
  const registrationIdentifier = organization?.registrationIdentifiers[0];
  const verificationLabel = organizationVerificationLabel(context);
  const isOwner = organization?.membership.role === "owner";
  const isTrusted =
    organization?.verification.canonicalTrustStatus === "trusted";
  const history=useQuery<{decisions:{id:string;createdAt:string;status:string;decision?:string;policyVersion?:string;trust?:string}[];reviews:{outcome:string;policyVersion:string;createdAt:string}[]}>({queryKey:["organization-verification-history",organization?.organizationId],enabled:Boolean(organization),queryFn:async()=>{const response=await fetch(`/api/organizations/${encodeURIComponent(organization!.organizationId)}/verification-history`,{credentials:"include"});if(!response.ok)throw new Error("history unavailable");return response.json();}});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!organization || !registrationIdentifier || !isOwner) return;
    setSubmitting(true);
    setSubmitted(false);
    setError("");

    const assertions = [
      { assertionCode: "evidence_category", value: "organization_existence" },
      {
        assertionCode: "evidence_category",
        value: "representative_association",
      },
      { assertionCode: "document_type", value: documentType },
      {
        assertionCode: "registration_identifier",
        value: `${registrationIdentifier.scheme}:${registrationIdentifier.value}`,
      },
      { assertionCode: "legal_name", value: organization.displayName },
      {
        assertionCode: "registration_jurisdiction",
        value: organization.jurisdiction,
      },
      { assertionCode: "association_asserted", value: "true" },
      {
        assertionCode: "representative_reference",
        value: representativeReference.trim(),
      },
    ];

    try {
      await apiRequest(
        "POST",
        `/api/organizations/${encodeURIComponent(organization.organizationId)}/profile-revisions/${encodeURIComponent(organization.profileRevisionId)}/evidence`,
        { assertions },
      );
      const response = await apiRequest(
        "POST",
        `/api/organizations/${encodeURIComponent(organization.organizationId)}/profile-revisions/${encodeURIComponent(organization.profileRevisionId)}/verification`,
      );
      const result = (await response.json()) as VerificationExecutionResponse;
      if (
        result.status !== "completed" ||
        typeof result.replayFingerprint !== "string" ||
        result.replayFingerprint.length === 0
      ) {
        throw new Error("Canonical verification replay was not returned.");
      }
        await Promise.all([
          queryClient.invalidateQueries({queryKey:["organization-verification-history"]}),
        queryClient.invalidateQueries({
          queryKey: ["/api/organizations/current"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/dashboard/overview"],
        }),
      ]);
      setSubmitted(true);
    } catch (caught) {
      setError(
        authErrorPresentation(
          caught,
          "Organization verification is temporarily unavailable.",
        ).message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || organizationLoading || !isAuthenticated) return null;

  if (demoMode) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Organization verification is unavailable in demo mode</CardTitle>
          <CardDescription>
            Exit demo mode to submit authoritative organization evidence.
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
      <Alert variant="destructive">
        <AlertTitle>Verification unavailable</AlertTitle>
        <AlertDescription>
          TUTELA could not safely resolve the authoritative organization state.
        </AlertDescription>
      </Alert>
    );
  }

  if (!organization) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Organization setup required</CardTitle>
          <CardDescription>
            Create an organization and owner Membership before submitting
            organization verification evidence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/organization/setup">Set up Organization</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-950">
          Verify your organization
        </h1>
        <p className="mt-2 text-neutral-600">
          Submit the required organization information and evidence to progress
          through TUTELA&apos;s verification and trading eligibility process.
        </p>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Verification and eligibility are separate</AlertTitle>
        <AlertDescription>
          Organization verification does not by itself guarantee trading
          eligibility. Eligibility is determined separately by TUTELA&apos;s trust
          and participation rules.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-700" />
                {organization.displayName}
              </CardTitle>
              <CardDescription className="mt-2">
                {organization.jurisdiction} · {organization.membership.role}
              </CardDescription>
            </div>
            <Badge variant={isTrusted ? "default" : "outline"}>
              {verificationLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-neutral-500">Registration identifier</p>
            <p className="font-medium text-neutral-900">
              {registrationIdentifier
                ? `${registrationIdentifier.scheme}: ${registrationIdentifier.value}`
                : "Unavailable"}
            </p>
          </div>
          <div>
            <p className="text-neutral-500">Registry lifecycle</p>
            <p className="font-medium capitalize text-neutral-900">
              {organization.lifecycle}
            </p>
          </div>
        </CardContent>
      </Card>

      {!isOwner ? (
        <Alert>
          <AlertTitle>Owner Membership required</AlertTitle>
          <AlertDescription>
            Only an active Organization owner can submit evidence or initiate
            verification in Production Cycle 1.
          </AlertDescription>
        </Alert>
      ) : isTrusted ? (
        <Alert className="border-emerald-200 bg-emerald-50">
          <AlertTitle>Organization verification completed</AlertTitle>
          <AlertDescription>
            Authoritative Replay currently resolves this organization&apos;s Trust
            status as trusted.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Organization evidence</CardTitle>
            <CardDescription>
              Provide documentary evidence details matching the current Registry
              profile. Submission starts the canonical verification workflow; it
              does not directly create a Decision or Trust result.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div>
                <Label htmlFor="documentType">Existence document type</Label>
                <select
                  id="documentType"
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="business_registration">
                    Business registration
                  </option>
                  <option value="certificate_of_incorporation">
                    Certificate of incorporation
                  </option>
                  <option value="business_license">Business license</option>
                </select>
              </div>
              <div>
                <Label htmlFor="representativeReference">
                  Representative association reference
                </Label>
                <Input
                  id="representativeReference"
                  value={representativeReference}
                  onChange={(event) =>
                    setRepresentativeReference(event.target.value)
                  }
                  placeholder="Reference shown on the supporting document"
                  maxLength={255}
                  required
                />
              </div>
              <label className="flex items-start gap-3 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={associationConfirmed}
                  onChange={(event) =>
                    setAssociationConfirmed(event.target.checked)
                  }
                  className="mt-1"
                  required
                />
                I confirm that the submitted evidence associates me with this
                organization. TUTELA will evaluate this assertion through its
                verification policy.
              </label>
              {submitted && (
                <Alert className="border-emerald-200 bg-emerald-50">
                  <AlertTitle>Evidence submitted — independent review pending</AlertTitle>
                  <AlertDescription>
                    Your structured assertions were persisted as Evidence. They are not a protected document repository and cannot approve or create Trust by themselves. An authorized independent reviewer must confirm them before Policy V2 can approve.
                  </AlertDescription>
                </Alert>
              )}
              {error && (
                <p
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900"
                  role="alert"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={
                  submitting ||
                  !associationConfirmed ||
                  !registrationIdentifier
                }
              >
                {submitting
                  ? "Submitting evidence..."
                  : "Submit evidence and start verification"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      {organization&&<Card><CardHeader><CardTitle>Verification history</CardTitle><CardDescription>Safe Policy V2 decisions and independent review outcomes. Reviewers record artifacts; only the canonical engine produces Verification and derived Trust.</CardDescription></CardHeader><CardContent>{history.isLoading?<p className="text-sm">Loading history…</p>:history.data&&history.data.decisions.length+history.data.reviews.length>0?<div className="space-y-3 text-sm">{history.data.reviews.map((review,index)=><div key={`review-${index}`} className="rounded border p-3"><strong>Independent review: {review.outcome.replaceAll("_"," ")}</strong><p>{review.outcome==="confirmed"?"Independent confirmation was recorded for canonical evaluation.":review.outcome==="revision_requested"?"The reviewer requested revised evidence.":"The independent review did not confirm the submitted evidence."}</p><p className="text-xs text-neutral-500">{review.policyVersion} · {new Date(review.createdAt).toLocaleString()}</p></div>)}{history.data.decisions.map(item=><div key={item.id} className="rounded border p-3"><strong>Decision: {(item.decision??item.status).replaceAll("_"," ")}</strong><p className="text-xs text-neutral-500">Trust: {item.trust??"not established"} · {item.policyVersion??"no policy"} · {new Date(item.createdAt).toLocaleString()}</p></div>)}</div>:<p className="text-sm text-neutral-600">No verification history has been recorded yet.</p>}</CardContent></Card>}
    </div>
  );
}
