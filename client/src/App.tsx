import React from "react";
import { Route, Switch } from "wouter";
import { Toaster } from "./components/ui/toaster";
import { useAuth } from "./hooks/useAuth";

import Landing from "./pages/landing";
import Dashboard from "./pages/dashboard";
import Commodities from "./pages/commodities";
import Contracts from "./pages/contracts";
import Partners from "./pages/partners";
import Verification from "./pages/verification";
import NotFound from "./pages/not-found";
import Layout from "./components/layout/Layout";

// بوابة بسيطة للتحكم في حالة الـ Auth (لودينغ / خطأ / غير مسجّل / مسجّل)
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, error } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto" />
          <p className="text-sm text-slate-400">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <div className="space-y-4 text-center max-w-md">
          <h1 className="text-xl font-semibold">Authentication Error</h1>
          <p className="text-sm text-slate-400">{error}</p>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  // لو ما في مستخدم => نظهر صفحة الهوم (Landing) كواجهة عامة
  if (!user) {
    return <Landing />;
  }

  // لو المستخدم مسجّل => نسمح بعرض بقية التطبيق داخل الـ Layout
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Toaster />
      <Switch>
        {/* مسار الهوم (عام) */}
        <Route path="/" component={Landing} />

        {/* المسارات المحمية */}
        <AuthGate>
          <Layout>
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/commodities" component={Commodities} />
            <Route path="/contracts" component={Contracts} />
            <Route path="/partners" component={Partners} />
            <Route path="/verification" component={Verification} />
          </Layout>
        </AuthGate>

        {/* 404 */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}
