import React from "react";
import { ShieldCheck, FileText, Banknote, Ship, ScanEye } from "lucide-react";
import { AnimatedCard } from "@/components/animations/AnimatedCard";
import { ScrollReveal } from "@/components/animations/ScrollReveal";

export function ValueGrid() {
  const values = [
    {
      icon: ShieldCheck,
      title: "Fraud Guard",
      description: "Gated access to qualified offers only."
    },
    {
      icon: FileText,
      title: "Spot & Futures e-Contracts",
      description: "Spot & futures e-contracts in one place."
    },
    {
      icon: Banknote,
      title: "Payment Orchestration", 
      description: "Payment orchestration with multi-party control."
    },
    {
      icon: ScanEye,
      title: "AI Review & Risk Signals",
      description: "AI document review & risk signals."
    },
    {
      icon: Ship,
      title: "Integrated Logistics",
      description: "Plug-in logistics and ship under the same contract."
    }
  ];

  return (
    <section id="product" className="py-20 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-neutral-900 mb-6 tracking-tight">
            Everything You Need to Trade Safely
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto font-light leading-relaxed">
            Complete platform for commodity trading with built-in verification, 
            contract management, and integrated payment flows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {values.map((value, index) => (
            <ScrollReveal 
              key={index}
              animation="fade-up"
              delay={index * 150}
            >
              <AnimatedCard 
                animation="hover-lift"
                className="bg-white rounded-2xl p-8 shadow-lg group"
              >
                <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-xl mb-6 group-hover:from-emerald-200 group-hover:to-emerald-300 transition-all duration-300">
                  <value.icon className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  {value.title}
                </h3>
                <p className="text-neutral-600 leading-relaxed">
                  {value.description}
                </p>
              </AnimatedCard>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}