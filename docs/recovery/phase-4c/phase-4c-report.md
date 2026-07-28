# Phase 4C authenticated dashboard read recovery report

Date: 2026-07-28

Status: complete; stopped before offer writes or unresolved business-domain
recovery

## One-time read-only legacy account inventory

This inventory was performed before Phase 4C implementation in a PostgreSQL
read-only transaction. Only the fields explicitly authorized by the repository
owner are recorded here.

### Account 1

| Field | Observed value |
|---|---|
| User ID | `demo-user-1` |
| Login identifier | `trader1@petromax.com` |
| Display/name fields | Sarah Chen |
| Database role | `senior_trader` |
| Organization/company | PetroMax Energy Trading |
| `users.verified` | `true` |
| Created | `2025-11-21T08:31:17.116Z` |
| Owns offers | yes — 3 of the 9 legacy offers |
| Offer-type evidence | 1 buy, 2 sell |
| `auth_provider` | null |
| `login_enabled` | null |
| `credential_status` | null |
| `password_hash` present | no |

Classification:

- demo/seed account: confirmed by exact ID, identifier, name, company, and role
  match in `server/seedData.ts`;
- administrator: no authoritative evidence;
- buyer: confirmed from an owned buy offer;
- seller: confirmed from owned sell offers;
- associated with the legacy offers: confirmed, 3 offers.

### Account 2

| Field | Observed value |
|---|---|
| User ID | `demo-user-2` |
| Login identifier | `manager@globalmetals.com` |
| Display/name fields | Marcus Rodriguez |
| Database role | `commodity_manager` |
| Organization/company | Global Metals Corp |
| `users.verified` | `true` |
| Created | `2025-11-21T08:31:17.333Z` |
| Owns offers | yes — 3 of the 9 legacy offers |
| Offer-type evidence | 2 buy, 1 sell |
| `auth_provider` | null |
| `login_enabled` | null |
| `credential_status` | null |
| `password_hash` present | no |

Classification:

- demo/seed account: confirmed by exact repository seed evidence;
- administrator: no authoritative evidence;
- buyer: confirmed from owned buy offers;
- seller: confirmed from an owned sell offer;
- associated with the legacy offers: confirmed, 3 offers.

### Account 3

| Field | Observed value |
|---|---|
| User ID | `demo-user-3` |
| Login identifier | `director@agrilink.com` |
| Display/name fields | Emma Thompson |
| Database role | `trading_director` |
| Organization/company | AgriLink International |
| `users.verified` | `true` |
| Created | `2025-11-21T08:31:17.529Z` |
| Owns offers | yes — 3 of the 9 legacy offers |
| Offer-type evidence | 1 buy, 2 sell |
| `auth_provider` | null |
| `login_enabled` | null |
| `credential_status` | null |
| `password_hash` present | no |

Classification:

- demo/seed account: confirmed by exact repository seed evidence;
- administrator: no authoritative evidence;
- buyer: confirmed from an owned buy offer;
- seller: confirmed from owned sell offers;
- associated with the legacy offers: confirmed, 3 offers.

### Account 4

| Field | Observed value |
|---|---|
| User ID | `local-admin` |
| Login identifier | `admin@tutela.local` |
| Display/name fields | Local Admin |
| Database role | `admin` |
| Organization/company | Demo Company |
| `users.verified` | `false` |
| Created | `2025-11-26T11:22:46.731Z` |
| Owns offers | no — 0 |
| `auth_provider` | null |
| `login_enabled` | null |
| `credential_status` | null |
| `password_hash` present | no |

Classification:

- demo/seed account: uncertain; no exact active repository seed match was
  found;
- administrator: uncertain; the legacy database role says `admin`, but there
  is no active administration-role authority and the account cannot log in;
- buyer: no authoritative evidence;
- seller: no authoritative evidence;
- associated with the legacy offers: no.

### Inventory safety confirmation

- Transaction mode: read-only, then rolled back
- All four legacy user snapshots: unchanged before versus after
- Database fingerprint:
  `e79139302ae53b2dafb58a2eaf54ab47873df4a15dd3c0026ea0024d424da659`
  before and after
- Sessions before and after inventory: 0
- Session created by inventory: no
- Credential tested by inventory: no
- User, offer, schema, journal, or marker write: none
- Prohibited fields or values reported: none

