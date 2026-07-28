# Phase 5A offer lifecycle authority and safe write-recovery report

Date: 2026-07-28

Status: characterization complete; mandatory stop before offer-write
implementation

## Executive summary

Phase 5A proves that the current repository cannot safely implement the
preferred draft-only owner workflow without a business and schema decision.

The database `offer_status` enum contains:

`active`, `pending`, `closed`, `cancelled`

It does not contain `draft`. The shared schema also lacks `draft`; only the
stale `MyOffers` frontend invents it. No authoritative evidence defines
`pending` as a private, owner-editable draft. Reusing it would change business
semantics without approval.

All nine legacy offers are stored as `active`, but every `valid_until` date is
now past. This proves stored lifecycle and expiry are separate and currently
unsynchronized.

The existing create route is also not mechanically recoverable:

- it validates with a broad schema that accepts client ownership, trust, and
  moderation fields;
- it accepts zero quantity, negative price, arbitrary units/currencies, and
  empty location;
- it creates with `active` as the default;
- it automatically starts offer verification;
- it performs incompatible activity writes without a transaction;
- it can leave a partial offer write after reporting failure.

Recovery mode continues blocking all offer writes and raw private-detail
routes. No offer, user, session, verification, schema, or other database write
was performed in Phase 5A.

## Repository state

- Branch: `recovery/phase-2-runtime-workflows`
- Approved starting revision:
  `37f3486d3039739603919445f74a15c13278dd4c`
- Architecture/inventory commit: `037ebe7`
- Authority/decision commit: `7056a98`
- Characterization-test commit: `22da01c`
- Report commit: this document's commit; final full hash is recorded in the
  handoff
- Approved history was not rewritten

## Database state

Fingerprint:

`e79139302ae53b2dafb58a2eaf54ab47873df4a15dd3c0026ea0024d424da659`

| State | Count |
|---|---:|
| Legacy users | 4 |
| Recovery traders | 1 |
| Offers | 9 |
| Recovery-trader offers | 0 |
| Sessions | 0 |
| Offer verifications | 0 |
| Contracts | 0 |
| Verification documents | 0 |

Snapshot hashes:

- legacy users:
  `3369cf18c0fb7ffa5881cdd4a6c25c2da11ef489c46e7b9e52f5d28f41288bbc`;
- legacy offers:
  `b9492303d4d3bb157941fd3ed609438761eb85396e83861af4cfb5f77664c2fc`.

The hashes remained unchanged through all Phase 5A inspection and testing.
The recovery marker remained valid. No production/Render environment was
active. A locally configured OpenAI variable remained disabled by the recovery
guard and no external integration was contacted.

## Legacy-offer inventory

All owners are confirmed demo/seed-classified legacy users. No counterparty
personal data was inspected or reported.

| Offer ID | Owner | Type | Commodity | Quantity / unit | Price USD | Status / expiry | Phase 3C public |
|---|---|---|---|---|---:|---|---|
| `dbefd152-6526-4ceb-bc6f-d9ade59ecff5` | `demo-user-1` | sell | WTI Crude Oil | 10,000 barrels | 78.45 | active / expired | no |
| `49d6c4b6-1d93-411a-ae02-f7cb6d5c2b3b` | `demo-user-1` | buy | Natural Gas | 50,000 MMBtu | 2.85 | active / expired | no |
| `f99ec48a-af7c-4cfe-a160-02c4701953aa` | `demo-user-1` | sell | Brent Crude Oil | 25,000 barrels | 82.20 | active / expired | no |
| `b2bdd386-f8e6-41ba-a592-213be872eccf` | `demo-user-2` | buy | Gold Bullion | 100 bars (400oz) | 775,000 | active / expired | no |
| `f3e6b280-ebd6-4794-af76-a217acd37fcd` | `demo-user-2` | sell | Silver Bullion | 500 bars (1000oz) | 23,500 | active / expired | no |
| `e19f0e34-bf49-40b1-820a-4a3dd2fbc93d` | `demo-user-2` | buy | Copper Cathode | 250 metric tons | 8,450 | active / expired | no |
| `74d76314-5f42-4097-aa8e-68fdaae2ff4e` | `demo-user-3` | sell | Wheat | 5,000 metric tons | 285 | active / expired | no |
| `24388766-71fd-4ab5-add6-7fd582456a67` | `demo-user-3` | buy | Soybeans | 10,000 metric tons | 445 | active / expired | no |
| `235f1eda-deac-4c08-b8c6-f1052511e2e5` | `demo-user-3` | sell | Arabica Coffee | 100 bags (60kg) | 195 | active / expired | no |

