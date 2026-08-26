import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { AnimatedButton } from "@/components/animations/AnimatedButton";
import { TypewriterText } from "@/components/animations/TypewriterText";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { FloatingIcons } from "@/components/animations/FloatingIcons";

export function Hero() {
  return (
    <section className="relative bg-gradient-to-b from-neutral-50 to-white py-20 lg:py-28 overflow-hidden">
      <FloatingIcons />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Column - Content */}
          <div className="order-2 lg:order-1">
            <ScrollReveal animation="fade-up">
              <h1 className="text-4xl lg:text-6xl font-bold text-neutral-900 leading-tight mb-6 tracking-tight">
                <span>Trade Strategic Commodities with </span>
                <span className="text-emerald-600 bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
                  Verified Counterparties
                </span>
              </h1>
            </ScrollReveal>
            
            <ScrollReveal animation="fade-up" delay={300}>
              <p className="text-lg lg:text-xl text-neutral-600 mb-8 leading-relaxed font-light">
                TUTELA filters fraud, gates access to qualified offers, and orchestrates 
                contracts, payments, and logistics—so deals close faster and safer.
              </p>
            </ScrollReveal>

            {/* CTA Buttons */}
            <ScrollReveal animation="fade-up" delay={600}>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <AnimatedButton 
                  size="lg" 
                  animation="sparkle"
                  className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-lg px-8 py-4 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
                  onClick={() => window.location.href = "/api/login"}
                >
                  Get Started
                  <ArrowRight className="ml-2 w-5 h-5" />
                </AnimatedButton>
                
                <AnimatedButton 
                  size="lg" 
                  variant="outline" 
                  animation="ripple"
                  className="text-lg px-8 py-4 border-neutral-300 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 transition-all duration-200 font-medium"
                  onClick={() => {
                    const event = new CustomEvent('openDemoModal');
                    window.dispatchEvent(event);
                  }}
                >
                  View Demo
                  <Play className="ml-2 w-5 h-5" />
                </AnimatedButton>
              </div>
            </ScrollReveal>

            {/* Book Demo Link */}
            <p className="text-neutral-500">
              Need a custom walkthrough?{" "}
              <a 
                href="/demo/request"
                className="text-emerald-600 hover:text-emerald-700 font-medium underline"
              >
                Book a demo
              </a>
            </p>
          </div>

          {/* Right Column - Product Mock */}
          <div className="order-1 lg:order-2 relative">
            <div className="bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-2xl p-8 shadow-2xl">
              {/* Mock Dashboard Interface */}
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-neutral-900">Trading Dashboard</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-sm text-emerald-600 font-medium">Verified</span>
                  </div>
                </div>
                
                {/* Mock Metrics */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-neutral-900">47</div>
                    <div className="text-sm text-neutral-600">Active Offers</div>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-neutral-900">$24.6M</div>
                    <div className="text-sm text-neutral-600">Volume</div>
                  </div>
                </div>

                {/* Mock Offer Card */}
                <div className="border border-neutral-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-neutral-900">WTI Crude Oil</h4>
                    <span className="text-emerald-600 text-sm font-medium">Verified Seller</span>
                  </div>
                  <div className="text-sm text-neutral-600 mb-3">
                    50,000 barrels • $78.45/barrel • FOB Houston
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-emerald-50 text-emerald-700 text-xs px-2 py-1 rounded">
                      Payment Secured
                    </div>
                    <div className="flex-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded">
                      Contract Ready
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 bg-emerald-100 text-emerald-700 text-xs px-3 py-2 rounded-full font-medium">
              AI Verified ✓
            </div>
            <div className="absolute -bottom-4 -left-4 bg-blue-100 text-blue-700 text-xs px-3 py-2 rounded-full font-medium">
              Escrow Active
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