## Executive summary

Phase 4C restores a useful authenticated dashboard for the retained recovery
trader without activating any unresolved workflow.

The dashboard now obtains one explicit, allow-listed aggregate DTO from
`GET /api/dashboard/overview`. It proves account/session access, counts only
offers whose owner is the authenticated server-side user, and reuses the
strict Phase 3C public marketplace projection. All unresolved domains have
explicit `unavailable` states rather than fabricated zeros, pending states,
demo values, or inferred verification.

For the approved database the result is:

- account: available;
- authenticated session: available;
- recovery trader's offers: empty, count 0;
- public marketplace: empty, published count 0;
- contracts, orders, activity, KYB, verification, subscription, performance
  insights, and AI recommendations: unavailable.

The dashboard no longer loads the legacy metrics, public-offer management,
activity, KYB wizard, subscription/demo, or AI components. Those files were
not deleted; they remain isolated for later domain-specific recovery.

## Repository state

- Branch: `recovery/phase-2-runtime-workflows`
- Approved starting revision:
  `def891f5ce1140ba6410c28a14c19d1c4356886b`
- Dashboard authority analysis: `dbd7e50`
- Safe DTO and module states: `34d442b`
- Authenticated read recovery: `74c533a`
- Safe frontend recovery: `501adc8`
- Failure/presentation hardening: `652c246`
- Security and runtime tests: `9b10981`
- Report commit: this document's commit; final full hash is recorded in the
  handoff
- Approved history was not rewritten

## Final database confirmation

Structural fingerprint:

`e79139302ae53b2dafb58a2eaf54ab47873df4a15dd3c0026ea0024d424da659`

| Table | Final count |
|---|---:|
| `neon_auth.users_sync` | 1 |
| `public.activity_logs` | 0 |
| `public.commodities` | 9 |
| `public.contracts` | 0 |
| `public.offers` | 9 |
| `public.partner_relations` | 0 |
| `public.sessions` | 0 |
| `public.users` | 5 |
| `public.verification_documents` | 0 |
| `public.offer_verifications` | 0 |
| `public.performance_insights_reports` | 0 |

Additional safety state:

- recovery marker: exactly one valid `tutela-recovery-test` row;
- retained recovery trader: exactly one and still satisfies all Phase 4B
  authority predicates;
- legacy users: 4, unchanged;
- legacy offers: 9, unchanged;
- migration journal: unchanged, including succeeded migration `0006`;
- final sessions at rest: 0.

The runtime test holds and compares hashes of all four complete legacy user
rows, all nine complete offer rows, and the complete migration journal before
and after the login/dashboard/restart/logout sequence.

## Dashboard architecture trace

### Recovered path

```text
protected /dashboard route
→ useAuth (/api/auth/user)
→ /api/dashboard/overview
→ Phase 4B authentication authority
├── explicit CurrentUserDto
├── offers.user_id = authenticated session user ID
└── Phase 3C fail-closed marketplace publication projection
→ DashboardOverviewDto
→ independent account, session, my-offers, marketplace, and availability cards
```

### Isolated legacy path

The former dashboard loaded a monolithic metrics route and a mixture of
public-offer, KYB, subscription, activity, and AI components. Its server query
combined:

- compatible offer ownership fields;
- incompatible legacy/current contract fields;
- incompatible verification-document fields;
- a current `audit_logs` model when the legacy database has
  `activity_logs`;
- unresolved financial-volume calculations.

It also converted missing metrics to numeric zero and included create/edit
offer and KYB actions. The recovered page no longer imports or executes that
path.

## Module authority matrix

| Module | Source | Result |
|---|---|---|
| Account | Phase 4B authenticated identity and allow-listed current-user DTO | available |
| Session | authenticated request | available |
| My offers | count filtered by authenticated `offers.user_id` | empty, count 0 |
| Public marketplace | Phase 3C publication projection | empty, count 0 |
| Contracts | unresolved legacy/current lifecycle | unavailable |
| Orders | no recovered lifecycle authority | unavailable |
| Activity | incompatible `activity_logs` / `audit_logs` models | unavailable |
| KYB | no approved KYB authority | unavailable |
| Verification | no approved verification authority | unavailable |
| Subscription | no approved entitlement authority | unavailable |
| Performance insights | generation/semantics outside scope | unavailable |
| AI recommendations | external/inferred behavior outside scope | unavailable |

