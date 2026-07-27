import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp } from "lucide-react";
import { fmtMoney } from "@/lib/formatting";
import { getUnitLabel, type CanonUnit } from "@shared/units";
import clsx from "clsx";

interface VWAPTileProps {
  avgPrice: number;
  avgPriceUnit: string;
  avgPriceCount: number;
  avgPriceCoverage?: { used: number; skipped: number };
  median?: number | null;
  p25?: number | null;
  p75?: number | null;
  variant?: 'hero' | 'compact';
}

export function VWAPTile({ 
  avgPrice, 
  avgPriceUnit, 
  avgPriceCount, 
  avgPriceCoverage,
  median, 
  p25, 
  p75,
  variant = 'compact'
}: VWAPTileProps) {
  const hasConversion = avgPriceCoverage && avgPriceCoverage.skipped > 0;
  
  const tooltipContent = [
    `VWAP over ${avgPriceCount} offer${avgPriceCount !== 1 ? 's' : ''}`,
    hasConversion ? `Converted to ${getUnitLabel(avgPriceUnit as CanonUnit)}` : null,
    avgPriceCoverage ? `Coverage: ${avgPriceCoverage.used} used, ${avgPriceCoverage.skipped} skipped` : null,
    median !== null && median !== undefined ? `median: ${fmtMoney(median)}` : null,
    p25 !== null && p75 !== null && p25 !== undefined && p75 !== undefined ? 
      `P25–P75: ${fmtMoney(p25)}–${fmtMoney(p75)}` : null
  ].filter(Boolean).join(' • ');

  // Show insufficient sample for single offer
  const insufficientSample = avgPriceCount === 1;

  return (
    <TooltipProvider>
      <Card className={clsx(
        "bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200",
        insufficientSample && "opacity-60",
        variant === 'hero' ? 'col-span-full' : ''
      )}>
        <CardContent className={clsx("p-6", variant === 'hero' ? 'py-8' : 'py-4')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-center cursor-help">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className={clsx(
                    "text-purple-600 mr-2",
                    variant === 'hero' ? 'w-6 h-6' : 'w-4 h-4'
                  )} />
                  <span className={clsx(
                    "text-gray-600",
                    variant === 'hero' ? 'text-sm' : 'text-xs'
                  )}>VWAP</span>
                  {hasConversion && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                      ⓘ Converted
                    </span>
                  )}
                </div>
                
                {insufficientSample ? (
                  <div className="text-center">
                    <div className={clsx(
                      "font-bold text-gray-500 mb-1",
                      variant === 'hero' ? 'text-2xl' : 'text-lg'
                    )}>
                      Insufficient sample
                    </div>
                    <div className="text-xs text-gray-400">
                      1 offer
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={clsx(
                      "font-bold text-purple-700 mb-1",
                      variant === 'hero' ? 'text-3xl' : 'text-lg'
                    )}>
                      {fmtMoney(avgPrice)} / {getUnitLabel(avgPriceUnit as CanonUnit)}
                    </div>
                    <div className="text-xs text-gray-500">
                      from {avgPriceCount} offer{avgPriceCount !== 1 ? 's' : ''}
                    </div>
                  </>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm">
                {insufficientSample 
                  ? 'Need at least 2 offers for meaningful VWAP calculation' 
                  : tooltipContent}
              </p>
            </TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}