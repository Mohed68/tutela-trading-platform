/**
 * Packaging Specifications System
 * 
 * Handles agricultural bags and metal bars with proper weight specifications.
 * Eliminates parenthetical text like "(60kg)" in pricing displays.
 */

export type PackagingSpec =
  | { kind: 'bag'; weight: { unit: 'kg'; value: number } }
  | { kind: 'bar'; metal: 'gold' | 'silver'; weight: { unit: 'troy_ounce' | 'kg'; value: number } };

export function toKg(p?: PackagingSpec): number | undefined {
  return p?.kind === 'bag' ? p.weight.value : undefined;
}

export function toOz(p?: PackagingSpec): number | undefined {
  if (p?.kind !== 'bar') return undefined;
  return p.weight.unit === 'troy_ounce' ? p.weight.value : p.weight.value * 32.1507466;
}

// Extract packaging spec from legacy text like "(60kg)" or "60kg bag"
export function extractPackagingSpec(text: string, unit: string): PackagingSpec | null {
  if (unit === 'bag') {
    const kgMatch = text.match(/\(?(\d+)\s*kg\)?/i);
    if (kgMatch) {
      const kgValue = parseInt(kgMatch[1], 10);
      return {
        kind: 'bag',
        weight: { unit: 'kg', value: kgValue }
      };
    }
  }
  
  if (unit === 'bar') {
    const ozMatch = text.match(/\(?(\d+)\s*oz\)?/i);
    if (ozMatch) {
      const ozValue = parseInt(ozMatch[1], 10);
      return {
        kind: 'bar',
        metal: 'gold', // Default, should be determined from commodity
        weight: { unit: 'troy_ounce', value: ozValue }
      };
    }
  }
  
  return null;
}

// Clean text by removing packaging weight references
export function cleanPackagingText(text: string): string {
  if (!text) return text;
  return text.replace(/\s*\(\d+\s*(kg|oz)\)\s*/gi, '').replace(/\s+/g, ' ').trim();
}