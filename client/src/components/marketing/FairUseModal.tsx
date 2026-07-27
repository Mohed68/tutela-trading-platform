import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface FairUseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FairUseModal({ isOpen, onClose }: FairUseModalProps) {
  const [, setLocation] = useLocation();

  if (!isOpen) return null;

  const handleStartVerification = () => {
    window.location.href = "/api/login";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div 
        className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900">Fair-Use Policy</h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mb-6">
          <ul className="space-y-2 text-sm text-neutral-700">
            <li>• 3 months free (Market Access) — auto-convert to paid</li>
            <li>• Reminders at T−30 / T−7 / T−1</li>
            <li className="font-medium">Fair-use caps during freemium:</li>
            <li className="ml-4">• Up to 10 offer views/day</li>
            <li className="ml-4">• Up to 2 concurrent negotiations</li>
            <li className="ml-4">• 1 basic contract template pack</li>
            <li>• Transaction fees still apply on executed deals during freemium</li>
          </ul>
        </div>
        
        <div className="flex gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
          >
            Close
          </Button>
          <Button
            onClick={handleStartVerification}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            Start Verification
          </Button>
        </div>
      </div>
    </div>
  );
}