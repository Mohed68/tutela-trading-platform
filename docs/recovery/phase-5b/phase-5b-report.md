# Phase 5B completion report

Date: 2026-07-28

Status: complete; stopped before pending submission or verification

## Executive summary

Phase 5B recovered the smallest safe private draft-offer workflow. An
authenticated local recovery trader can create, list, read, edit, and delete
only that trader's `draft` offers. Drafts never enter the public marketplace
projection and cannot transition to another state.

The implementation is a recovery extension, not a rewrite. The legacy offer
routes and monolithic create path remain blocked in controlled recovery mode.
No legacy offer or legacy user was modified.

## Branch and revisions

- Branch: `recovery/phase-2-runtime-workflows`
- Approved starting revision:
  `d8fdfbff5a244e960e478948b4f855dad58b511a`
- Completion revision: recorded by the final Phase 5B report commit

Focused implementation commits:

1. `db34e6f` — draft offer-status migration
2. `1005935` — safe draft request/response DTOs
3. `165f0ff` — temporary Phase 5B draft validation policy
4. `4fa42cc` — owner-only draft storage and routes
5. `01ac991` — private draft frontend
6. `82ff34c` — security and runtime regressions

## Database migration

- Migration: `migrations/0007_add_draft_offer_status.sql`
- Identifier: `0007_add_draft_offer_status`
- SHA-256:
  `b5aa52f9d1a0f0c00a0ddb51cc02ae55d6fcc07b952de20a11544de2bd5be284`
- Journal status: `succeeded`
- SQL-executed flag: `true`
- Pre-migration fingerprint:
  `e79139302ae53b2dafb58a2eaf54ab47873df4a15dd3c0026ea0024d424da659`
- Post-migration fingerprint:
  `0a899670e067b22692abc0a8f3d9d05c590f84d709d214984e2cf1e1749d1def`

The exact schema change was:

```sql
ALTER TYPE public.offer_status
  ADD VALUE IF NOT EXISTS 'draft';
```

The existing default remains `active`. No status was remapped, no default was
changed, and no row was backfilled. Rehearsal applied the migration twice in
one transaction, confirmed the expected fingerprint, and rolled back to the
exact pre-migration fingerprint.

The migration is safely idempotent and journal-protected. The enum addition is
forward-only once production data uses it. Removing an enum value would
require a destructive enum rebuild after proving no row uses `draft`; no
automatic reversal is provided.

## Protected-data invariance

- Legacy users: 4, unchanged
- Legacy-user snapshot hash:
  `3369cf18c0fb7ffa5881cdd4a6c25c2da11ef489c46e7b9e52f5d28f41288bbc`
- Legacy offers: 9, unchanged
- Legacy-offer snapshot hash:
  `b9492303d4d3bb157941fd3ed609438761eb85396e83861af4cfb5f77664c2fc`
- Final recovery-owned offers: 0
- Final sessions: 0
- Final offer verifications: 0
- Final activity logs: 0
- Public marketplace: HTTP 200, 0 published offers

## Lifecycle semantics

`draft` means a private, owner-editable, unpublished record. Phase 5B allows
only:

- create as `draft`;
- `draft` to `draft` commercial-field updates;
- physical deletion of an owned, dependency-free draft.

Phase 5B provides no submit, pending, active, publish, verification,
moderation, archive, restore, negotiation, order, contract, or payment
transition.

## Request contracts and validation

The create contract accepts only:

- `offerType`: `buy` or `sell`;
- `commodityId`: an existing commodity UUID;
- `quantity`: positive `numeric(15,2)`-compatible decimal text;
- `unit`: an approved unit for the selected commodity;
- `amountPerUnit`: positive `numeric(15,2)`-compatible decimal text;
- `currency`: `USD`;
- `location`: non-empty, at most 255 characters;
- `validUntil`: optional valid future ISO timestamp.

The update contract is a strict, non-empty patch over the same commercial
fields. `validUntil` may also be cleared to `null`. Changing a commodity or
unit validates the resulting commodity/unit pair.

