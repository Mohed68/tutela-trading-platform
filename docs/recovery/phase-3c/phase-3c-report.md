# Phase 3C completion report

Date: 2026-07-27

Decision implemented: Option A — strict fail-closed marketplace.

## Executive summary

The public marketplace now fails closed without failing at runtime.

Publication requires all three conditions:

1. `offers.verified IS TRUE`;
2. `offers.seller_org_verified IS TRUE`;
3. offer status is `active`.

Before the publication query runs, the repository verifies that both
authoritative verification columns exist as Boolean columns. If either column
is unavailable, no offer row is queried or inferred and the public result is
an empty collection.

Against the approved legacy database:

- `GET /api/offers` returns HTTP 200;
- published offers = 0;
- all nine legacy offers remain unchanged;
- no user table is joined or selected;
- no schema or business-data write occurs.

## Repository state

- Branch: `recovery/phase-2-runtime-workflows`
- Phase 3C starting revision:
  `0920d726298adfd0d64b6d9cd353a9a9ceb10d2e`
- Server policy commit: `a9d52d2`
- Marketplace presentation commit: `fb7418a`
- Policy and runtime tests commit: `5808a4c`
- Runtime and presentation test hardening commit: `1f32ecd`
- Report commit: the Phase 3C final `HEAD`

## Database safety

- Recovery marker: valid and exactly one row.
- Approved fingerprint:
  `1654ed34b5a19cef9edc6fe3e996553e59c370f311207a89348811f969e3def8`.
- Fingerprint match: yes.
- Migration journal: unchanged.
- Schema changes: none.
- Business writes: none.
- Seeds, resets, migrations, updates, deletes, backfills, and verification
  records: none.

Approved business-table counts remain:

| Table | Count |
|---|---:|
| `neon_auth.users_sync` | 1 |
| `public.activity_logs` | 0 |
| `public.commodities` | 9 |
| `public.contracts` | 0 |
| `public.offers` | 9 |
| `public.partner_relations` | 0 |
| `public.sessions` | 0 |
| `public.users` | 4 |
| `public.verification_documents` | 0 |
| `public.offer_verifications` | 0 |
| `public.performance_insights_reports` | 0 |

## Server implementation

### Authority check

`server/marketplace/publicMarketplace.ts` queries
`information_schema.columns` for the two exact Boolean authority columns.
Absence produces an empty array. It does not produce false, unverified,
pending, or any inferred state.

### Publication query

When authority is available, a fixed, minimal query:

- selects only public offer and commodity facts;
- does not join `users`;
- does not select `user_id`;
- does not select organization names, KYB data, verification evidence,
  document data, audit data, or moderation data;
- requires both verification values to be explicitly true;
- requires active status;
- orders by creation time descending.

A second projection guard rejects any row that does not contain both explicit
true values and active status.

### Public DTO

`shared/marketplace.ts` defines a dedicated public contract containing:

- offer ID and type;
- commodity ID, name, and category;
- quantity and unit;
- price and currency;
- location;
- minimum quantity, delivery terms, payment terms, and validity;
- active lifecycle status;
- explicit offer and seller-organization verified states;
- published visibility;
- a nullable public seller display name, currently always null;
- normalization results;
- timestamps.

The DTO excludes:

- raw user objects and user identifiers;
- email and personal names;
- password or authentication fields;
- financial and credit ratings;
- KYB and document details;
- verification evidence and internal review data;
- moderation fields and notes.

## API behavior

The same published population now drives all read-only marketplace endpoints.

| Endpoint | Result against legacy data |
|---|---|
| `GET /api/offers` | 200, zero offers, strict publication-policy identifier |
| `GET /api/offers/summary` | 200, zero published offers and zero market value |
| `GET /api/offers/options` | 200, zero commodity options |
| `GET /api/offers/search` | 200, zero offers |
| `POST /api/offers` in recovery mode | 503 before route behavior |

Authenticated `my` and `interested` branches were not changed. Authentication,
offer writes, and trading workflows remain outside Phase 3C.

