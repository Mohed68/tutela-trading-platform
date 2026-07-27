import React from "react";
import { ShieldCheck, Building2, Truck, CreditCard } from "lucide-react";

export function TrustBar() {
  return (
    <section className="bg-gradient-to-r from-neutral-50 to-white border-y border-neutral-200 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
          {/* IP Registration */}
          <div className="flex items-center gap-3 text-neutral-700">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm font-semibold">
              IP Registered — UAE Ministry of Economy #1129-2024
            </span>
          </div>

          {/* Partner Logos Placeholder */}
          <div className="flex items-center gap-8 opacity-70">
            <div className="text-xs text-neutral-500 font-bold tracking-wide">TRUSTED PARTNERS</div>
            
            {/* Bank Partner */}
            <div className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 transition-colors duration-200">
              <Building2 className="w-6 h-6" />
              <span className="text-sm font-medium">Banking</span>
            </div>

            {/* Logistics Partner */}
            <div className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 transition-colors duration-200">
              <Truck className="w-6 h-6" />
              <span className="text-sm font-medium">Logistics</span>
            </div>

            {/* Payment Partner */}
            <div className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 transition-colors duration-200">
              <CreditCard className="w-6 h-6" />
              <span className="text-sm font-medium">Payments</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}