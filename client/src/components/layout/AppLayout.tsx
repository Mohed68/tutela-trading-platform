import React from "react";
import { AppHeader } from "@/components/navigation/AppHeader";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { DemoBanner } from "@/components/navigation/DemoBanner";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { isDemo } from "@/lib/demo";

interface AppLayoutProps {
  children: React.ReactNode;
  showBreadcrumbs?: boolean;
}

export function AppLayout({ children, showBreadcrumbs = true }: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const demoMode = isDemo();

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Demo Banner */}
      {demoMode && <DemoBanner />}
      
      {/* App Header */}
      <AppHeader 
        onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        isMenuOpen={isSidebarOpen}
      />
      
      {/* Sidebar */}
      <AppSidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      {/* Main Content */}
      <main className="lg:pl-64 pt-16" style={{ paddingTop: '4rem' }}>
        <div className="px-4 sm:px-6 lg:px-8 py-6" style={{ paddingTop: '1rem' }}>
          {showBreadcrumbs && <Breadcrumbs />}
          {children}
        </div>
      </main>
    </div>
  );
}