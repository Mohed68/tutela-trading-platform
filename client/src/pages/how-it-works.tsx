import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Steps } from "@/components/marketing/Steps";
import { ArrowRight, CheckCircle } from "lucide-react";
import { MetaTags, pageMetaConfigs } from "@/components/seo/MetaTags";

export default function HowItWorks() {
  const details = [
    {
      step: "1",
      title: "Register & Complete KYB",
      description: "Create your account and complete our comprehensive Know Your Business verification process.",
      features: [
        "Business registration verification",
        "Owner/director identity checks", 
        "Address and banking confirmation",
        "AI-powered document review"
      ]
    },
    {
      step: "2", 
      title: "Access Qualified Marketplace",
      description: "Once verified, browse offers from other pre-screened, legitimate counterparties.",
      features: [
        "Verified seller credentials displayed",
        "Transparent pricing and terms",
        "Real-time availability updates",
        "Advanced filtering and search"
      ]
    },
    {
      step: "3",
      title: "Negotiate & Execute Smart Contracts", 
      description: "Negotiate terms and execute binding smart contracts with built-in escrow protection.",
      features: [
        "Secure negotiation interface",
        "Automated contract generation",
        "Multi-party escrow setup",
        "Legal compliance validation"
      ]
    },
    {
      step: "4",
      title: "Orchestrated Payment Flows",
      description: "Secure multi-party payment processing with automated milestone-based releases.",
      features: [
        "Escrow account management",
        "Milestone-based releases",
        "Multi-currency support",
        "Real-time payment tracking"
      ]
    },
    {
      step: "5",
      title: "Integrated Logistics & Delivery",
      description: "Coordinate shipping and logistics with automatic title transfer upon delivery confirmation.",
      features: [
        "Logistics partner integration",
        "Real-time shipment tracking",
        "Automated title transfer",
        "Delivery confirmation system"
      ]
    }
  ];

  return (
    <>
      <MetaTags {...pageMetaConfigs.howItWorks} />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-neutral-50 to-white py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-neutral-900 mb-6">
              How Tutela Works
            </h1>
            <p className="text-xl text-neutral-600 leading-relaxed">
              From verification to delivery, every step is designed for security, 
              efficiency, and trust in commodity trading.
            </p>
          </div>
        </section>

        {/* Detailed Steps */}
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-20">
              {details.map((detail, index) => (
                <div 
                  key={index}
                  className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
                    index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''
                  }`}
                >
                  {/* Content */}
                  <div className={index % 2 === 1 ? 'lg:col-start-2' : ''}>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold text-lg">
                        {detail.step}
                      </div>
                      <h2 className="text-2xl lg:text-3xl font-bold text-neutral-900">
                        {detail.title}
                      </h2>
                    </div>
                    
                    <p className="text-lg text-neutral-600 mb-8">
                      {detail.description}
                    </p>

                    <ul className="space-y-3">
                      {detail.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span className="text-neutral-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Visual */}
                  <div className={index % 2 === 1 ? 'lg:col-start-1' : ''}>
                    <div className="bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-2xl p-8 h-80 flex items-center justify-center">
                      <div className="text-center text-neutral-500">
                        <div className="w-16 h-16 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                          <span className="text-emerald-600 font-bold text-2xl">{detail.step}</span>
                        </div>
                        <p className="font-medium">Step {detail.step} Visualization</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Process Overview */}
        <Steps />

        {/* CTA Section */}
        <section className="py-20 bg-emerald-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-neutral-900 mb-6">
              Ready to Experience Secure Trading?
            </h2>
            <p className="text-lg text-neutral-600 mb-8">
              Join the verified marketplace and start trading commodities with confidence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-emerald-600 hover:bg-emerald-700"
                asChild
              >
                <Link href="/verification">
                  Start Verification
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => {
                  const event = new CustomEvent('openDemoModal');
                  window.dispatchEvent(event);
                }}
              >
                Try Demo First
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}