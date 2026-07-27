import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, X } from "lucide-react";
import { isDemo, disableDemo, getDemoMode } from "@/lib/demo";
import { useLocation } from "wouter";

export function DemoBanner() {
  const [, setLocation] = useLocation();
  const demoMode = getDemoMode();
  const showBanner = isDemo();

  if (!showBanner) {
    return null;
  }

  const handleExitDemo = () => {
    disableDemo();
    // disableDemo() will handle the navigation
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Play className="w-5 h-5" />
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              Demo Mode
            </Badge>
          </div>
          
          <div className="hidden sm:block">
            <span className="text-sm font-medium">
              You're exploring Tutela with sample data
              {demoMode === "verified" && " as a verified user"}
              {demoMode === "pending" && " with pending verification"}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden md:block text-sm text-blue-100">
            All data is temporary and will be cleared when you exit demo mode
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExitDemo}
            className="bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            <X className="w-4 h-4 mr-1" />
            Exit Demo
          </Button>
        </div>
      </div>
    </div>
  );
}