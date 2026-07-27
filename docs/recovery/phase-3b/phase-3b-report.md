# Phase 3B completion report

Date: 2026-07-27

## Executive summary

Phase 3B reached a mandatory business-decision boundary. The public marketplace
failure cannot be corrected mechanically without changing trust or publication
meaning.

The approved legacy database has nine active offers but no offer-verification
evidence, no seller-organization verification source, no moderation evidence,
and no organization entity. The legacy `users.verified` boolean is not proven
equivalent to current KYB or seller-organization verification.

No runtime marketplace behavior, schema, business row, authentication path, or
integration was changed. This phase produced an evidence trace, a safe DTO
proposal, three compatibility options, and executable characterization tests.

Recommended immediate policy: Option A, strict fail-closed, subject to explicit
approval. Recommended production destination: Option C, an additive
evidence-backed verification model and explicit review workflow.

## Repository state

- Branch: `recovery/phase-2-runtime-workflows`
- Phase 3B starting revision:
  `be7d38b61875919b4ca19a8c4eaa37a439274c08`
- Evidence commit: `0ddb960`
- DTO decision commit: `14f65b3`
- Characterization-test commit: `7d91da7`
- Report commit: the Phase 3B final `HEAD`

## Disposable database confirmation

- Recovery marker: present, valid, and exactly one row.
- Post-migration fingerprint:
  `1654ed34b5a19cef9edc6fe3e996553e59c370f311207a89348811f969e3def8`.
- Fingerprint match: yes.
- Migration-journal rows: 6.
- Journal state:
  - additive migration / succeeded / SQL executed: 3
  - legacy reconciliation / succeeded / SQL executed: 1
  - legacy reconciliation / superseded / SQL not executed: 1
  - observed legacy baseline / verified / SQL not executed: 1
- All approved business-table counts matched before and after the runtime
  probes.

## Row counts

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

## Offer-listing execution trace

The complete trace is recorded in
`docs/recovery/phase-3b/marketplace-evidence-analysis.md`.

In summary:

- Recovery middleware allows the public read.
- `GET /api/offers` requires authentication only for `my` or `interested`
  filters.
- `storage.getOffers()` selects every current offer, commodity, and user
  column with two left joins.
- The first absent current field is `offers.verified`; PostgreSQL returns
  `42703`.
- The handler uses both missing booleans as strict publication filters.
- The active marketplace card repeats the same guard and otherwise returns
  `null`.
- The card converts seller-organization verification into a completed-KYB
  claim.
- The detail modal unconditionally claims a verified trader and reads identity
  data from the raw joined user.
- The response has no dedicated public serializer and, if the query succeeded,
  would include the complete joined user object.
- Ordering is newest first. Pagination is absent.
- The client also requests summary and options endpoints with the same
  unresolved trust assumptions.

## Verification evidence

- `offers.verified`: required by current code, absent in legacy data.
- `offers.seller_org_verified`: required by current code, absent in legacy
  data.
- `offer_verifications`: zero rows; schema supports pending submissions only.
- `verification_documents`: zero rows.
- Relevant `activity_logs`: zero rows.
- Current KYB, organization, and moderation columns are absent from the legacy
  users/offers tables.
- No organization table exists.
- Legacy `users.verified`: true = 3, false = 1. All nine offers belong to the
  three true users, but no evidence proves that this boolean represents
  organization KYB or offer verification.
- Seed/demo code sets several booleans together. It is not migration or
  production authority.

## Legacy distributions

- Offer status: active = 9.
- Offer type: buy = 4; sell = 5.
- Linked seller rows: 9.
- Matched seller links: 9.
- Orphan seller links: 0.
- Distinct sellers represented: 3.
- User company-name presence: present = 4; absent = 0. No names were displayed
  or reported.

## Canonical DTO proposal

The proposed DTO is recorded in
`docs/recovery/phase-3b/marketplace-dto-decision.md`.

It separates:

- immutable offer facts;
- offer verification state;
- seller-organization verification state;
- moderation/visibility state;
- optional public seller display information;
- normalization data.

It uses explicit `unknown` and `unavailable` values, renders a verified badge
only for proven `verified`, and excludes raw users, credentials, personal
identity, ratings, document paths, and internal moderation data.

## Compatibility options

- Option A: strict fail-closed. All nine legacy offers remain excluded and the
  marketplace becomes explicitly empty/unavailable.
