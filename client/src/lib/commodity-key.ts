export type CommodityKey =
  | "crude_oil" | "diesel" | "gasoline" | "jet_a1"
  | "lpg" | "lng" | "natural_gas"
  | "gold_bullion" | "silver_bullion"
  | "wheat" | "soybeans" | "coffee" | "sugar"
  | "petrochem" | "fertilizers"
  | "default";

const KW: Record<CommodityKey, string[]> = {
  crude_oil: ["crude", "wti", "brent"],
  diesel: ["diesel", "gasoil", "en590", "ago"],
  gasoline: ["gasoline", "mogas", "ron95", "ron92"],
  jet_a1: ["jet a-1", "jeta1", "aviation kerosene"],
  lpg: ["lpg", "propane", "butane"],
  lng: ["lng"],
  natural_gas: ["natural gas", "ng"],
  gold_bullion: ["gold", "au", "bullion"],
  silver_bullion: ["silver", "ag", "bullion silver"],
  wheat: ["wheat", "hard red winter", "hrw", "hrww"],
  soybeans: ["soybean", "soybeans", "soya"],
  coffee: ["coffee", "arabica", "robusta"],
  sugar: ["sugar", "icumsa"],
  petrochem: ["petrochem", "xylene", "benzene", "polymer"],
  fertilizers: ["urea", "dap", "map", "fertilizer"],
  default: []
};

const CAT_MAP: Record<string, CommodityKey> = {
  "Fuel Hydrocarbons": "crude_oil",
  "Metals Precious": "gold_bullion",
  "Agricultural": "wheat"
};

export function resolveCommodityKey(name: string, category?: string): CommodityKey {
  const s = (name || "").toLowerCase();
  for (const [key, words] of Object.entries(KW)) {
    if (words.some(w => s.includes(w))) return key as CommodityKey;
  }
  if (category && CAT_MAP[category]) return CAT_MAP[category];
  return "default";
}