import { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/landing";
import Dashboard from "./pages/dashboard";
import Contracts from "./pages/contracts";
import Partners from "./pages/partners";
import Verification from "./pages/verification";
import NotFound from "./pages/not-found";
import OffersRedirect from "./pages/offers";
import CommoditiesRedirect from "./pages/commodities";
import { ROUTES } from "./config/routes";
import Marketplace from "./pages/marketplace";

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading page...</div>}>
        <Routes>

          {/* Public Landing */}
          <Route path={ROUTES.landing} element={<LandingPage />} />

          {/* Protected Routes */}
          <Route path={ROUTES.dashboard} element={<Dashboard />} />
          <Route path={ROUTES.commodities} element={<Marketplace />} />
          <Route path={ROUTES.contracts} element={<Contracts />} />
          <Route path={ROUTES.partners} element={<Partners />} />
          <Route path={ROUTES.verification} element={<Verification />} />

           {/* Legacy aliases */}
          <Route path={ROUTES.marketplace} element={<CommoditiesRedirect />} />

           {/* Redirected legacy routes */}
          <Route path={ROUTES.offers} element={<OffersRedirect />} />
          <Route path={ROUTES.notFound} element={<NotFound />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
