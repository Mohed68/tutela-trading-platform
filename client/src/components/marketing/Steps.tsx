import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { UserCheck, Shield, FileText, CreditCard, Ship } from "lucide-react";

export function Steps() {
  const steps = [
    {
      icon: UserCheck,
      title: "Register & KYB",
      description: "Complete business verification and get qualified access to the platform."
    },
    {
      icon: Shield,
      title: "Qualified Access",
      description: "Browse verified offers from pre-screened, legitimate counterparties."
    },
    {
      icon: FileText,
      title: "Negotiate & e-Contract",
      description: "Negotiate terms and execute smart contracts with built-in escrow protection."
    },
    {
      icon: CreditCard,
      title: "Payment Orchestration",
      description: "Secure multi-party payment flows with automated milestone releases."
    },
    {
      icon: Ship,
      title: "Shipment & Title Transfer",
      description: "Integrated logistics with automatic title transfer upon delivery confirmation."
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-neutral-900 mb-4">
            How It Works
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            From verification to delivery, every step is designed for security and efficiency.
          </p>
        </div>

        <div className="relative">
          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-neutral-200 z-0" 
                       style={{ transform: 'translateX(-50%)' }} />
                )}
                
                <div className="relative z-10 text-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-xl mx-auto mb-4">
                    <step.icon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-neutral-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <div className="bg-emerald-50 rounded-2xl p-8 inline-block">
              <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                Ready to get started?
              </h3>
              <p className="text-neutral-600 mb-6">
                Begin your verification process and access qualified commodity offers.
              </p>
              <Button 
                size="lg" 
                className="bg-emerald-600 hover:bg-emerald-700"
                asChild
              >
                <Link href="/verification">Start Verification</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}