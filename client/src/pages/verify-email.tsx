import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CurrentUserDto } from "@shared/auth";

type VerificationState = "working" | "verified" | "invalid";

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const started = useRef(false);
  const [state, setState] = useState<VerificationState>("working");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("invalid");
      return;
    }

    void apiRequest("POST", "/api/auth/verify-email", { token })
      .then(async (response) => {
        const user = (await response.json()) as CurrentUserDto;
        queryClient.setQueryData(["/api/auth/user"], user);
        window.history.replaceState({}, "", "/verify-email");
        setState("verified");
      })
      .catch(() => setState("invalid"));
  }, []);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          {state === "working" && (
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-emerald-700" />
          )}
          {state === "verified" && (
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-700" />
          )}
          {state === "invalid" && (
            <XCircle className="mx-auto h-12 w-12 text-red-600" />
          )}
          <CardTitle className="mt-4">
            {state === "working" && "Verifying your email"}
            {state === "verified" && "Email verified"}
            {state === "invalid" && "Verification link unavailable"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-neutral-600">
            {state === "working" &&
              "Please wait while Tutela activates your account."}
            {state === "verified" &&
              "Your account is active. You can continue to your dashboard."}
            {state === "invalid" &&
              "This link is invalid, expired, or has already been used."}
          </p>
          {state === "verified" && (
            <Button className="w-full" onClick={() => navigate("/dashboard")}>
              Continue
            </Button>
          )}
          {state === "invalid" && (
            <Button asChild variant="outline" className="w-full">
              <Link href="/register">Register again</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
