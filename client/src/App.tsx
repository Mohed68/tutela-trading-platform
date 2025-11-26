// client/src/App.tsx
import React from "react";
import { Switch, Route, Redirect } from "wouter";
import Landing from "./pages/landing";
import DashboardPage from "./pages/dashboard";
import CommoditiesPage from "./pages/commodities";
import ContractsPage from "./pages/contracts";
import PartnersPage from "./pages/partners";
import VerificationPage from "./pages/verification";
import NotFoundPage from "./pages/not-found";
import { useAuth } from "./hooks/useAuth";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // أثناء فحص حالة المستخدم
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Switch>
      {/* صفحة الهبوط متاحة للجميع */}
      <Route path="/" component={Landing} />

      {/* الصفحات المحمية */}
      <Route path="/dashboard">
        {isAuthenticated ? <DashboardPage /> : <Redirect to="/" />}
      </Route>

      <Route path="/commodities">
        {isAuthenticated ? <CommoditiesPage /> : <Redirect to="/" />}
      </Route>

      <Route path="/contracts">
        {isAuthenticated ? <ContractsPage /> : <Redirect to="/" />}
      </Route>

      <Route path="/partners">
        {isAuthenticated ? <PartnersPage /> : <Redirect to="/" />}
      </Route>

      <Route path="/verification">
        {isAuthenticated ? <VerificationPage /> : <Redirect to="/" />}
      </Route>

      {/* 404 */}
      <Route component={NotFoundPage} />
    </Switch>
  );
}

export default function App() {
  return <Router />;
}
