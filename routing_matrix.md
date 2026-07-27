# Routing Matrix - Current vs Desired State

## Current State Analysis
| Current Path | File/Component | Renders | Issues |
|-------------|-----------------|---------|---------|
| `/offers` | `pages/commodities.tsx` | `<Commodities />` | Wrong component name, should be personal offers |
| `/marketplace` | `pages/marketplace.tsx` | `<Marketplace />` | Browse all offers - should be canonical |
| `/commodities` | Not defined | N/A | Missing route |

## Target State (After Fix)
| Path | File | Component | Purpose | Status |
|------|------|-----------|---------|---------|
| `/marketplace` | `pages/marketplace.tsx` | `<Marketplace />` | **CANONICAL** - Browse all offers with filtering | ✓ Keep |
| `/offers` | `pages/offers.tsx` | `<Navigate to="/marketplace" />` | **REDIRECT** - Personal offers redirect to marketplace | → Fix |
| `/commodities` | `pages/commodities.tsx` | `<Navigate to="/marketplace?view=by-category" />` | **REDIRECT** - Category view redirect | → Fix |

## Implementation Plan

### Step 1: Create Routes Config
- Create `client/src/config/routes.ts` with constants
- Add route aliases mapping

### Step 2: Fix File Structure
- Rename `pages/commodities.tsx` → `pages/offers.tsx` (personal offers functionality)
- Create new redirect `pages/commodities.tsx`
- Update `pages/marketplace.tsx` to be the canonical browse route

### Step 3: Update Navigation
- Update `AppSidebar.tsx` to use routes constants
- Fix all hard-coded route references

### Step 4: Implement Redirects
- Add client-side redirects using React Router Navigate
- Ensure proper URL handling with query params

## Routes Mapping
```typescript
export const ROUTES = {
  marketplace: "/marketplace",    // CANONICAL - browse all offers
  offers: "/offers",             // Personal offers management
  commodities: "/commodities",   // Category-based browsing
} as const;

export const ROUTE_ALIASES: Record<string, string> = {
  [ROUTES.offers]: ROUTES.marketplace,
  [ROUTES.commodities]: `${ROUTES.marketplace}?view=by-category`,
};
```