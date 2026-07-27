import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", { email, password });
      queryClient.setQueryData(["/api/auth/user"], await response.json());
      navigate("/");
    } catch (e) { setError(e instanceof Error ? e.message.replace(/^\d+:\s*/, "") : "Login failed."); } finally { setLoading(false); }
  }
  return <div className="min-h-[70vh] flex items-center justify-center px-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>Sign in to TUTELA</CardTitle><CardDescription>Use your business account credentials.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div><div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>{error && <p className="text-sm text-destructive" role="alert">{error}</p>}<Button className="w-full" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button><p className="text-sm text-center">No account? <Link href="/register" className="underline">Create one</Link></p></form></CardContent></Card></div>;
}
