# Phase 3B marketplace evidence and authority analysis

Date: 2026-07-27

Scope: the read-only `GET /api/offers` marketplace path only.

## Safety baseline

- Branch: `recovery/phase-2-runtime-workflows`
- Starting revision: `be7d38b61875919b4ca19a8c4eaa37a439274c08`
- Recovery marker: exactly one valid `tutela-recovery-test` row
- Application-schema fingerprint:
  `1654ed34b5a19cef9edc6fe3e996553e59c370f311207a89348811f969e3def8`
- The fingerprint matches the approved post-migration fingerprint.
- The migration journal contains six records.
- Recovery mode permits only `GET`/`HEAD` for `/api/health`,
  `/api/commodities`, `/api/offers`, and `/api/auth/user`. It rejects other
  API and admin routes with `503`.
- Controlled recovery startup was reconfirmed on the recovery-only port. It
  did not seed, initialize external monitoring, or contact a production
  integration.

No database write was performed during Phase 3B inspection.

## Approved row-count comparison

| Table | Approved | Observed |
|---|---:|---:|
| `neon_auth.users_sync` | 1 | 1 |
| `public.activity_logs` | 0 | 0 |
| `public.commodities` | 9 | 9 |
| `public.contracts` | 0 | 0 |
| `public.offers` | 9 | 9 |
| `public.partner_relations` | 0 | 0 |
| `public.sessions` | 0 | 0 |
| `public.users` | 4 | 4 |
| `public.verification_documents` | 0 | 0 |
| `public.offer_verifications` | 0 | 0 |
| `public.performance_insights_reports` | 0 | 0 |

## Complete `GET /api/offers` execution trace

1. `server/index.ts` installs `recoveryModeGuard` before route registration.
   Recovery mode allows this specific read route.
2. `server/routes.ts` registers `GET /api/offers`.
3. The public path does not require authentication. Only `filter=my` and
   `filter=interested` require an authenticated user.
4. The handler discards a `unit` filter, resolves category, commodity, and
   search filters, and calls `storage.getOffers()`.
5. `server/storage.ts#getOffers` uses an unqualified Drizzle `select()` from
   the complete current `offers` schema, left-joins the complete
   `commodities` and `users` schemas, and orders by `offers.createdAt`
   descending.
6. Because whole current table definitions are selected, the generated SQL
   requests every field declared in `shared/schema.ts`, not only fields needed
   by the marketplace.
7. The approved legacy `offers` table lacks the current offer verification,
   seller-organization, delegate, specifications, delivery-options, and
   moderation columns. The first PostgreSQL failure is
   `offers.verified` (`42703`).
8. If selection succeeded, the storage method would spread every offer field
   and attach the complete joined commodity and user objects.
9. The route filters the in-memory result to:
   `offer.verified === true`,
   `offer.sellerOrgVerified === true`, and
   `offer.status === "active"`.
10. It then filters by category, commodity key, and free text. Search includes
    commodity labels, offer title, seller organization name, and location.
11. It optionally derives normalized quantity and price fields.
12. It returns `{ offers: normalizedOffers, totalCount }`. There is no
    pagination, cursor, limit, or offset.
13. `client/src/pages/marketplace.tsx` fetches the route with React Query,
    accepts either the object response or a legacy raw array, and passes the
    array to `OfferList`.
14. `OfferList` enriches commodity data and passes each row to the active
    feature-level `OfferCardDetailed`.
15. That card independently applies the same two verification booleans and
    returns `null` unless both are true.
16. A true seller-organization flag renders `Verified (KYB)` and explicitly
    claims company identity and registration were verified. The false branch
    says `Pending KYB`, which incorrectly collapses unknown, unavailable,
    unverified, and pending.
17. Selecting a card passes the same raw object to `OfferDetailModal`. The
    modal unconditionally claims `Verified Trader`, invents a five-star
    rating, and reads organization and personal names from the raw object.
18. The browser route `/marketplace` is registered only inside the
    authenticated application router. The API is public, but anonymous users
    cannot reach the active marketplace page.

`GET /api/offers/summary` and `/api/offers/options` use the same missing fields
and trust filter. The marketplace page requests both, so recovering only the
list endpoint would still leave adjacent marketplace requests broken.

## Field-origin matrix

