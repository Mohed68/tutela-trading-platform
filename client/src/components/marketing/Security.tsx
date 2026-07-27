import React from "react";
import { Shield, Lock, Eye, FileCheck } from "lucide-react";

export function Security() {
  const features = [
    {
      icon: Shield,
      title: "Fraud Protection",
      description: "Reduce financial losses from fraud by up to 95% with our verified trading environment."
    },
    {
      icon: Lock,
      title: "Verified Partners Only",
      description: "Trade only with pre-screened, financially vetted partners to minimize risk."
    },
    {
      icon: Eye,
      title: "Complete Trade Transparency", 
      description: "Full visibility into trade history and partner performance for better decisions."
    },
    {
      icon: FileCheck,
      title: "Faster Deal Closure",
      description: "Streamlined documentation and verification cuts deal time by 2-3 weeks."
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div>
            <h2 className="text-3xl lg:text-4xl font-bold text-neutral-900 mb-6 tracking-tight">
              Trade Protection & Risk Reduction
            </h2>
            <p className="text-lg text-neutral-600 mb-8 leading-relaxed font-light">
              Minimize financial losses and maximize successful trades. 
              Our verified partner network and fraud protection systems 
              safeguard your deals from start to finish.
            </p>

            <div className="space-y-6">
              {features.map((feature, index) => (
                <div key={index} className="flex gap-4 group hover:bg-neutral-50 p-3 -m-3 rounded-lg transition-all duration-200">
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-lg flex-shrink-0 group-hover:from-emerald-200 group-hover:to-emerald-300 transition-all duration-200">
                    <feature.icon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900 mb-2 text-lg">
                      {feature.title}
                    </h3>
                    <p className="text-neutral-600">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-neutral-50 rounded-lg">
              <p className="text-sm text-neutral-600">
                <strong>Results:</strong> Our traders report 40% fewer failed deals and 25% faster transaction times. 
                Enterprise volume discounts and premium partner access available for qualifying traders.
              </p>
            </div>
          </div>

          {/* Visual */}
          <div className="relative">
            <div className="bg-gradient-to-br from-emerald-100 to-blue-100 rounded-2xl p-8">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <Shield className="w-6 h-6 text-emerald-600" />
                  <span className="font-semibold text-neutral-900">Trading Performance</span>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                    <span className="text-sm font-medium">Fraud Prevention</span>
                    <span className="text-emerald-600 text-sm font-semibold">95% Effective</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                    <span className="text-sm font-medium">Partner Verification</span>
                    <span className="text-emerald-600 text-sm font-semibold">100% Screened</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                    <span className="text-sm font-medium">Deal Success Rate</span>
                    <span className="text-emerald-600 text-sm font-semibold">92% Higher</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                    <span className="text-sm font-medium">Time to Settlement</span>
                    <span className="text-emerald-600 text-sm font-semibold">60% Faster</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}