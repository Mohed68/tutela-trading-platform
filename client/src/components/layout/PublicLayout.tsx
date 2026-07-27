import React from "react";
import { PublicHeader } from "@/components/navigation/PublicHeader";
import { PublicFooter } from "@/components/navigation/PublicFooter";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ paddingTop: '3rem' }}>
      <PublicHeader />
      <main className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}