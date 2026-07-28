# Phase 6B — Verification Engine Implementation Report

Date: 2026-07-28

Status: complete; stopped before the next capability

Authoritative architecture:
`docs/architecture/verification-engine-v2.md`

Branch: `recovery/phase-6b-verification-engine`

## Executive summary

Phase 6B implemented Tutela's approved Offer Verification Engine Version 2 as
an additive, fail-closed capability.

An authenticated owner submission now atomically:

1. creates an immutable Submission Revision;
2. stores one queued Verification Attempt;
3. records a `verification_queued` event;
4. creates one durable internal command;
5. remains private `submitted`.

An internal worker claims the command, evaluates deterministic technical and
commercial rules, persists one immutable decision with structured findings,
and records completion. A separate Workflow Coordinator then consumes the
decision and owns the lifecycle transition:

- `approved`: `submitted → verified`;
- `revision_required`: `submitted → draft`;
- `manual_review`: remains `submitted`.

The Verification Engine never changes offer lifecycle. The Workflow
Coordinator never evaluates rules.

No KYB, organization verification, compliance, marketplace publication,
moderation, order, negotiation, contract, payment, escrow, blockchain, AI
decision, risk scoring, notification, or email behavior was added.

## Commits

Focused Phase 6B commits:

1. `fa86a7a` — mark Version 2 architecture authoritative
2. `d441093` — add deterministic verification domain engine
3. `022a044` — add verification persistence migration
4. `f0f917b` — orchestrate immutable offer verification
5. `509d48a` — harden recovery and regression coverage
6. completion report commit — current Phase 6B completion revision

## Domain implementation

Shared contracts now define independently:

- Offer Verification Process:
  `not_started`, `queued`, `running`, `completed`;
- Verification Decision:
  `approved`, `revision_required`, `manual_review`;
- Confidence:
  `HIGH`, `MEDIUM`, `LOW`;
- Severity:
  `INFO`, `WARNING`, `ERROR`, `CRITICAL`;
- finding disposition:
  `owner_correctable`, `requires_platform_review`;
- policy family:
  `technical`, `commercial`, `system`;
- stable Rule IDs;
- stable Reason Codes;
- immutable submitted-offer snapshot;
- engine result and eligibility projection contracts.

Process state, decision, lifecycle, severity, disposition, confidence, and
eligibility are separate types and responsibilities.

## Deterministic validation

### Technical Policy

Version: `technical-recovery-v1`

Technical rules validate:

- required values;
- Submission Revision identity;
- submitted record version;
- offer type;
- commodity reference fields;
- positive database-compatible quantity and price;
- recognized unit identifier;
- recognized currency identifier;
- location;
- validity parsing and expiration;
- snapshot schema version;
- exact `submitted` lifecycle assertion.

### Commercial Policy

Version: `commercial-phase5b-recovery-v1`

Commercial rules validate:

- supported commodity;
- supported buy/sell commercial model;
- commodity-specific unit policy;
- temporary Phase 5B USD policy.

The implementation reuses the existing commodity-unit policy boundary. It does
not duplicate the catalog, normalize values, convert values, or make USD/current
units permanent platform constraints.

### Decision reduction

The algorithm is deterministic:

1. any `requires_platform_review` finding produces `manual_review`;
2. otherwise any finding produces `revision_required`;
3. otherwise the decision is `approved`.

Severity is persisted metadata and is not read by the reducer.

Unexpected errors, unavailable recorded versions, schema conflicts, and offer
state/revision conflicts cannot approve.

### Confidence

Confidence model: `deterministic-v1`

- `approved → HIGH`
- `revision_required → HIGH`
- `manual_review → LOW`

Confidence has no lifecycle, decision, eligibility, or publication authority.

## Stable rules and reasons

Every finding persists:

- stable Rule ID;
- Reason Code;
- severity;
- disposition;
- policy family;
- exact policy version;
- deterministic evaluation order.