## Database compatibility characterization

| Existing query | Classification | Phase 4C treatment |
|---|---|---|
| Authentication current user | A — fully compatible after Phase 4B | reused through the safe DTO |
| Offer ownership by `offers.user_id` | A — fully compatible | narrowed to a count owned by the session user |
| Public offers | J / publication trust required | reused Phase 3C strict fail-closed projection |
| Dashboard contract counts | C, E, I | not queried; unavailable |
| Dashboard verification count | C, J | not queried; unavailable |
| Dashboard total volume | C, H, I | not queried; unavailable |
| Dashboard activity | C / legacy table mismatch | not queried; unavailable |
| Public offers used as "my offers" | G and L | removed from dashboard |
| KYB/subscription fallback hooks | J and K | removed from dashboard |
| Hard-coded AI insights | K | removed from dashboard |
| Create/edit/verify dashboard actions | outside authorized scope | removed from dashboard |

No schema or migration change was required.

## Safe dashboard DTO

Each module is:

```text
{
  state: available | empty | unavailable | error,
  data: allow-listed data or null
}
```

The response contains:

- account: existing `CurrentUserDto`;
- session: only `authenticated: true`;
- my offers: only `count`;
- public marketplace: only `publishedOffers` and the approved publication
  policy identifier;
- unresolved modules: `data: null`.

It contains no raw joined rows or object spreading.

## Sensitive fields excluded

The dashboard response excludes:

- password or password-hash fields;
- email and personal legal names;
- phone, address, provider, session, and cookie data;
- user verification internals;
- KYB documents and paths;
- moderation notes and rejection reasons;
- financial ratings and risk scores;
- subscription internals;
- raw contract terms;
- counterparty details;
- database errors.

The runtime suite recursively checks prohibited response keys and also proves
that none of the four legacy user IDs or identifiers appears in the response.

## Ownership protection

- The only user-specific business read uses the authenticated session user ID.
- The route accepts no ownership parameter.
- A request containing another user's ID in the query string returns the same
  recovery-trader result.
- The retained recovery trader owns zero offers.
- None of the nine legacy offers is returned or counted for that trader.
- No organization membership, buyer role, seller role, or administrative
  authority is inferred.
- The public marketplace still uses its separate public DTO and strict
  publication policy.

## Runtime results

| Probe | Result |
|---|---|
| Anonymous dashboard overview | HTTP 401 |
| Real Passport login | HTTP 200 |
| Authenticated dashboard shell | HTTP 200 HTML |
| Account summary | available, safe recovery display identity |
| My offers | empty, count 0 |
| Public marketplace summary | empty, published count 0 |
| Contracts | unavailable, null data |
| KYB | unavailable, null data |
| Legacy dashboard metrics/activity/AI/KYB/plan reads | guarded HTTP 503, never HTTP 500 |
| Optional owned-offer failure | only that module becomes `error` |
| Optional marketplace failure | only that module becomes `error` |
| Session after controlled restart | persisted and dashboard remains HTTP 200 |
| Logout | HTTP 200 |
| Dashboard after logout | HTTP 401 |
| Final sessions | 0 |

## Frontend rendering result

The recovered page:

- has explicit loading skeletons;
- renders account, session, owned-offer, and marketplace cards;
- renders neutral unavailable states independently;
- renders a safe whole-page temporary-unavailable state if the aggregate
  request itself fails;
- keeps only the safe Browse Marketplace action;
- contains no offer creation/editing, KYB, verification, subscription,
  payment, contract, order, or AI action;
- contains no user-facing recovery or schema terminology.

The production frontend bundle completed successfully and the controlled
runtime served the dashboard shell as HTML. The in-app browser surface could
not connect to the local host despite the machine-local health endpoint
returning HTTP 200, so a visual browser click-through and console-log capture
were not asserted. This was isolated to the browser surface; the real
server/API/session runtime probes passed.

## Mechanical fixes made

1. Added explicit dashboard module DTOs and states.
2. Split authoritative offer ownership and marketplace reads into independent
   operations.
