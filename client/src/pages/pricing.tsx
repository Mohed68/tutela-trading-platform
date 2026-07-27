import React from "react";
import PricingSection from "@/components/marketing/PricingSection";
import { MetaTags, pageMetaConfigs } from "@/components/seo/MetaTags";

export default function Pricing() {
  return (
    <>
      <MetaTags {...pageMetaConfigs.pricing} />
      <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Pricing</h1>
          <p className="mt-2 text-neutral-600">
            Choose a plan that fits your desk. Switch to monthly anytime (+20%).
          </p>
        </header>
        <PricingSection />
      </div>
    </div>
    </>
  );
}