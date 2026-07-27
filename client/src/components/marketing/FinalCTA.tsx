import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="py-20 bg-gradient-to-r from-emerald-600 to-emerald-700">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
          Ready to Trade with Verified Counterparties?
        </h2>
        <p className="text-lg text-emerald-100 mb-8 leading-relaxed">
          Join the secure marketplace for strategic commodity trading. 
          Get verified access to qualified offers and start trading with confidence.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            className="bg-white text-emerald-600 hover:bg-neutral-100 text-lg px-8 py-4"
            onClick={() => window.location.href = "/api/login"}
          >
            Sign In to Get Started
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          
          <Button 
            size="lg" 
            variant="outline" 
            className="border-white text-white hover:bg-white hover:text-emerald-600 text-lg px-8 py-4"
            onClick={() => {
              const event = new CustomEvent('openDemoModal');
              window.dispatchEvent(event);
            }}
          >
            View Demo
            <Play className="ml-2 w-5 h-5" />
          </Button>
        </div>

        <p className="text-emerald-100 text-sm mt-6">
          Questions? <a href="mailto:support@tutela.com" className="underline font-medium">Contact our team</a>
        </p>
      </div>
    </section>
  );
}