import React from "react";
import { useLocation } from "wouter";

function getSearchParam(url: string, param: string): string | null {
  const urlObj = new URL(url, window.location.origin);
  return urlObj.searchParams.get(param);
}

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  
  const currentUrl = window.location.href;
  const plan = getSearchParam(currentUrl, "plan");
  const term = getSearchParam(currentUrl, "term");
  
  const label = plan === "td" ? "Trading Desk"
              : plan === "cs" ? "Clearing Suite"
              : "Market Access";

  const termLabel = term === "monthly" ? "monthly" : "annual";

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-700 flex items-center justify-center text-4xl font-bold shadow-lg">
          ✓
        </div>
        
        <h1 className="text-4xl font-bold text-neutral-900 tracking-tight">Activation Complete!</h1>
        <p className="mt-4 text-xl text-neutral-600 font-light">
          Your <strong className="text-emerald-600">{label}</strong> plan has been activated ({termLabel} billing).
        </p>
        <p className="mt-3 text-neutral-500">
          You can start using your plan right away. Welcome to TUTELA!
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            className="w-full sm:w-auto rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 px-8 py-3 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            onClick={() => setLocation("/dashboard")}
          >
            Go to Dashboard
          </button>
          <button
            className="w-full sm:w-auto rounded-lg border border-neutral-300 hover:border-neutral-400 bg-white px-8 py-3 text-neutral-700 hover:bg-neutral-50 font-medium transition-all duration-200"
            onClick={() => setLocation("/settings?tab=billing")}
          >
            Manage Billing
          </button>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg text-left">
          <h3 className="text-sm font-semibold text-blue-900">Next Steps</h3>
          <ul className="mt-2 text-sm text-blue-800 space-y-1">
            <li>• Complete your KYB verification if not done</li>
            <li>• Explore the commodity marketplace</li>
            <li>• Set up your trading preferences</li>
            <li>• Invite team members to your workspace</li>
          </ul>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Need help? Contact our support team at{" "}
          <a href="mailto:support@tutela.trade" className="text-blue-600 hover:underline">
            support@tutela.trade
          </a>
        </div>
      </div>
    </main>
  );
}