import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { canonicalizeUnit, getUnitLabel, type CanonUnit } from "@shared/units";
import clsx from "clsx";

interface Commodity {
  key: string;
  label: string;
  units: string[];
}

interface OptionsResponse {
  commodities: Commodity[];
}

interface MarketplaceFiltersProps {
  category: string;
  commodityKey: string;
  unit: string;
  isOpen: boolean;
  onFilterChange: (filters: { category?: string; commodityKey?: string; unit?: string }) => void;
  onToggle: () => void;
}

export function MarketplaceFilters({ 
  category, 
  commodityKey, 
  unit, 
  isOpen,
  onFilterChange,
  onToggle
}: MarketplaceFiltersProps) {
  const [selectedCommodity, setSelectedCommodity] = useState<Commodity | null>(null);

  // Fetch commodity options when category changes
  const { data: options, isLoading } = useQuery<OptionsResponse>({
    queryKey: ['/api/offers/options', category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category && category !== 'all') {
        params.set('category', category);
      }
      
      const response = await fetch(`/api/offers/options?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch commodity options');
      }
      return response.json();
    },
    enabled: category !== 'all',
  });

  // Update selected commodity when commodityKey changes and canonicalize units
  useEffect(() => {
    if (options && commodityKey) {
      const commodity = options.commodities.find(c => c.key === commodityKey);
      if (commodity) {
        // Canonicalize units
        const canonicalUnits = Array.from(new Set(
          commodity.units
            .map(u => canonicalizeUnit(u))
            .filter((u): u is CanonUnit => u !== null)
        ));
        setSelectedCommodity({
          ...commodity,
          units: canonicalUnits
        });
      } else {
        setSelectedCommodity(null);
      }
    } else {
      setSelectedCommodity(null);
    }
  }, [options, commodityKey]);

  // Auto-select unit if only one available
  useEffect(() => {
    if (selectedCommodity && selectedCommodity.units.length === 1 && !unit) {
      onFilterChange({ unit: selectedCommodity.units[0] });
    }
  }, [selectedCommodity, unit, onFilterChange]);

  const handleCommodityChange = (value: string) => {
    const commodity = options?.commodities.find(c => c.key === value);
    setSelectedCommodity(commodity || null);
    
    // Clear unit when commodity changes
    onFilterChange({ 
      commodityKey: value,
      unit: commodity && commodity.units.length === 1 ? commodity.units[0] : undefined
    });
  };

  const handleUnitChange = (value: string) => {
    onFilterChange({ unit: value });
  };

  const handleReset = () => {
    setSelectedCommodity(null);
    onFilterChange({ commodityKey: undefined, unit: undefined });
  };

  const commodityDisabled = category === 'all' || isLoading;
  const unitDisabled = !selectedCommodity || selectedCommodity.units.length <= 1;
  const hasFilters = commodityKey || unit;

  return (
    <div className="space-y-4">
      {/* Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="flex items-center gap-2 text-sm"
      >
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        More filters
        {hasFilters && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
            {[commodityKey && 'commodity', unit && 'unit'].filter(Boolean).length}
          </span>
        )}
      </Button>

      {/* Collapsible Filter Panel */}
      <div className={clsx(
        "overflow-hidden transition-all duration-200",
        isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="flex items-end gap-4 p-4 bg-gray-50 rounded-lg border">
          {/* Commodity Selector */}
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Commodity</label>
            <Select 
              value={commodityKey || ""} 
              onValueChange={handleCommodityChange}
              disabled={commodityDisabled}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder={commodityDisabled ? "Select category first" : "All commodities"} />
              </SelectTrigger>
              <SelectContent>
                {options?.commodities.map((commodity) => (
                  <SelectItem key={commodity.key} value={commodity.key}>
                    {commodity.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unit Selector */}
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Unit</label>
            <Select 
              value={unit || ""} 
              onValueChange={handleUnitChange}
              disabled={unitDisabled}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder={unitDisabled ? "Auto" : "Select unit"} />
              </SelectTrigger>
              <SelectContent>
                {selectedCommodity?.units.map((unitOption) => (
                  <SelectItem key={unitOption} value={unitOption}>
                    {getUnitLabel(unitOption as CanonUnit)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reset Button */}
          {hasFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              <X className="w-3 h-3 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}