All use USD. Delivery terms contain a mixture of Incoterm-like prefixes and
free prose; the table has no separate Incoterm field. Full authorized
structural inventory, validity dates, terms, and timestamps are recorded in
`offer-architecture-inventory.md`.

## Offer architecture trace

```text
MyOffers.tsx
├── optional fabricated demo rows
├── GET /api/offers?filter=my
│   └── storage.getOffers(sessionUserId)
│       └── full offers + commodities + users selection
│           └── fails on current-code-only columns
├── PATCH /api/offers/:id/status
│   └── updateOfferStatus(id, arbitrary status)
│       └── no owner predicate or transition validation
└── /create-offer
    └── no registered route

CreateOfferModal
└── POST /api/offers
    ├── broad insertOfferSchema
    ├── storage.createOffer
    ├── incompatible activity log
    ├── duplicate activity log
    └── automatic pending verification submission

Public marketplace
└── dedicated Phase 3C minimal projection
    └── requires explicit offer + seller-organization verification
```

## Database schema summary

Authoritative required database fields:

- owner user ID;
- commodity ID;
- buy/sell type;
- quantity;
- unit;
- price per unit;
- location.

Authoritative optional/default fields:

- currency, default USD;
- lifecycle status, default active;
- validity date;
- minimum quantity;
- delivery terms;
- payment terms;
- timestamps.

Missing database concepts declared by current code:

- offer and seller-organization verification;
- organization/delegate identity;
- offer-specific specification/delivery variants;
- moderation;
- recovery provenance;
- version/idempotency;
- draft lifecycle.

The table has only primary-key, owner FK, and commodity FK constraints. It has
no positive-number, text-length, unit, currency, expiry, lifecycle-transition,
or owner index constraint.

## Field authority result

Fields safe for future owner DTO projection:

- explicit core offer facts;
- safe commodity ID/name/category;
- quantity/unit;
- price/currency;
- location;
- lifecycle value;
- derived expiry state;
- optional minimum, delivery, payment, and validity terms;
- timestamps.

Fields never accepted from client authority:

- ID and owner;
- lifecycle status;
- verification/publication fields;
- seller/organization/delegate fields;
- moderation;
- timestamps;
- recovery provenance;
- order, contract, payment, blockchain, or admin fields.

Every individual database and current-code field is classified in
`offer-authority-decision.md`, including owner/public DTO eligibility and the
required decision.

## Lifecycle status matrix

| Value/concept | Persisted authority | Meaning proven | Owner transition authorized |
|---|---|---|---|
| `active` | database/shared | only stored state; not publication proof | no |
| `pending` | database/shared | no | no |
| `closed` | database/shared | terminal/reopen behavior unknown | no |
| `cancelled` | database/shared | side effects/reversibility unknown | no |
| `hidden` | shared/admin only; DB rejects | moderation concept | no |
| `archived` | shared/admin only; DB rejects | moderation concept | no |
| `draft` | stale frontend only | no | no |
| `pending_verification` | stale frontend only | verification, not lifecycle | no |
| `paused` | stale frontend only; DB rejects | no | no |
| `sold_out` | stale frontend only; DB rejects | no | no |
| expired | derived from date | separate from stored lifecycle | no stored transition |

Lifecycle, verification, publication, moderation, and expiry must remain
separate.

## Transition matrix

No owner transition is authorized.

