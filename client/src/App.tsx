import { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/landing";
import Dashboard from "./pages/dashboard";
import Commodities from "./pages/commodities";
import Contracts from "./pages/contracts";
import Partners from "./pages/partners";
import Verification from "./pages/verification";

import Layout from "./components/layout"; 
// ملاحظة: يوجد index.tsx داخل مجلد layout، لذلك الاستيراد صحيح بهذا الشكل

import { useAuth } from "./common/authUtils";

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

          {/* Protected Routes */}
          <Route element={<Layout user={user} />}>

            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/commodities" element={<Commodities />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/verification" element={<Verification />} />

          </Route>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/commodities" element={<Commodities />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/verification" element={<Verification />} />

          {/* 404 */}
          <Route path="*" element={<div>Page not found</div>} />

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