The implemented rule catalog includes technical Rules `TECHNICAL-001` through
`TECHNICAL-011`, commercial Rules `COMMERCIAL-001`, `COMMERCIAL-002`,
`COMMERCIAL-014`, `COMMERCIAL-015`, and system Rules `SYSTEM-001`,
`SYSTEM-002`, `SYSTEM-003`, `SYSTEM-999`.

Reason records contain no human sentence, submitted value, personal data,
document, credential, secret, or raw exception.

## Migration

Migration:

- identifier: `0009_verification_engine`
- file: `migrations/0009_verification_engine.sql`
- SHA-256:
  `baa66a06bad5b6c60d1929f5330830dc46653914de92a864fb21db15a700ef83`
- execution status: `succeeded`
- SQL executed: `true`
- pre-migration fingerprint:
  `d309afaee7935df8b4e91e42f9f6f6c6e9c646b810640e1683e0512e6777bdbe`
- post-migration fingerprint:
  `aeb77478a423b407e5e69705f78b7948e8020411b7defa26f605568f616fc401`

### Additive schema

The migration adds the private `verified` value to `public.offer_status` and
creates:

- `public.offer_submission_revisions`
- `public.offer_verification_attempts`
- `public.offer_verification_findings`
- `public.offer_verification_events`
- `public.offer_verification_commands`
- `public.offer_workflow_transitions`

It adds foreign keys, unique/idempotency constraints, process/decision/
confidence checks, stable finding catalogs, active-attempt uniqueness, command
claim consistency, and workflow mapping constraints.

It does not:

- add a column to a legacy offer;
- rewrite a legacy offer;
- change an offer default;
- backfill an offer or decision;
- modify a user;
- repurpose `public.offer_verifications`;
- create organization/KYB/publication data.

### Rehearsal

The migration was executed twice inside one transaction. Rehearsal confirmed:

- expected post-migration fingerprint;
- idempotent SQL;
- all six new tables empty;
- legacy user snapshot unchanged;
- legacy offer snapshot unchanged;
- complete rollback;
- exact pre-migration fingerprint restored after rollback.

The migration was committed before execution so the journal records stable Git
provenance and checksum.

### Rollback considerations

No automatic down migration is supplied.

Removing `verified` from a PostgreSQL enum requires a destructive enum rebuild
after proving no row uses it. Dropping verification history would destroy audit
evidence and requires explicit approval. Recovery therefore uses forward,
additive reconciliation.

## Persistence and history

### Submission Revision

Submission history is stored outside the legacy offer row. This preserves
legacy row hashes and gives each submission immutable revision identity,
snapshot, fingerprint, schema version, record version, and timestamp.

### Verification Attempt

Each attempt stores:

- offer and Submission Revision;
- attempt sequence and idempotency key;
- immutable snapshot and SHA-256 fingerprint;
- process state;
- write-once decision and confidence;
- engine, snapshot, technical-policy, commercial-policy, and confidence-model
  versions;
- lease state;
- queue/start/completion timestamps.

### Findings and events

Findings are structured and ordered. Process events are append-only:

- `verification_queued`
- `verification_claimed`
- `verification_claim_expired`
- `verification_completed`

### Current versus historical

Current applicability uses exact offer ID, Submission Revision, and attempt
sequence. Returning an offer to draft preserves its completed attempt. Editing
and resubmitting creates a new revision and attempt without modifying history.

## Internal orchestration

### Durable trigger

The owner submission transaction creates the revision, queued attempt, event,
and command atomically. The HTTP client cannot provide verification authority.

### Worker

The worker:

- uses at-least-once durable delivery;
- claims with row locking and skip-locked behavior;
- stores only a claim-token hash;
- rejects expired claims at completion;
- recovers expired work to the same logical attempt;
- resolves exact recorded engine/policy versions;
- fails closed when recorded versions are unavailable;
- cannot write a second terminal decision.

