import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  authErrorPresentation,
  type AuthErrorPresentation,
} from "@/lib/authApiError";
import {
  BUSINESS_EMAIL_REJECTION,
  usesBlockedPublicEmailDomain,
} from "@shared/businessEmail";

export default function Register() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<AuthErrorPresentation>();
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: event.target.value });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (usesBlockedPublicEmailDomain(form.email)) {
      setError(BUSINESS_EMAIL_REJECTION);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError({ message: "Passwords do not match." });
      return;
    }
    if (form.password.length < 12) {
      setError({ message: "Password must contain at least 12 characters." });
      return;
    }
    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/register", {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
      });
      const result = (await response.json()) as { activation?: string };
      queryClient.setQueryData(["/api/auth/user"], null);
      navigate(
        result.activation === "direct"
          ? "/login?registered=1"
          : "/registration-pending",
      );
    } catch (caught) {
      setError(authErrorPresentation(caught, "Registration failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Create your TUTELA account</CardTitle>
          <CardDescription>
            Register with your official company email to begin your organization setup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" value={form.firstName} onChange={set("firstName")} required />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={form.lastName} onChange={set("lastName")} required />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Company email</Label>
              <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
              <p className="mt-1 text-xs text-neutral-500">Public email services are not accepted for B2B registration.</p>
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} required />
            </div>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
                {error.title && <p className="font-semibold">{error.title}</p>}
                <p className={error.title ? "mt-1" : undefined}>{error.message}</p>
                {error.supportText && <p className="mt-2 text-red-800">{error.supportText}</p>}
              </div>
            )}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
            <p className="text-center text-sm">
              Already registered? <Link href="/login" className="underline">Sign in</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
