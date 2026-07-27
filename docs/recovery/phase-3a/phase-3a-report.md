# Phase 3A controlled runtime characterization

Status: complete; stopped before workflow or business-semantic changes

## Executive result

The server starts safely against the marked disposable Neon branch in explicit
local recovery mode. Database connectivity, session and Passport setup, route
registration, Vite, HTTP binding, and the React landing shell initialize.

The first marketplace runtime boundary is confirmed: current offer queries
select `offers.verified`, which does not exist in the approved legacy schema.
Resolving that column and its visibility semantics is not mechanical and was
not attempted.

## Database and migration state

- Legacy fingerprint before replay:
  `0ff84f064026bb8e918a9ffc1725a8fb611eb753169bf07b9c166e81ee9f143f`
- Approved migrations replayed: journal, observed baseline record, 0002
  superseded record, 0003, 0004, and 0005.
- Migration 0001: not executed.
- Post-migration fingerprint:
  `1654ed34b5a19cef9edc6fe3e996553e59c370f311207a89348811f969e3def8`
- Marker: exactly one `tutela-recovery-test` row.
- Migration journal: six verified records.

The first marker-creation command had a shell-escaped parameter error. Its
transaction rolled back. The clean legacy fingerprint and row counts were
reverified before the authorized marker transaction was retried successfully.

## Startup result

- Mode: explicit controlled recovery/development child process
- Bound address: `0.0.0.0`
- Bound port: 5055
- Database health: connected
- Local-authentication compatibility: incomplete and reported without
  migration
- Session store: initialized with automatic pruning disabled
- Passport: initialized
- Routes: registered
- Vite frontend: initialized
- Sentry: disabled
- Startup demo clear/seed: disabled
- External payments, storage, AI, blockchain, and email: not contacted
- Application WebSocket server: none
- Neon database transport: initialized through the existing driver
- Process: terminated after the bounded probe window

## Safe endpoint results

| Method | Route | Expected authentication | Status | Response shape | Database/runtime evidence |
|---|---|---|---:|---|---|
| GET | `/api/health` | Public | 200 | Object: `environment`, `status`, `timestamp` | No business query |
| GET | `/` | Public | 200 | HTML application shell | Local Vite/static assets |
| GET | `/api/commodities` | Public | 200 | Array of 9 commodities | `public.commodities` |
| GET | `/api/offers` | Public | 500 | Object: `message` | Query stopped at missing `offers.verified` |
| GET | `/api/auth/user` | Required | 401 | Object: `message` | Anonymous status; no session created |

The in-app browser rendered the complete landing page with the expected title
and no console errors. Direct unauthenticated navigation to `/marketplace`
rendered the application's 404 page because marketplace routes are registered
only inside the authenticated client branch. No interaction was performed.

## Row-count comparison

Counts were identical before and after both controlled startup runs:

| Table | Before | After |
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

The post-startup fingerprint remained
`1654ed34b5a19cef9edc6fe3e996553e59c370f311207a89348811f969e3def8`.

## Failure classification

### Local authentication schema

- Category: D (missing column), H (authentication/session mismatch), and K
  (unresolved business-semantic decision)
- Component: normal database startup health check and current `users` model
- Evidence: legacy `users` lacks `password_hash`, `auth_provider`,
  `email_verified_at`, and `last_login_at`; it also lacks later KYB, plan,
  preference, and administration columns used by current queries.
- Mechanical fix: no. Migration 0001 includes an unapproved account
  classification backfill, and authentication coexistence is unresolved.
- Phase 3A treatment: normal startup remains fail-closed; recovery mode permits
  read-only characterization while all mutation routes are blocked.

### Public offer listing

- Category: D (missing column) and K (unresolved business-semantic decision)
- Component: `DatabaseStorage.getOffers`
- Trigger: `GET /api/offers`
- Redacted error: `column offers.verified does not exist` (PostgreSQL 42703)
- Repository evidence: `shared/schema.ts` and marketplace filtering require
  `verified` and `seller_org_verified`.
- Database evidence: neither column exists in the approved legacy baseline.
- Mechanical fix: no. Defaulting or bypassing verification would change offer
  visibility and marketplace trust behavior.

### Authenticated marketplace client route

- Category: H (authentication boundary)
- Trigger: anonymous browser navigation to `/marketplace`
- Result: rendered application 404 because authenticated client routes are not
  mounted for anonymous users.
- Mechanical fix: not established; this may be intentional access control.

### Build/frontend warnings

- Category: J (frontend build/tooling warning)
- Evidence: stale Browserslist metadata and a bundle chunk above 500 kB.
- Impact: non-blocking for startup; optimization is outside recovery scope.

## Mechanical changes

- Added explicit recovery-mode validation and read-only route gating.
- Disabled startup seed/reset scheduling, session pruning, and Sentry only in
  recovery mode.
- Added a local launcher that loads `.env`, changes only its child process to
  development, and disables demo/monitoring flags.
- Allowed the startup health check to report unresolved authentication columns
  only in recovery mode.
- Made OpenAI clients lazy and feature-scoped.
- Redacted startup/safe-probe errors and removed response bodies from request
  logs.
- Added focused tests for recovery defaults, production/Render rejection,
  startup seed and monitoring suppression, secret redaction, and optional
  OpenAI behavior.

No DTO, lifecycle, verification, payment, KYB, contract, offer, order,
blockchain, or authentication business rule was changed.

## Unresolved boundaries

1. Offer verification and seller-organization verification semantics for the
   nine legacy offers.
2. Local authentication versus Neon/external identity and treatment of the
   four legacy users.
3. Missing current users, offers, interested-offers, orders, audit, temporary
   document, contract, and KYB structures.
4. Contract financial-field and lifecycle mappings.
5. KYB status and storage-locator mappings.
6. Existing automatic production seeding and unauthenticated seed/reset route
   security.
7. `activity_logs` versus `audit_logs`.

## Recommended Phase 3B scope

Create a business-decision package for marketplace read compatibility before
changing schema or queries:

1. decide how legacy offers become verified or remain hidden;
2. decide whether seller-organization verification can be derived, backfilled,
   or must remain unavailable;
3. define a safe legacy/current public offer DTO;
4. approve only the additive columns/backfill needed for public marketplace
   reads;
5. separately approve removal or hard protection of automatic seed/reset
   behavior before any production startup.

Authentication, contract, KYB, order, payment, escrow, blockchain, and write
workflow work remains outside that checkpoint.
