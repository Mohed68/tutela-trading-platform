import React from "react";
import {
  Droplet,  // crude oil
  Factory,  // diesel/gasoline/refined
  Flame,    // gas/LPG/LNG
  Gem,      // gold
  Coins,    // silver
  Wheat,    // wheat
  Leaf,     // soybeans/fertilizers
  Coffee,   // coffee
  FlaskConical, // petrochem
  Package   // sugar (bag)
} from "lucide-react";
import { resolveCommodityKey } from "@/lib/commodity-key";

const MAP: Record<string, {C: any; label: string; className?: string}> = {
  crude_oil:      { C: Droplet,      label: "Crude Oil",      className: "text-sky-700" },
  diesel:         { C: Factory,      label: "Diesel",         className: "text-slate-700" },
  gasoline:       { C: Factory,      label: "Gasoline",       className: "text-slate-700" },
  jet_a1:         { C: Factory,      label: "Jet A-1",        className: "text-slate-700" },
  lpg:            { C: Flame,        label: "LPG",            className: "text-orange-600" },
  lng:            { C: Flame,        label: "LNG",            className: "text-orange-600" },
  natural_gas:    { C: Flame,        label: "Natural Gas",    className: "text-orange-600" },
  gold_bullion:   { C: Gem,          label: "Gold",           className: "text-amber-600" },
  silver_bullion: { C: Coins,        label: "Silver",         className: "text-zinc-600" },
  wheat:          { C: Wheat,        label: "Wheat",          className: "text-green-700" },
  soybeans:       { C: Leaf,         label: "Soybeans",       className: "text-green-700" },
  coffee:         { C: Coffee,       label: "Coffee",         className: "text-stone-700" },
  sugar:          { C: Package,      label: "Sugar",          className: "text-stone-600" },
  petrochem:      { C: FlaskConical, label: "Petrochemicals", className: "text-indigo-700" },
  fertilizers:    { C: Leaf,         label: "Fertilizers",    className: "text-green-700" },
  default:        { C: Factory,      label: "Commodity",      className: "text-muted-foreground" }
};

export function CommodityIcon({ name, category, className }:{
  name: string; category?: string; className?: string;
}) {
  const key = resolveCommodityKey(name, category);
  const { C, label, className: tint } = MAP[key] ?? MAP.default;
  return <C role="img" aria-label={label} className={`h-5 w-5 shrink-0 ${tint} ${className||""}`} />;
}

// Legacy compatibility component for existing imports
interface CommodityIconProps {
  offer: any;
  className?: string;
}

export default function CommodityIconLegacy({ offer, className = "w-5 h-5" }: CommodityIconProps) {
  const commodityName = offer?.commodity?.name || offer?.commodityName || offer?.title || "";
  const commodityCategory = offer?.commodity?.category || offer?.category || "";
  
  return <CommodityIcon name={commodityName} category={commodityCategory} className={className} />;
}