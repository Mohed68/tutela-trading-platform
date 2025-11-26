import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";

// Pages
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Commodities from "@/pages/commodities";
import Contracts from "@/pages/contracts";
import Partners from "@/pages/partners";
import Verification from "@/pages/verification";
import NotFound from "@/pages/not-found";

// Protected wrapper
function ProtectedRoute({ component: Component }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  // If NOT authenticated → redirect to Landing
  if (!isAuthenticated) return <Redirect to="/" />;

  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Landing always visible */}
      <Route path="/" component={Landing} />

      {/* App routes */}
      <Route path="/app" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/app/commodities" component={() => <ProtectedRoute component={Commodities} />} />
      <Route path="/app/contracts" component={() => <ProtectedRoute component={Contracts} />} />
      <Route path="/app/partners" component={() => <ProtectedRoute component={Partners} />} />
      <Route path="/app/verification" component={() => <ProtectedRoute component={Verification} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
