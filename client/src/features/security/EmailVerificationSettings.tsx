import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

type RequestResult = { status: "sent"; email: string } | { status: "already_verified" };

export function EmailVerificationSettings() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const verified = user?.emailVerified === "verified";

  const requestVerification = async () => {
    setBusy(true); setNotice("");
    try {
      const response = await apiRequest("POST", "/api/auth/email-verification/request", {});
      const result = await response.json() as RequestResult;
      setNotice(result.status === "already_verified" ? "Your email is already verified." : `Verification email sent to ${result.email}`);
    } catch (error) {
      const value = error instanceof Error ? error.message : "";
      setNotice(value.includes("429") ? "A verification email was sent recently. Please wait before trying again." : "The verification email could not be sent. Please try again later.");
    } finally { setBusy(false); }
  };

  return <Card data-testid="email-verification-settings">
    <CardHeader><CardTitle>Email verification</CardTitle><CardDescription>Confirm the email address attached to your authenticated TUTELA account.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex items-center gap-3"><span className="text-sm">Status</span><Badge variant={verified ? "default" : "outline"}>{verified ? "Verified" : "Unverified"}</Badge></div>
      {!verified && <Button disabled={busy || !user?.email} onClick={requestVerification}>{busy ? "Sending…" : "Send verification email"}</Button>}
      {notice && <p role="status" className="text-sm text-neutral-700">{notice}</p>}
      {!verified && <p className="text-xs text-neutral-500">The secure link expires after 24 hours. Your existing login and MFA settings are unchanged.</p>}
    </CardContent>
  </Card>;
}
