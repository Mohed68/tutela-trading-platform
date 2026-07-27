# Phase 3B marketplace DTO decision package

Date: 2026-07-27

Status: business decision required before implementation.

## Proposed canonical public DTO

The public API must stop returning Drizzle rows and complete joined user
objects. A dedicated projection should expose only fields approved for public
marketplace use.

```ts
type OfferVerificationState =
  | "verified"
  | "unverified"
  | "pending"
  | "unknown"
  | "not_applicable";

type SellerOrganizationVerificationState =
  | "verified"
  | "unverified"
  | "pending"
  | "unknown"
  | "unavailable";

type MarketplaceVisibilityState =
  | "published"
  | "hidden"
  | "archived"
  | "unknown";

interface PublicMarketplaceOfferDto {
  id: string;
  offerType: "buy" | "sell";
  commodity: {
    id: string;
    name: string;
    category: string;
  };
  quantity: {
    value: string;
    unit: string;
  };
  pricing: {
    amountPerUnit: string;
    currency: string;
  };
  location: string;
  terms: {
    delivery: string | null;
    payment: string | null;
    validUntil: string | null;
  };
  status: "active" | "pending" | "closed" | "cancelled";
  trust: {
    offerVerification: {
      state: OfferVerificationState;
      evidenceSource: string | null;
      verifiedAt: string | null;
    };
    sellerOrganizationVerification: {
      state: SellerOrganizationVerificationState;
      evidenceSource: string | null;
      verifiedAt: string | null;
    };
  };
  visibility: {
    state: MarketplaceVisibilityState;
  };
  seller: {
    displayName: string | null;
  };
  normalization: {
    targetUnit: string | null;
    quantity: number | null;
    amountPerUnit: number | null;
    converted: boolean;
    convertible: boolean;
  };
  createdAt: string | null;
  updatedAt: string | null;
}
```

### Contract rules

- `unknown` is not `unverified`, `pending`, or `verified`.
- `unavailable` means no seller-organization verification source exists.
- Only authoritative positive evidence may produce `verified`.
- Only an authoritative negative review outcome may produce `unverified`.
- A submission without review may produce `pending`; mere absence may not.
- `active` is an offer lifecycle value, not a visibility or trust value.
- Seller display name is nullable until a public organization-name disclosure
  policy is approved.
- The serializer must not expose email, first or last name, password hash,
  profile image URL, personal user ID, financial or credit rating, delegate
  identity, internal notes, document paths, audit details, or raw joined rows.
- The verified badge may render only for the exact `verified` state.
- `unknown` and `unavailable` may render only neutral language such as
  `Verification unavailable`.

### Backward compatibility

The current booleans cannot represent unknown safely. During a controlled
transition, deprecated `verified` and `sellerOrgVerified` properties could be
returned as `null`, never fabricated as true or false. Existing clients treat
null as falsy and would fail closed, so the active marketplace client must be
updated in the same approved compatibility change.

The canonical DTO deliberately does not preserve the current raw `user`
object. Preserving that shape would expose fields that are not part of a safe
public contract.

## Compatibility options

### Option A — strict fail-closed marketplace

Only offers with authoritative positive evidence for both offer and seller
organization verification are published.

- Data integrity: strongest; no inferred values or data backfill.
- Trust: preserves the repository's existing two-factor trust gate.
- User experience: all nine legacy offers are excluded, so the marketplace is
  empty with an explicit recovery/unavailable state.
- Migration impact: none for the immediate compatibility response.
- Frontend impact: remove unsupported verified copy, render an explicit empty
  state, and ensure unknown is not labeled unverified.
- Backward compatibility: behavior is consistent with the current strict
  predicate but differs from the seeded/demo expectation of visible offers.
- Operational burden: low immediately; high until a real review workflow
  exists.
- Misleading-buyer risk: lowest.
- Recovery suitability: high as a temporary safety posture.
- Production suitability: safe but commercially incomplete.

### Option B — legacy-visible with explicit unknown trust state

Return otherwise publishable legacy offers with offer verification `unknown`
and seller-organization verification `unavailable` or `unknown`. Replace all
verified claims with neutral language.

- Data integrity: preserves unknowns and does not mutate records.
- Trust: changes the existing verified-only publication policy.
- User experience: all nine active offers can be visible, with clear neutral
  trust labels.
- Migration impact: none immediately.
- Frontend impact: substantial but bounded. Cards, detail modal, headings,
  summary metrics, and filtering must stop assuming verified status.
- Backward compatibility: requires a coordinated DTO/client change; legacy
  boolean guards would otherwise hide every card.
- Operational burden: moderate because buyers need clear warnings and product
  language.
- Misleading-buyer risk: moderate if every trust claim is corrected; high if
  any current badge or copy remains.
- Recovery suitability: technically feasible only after explicit approval to
  relax the verified-only publication rule.
- Production suitability: possible as a transparent legacy mode, subject to
  legal/product/security approval.

### Option C — additive verification model and explicit review/backfill

Add authoritative offer-verification, seller-organization verification, and
visibility state with evidence provenance and review timestamps. Existing
records remain unknown until reviewed; no automatic positive backfill occurs.

- Data integrity: best long-term model because concepts and evidence are
  explicit.
- Trust: strongest sustainable semantics.
- User experience: initially the same as Option A unless Option B is separately
  approved during review.
- Migration impact: new additive schema, migration journal entries, review
  workflow, and possibly an organization entity or documented user-company
  authority.
- Frontend impact: adopt the canonical DTO and explicit state badges.
- Backward compatibility: requires a versioned or coordinated API transition.
- Operational burden: highest; needs reviewers, audit records, exception
  handling, and backfill operations.
- Misleading-buyer risk: low after review; unknown records remain visibly
  distinct.
- Recovery suitability: not an immediate compatibility fix.
- Production suitability: highest.

## Recommendation

Adopt Option A for the immediate recovery checkpoint and plan Option C as the
production destination.

Option A is the only current choice that preserves the repository's explicit
verified-only marketplace gate without fabricating evidence. It means the
current nine legacy offers will not be publicly listed. That effect must be
approved as a business decision before implementation.

Option B should be selected only if the product owner explicitly authorizes
legacy offers to be visible without proven offer or seller-organization
verification and accepts the corresponding marketplace-copy and trust-policy
change.

## Decisions required

1. May active legacy offers be visible when offer verification is unknown?
2. May active legacy offers be visible when seller-organization verification
   is unavailable?
3. Does legacy `users.verified` mean account verification, trader verification,
   organization KYB approval, or another historical concept?
4. What event and evidence make an offer `verified`?
5. Does an `offer_verifications` submission remain pending until a separate
   administrative decision? Where is that decision stored and audited?
6. Is the seller organization the user record, a future organization entity,
   or a per-offer snapshot?
7. Which organization label, if any, is approved for public disclosure?
8. Are personal delegate/contact names ever public on an offer listing or
   detail view?
9. Is `active` sufficient for publication, or must an independent visibility
   or moderation state also be `published`?
10. How should hidden and archived lifecycle states interact with verification
    and publication?
11. Should `/api/offers/summary` and `/api/offers/options` be included in the
    same compatibility change so the marketplace page has one consistent
    population?
12. Should the public marketplace remain API-public while the browser route
    remains authentication-gated?

## Implementation boundary

No runtime correction is authorized by the available evidence. Implementation
must wait for the option and the decisions above to be approved. Authentication,
KYB administration, schema additions, backfill, offer writes, contracts,
orders, payments, escrow, and blockchain remain outside Phase 3B.