| Transition | Result |
|---|---|
| create → draft | blocked: draft does not exist |
| create → pending | blocked: pending meaning unproven |
| create → active | Option B only; not authorized |
| draft → active/cancelled | blocked: no draft |
| pending → active | blocked: no submission/approval authority |
| active → closed/cancelled | blocked: consequences unknown |
| active → expired | date-derived only; legacy rows prove no stored transition |
| closed/cancelled → active | blocked: reopen semantics absent |
| owner archive/delete | blocked: no authoritative retention semantics |

## Ownership model and current route safety

The authoritative owner is `offers.user_id`, assigned from the authenticated
session.

Current findings:

- owner list applies the correct session filter but returns raw joined rows and
  fails against the database schema;
- owner detail has no owner predicate;
- status update has no owner predicate;
- verification submission has no offer-owner predicate;
- create overwrites client owner with session owner in storage, but the
  validator still accepts client owner and other authority fields;
- recovery mode blocks all current writes and raw detail;
- the recovery trader cannot currently modify a legacy offer because the
  outer recovery guard rejects the request.

A future safe query must combine offer ID and session owner ID in one database
predicate and return generic not-found for cross-user access.

## Unsafe or stale routes

| Route | Result |
|---|---|
| `GET /api/offers?filter=my` | owner filter exists; raw/missing-column failure |
| `GET /api/offers/:id` | no owner check; raw joined user |
| `POST /api/offers` | broad authority, active default, automatic verification, partial-write risk |
| `PATCH /api/offers/:id/status` | no owner check or transition validation |
| `POST /api/offers/:id/verify` | no offer-owner check; outside scope |
| Admin moderation routes | outside scope and incompatible with legacy schema |

All remain blocked where recovery mode requires.

## Candidate safe contracts

### Create

Design-only allow-list:

- offer type;
- commodity ID;
- quantity;
- unit;
- amount per unit;
- optional currency;
- location;
- optional minimum quantity;
- optional delivery terms;
- optional payment terms;
- optional validity date.

Server-only:

- ID;
- owner;
- timestamps;
- initial lifecycle state;
- non-public state.

Implementation is blocked until initial lifecycle and validation vocabularies
are approved.

### Update

Only fields explicitly declared mutable by a future lifecycle decision.
Owner, status, verification, publication, organization, moderation, and
timestamps must not be part of the request.

Lifecycle transitions require a separate explicit endpoint and transition
matrix.

## DTO definitions

Design-only DTOs were specified for:

- owner summary;
- owner detail;
- create request;
- update request.

They contain explicit core fields only and exclude raw users, personal data,
verification evidence, moderation/rejection data, ratings, contracts, orders,
payments, blockchain, and raw errors.

The public DTO remains unchanged from Phase 3C.

## Validation rules

Proven mechanical constraints:

- offer type must be buy or sell;
- commodity must exist;
- decimals must fit `numeric(15,2)`;
- client authority fields must be rejected;
- malformed input must receive generic errors.

Decisions still required:

- strict-positive versus zero price;
- supported unit vocabulary per commodity;
- supported currencies;
- structured Incoterm versus free delivery prose;
- future/required validity;
- minimum-quantity invariants;
- maximum text lengths;
- idempotency;
- optimistic concurrency and stale updates.

Current generic validation enforces none of those commercial constraints except
the buy/sell enum and value types.

## Options

### Option A — Draft only

- Best future isolation and lowest publication risk.
- Currently blocked because draft does not exist and pending has no proven
  draft meaning.
- A retained recovery offer also lacks a persistent recovery-provenance field.
- Recommended design after a lifecycle/schema decision, not for current
  implementation.

### Option B — Active but unpublished

- Technically fits the database default.
- Phase 3C would still keep it non-public without trust proofs.
- Higher future publication risk and unclear “active” meaning.
- Not authorized and not recommended for Phase 5A.

### Option C — Full verification handoff

- Requires verification, organization, KYB, moderation, and publication
  authority.
- Outside scope.

## Recommended option

Do not implement any option yet.

The preferred future direction remains Option A, but only after explicit
approval of either:

1. an additive private `draft` lifecycle state; or
2. a business-rule declaration that existing `pending` means private,
   owner-editable draft.

The second choice is a semantic change and must not be inferred.

## Business decisions required

