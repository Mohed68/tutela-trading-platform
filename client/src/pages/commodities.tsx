import { useEffect } from "react";
import { useLocation } from "wouter";
import { ROUTES } from "@/config/routes";

/**
 * Commodities redirect page
 * Redirects /commodities to /marketplace?view=by-category
 */
export default function Commodities() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to marketplace with category view
    setLocation(`${ROUTES.marketplace}?view=by-category`, { replace: true });
  }, [setLocation]);

  // Show loading while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to marketplace...</p>
      </div>
    </div>
  );
}