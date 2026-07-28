# Phase 5C completion report

Date: 2026-07-28

Status: complete; stopped at the private submission boundary

## Executive summary

Phase 5C recovered exactly one additional business capability: an
authenticated owner can declare a completed private draft `submitted`.

Submission freezes the offer. It does not verify, approve, moderate, activate,
publish, notify, trade, order, contract, pay, invoke blockchain, or invoke AI.
Submitted offers remain owner-only and absent from the public marketplace.

The runtime exercise created one temporary draft, edited it, submitted it,
proved it was private and read-only, and removed that exact submitted row.
The final database has zero recovery-owned offers and zero sessions.

## Branch and commits

- Branch: `recovery/phase-2-runtime-workflows`
- Approved starting revision:
  `798057e67fe4ff74563d6dd7216705ddb1ddfce5`
- Completion revision: recorded by the final Phase 5C report commit

Focused implementation commits:

1. `dd7d4e4` — additive submitted-status migration
2. `544ddda` — owner-only submission boundary
3. `fdd75ce` — private submission interface
4. `67f3292` — submission security and runtime regressions

## Migration

- File: `migrations/0008_add_submitted_offer_status.sql`
- Identifier: `0008_add_submitted_offer_status`
- SHA-256:
  `f5253418f90a32f217c0a81e7c1e048dfe6d926415d959f033e258bb60ebe79b`
- Journal status: `succeeded`
- SQL-executed flag: `true`
- Pre-migration fingerprint:
  `0a899670e067b22692abc0a8f3d9d05c590f84d709d214984e2cf1e1749d1def`
- Post-migration fingerprint:
  `d309afaee7935df8b4e91e42f9f6f6c6e9c646b810640e1683e0512e6777bdbe`

Exact schema change:

```sql
ALTER TYPE public.offer_status
  ADD VALUE IF NOT EXISTS 'submitted';
```

The migration did not remap a status, change a default, backfill a row, or
rewrite a legacy offer. Rehearsal applied the SQL twice in one transaction,
confirmed the expected post-migration fingerprint, and rolled back to the
exact Phase 5B fingerprint.

The addition is idempotent and journal/checksum protected. Once stored rows use
`submitted`, reversing the enum would require a destructive enum rebuild after
proving no row uses the value. No automatic reversal is provided.

## Lifecycle authority

Authoritative meanings:

- `draft`: private, owner-editable, owner-deletable, not submitted.
- `submitted`: private, owner-readable, frozen, waiting for future platform
  processing.

`submitted` provides no trust, approval, verification, moderation,
publication, or trading claim.

## Transition matrix

| Current state | Action | Result | Phase 5C |
|---|---|---|---|
| `draft` | edit commercial fields | `draft` | allowed |
| `draft` | delete | removed | allowed |
| `draft` | submit by owner | `submitted` | allowed |
| `submitted` | list/detail | `submitted` | allowed, read-only |
| `submitted` | submit again by same owner | `submitted` | idempotent |
| `submitted` | edit | none | denied |
| `submitted` | delete | none | denied |
| `submitted` | change status | none | denied |
| `submitted` | publish/activate/verify | none | unavailable |
| legacy/non-draft | submit | none | denied |
| another owner's draft | submit | none | generic not-found |

No `submitted → pending`, `active`, `published`, `verified`,
`pending_verification`, order, contract, payment, or blockchain transition
exists.

## Route and authorization

Added:

```text
POST /api/drafts/:id/submit
```

Requirements enforced:

- authenticated local recovery identity;
- owner derived only from the session;
- no alternate owner parameter;
- current stored status exactly `draft`;
- atomic `draft → submitted` update;
- generic not-found for absent, non-owned, legacy, or non-draft records;
- strict empty request body;
- no client-supplied status or trust authority.

Repeating submission by the same owner returns the existing submitted DTO
without executing another update or changing `updated_at`.

The existing owner list and detail routes now project both private states.
Update and delete continue to use exact `status = draft` predicates, which
makes submitted records read-only without a separate override.

## DTO

`SubmittedOfferSummaryDto` and `SubmittedOfferDetailDto` differ from the draft
DTO only through the discriminating lifecycle state:

```text
status: "submitted"
visibility.state: "private"
```

No trust, verification, moderation, publication, seller authority, KYB,
rating, risk, user, authentication, session, order, contract, payment,
blockchain, or recovery-marker field was added.

## Side-effect isolation

Submission executes one guarded offer-status update. It does not call:

- offer or organization verification;
- moderation;
- activity or audit reconciliation;
- notifications or email;
- orders or contracts;
- payments or escrow;
- blockchain;
- AI or external APIs.

The controlled runtime disabled startup seeding, OpenAI, Stripe, Sentry,
external monitoring, and production integrations.

## Frontend

The private-offers page now provides:

- a Submit Draft action for draft records;
- explicit confirmation before submission;
- Submitted badge and private submitted listing;
- submitted detail presentation;
- read-only submitted state;
- no edit/delete controls after submission;
- explicit wording that submission does not verify, activate, or publish.

No verification, moderation, publication, trading, order, contract, payment,
blockchain, or AI UI was introduced.

## Runtime evidence