- Option B: legacy-visible with explicit unknown/unavailable trust. All nine
  active offers may be visible, but this relaxes the current verified-only
  publication rule and requires coordinated copy, UI, summary, and API changes.
- Option C: additive canonical verification and visibility model with explicit
  review and no automatic positive backfill.

Recommendation: approve Option A for recovery safety and design Option C for
production. Option B requires an explicit product/trust-policy authorization.

## Mechanical-fix determination

No mechanical fix exists.

The missing values are consumed by both server publication logic and client
rendering. None of the available legacy values is proven semantically
identical, and the current response projection is not safe for public use.

## Runtime characterization

- Controlled recovery server startup: successful.
- `GET /api/health`: 200.
- `GET /api/offers`: 500 with only a public `message` key.
- `POST /api/offers`: 503, blocked by recovery mode before route behavior.
- Recovery server stopped after the bounded probe.
- Landing page: previously characterized successfully in the unchanged Phase
  3A runtime.
- Anonymous `/marketplace`: previously characterized as the application 404
  because the client registers the route only for authenticated users.
- Authenticated marketplace rendering: not attempted because authentication
  recovery is outside scope.
- Offer cards: cannot receive live rows because the API fails. If supplied a
  row, the active card renders only when both booleans are true.
- Unknown badge behavior: unsupported by the current client.
- Current seller badge: claims completed KYB only when
  `sellerOrgVerified=true`; absent evidence cannot reach a safe neutral state.
- Current detail modal: contains an unconditional verified-trader claim.
- Filters: category, commodity key, and search are applied in memory after the
  trust predicate; unit is normalization-only.
- Pagination: none.

## Implementation performed

No production implementation was performed. Only documentation, a package test
command, and non-mutating characterization tests were added.

## Files modified

| File | Reason |
|---|---|
| `docs/recovery/phase-3b/marketplace-evidence-analysis.md` | Record the full execution trace, data authority, aggregates, duplicate implementations, and mechanical-fix result |
| `docs/recovery/phase-3b/marketplace-dto-decision.md` | Define the safe DTO, options, recommendation, and required decisions |
| `scripts/marketplace/legacy-offer.characterization.test.ts` | Prove the approved fingerprint/schema mismatch and proposed DTO safety invariants without writes |
| `package.json` | Add a repeatable marketplace characterization test command |
| `docs/recovery/phase-3b/phase-3b-report.md` | Record Phase 3B results and stop boundary |

## Validation

- `npm run check`: passed.
- `npm run build`: passed.
  - Existing non-blocking warnings remain for stale Browserslist data and a
    JavaScript chunk larger than 500 kB.
- `npm run test:marketplace-characterization`: 2 passed.
- `npm run test:migrations`: 5 passed.
- `npm run test:recovery`: 6 passed.
- `npm run test:api-request`: 4 passed.

The characterization test connects only after verifying the recovery marker
and approved fingerprint, begins a read-only transaction, checks aggregate
evidence, and rolls back.

## Database writes

None.

The runtime write probe was rejected with `503` by recovery mode. Inspection
and characterization used read-only transactions. No migration, seed, reset,
insert, update, delete, authentication action, or business workflow ran.

## Risk assessment

- Critical: inventing either verification flag could misrepresent trust and
  expose buyers to unreviewed offers.
- Critical: returning the current raw storage shape could expose sensitive
  joined-user fields.
- High: the active card and detail modal contain unsupported KYB/trader claims.
- High: list, summary, and options endpoints duplicate trust logic and can
  diverge.
- High: selecting Option B changes marketplace publication policy.
- Medium: the browser marketplace is authentication-gated although the API is
  public.
- Medium: no pagination means future listings may become expensive.
- Low for this phase: no application behavior or database state changed.

## Required next checkpoint

The owner must approve one compatibility option and answer the decisions in
`marketplace-dto-decision.md`.

If Option A is approved, the next bounded checkpoint should implement:

1. a dedicated safe public projection;
2. an explicit empty/unavailable marketplace result for unproven offers;
3. neutral UI and detail behavior with no verified claims;
4. aligned list, summary, and options populations;
5. integration tests proving no sensitive fields or business writes.

Do not proceed to authentication, KYB administration, schema/backfill, offer
writes, contracts, orders, payments, escrow, blockchain, or deployment before
that approval.