## Marketplace presentation

- The marketplace heading describes the exact two-part publication policy.
- The empty state says no verified offers are currently available and explains
  that both verification states are required.
- Unknown records cannot enter the card adapter and are not converted to
  unverified.
- A card can render only from a DTO containing both explicit verified states
  and published visibility.
- Seller identity is not included in the card or public detail presentation.
- The card no longer claims completed KYB.
- The active detail view no longer reads joined-user names or contact fields.
- The unsupported `Verified Trader`, `Pending KYB`, and fabricated five-star
  claims were removed from the active marketplace path.
- Missing commercial terms and minimum quantities are shown as unspecified
  rather than populated with fabricated defaults.
- Summary fallback no longer infers verified traders from offer booleans or
  user relationships.

The browser route remains authentication-gated, as it was before Phase 3C.
Authentication was not changed or bypassed. Browser automation could not open
the local URL because the browser client blocked localhost, so no visual
browser claim is made. The built server was validated through HTTP and the
active presentation contract is covered by executable source-level regression
tests.

## Files modified

| File | Reason |
|---|---|
| `shared/marketplace.ts` | Canonical, minimized public marketplace contracts |
| `server/marketplace/publicMarketplace.ts` | Authority detection, strict publication query, public projection, filtering, normalization, summary, and options |
| `server/routes.ts` | Route public list, summary, options, and search through the strict projection |
| `server/recoveryMode.ts` | Permit the additional approved read-only marketplace routes during controlled recovery |
| `client/src/pages/marketplace.tsx` | Consume canonical contract and state the exact publication policy |
| `client/src/features/offers/views/OfferList.tsx` | Enforce verified/published DTO states and render the safe empty state |
| `client/src/features/offers/components/OfferCardDetailed.tsx` | Remove unsupported KYB, identity, and fabricated term claims |
| `client/src/components/offers/OfferDetailModal.tsx` | Remove joined-user identity and unsupported trader/rating claims |
| `client/src/components/MarketplaceInsights.tsx` | Remove inferred trader verification and align metrics with published offers |
| `server/recoveryMode.test.ts` | Verify only approved read methods are enabled |
| `server/marketplace/publicMarketplace.test.ts` | Verify proof requirements and data minimization |
| `scripts/marketplace/phase-3c.runtime.test.ts` | Validate real endpoints and unchanged database state |
| `client/src/features/offers/marketplacePresentation.test.ts` | Prevent reintroduction of unsupported trust and identity claims |
| `package.json` | Add Phase 3C test commands |

## Validation

- `npm run check`: passed.
- `npm run build`: passed.
- `npm run test:marketplace-policy`: 4 passed.
- `npm run test:marketplace-presentation`: 3 passed.
- `npm run test:marketplace-runtime`: 1 passed.
- `npm run test:marketplace-characterization`: 2 passed.
- `npm run test:migrations`: 5 passed.
- `npm run test:recovery`: 7 passed.
- `npm run test:api-request`: 4 passed.

The build retains two pre-existing non-blocking warnings:

- stale Browserslist compatibility data;
- a frontend JavaScript chunk larger than 500 kB.

## Risk assessment

- Low: legacy offers are not modified and cannot be published without both
  explicit authority values.
- Low: public routes no longer select or serialize users.
- Low: all public marketplace aggregates derive from the identical published
  population.
- Medium: no current legacy offer is visible; this is the explicitly approved
  Option A outcome.
- Medium: authenticated marketplace rendering remains unavailable for live
  visual validation until authentication recovery is separately authorized.
- Medium: verified records cannot exist until a separately approved
  authoritative schema and workflow are available.
- Existing, out-of-scope risk: authenticated offer-management and trading
  routes still use the broader legacy/current storage model.

## Stop boundary

Phase 3C is complete.

No work proceeds into authentication, KYB, schema additions, data backfill,
offer writes, contracts, orders, payments, escrow, blockchain, administration,
or deployment without separate authorization.
