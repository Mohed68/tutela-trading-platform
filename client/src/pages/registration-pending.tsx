import { Link } from "wouter";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegistrationPending() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <MailCheck className="mx-auto h-12 w-12 text-emerald-700" />
          <CardTitle className="mt-4">Check your inbox</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-neutral-600">
            If this email is new to TUTELA, we’ve sent a verification link to
            complete your registration. If you already have an account, sign
            in or reset your password.
          </p>
          <Button asChild className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