The contracts reject unknown keys and client-supplied owner, lifecycle,
verification, seller authority, organization authority, moderation,
publication, timestamps, and related-workflow fields. NaN, Infinity, zero or
negative values, excessive precision, unsafe coercions, arbitrary currencies,
arbitrary units, invalid offer types, invalid commodities, malformed dates,
and expired dates are rejected.

Optional minimum quantity, delivery/payment terms, Incoterms, specifications,
and notes were omitted because their authoritative Phase 5B semantics remain
unresolved and the database permits safe omission.

## Temporary Phase 5B policy boundary

The USD-only and current-unit rules are isolated in
`server/drafts/policy.ts`. They are explicitly a Phase 5B recovery policy, not
a permanent Tutela measurement or currency design.

The unit choices delegate to the existing commodity conversion profiles.
Draft creation performs no conversion or normalization. Validated quantity,
unit, price, and currency values are inserted directly into their original
database columns.

## Safe DTOs

The implementation defines:

- `DraftOfferSummaryDto`;
- `DraftOfferDetailDto`;
- `CreateDraftOfferRequest`;
- `UpdateDraftOfferRequest`;
- `DeleteDraftOfferResponse`;
- `DraftOfferOptionsDto`.

Responses contain only draft ID, safe commodity and commercial values,
private-draft lifecycle/visibility, and timestamps. They contain no raw user,
email, authentication, organization trust, verification evidence, moderation,
ratings, risk, KYB, contract, order, payment, blockchain, session, or recovery
marker data. The Phase 3C public marketplace DTO is unchanged.

## Authorization and storage

- Authentication is required for every draft route.
- The actor is refreshed from the existing local-auth authority before each
  operation.
- Ownership comes only from the authenticated session.
- Detail, update, and delete queries include ID, owner ID, and exact
  `status = draft` predicates.
- Cross-owner and non-draft access returns the same generic not-found result.
- Storage uses explicit legacy-compatible projections rather than the unsafe
  full Drizzle offer/user join.
- Delete locks the candidate row, checks existing offer-verification and
  contract dependencies, refuses dependencies without cascading, and retains
  foreign-key refusal as a final integrity boundary.

## Routes

- `GET /api/drafts/options`
- `GET /api/drafts`
- `POST /api/drafts`
- `GET /api/drafts/:id`
- `PATCH /api/drafts/:id`
- `DELETE /api/drafts/:id`

The existing `POST /api/offers`, raw offer detail, arbitrary status update,
and verification routes remain blocked in controlled recovery mode.

## Isolated side effects

The draft path does not call:

- verification or moderation;
- `activity_logs` or `audit_logs`;
- email or notifications;
- OpenAI or other external APIs;
- blockchain;
- payments;
- orders or contracts.

It does not reuse the legacy monolithic create function. One SQL insert is the
entire create side effect.

## Frontend workflow

`/my-offers` now renders the recovered “My Drafts” interface:

- safe empty state;
- create form populated from server-provided commodity/unit options;
- private/unpublished explanation;
- draft cards and detail dialog;
- edit form;
- delete confirmation;
- loading, error, and mutation states;
- dashboard cache refresh after create/update/delete.

The interface exposes no submit, activate, publish, verify, moderate,
negotiate, order, contract, payment, blockchain, or AI action.

## Runtime result

The runtime test used the retained recovery trader and created exactly one
synthetic draft. It confirmed:

- owner was assigned by the server;
- state was exactly `draft`;
- DTO visibility was private;
- original validated quantity/unit/price/currency were stored without
  conversion;
- owner list and detail contained only that draft;
- anonymous operations were denied;
- another user ID could not read, update, or delete it;
- legacy/non-draft offers could not be reached through draft routes;
- authority/status/trust/moderation overrides were rejected;
- one location update changed only `location` and `updated_at`;
- no verification or activity row was created;
- marketplace remained at zero;
- dashboard owner count reflected the draft without publishing it;
- exact-ID deletion removed only that draft;
- logout and cleanup returned sessions and recovery-owned offers to zero.

No external integration credentials were passed to the controlled runtime and
recovery guards kept startup monitoring, seeding, OpenAI, Stripe, Sentry, and
other production integrations disabled.

