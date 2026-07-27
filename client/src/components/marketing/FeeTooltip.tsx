import React, { useState } from "react";
import { Info } from "lucide-react";

interface FeeTooltipProps {
  percentage: string;
  minimum: string;
}

export function FeeTooltip({ percentage, minimum }: FeeTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className="text-neutral-400 hover:text-neutral-600 ml-1"
        aria-label="How fees work"
      >
        <Info className="w-4 h-4" />
      </button>
      
      {isOpen && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-80 bg-neutral-900 text-white text-xs rounded-lg p-3 shadow-lg z-10">
          <div className="font-medium mb-2">How fees work</div>
          <div className="space-y-1">
            <div>On a $1.2M deal: {percentage} × $1,200,000 = $1,680 → higher than {minimum} min → $1,680 applies.</div>
            <div>On a $350k deal: {percentage} × $350,000 = $490 → below {minimum} min → {minimum} applies.</div>
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-neutral-900"></div>
        </div>
      )}
    </div>
  );
}