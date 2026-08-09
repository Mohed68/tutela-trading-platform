import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Register() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    if (form.password.length < 12) return setError("Password must contain at least 12 characters.");
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/register", { firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password });
      queryClient.setQueryData(["/api/auth/user"], null); navigate("/registration-pending");
    } catch (e) { setError(e instanceof Error ? e.message.replace(/^\d+:\s*/, "") : "Registration failed."); } finally { setLoading(false); }
  }
  return <div className="min-h-[70vh] flex items-center justify-center px-4"><Card className="w-full max-w-lg"><CardHeader><CardTitle>Create your TUTELA account</CardTitle><CardDescription>Start with a secure local business account.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><Label htmlFor="firstName">First name</Label><Input id="firstName" value={form.firstName} onChange={set("firstName")} required /></div><div><Label htmlFor="lastName">Last name</Label><Input id="lastName" value={form.lastName} onChange={set("lastName")} required /></div></div><div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} required /></div><div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required /></div><div><Label htmlFor="confirmPassword">Confirm password</Label><Input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} required /></div>{error && <p className="text-sm text-destructive" role="alert">{error}</p>}<Button className="w-full" type="submit" disabled={loading}>{loading ? "Creating account..." : "Create account"}</Button><p className="text-sm text-center">Already registered? <Link href="/login" className="underline">Sign in</Link></p></form></CardContent></Card></div>;
}