## Database writes performed

Authorized writes only:

- enum addition for `draft`;
- one migration journal insert/update;
- normal login `last_login_at` and session writes;
- one synthetic recovery draft insert;
- one update to that exact draft;
- deletion of that exact draft;
- session cleanup.

No legacy user, legacy offer, verification, moderation, KYB, partner,
subscription, order, contract, payment, or blockchain row was written.

## Validation results

Passed:

- draft validation and temporary policy tests;
- owner/draft route recovery-guard tests;
- complete Phase 5B runtime test;
- offer authority characterization;
- migration checksum/rehearsal tests and migration verification;
- API request tests;
- authentication characterization and real session runtime;
- dashboard unit and runtime regressions;
- marketplace policy, presentation, characterization, and runtime regressions;
- recovery-mode and disabled-OpenAI tests;
- `npm run check`;
- `npm run build`.

The build retains the existing Vite large-chunk and outdated Browserslist-data
warnings. They do not fail compilation but remain deployment/performance work.

## Files modified

Schema and contracts:

- `migrations/0007_add_draft_offer_status.sql`
- `shared/schema.ts`
- `shared/drafts.ts`
- `shared/draftValidation.ts`

Backend:

- `server/drafts/policy.ts`
- `server/drafts/storage.ts`
- `server/drafts/routes.ts`
- `server/recoveryMode.ts`
- `server/routes.ts`

Frontend:

- `client/src/pages/MyDrafts.tsx`
- `client/src/App.tsx`
- `client/src/components/navigation/AppSidebar.tsx`
- `client/src/config/routes.ts`

Tooling and tests:

- `scripts/offers/draft-migration.ts`
- `scripts/offers/phase-5a.characterization.test.ts`
- `scripts/offers/phase-5b.runtime.test.ts`
- authentication, dashboard, and marketplace regression fingerprints
- `server/drafts/policy.test.ts`
- `server/recoveryMode.test.ts`
- `shared/draftValidation.test.ts`
- `package.json`

## Remaining risks

- `pending` semantics remain unresolved.
- There is no submission, verification, publication, or moderation handoff.
- The wider shared offer schema still declares legacy-incompatible columns and
  `hidden`/`archived` statuses; the safe draft storage intentionally bypasses
  that drift.
- The legacy generic create/status/detail implementations remain unsafe
  outside the controlled recovery guard and were not repaired or removed.
- Draft optimistic concurrency and create idempotency are not authoritative.
- No persistent offer-level recovery provenance exists; runtime cleanup relies
  on the exact generated ID plus owner and `draft` predicates.
- Draft audit logging is intentionally absent until a compatible authoritative
  audit model is approved.
- Frontend bundle size requires later deployment/performance work.

## Future product requirement: Flexible Commercial Measurement and Currency Layer

Future Tutela design must preserve original customer-entered commercial values
separately from internal comparison values. This future requirement covers:

- commodity-specific unit catalogs;
- regional and industry-specific units;
- customer-selected pricing basis;
- preservation of original submitted values;
- transparent conversion previews;
- canonical internal normalization;
- exchange-rate source and timestamp;
- conversion-factor versioning;
- rounding and precision policy;
- user confirmation before converted values are relied upon;
- prevention of duplicate or semantically equivalent unit labels;
- marketplace display in original and optionally preferred user units.

The future model should retain original quantity, unit, price, currency, and
pricing basis, while storing normalized quantity, canonical comparison unit,
normalized price, comparison currency, exchange-rate/conversion metadata,
timestamp, and source for comparison, filtering, sorting, VWAP, analytics,
matching, and benchmarking.

No part of that normalization, conversion, exchange-rate, additional-currency,
or additional-unit layer was implemented in Phase 5B.

## Recommended Phase 5C scope

Do not infer a submission workflow from `pending`. Phase 5C should begin with
a separate business-decision package for:

- exact `pending` meaning;
- draft submission authority and validation;
- verification/moderation handoff;
- post-submission field mutability;
- optimistic concurrency and idempotency;
- authoritative audit behavior;
- cancellation/withdrawal and retention rules.

No Phase 5C work has started.