A worker-disable switch exists only when both controlled recovery mode and a
non-production environment are active. It preserves the historical Phase 5C
submission-boundary regression test and cannot disable production processing.

### Workflow Coordinator

The coordinator:

- consumes only completed persisted decisions;
- imports no rule engine;
- locks the current offer;
- confirms exact Submission Revision;
- applies only the approved mapping;
- records applied/already-applied/stale transition history;
- is idempotent by attempt;
- rejects stale results.

Decision persistence and lifecycle transition are separate transactions and
ownership boundaries.

## Architecture compliance

| Version 2 requirement | Implementation evidence |
|---|---|
| Engine owns verification only | Pure engine has no database, route, lifecycle, marketplace, KYB, payment, contract, blockchain, AI, email, or notification dependency |
| Coordinator owns lifecycle | Only coordinator applies verification-driven offer transitions |
| Process and decision separated | Independent contracts and persistence columns |
| Stable Rule Identity | Cataloged Rule IDs persisted with every finding |
| Reason Code architecture | Allowlisted machine codes with no human/raw data |
| Severity metadata | Persisted independently; static test proves reducer does not read it |
| Independent policy versions | Separate technical and commercial versions per attempt/finding |
| Confidence metadata | Independently versioned deterministic mapping |
| Immutable snapshot/history | Revision snapshots, fingerprints, attempts, findings, events, and no runtime update path for completed history |
| Automatic server trigger | Submission atomically queues one platform-owned attempt |
| Duplicate/concurrency protection | Idempotency keys, unique constraints, locks, leases, compare-and-set completion, coordinator operation keys |
| Fail closed | Unknown errors, unavailable versions, stale revision, and lifecycle conflict become manual review or stale no-op |
| Manual review boundary | Completed decision; offer remains submitted unless an external conflicting test mutation made the coordinator stale |
| Marketplace decoupling | No marketplace write/integration; strict public repository remains unchanged |
| Phase 5 compatibility | Draft, submission, auth, dashboard, and marketplace runtime regressions pass |

Architecture-compliance tests statically verify that the engine cannot own
lifecycle and that the coordinator cannot import or execute validation rules.

## Runtime characterization

The controlled Phase 6B test exercised:

```text
valid draft
→ submit
→ queued
→ running
→ approved
→ coordinator
→ private verified
```

It also exercised:

```text
invalid quantity
→ submit
→ revision_required
→ coordinator returns to draft
→ owner correction
→ resubmit as revision 2
→ approved
→ private verified
```

And the concurrency fail-closed path:

```text
queued attempt
→ worker claim
→ temporary state conflict
→ persisted manual_review + SYSTEM-003
→ coordinator stale no-op
```

Confirmed:

- the queued state had no decision;
- approved had zero findings and `HIGH` confidence;
- revision required persisted `TECHNICAL-004`,
  `INVALID_QUANTITY`, `ERROR`;
- revision 1 history remained after revision 2 approval;
- duplicate command processing produced no second decision;
- duplicate coordinator execution returned the existing result;
- state conflict persisted `manual_review`, `LOW`,
  `OFFER_STATE_CONFLICT`;
- public marketplace remained empty;
- every temporary record was removed exactly.

## Protected-data validation

Final protected state:

- legacy users: 4, unchanged;
- legacy-user snapshot hash:
  `3369cf18c0fb7ffa5881cdd4a6c25c2da11ef489c46e7b9e52f5d28f41288bbc`;
- legacy offers: 9, unchanged;
- legacy-offer snapshot hash:
  `b9492303d4d3bb157941fd3ed609438761eb85396e83861af4cfb5f77664c2fc`;
- recovery-owned offers: 0;
- sessions: 0;
- legacy `offer_verifications`: 0;
- Submission Revisions: 0;
- Verification Attempts: 0;
- Verification Findings: 0;
- Verification Events: 0;
- Verification Commands: 0;
- Workflow Transitions: 0;
- public marketplace: HTTP 200, zero published offers;
- schema fingerprint:
  `aeb77478a423b407e5e69705f78b7948e8020411b7defa26f605568f616fc401`.

