import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { authErrorPresentation } from "@/lib/authApiError";

const UNVERIFIED_LOGIN_MESSAGE = "Email verification required.";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [loading, setLoading] = useState(false);
  const registeredWithoutEmail =
    new URLSearchParams(window.location.search).get("registered") === "1";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setUnverified(false);
    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        email,
        password,
      });
      queryClient.setQueryData(["/api/auth/user"], await response.json());
      navigate("/");
    } catch (caught) {
      const presentation = authErrorPresentation(
        caught,
        "Email or password is incorrect.",
      );
      if (presentation.message === UNVERIFIED_LOGIN_MESSAGE) {
        setUnverified(true);
      } else {
        setError(presentation.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back to TUTELA</CardTitle>
          <CardDescription>
            Sign in to access your organization, verified opportunities, and trading workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {registeredWithoutEmail && (
              <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
                Your account is ready. Sign in with the password you just created.
              </p>
            )}
            {unverified && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
                <p className="font-semibold">Email verification required</p>
                <p className="mt-1">Please verify your email address before signing in. Check your inbox for the verification message.</p>
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <p className="text-center text-sm">
              New to TUTELA? <Link href="/register" className="underline">Create an account</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
