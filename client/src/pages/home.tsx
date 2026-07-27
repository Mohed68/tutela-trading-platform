import React from "react";
import { Hero } from "@/components/marketing/Hero";
import { TrustBar } from "@/components/marketing/TrustBar";
import { ValueGrid } from "@/components/marketing/ValueGrid";
import { Steps } from "@/components/marketing/Steps";
import { Personas } from "@/components/marketing/Personas";
import { Security } from "@/components/marketing/Security";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { DemoModal } from "@/components/marketing/DemoModal";
import { MetaTags, pageMetaConfigs } from "@/components/seo/MetaTags";

export default function Home() {
  const [isDemoModalOpen, setIsDemoModalOpen] = React.useState(false);

  // Listen for demo modal trigger from buttons
  React.useEffect(() => {
    const handleOpenDemoModal = () => setIsDemoModalOpen(true);
    window.addEventListener('openDemoModal', handleOpenDemoModal);
    return () => window.removeEventListener('openDemoModal', handleOpenDemoModal);
  }, []);

  // Check for demo trigger in URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'open') {
      setIsDemoModalOpen(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return (
    <>
      <MetaTags {...pageMetaConfigs.home} />
      <Hero />
      <TrustBar />
      <ValueGrid />
      <Steps />
      <Personas />
      <Security />
      <FinalCTA />
      
      <DemoModal 
        open={isDemoModalOpen} 
        onClose={() => setIsDemoModalOpen(false)} 
      />
    </>
  );
}