1. Draft versus pending.
2. Owner-allowed transitions and mutability.
3. Cancellation, archive, deletion, retention, and reopen behavior.
4. Expiry behavior.
5. Unit, currency, Incoterm, price, and text rules.
6. Idempotency and optimistic concurrency.
7. Recovery-offer provenance and cleanup.
8. Authoritative activity log and atomic write requirements.

## Implementation and runtime results

Implementation performed: none.

| Requested result | Phase 5A outcome |
|---|---|
| Recovery offer | not created |
| Owner-only listing | characterized; current route unsafe/broken |
| Owner detail | characterized; current route lacks ownership |
| Edit | no current route; not implemented |
| Cancel/archive/delete | semantics unproven; not performed |
| Public marketplace | HTTP 200, 0 offers |
| Cross-user writes | outer recovery guard blocks them |
| Legacy offers | 9 unchanged |
| Legacy users | 4 unchanged |
| Recovery authority | trader only, unchanged |
| Sessions | 0 |
| External integrations | none contacted |

No browser validation was necessary because no frontend workflow was changed.

## Files modified

| File | Reason |
|---|---|
| `docs/recovery/phase-5a/offer-architecture-inventory.md` | Record complete architecture and legacy inventory |
| `docs/recovery/phase-5a/offer-authority-decision.md` | Record field/lifecycle matrices, DTO designs, options, and stop boundary |
| `scripts/offers/phase-5a.characterization.test.ts` | Prove database, schema, validation, guard, and invariance findings |
| `package.json` | Add the narrow offer-characterization test command |
| `docs/recovery/phase-5a/phase-5a-report.md` | Record completion outcome |

No application behavior or runtime source file was modified. No file was
deleted.

## Commits created

1. `037ebe7` — offer architecture and legacy inventory
2. `7056a98` — field and lifecycle authority matrices
3. `22da01c` — read-only offer characterization tests
4. report commit — this report

## Tests

Read-only/no-business-write checks passed: 47.

| Command | Result |
|---|---|
| `npm run test:offer-characterization` | 4 passed |
| `npm run test:dashboard` | 6 passed |
| `npm run test:auth-characterization` | 10 passed |
| `npm run test:marketplace-characterization` | 2 passed |
| `npm run test:marketplace-policy` | 4 passed |
| `npm run test:marketplace-presentation` | 3 passed |
| `npm run test:marketplace-runtime` | 1 passed |
| `npm run test:recovery` | 8 passed |
| `npm run test:migrations` | 5 passed |
| `npm run test:api-request` | 4 passed |
| `npm run check` | passed |
| `npm run build` | passed |

Offer-write, owner-edit, cross-user write, cancellation, and offer-cleanup
runtime tests were not run because no write workflow was authorized or
implemented. Authentication/dashboard runtime suites that create session rows
were not rerun after the stop decision; their accepted Phase 4C results remain
unchanged, and no runtime source was modified.

## Database writes and cleanup

- Offer writes: none
- User writes: none
- Session writes: none
- Verification writes: none
- Journal/schema writes: none
- Recovery offer retained: none
- Cleanup required: none
- Final sessions: 0

## Unresolved offer risks

- No private draft state.
- Active/expiry inconsistency.
- Unsafe broad create validation.
- Automatic verification coupling.
- Non-atomic partial-create risk.
- Raw joined-user owner responses.
- Missing owner predicates.
- Arbitrary status mutation.
- Conflicting frontend/database statuses.
- Missing `/create-offer` route and real edit flow.
- No provenance, idempotency, concurrency, or authoritative audit path.

## Recommended Phase 5B scope

Phase 5B should be a business-decision and additive draft-state design phase,
not a write implementation phase, unless the owner first approves:

- the exact private initial lifecycle state;
- lifecycle transitions and deletion/retention semantics;
- required validation vocabularies;
- recovery provenance;
- atomic activity logging.

Only after those decisions should a new implementation authorization permit
one isolated owner draft and the 28 conditional security/runtime tests.

Do not activate verification, KYB, publication, orders, contracts, payments,
blockchain, AI, administration, or deployment in Phase 5B.
