import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";

const Landing: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const goToLogin = () => {
    window.location.href = "/api/login";
  };

  const handleSignIn = () => {
    if (isAuthenticated) navigate("/dashboard");
    else goToLogin();
  };

  const handleStartTrading = () => {
    if (isAuthenticated) navigate("/dashboard");
    else goToLogin();
  };

  const handleBrowseMarketplace = () => {
    if (isAuthenticated) navigate("/commodities");
    else goToLogin();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B1220] via-[#020617] to-[#02040A] text-white">

      {/* HEADER */}
      <header className="flex items-center justify-between px-8 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="TUTELA" className="h-10 w-10" />
          <span className="text-xl font-bold">TUTELA</span>
        </div>

        <Button
          onClick={handleSignIn}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6"
        >
          {isAuthenticated ? "Open Dashboard" : "Sign In"}
        </Button>
      </header>

      {/* HERO SECTION */}
      <section className="flex flex-col items-center text-center px-6 py-28">
        <h1 className="max-w-3xl text-4xl md:text-6xl font-bold leading-tight text-white">
          Secure Physical Commodity Trading  
          <span className="text-blue-400"> with AI & Blockchain</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-gray-300">
          TUTELA simplifies global commodity trading with verified suppliers,
          blockchain-backed contracts, and AI-powered validation.
        </p>

        <div className="mt-10 flex flex-col md:flex-row gap-6">
          <Button
            onClick={handleStartTrading}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6"
          >
            Start Trading <ChevronRight className="ml-2 h-5 w-5" />
          </Button>

          <Button
            onClick={handleBrowseMarketplace}
            variant="outline"
            size="lg"
            className="text-white border-white hover:bg-white/10 px-8 py-6"
          >
            Browse Marketplace <TrendingUp className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Landing;