| Public concept | Current source | Legacy source | Finding |
|---|---|---|---|
| Offer ID | `offers.id` | `offers.id` | Proven core fact |
| Offer type | `offers.type` | `offers.type` | Proven core fact |
| Commodity | joined `commodities` row | same | Proven core fact |
| Quantity/unit | `offers.quantity`, `unit` | same | Proven core fact |
| Price/currency | `offers.pricePerUnit`, `currency` | same | Proven core fact |
| Location | `offers.location` | same | Proven core fact |
| Delivery/payment terms | offer columns | same | Proven core facts, nullable |
| Validity/timestamps | offer columns | same | Proven core facts, nullable |
| Offer status | `offers.status` | same | All legacy values are `active`; status is not verification |
| Offer verification | `offers.verified` | absent | No authoritative legacy value |
| Offer-document submission | `offer_verifications` | additive table, zero rows | Submission supports only `pending`; it has no approval state |
| Seller organization verification | `offers.sellerOrgVerified` | absent | No authoritative legacy value |
| Seller organization identity | `offers.sellerOrg*` | absent | Only linked `users.company_name` exists; equivalence is unproven |
| Seller identity | full joined `users` row | linked by `offers.user_id` | Structural link is proven; public disclosure policy is not |
| User verification | `users.verified` | present | Semantics are not documented as KYB or organization verification |
| KYB approval | `users.kybStatus` and admin workflow | absent in legacy | Cannot be reconstructed from `users.verified` safely |
| Moderation | `offers.moderationStatus` and audit logs | columns absent; logs empty | No legacy moderation authority |
| Visibility | conjunction of verification flags and active status | no dedicated field | Publication rule is unresolved |

## Legacy aggregate characterization

- Offer statuses: `active` = 9; null = 0.
- Offer types: `buy` = 4; `sell` = 5.
- All nine offers have a non-null seller link.
- All nine seller links resolve to a user; orphan links = 0.
- Distinct sellers represented by the offers = 3.
- `users.verified`: true = 3, false = 1, null = 0.
- All four users have a non-empty `company_name`; values were not inspected or
  reported.
- `verification_documents`: 0 rows and no status distribution.
- `offer_verifications`: 0 rows and no status distribution.
- Approval-, verification-, moderation-, hidden-, archived-, or KYB-like
  actions in `activity_logs`: 0.
- No organization- or company-named base table exists.
- The legacy `offers` table contains no verification, approval, publication,
  visibility, organization, KYB, or moderation column.
- The legacy `users` table has `verified` and `company_name`, but no
  `kyb_status`, `verification_level`, organization entity, or supporting
  approval evidence.

## Verification-semantics findings

The repository represents several different concepts:

1. `offers.verified` is used as a marketplace publication gate and demo badge.
   No persisted review workflow is connected to it.
2. `offer_verifications.status` is only `pending`. The migration explicitly
   distinguishes offer-document submissions from user KYB.
3. `offers.sellerOrgVerified` is a cached-looking per-offer field used by the
   card to claim completed KYB. There is no organization table or derivation.
4. `users.verified` is a legacy general account/trader flag. Current code
   separately models `users.kybStatus`, verification level, and four document
   statuses.
5. `offers.moderationStatus` is a separate administrative concept. Audit
   actions separately distinguish KYB decisions from hiding, unhiding, and
   archiving offers.
6. Seed and demo code sets user, offer, and seller flags to true together.
   That demonstrates demo presentation intent, not production authority.
7. Marketing copy and several UI fallbacks make broad verified-marketplace
   claims. Copy is not data or workflow authority.

Accordingly, `users.verified`, active status, user existence, organization
name presence, document presence, and pending submission are not proven
substitutes for either missing marketplace verification field.

## Duplicate and legacy client behavior

- The active marketplace card is
  `client/src/features/offers/components/OfferCardDetailed.tsx`.
- `client/src/components/offers/OfferCardDetailed.tsx` is a second
  implementation with different badge logic and no import site. It is
  currently unreferenced but was not deleted.
- `client/src/hooks/useVisibleOffers.ts` duplicates the strict verified/active
  filtering rule but has no import site. It was not deleted.
- `MyOffers.tsx`, seed data, and marketing components contain demo/static
  verification states. They are not evidence for legacy production records.
- `OfferDetailModal` is active and currently contains unsupported trust,
  rating, and seller-contact claims.

## Mechanical-fix determination

No purely mechanical fix exists.

- Removing the missing fields would change the explicit publication filter
  and card guard.
- Mapping missing values to false would turn unknown into unverified and hide
  all nine offers.
- Mapping active status or `users.verified` to true would fabricate offer or
  organization verification.
- Returning raw legacy rows would expose the complete joined user object and
  preserve unsupported badges.
- Making legacy offers visible requires an explicit trust and publication
  decision.

Phase 3B must therefore stop before runtime implementation.
