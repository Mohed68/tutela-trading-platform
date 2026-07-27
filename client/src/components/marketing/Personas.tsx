import React from "react";
import { TrendingUp, TrendingDown, Building } from "lucide-react";

export function Personas() {
  const personas = [
    {
      icon: TrendingUp,
      title: "Buyers/Importers",
      subtitle: "Source with Confidence",
      description: "Qualified offers, clearer risk, faster settlement.",
      benefits: [
        "Pre-verified seller credentials",
        "Transparent pricing with escrow protection", 
        "Streamlined contract execution",
        "Integrated logistics coordination"
      ]
    },
    {
      icon: TrendingDown,
      title: "Sellers/Producers", 
      subtitle: "Trade with Trust",
      description: "Credible counterparties, secure payment flows.",
      benefits: [
        "Qualified buyer verification",
        "Guaranteed payment through smart contracts",
        "Reduced settlement risk",
        "Professional marketplace presence"
      ]
    },
    {
      icon: Building,
      title: "Banks & Logistics",
      subtitle: "Enhanced Deal Flow",
      description: "Pre-qualified deal flow with shared context.",
      benefits: [
        "Verified counterparty information",
        "Standardized documentation",
        "Automated compliance checks",
        "Integrated service delivery"
      ]
    }
  ];

  return (
    <section className="py-20 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-neutral-900 mb-4">
            Built for Every Participant
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            Whether you're buying, selling, or facilitating trades, 
            Tutela provides the tools and security you need.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {personas.map((persona, index) => (
            <div 
              key={index}
              className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow duration-300"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-6">
                <persona.icon className="w-6 h-6 text-blue-600" />
              </div>
              
              <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                {persona.title}
              </h3>
              <div className="text-sm text-blue-600 font-medium mb-3">
                {persona.subtitle}
              </div>
              <p className="text-neutral-600 mb-6 text-lg font-medium">
                "{persona.description}"
              </p>

              <ul className="space-y-3">
                {persona.benefits.map((benefit, benefitIndex) => (
                  <li key={benefitIndex} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm text-neutral-600">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}