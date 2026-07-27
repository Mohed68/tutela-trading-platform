import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DemoModal } from "@/components/marketing/DemoModal";
import { Play, ArrowRight } from "lucide-react";
import { MetaTags, pageMetaConfigs } from "@/components/seo/MetaTags";

export default function Demo() {
  const [, setLocation] = useLocation();
  const [isDemoModalOpen, setIsDemoModalOpen] = React.useState(true);

  const handleModalClose = () => {
    setIsDemoModalOpen(false);
    setLocation("/");
  };

  const handleStartInteractiveDemo = () => {
    setIsDemoModalOpen(true);
  };

  return (
    <>
      <MetaTags {...pageMetaConfigs.demo} />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-neutral-50 to-white py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-neutral-900 mb-6">
              Try Tutela Demo
            </h1>
            <p className="text-xl text-neutral-600 leading-relaxed mb-8">
              Experience the complete commodity trading platform with realistic sample data. 
              No registration required.
            </p>
            
            <Button 
              size="lg" 
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleStartInteractiveDemo}
            >
              <Play className="mr-2 w-5 h-5" />
              Start Interactive Demo
            </Button>
          </div>
        </section>

        {/* Demo Features */}
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-neutral-900 text-center mb-12">
              What You'll Experience
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-emerald-600 font-bold">1</span>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Verified Dashboard
                </h3>
                <p className="text-neutral-600">
                  See how the platform looks for verified users with access to qualified offers and trading tools.
                </p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-emerald-600 font-bold">2</span>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Browse Real Offers
                </h3>
                <p className="text-neutral-600">
                  Explore sample commodity offers with realistic pricing, specifications, and seller information.
                </p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-emerald-600 font-bold">3</span>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Contract Simulation
                </h3>
                <p className="text-neutral-600">
                  Experience the smart contract creation and payment escrow processes with sample transactions.
                </p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-emerald-600 font-bold">4</span>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Analytics Dashboard
                </h3>
                <p className="text-neutral-600">
                  View trading metrics, performance insights, and AI-powered market analysis features.
                </p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-emerald-600 font-bold">5</span>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Verification Process
                </h3>
                <p className="text-neutral-600">
                  See how the KYB verification process works and what verified status provides.
                </p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-emerald-600 font-bold">6</span>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Full Workflow
                </h3>
                <p className="text-neutral-600">
                  Experience the complete trading workflow from offer discovery to contract execution.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-emerald-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-neutral-900 mb-6">
              Ready to Start Trading for Real?
            </h2>
            <p className="text-lg text-neutral-600 mb-8">
              After exploring the demo, begin your verification process to access 
              the live marketplace with real offers and counterparties.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-emerald-600 hover:bg-emerald-700"
                asChild
              >
                <a href="/verification">
                  Start Real Verification
                  <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => setIsDemoModalOpen(true)}
              >
                <Play className="mr-2 w-5 h-5" />
                Try Demo Again
              </Button>
            </div>
          </div>
        </section>
      
        <DemoModal 
          open={isDemoModalOpen} 
          onClose={handleModalClose} 
        />
      </div>
    </>
  );
}