3. Added a minimal authenticated offer-count storage method.
4. Scoped ownership exclusively to the server session identity.
5. Reused the existing strict marketplace policy.
6. Converted unresolved domains to explicit unavailable states.
7. Prevented one optional query failure from crashing the dashboard.
8. Replaced the unsafe legacy dashboard composition with the safe read-only
   component.
9. Allowed only the new read-only overview route through the recovery guard.
10. Kept all legacy write and incompatible read routes guarded.

## Files modified

| File | Reason |
|---|---|
| `docs/recovery/phase-4c/dashboard-authority.md` | Record architecture, query compatibility, and module authority before implementation |
| `shared/dashboard.ts` | Define allow-listed dashboard DTO and module states |
| `server/dashboard.ts` | Build independent, fail-safe dashboard modules |
| `server/storage.ts` | Add authenticated-owner offer count |
| `server/routes.ts` | Add protected overview endpoint with safe failures |
| `server/recoveryMode.ts` | Permit only the overview GET/HEAD in controlled recovery |
| `server/recoveryMode.test.ts` | Prove guard permissions remain narrow |
| `client/src/pages/dashboard.tsx` | Bootstrap the safe overview and render loading/error states |
| `client/src/components/dashboard/RecoveryDashboard.tsx` | Render read-only account, offer, marketplace, and availability modules |
| `server/dashboard.test.ts` | Test DTO allow-list, statuses, and partial failures |
| `scripts/dashboard/phase-4c.runtime.test.ts` | Test real login, scope, restart, logout, and database invariance |
| `package.json` | Add narrow dashboard test commands |
| `docs/recovery/phase-4c/phase-4c-report.md` | Record the Phase 4C outcome |

No file was deleted.

## Tests and validation

Unique passing checks: 45.

| Command | Result |
|---|---|
| `npm run test:dashboard` | 6 passed |
| `npm run test:dashboard-runtime` | 1 passed |
| `npm run test:auth-characterization` | 10 passed |
| `npm run test:auth-runtime` | 1 passed |
| `npm run test:marketplace-characterization` | 2 passed |
| `npm run test:marketplace-policy` | 4 passed |
| `npm run test:marketplace-presentation` | 3 passed |
| `npm run test:marketplace-runtime` | 1 passed |
| `npm run test:recovery` | 8 passed |
| `npm run test:migrations` | 5 passed |
| `npm run test:api-request` | 4 passed |
| `npm run check` | passed |
| `npm run build` | passed |

Non-blocking build warnings remain:

- browser compatibility data is outdated;
- the main frontend chunk exceeds the configured warning threshold.

Neither warning is a Phase 4C functional failure.

## Database writes performed

Authorized runtime writes only:

- normal session row creation during real Passport login;
- the existing Phase 4B `last_login_at` update for the retained recovery
  trader;
- logout/session cleanup, returning sessions to zero.

No legacy user, offer, contract, order, verification, KYB, partner,
subscription, migration-journal, recovery-marker, or schema write occurred.

## Risk assessment and unresolved items

### Resolved in this phase

- unsafe raw/monolithic dashboard response risk;
- cross-user offer-count risk;
- public offers incorrectly presented as owned offers;
- fabricated zero contract/verification/financial metrics;
- fabricated KYB/subscription/demo states;
- dashboard-wide failure from one optional module;
- dashboard write controls in the initial view.

### Still unresolved and intentionally unavailable

- contract and order schemas and lifecycle authority;
- activity/audit schema reconciliation;
- KYB and verification authority;
- subscription/payment entitlement;
- performance-insight semantics;
- AI recommendation semantics;
- offer create/edit workflows;
- navigation to other unrecovered authenticated pages;
- browser-level visual/console verification in the current desktop browser
  surface.

The old dashboard components and endpoints remain in the repository because
this phase did not prove they are unused outside their former dashboard path.
They are isolated from the recovered page and guarded during controlled
recovery.

## Recommended next phase

After owner review, the smallest safe next step is a separately authorized
authenticated-navigation and route-availability hardening phase. It should
ensure the application shell does not advertise unrecovered write workflows
and should characterize each remaining authenticated page before enabling it.

That phase must not activate offer writes, contracts, orders, KYB,
verification, payments, blockchain, administration, or production
integrations without their required business decisions.