The retained recovery trader completed:

```text
login
→ create one draft
→ edit location
→ submit
→ read submitted list/detail
→ prove edit/delete/status/publication unavailable
→ verify marketplace remains empty
→ exact-ID submitted cleanup
→ logout
```

Confirmed:

- server assigned the owner;
- initial state was `draft`;
- one commercial edit succeeded before submission;
- submission changed only `status` and `updated_at`;
- result state was exactly `submitted`;
- visibility remained private;
- repeat submission was idempotent;
- owner list/detail returned the safe submitted DTO;
- another user ID could not submit the draft;
- a legacy active offer could not be submitted;
- submitted edit and delete returned generic not-found;
- client status, verification, publication, and moderation spoofing failed;
- an unimplemented publish route remained blocked;
- no offer-verification or activity row was created;
- dashboard owner count included the private record;
- public marketplace remained HTTP 200 with zero offers;
- exact cleanup removed only the temporary submitted offer.

## Security evidence

Tests prove:

- anonymous submission is denied;
- owner comes from the authenticated session;
- cross-owner submission is denied without existence disclosure;
- legacy and non-draft offers cannot submit;
- submission accepts no client body authority;
- client self-verification and self-publication fields are rejected;
- submitted records are read-only and not deletable;
- submitted records never reach the Phase 3C public projection;
- public `active` still does not bypass the two-proof publication policy;
- DTOs expose no sensitive or trust internals;
- migration checksum and fingerprint are verified;
- recovery-mode route scope allows only the exact submit method.

## Protected-data invariance

- Legacy users: 4, unchanged
- Legacy-user snapshot hash:
  `3369cf18c0fb7ffa5881cdd4a6c25c2da11ef489c46e7b9e52f5d28f41288bbc`
- Legacy offers: 9, unchanged
- Legacy-offer snapshot hash:
  `b9492303d4d3bb157941fd3ed609438761eb85396e83861af4cfb5f77664c2fc`
- Final recovery-owned drafts: 0
- Final recovery-owned submitted offers: 0
- Final sessions: 0
- Final offer verifications: 0
- Final activity logs: 0
- Final marketplace: HTTP 200, zero published offers

## Database writes performed

Authorized writes only:

- additive `submitted` enum value;
- one migration-journal insert/update;
- normal login `last_login_at` and session writes;
- one temporary recovery-owned draft;
- one pre-submission edit to that exact draft;
- one `draft → submitted` transition;
- exact-ID cleanup of that submitted offer;
- session cleanup.

No legacy user, legacy offer, verification, moderation, KYB, partner,
subscription, notification, order, contract, payment, escrow, blockchain, or
AI record was written.

## Files modified

Schema and migration:

- `migrations/0008_add_submitted_offer_status.sql`
- `scripts/offers/submission-migration.ts`
- `shared/schema.ts`

Contracts and validation:

- `shared/drafts.ts`
- `shared/draftValidation.ts`
- `shared/draftValidation.test.ts`

Backend:

- `server/drafts/storage.ts`
- `server/drafts/routes.ts`
- `server/recoveryMode.ts`
- `server/recoveryMode.test.ts`

Frontend:

- `client/src/pages/MyDrafts.tsx`
- `client/src/components/navigation/AppSidebar.tsx`

Regression tooling:

- `scripts/offers/phase-5c.runtime.test.ts`
- current authentication, dashboard, marketplace, offer, and Phase 5B
  regression fingerprints
- `package.json`

## Tests and validation

Passed:

- submission migration rehearsal and verification;
- migration checksum/error-safety tests;
- Phase 5C submission runtime;
- strict draft/submission validation tests;
- offer authority characterization;
- recovery route and disabled-OpenAI tests;
- API request tests;
- authentication characterization and real-session runtime;
- dashboard unit and restart/runtime tests;
- marketplace policy, presentation, characterization, and runtime tests;
- `npm run check`;
- `npm run build`.

The production build retains the existing large-chunk and outdated
Browserslist-data warnings. They are non-failing but remain deployment and
performance work.

## Remaining lifecycle

Unresolved and intentionally absent:

- meaning and use of legacy `pending`;
- platform verification intake and evidence authority;
- organization verification;
- moderation and approval;
- publication eligibility and activation;
- submitted withdrawal, rejection, correction, or return-to-draft;
- owner communication and notification;
- authoritative submission/audit history;
- optimistic concurrency/versioning beyond the atomic status predicate;
- orders, negotiation, contracts, payment, escrow, and blockchain.

The wider legacy generic offer-create/status/detail implementations remain
blocked during controlled recovery and still require separate recovery work
before they can be trusted outside that guard.

## Recommended Phase 6

Phase 6 should start with a decision-only authority package for future
processing of submitted offers. It must define before implementation:

- whether `pending` is retained, replaced, or left legacy-only;
- who may begin verification processing;
- authoritative offer and organization evidence;
- verification versus moderation separation;
- submitted correction, withdrawal, rejection, and return-to-draft rules;
- immutable submission snapshot and audit requirements;
- owner notification boundaries;
- exact condition for any future `active` or public state.

No verification, KYB, administration, publication, order, contract, payment,
blockchain, AI, or deployment work has started.