## Database writes performed

Authorized persistent writes:

- migration-journal entry for `0009`;
- additive `verified` enum value;
- six isolated verification/workflow tables and their constraints/indexes.

Authorized temporary runtime writes:

- recovery-owned draft offers;
- Submission Revisions;
- Verification Attempts, Findings, Events, Commands, and Workflow Transitions;
- normal authentication/session writes in prior-phase regression tests.

All temporary offer, verification, workflow, and session records were removed.
No legacy user, legacy offer, KYB, organization, partner, subscription, order,
contract, payment, escrow, blockchain, AI, notification, email, or public
marketplace record was modified.

## Regression results

Passed:

- verification domain tests: 14;
- architecture compliance tests: 4 included above;
- Phase 6B database runtime;
- migration rehearsal and final verification;
- API request tests;
- authentication characterization;
- real Passport login/restart/logout runtime;
- dashboard unit tests;
- authenticated dashboard runtime;
- marketplace publication-policy tests;
- marketplace presentation tests;
- legacy marketplace characterization;
- safe empty marketplace runtime;
- draft validation and policy tests;
- Phase 5A offer characterization;
- Phase 5B draft runtime;
- Phase 5C submission runtime;
- migration safety utility tests;
- recovery guard and disabled-OpenAI tests;
- `npm run check`;
- `npm run build`.

The production build retains the pre-existing non-failing warnings for outdated
Browserslist data and a JavaScript chunk larger than 500 kB.

## Files modified

Architecture and report:

- `docs/architecture/verification-engine-v2.md`
- `docs/recovery/phase-6b/phase-6b-report.md`

Migration:

- `migrations/0009_verification_engine.sql`
- `scripts/offers/verification-migration.ts`

Domain:

- `shared/verification.ts`
- `shared/schema.ts`
- `server/verification/catalog.ts`
- `server/verification/policy.ts`
- `server/verification/rules.ts`
- `server/verification/engine.ts`
- `server/verification/snapshot.ts`

Persistence and orchestration:

- `server/verification/repository.ts`
- `server/verification/coordinator.ts`
- `server/verification/worker.ts`
- `server/drafts/storage.ts`
- `server/databaseHealth.ts`
- `server/index.ts`

Tests and regression baselines:

- `server/verification/engine.test.ts`
- `server/verification/architecture.test.ts`
- `scripts/offers/phase-6b.runtime.test.ts`
- active Phase 3C–5C characterization/runtime fingerprint fixtures
- Phase 5C exact cleanup support for additive verification history
- `package.json`

## Risk assessment

- Low: deterministic rules are pure, tested, and reuse the approved Phase 5B
  policy.
- Low: legacy business rows were not rewritten and their hashes are unchanged.
- Low: duplicate worker/coordinator execution is idempotent and constrained.
- Medium: the worker is an in-process polling adapter. The architecture permits
  replacement by a future workflow engine without changing domain logic.
- Medium: no owner-facing verification-result frontend or new result API was
  added because Phase 6B authorized the engine and internal orchestration only.
  Verified offers remain private and outside the existing draft/submitted UI
  lifecycle.
- Medium: operational lease duration and retry cadence currently use recovery
  defaults and require production tuning during deployment work.

## Remaining boundaries

Intentionally not implemented:

- human manual-review service and RBAC;
- owner-facing verification history/result API;
- frontend verification presentation;
- organization verification or KYB composition;
- moderation;
- marketplace publication eligibility;
- activation;
- orders, negotiations, contracts, payments, escrow, or settlement;
- blockchain/external audit export;
- AI advice or decisions;
- risk scoring;
- notifications and email;
- Render/worker deployment tuning.

Phase 6B stops here pending review. No next capability has begun.
