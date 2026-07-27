import moqPolicies from '../config/moq-policies.json' with { type: 'json' };

export interface MOQRule {
  unit: string;
  type: 'fixed' | 'by_pct_of_qty';
  value?: number;
  pct?: number;
  floor?: number;
  step: number;
}

export interface CommodityPolicy {
  defaultUnit: string;
  allowedUnits: string[];
  minOrder: MOQRule[];
  notes?: string;
}

/**
 * Resolve commodity name to policy key
 */
export function resolveCommodityKey(commodityName: string): string {
  const name = commodityName.toLowerCase();
  
  // Crude oil variants
  if (name.includes('crude') || name.includes('brent') || name.includes('wti')) {
    return 'crude_oil';
  }
  
  // Refined products
  if (name.includes('diesel')) return 'diesel';
  if (name.includes('gasoline') || name.includes('petrol')) return 'gasoline';
  
  // Precious metals
  if (name.includes('gold')) return 'gold_bullion';
  if (name.includes('silver')) return 'silver_bullion';
  
  // Agricultural products
  if (name.includes('wheat')) return 'hard_red_winter_wheat';
  if (name.includes('soybean') || name.includes('soy')) return 'premium_soybeans';
  if (name.includes('coffee')) return 'arabica_coffee_beans';
  
  return 'default';
}

/**
 * Suggest minimum order quantity based on commodity and unit
 */
export function suggestMinOrder(params: {
  commodityName: string;
  unit: string;
  availableQty: number;
}): number {
  const { commodityName, unit, availableQty } = params;
  
  const policyKey = resolveCommodityKey(commodityName);
  const policy = moqPolicies[policyKey as keyof typeof moqPolicies] || moqPolicies.default;
  
  // Find matching unit rule
  const rule = policy.minOrder.find(r => r.unit === unit);
  if (!rule) {
    // Use default rule or fallback
    const defaultRule = policy.minOrder[0];
    if (defaultRule.type === 'by_pct_of_qty') {
      const suggested = Math.max(
        Math.ceil(availableQty * (defaultRule.pct || 0.05)),
        defaultRule.floor || 1
      );
      return Math.min(suggested, availableQty);
    }
    return Math.min(defaultRule.value || 1, availableQty);
  }
  
  let suggested: number;
  
  if (rule.type === 'by_pct_of_qty') {
    suggested = Math.max(
      Math.ceil(availableQty * (rule.pct || 0.05)),
      rule.floor || 1
    );
  } else {
    suggested = rule.value || 1;
  }
  
  // Apply step rounding
  if (rule.step > 1) {
    suggested = Math.ceil(suggested / rule.step) * rule.step;
  }
  
  // Clamp to available quantity
  return Math.min(suggested, availableQty);
}

/**
 * Get allowed units for a commodity
 */
export function getAllowedUnits(commodityName: string): string[] {
  const policyKey = resolveCommodityKey(commodityName);
  const policy = moqPolicies[policyKey as keyof typeof moqPolicies] || moqPolicies.default;
  return policy.allowedUnits;
}

/**
 * Get default unit for a commodity
 */
export function getDefaultUnit(commodityName: string): string {
  const policyKey = resolveCommodityKey(commodityName);
  const policy = moqPolicies[policyKey as keyof typeof moqPolicies] || moqPolicies.default;
  return policy.defaultUnit;
}

/**
 * Convert between mass units (only for precious metals)
 */
export function convertMassUnits(value: number, fromUnit: string, toUnit: string): number | null {
  const conversions: Record<string, number> = {
    'kg': 1000, // grams
    'gram': 1,
    'troy_ounce': 31.1035, // grams
    'troy oz': 31.1035
  };
  
  const fromGrams = conversions[fromUnit];
  const toGrams = conversions[toUnit];
  
  if (!fromGrams || !toGrams) return null;
  
  // Convert to grams, then to target unit
  const grams = value * fromGrams;
  return grams / toGrams;
}