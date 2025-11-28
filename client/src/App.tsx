import { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/landing";
import Dashboard from "./pages/dashboard";
import Commodities from "./pages/commodities";
import Marketplace from "./pages/marketplace";
import Contracts from "./pages/contracts";
import Partners from "./pages/partners";
import Verification from "./pages/verification";

import Layout from "./components/layout"; 
// ملاحظة: يوجد index.tsx داخل مجلد layout، لذلك الاستيراد صحيح بهذا الشكل

import { useAuth } from "./common/authUtils";
import NotFound from "./pages/not-found";
import OffersRedirect from "./pages/offers";
import CommoditiesRedirect from "./pages/commodities";
import { ROUTES } from "./config/routes";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="w-full h-screen flex items-center justify-center text-xl">
      Loading...
    </div>;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading page...</div>}>
        <Routes>

          {/* Public Landing */}
          <Route path="/" element={<LandingPage />} />
          <Route path={ROUTES.landing} element={<LandingPage />} />

          {/* Protected Routes */}
          <Route element={<Layout user={user} />}>

            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/commodities" element={<Commodities />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/verification" element={<Verification />} />
          <Route path={ROUTES.dashboard} element={<Dashboard />} />
          <Route path={ROUTES.marketplace} element={<Marketplace />} />
          <Route path={ROUTES.contracts} element={<Contracts />} />
          <Route path={ROUTES.partners} element={<Partners />} />
          <Route path={ROUTES.verification} element={<Verification />} />

          </Route>
          {/* Redirected legacy routes */}
          <Route path={ROUTES.offers} element={<OffersRedirect />} />
          <Route path={ROUTES.commodities} element={<CommoditiesRedirect />} />

          {/* 404 */}
          <Route path="*" element={<div>Page not found</div>} />
          <Route path="*" element={<NotFound />} />

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
