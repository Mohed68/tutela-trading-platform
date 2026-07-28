# Phase 5A offer authority and write-recovery decision package

Date: 2026-07-28

Status: mandatory stop before implementation

## Decision

No offer write recovery is implemented in Phase 5A.

Option A requires an authoritative draft or equivalent private lifecycle
state. The database has only:

`active`, `pending`, `closed`, `cancelled`

Neither repository behavior nor persisted data defines `pending` as an
owner-editable private draft. `draft` exists only in the stale `MyOffers`
frontend model and is rejected by the database enum. The shared schema also
has no `draft`.

The preferred Option A therefore fails its first mandatory condition. Treating
`pending` as draft would invent business semantics. Creating with the database
default would create `active`, which is explicitly not authorized as the
Phase 5A default.

Additional blocking facts:

- cancellation versus deletion/archive semantics are not proven;
- all active legacy offers are expired by date, so lifecycle status and expiry
  are not synchronized;
- current creation automatically starts verification, which is outside scope;
- current creation performs incompatible activity writes without a transaction;
- no recovery-provenance field identifies a recovery-created offer;
- no owner edit route exists;
- detail and status routes lack owner authorization;
- supported units, currencies, and Incoterms are inconsistent or unconstrained.

## Classification legend

- A: authoritative and required
- B: authoritative and optional
- C: legacy-only
- D: current-code-only
- E: missing from database
- F: missing from shared schema
- G: derived mechanically
- H: business-semantic ambiguity
- I: verification-related
- J: publication-related
- K: contract/order-related
- L: demo-only
- M: unsafe or sensitive
- N: deprecated or unused

## Field authority matrix

“Create” and “update” below describe a future owner-private workflow. “No”
means the field must not be accepted from a client. “Blocked” means the field
could be part of a safe contract only after the lifecycle decision.

| Field | Class | Repository/database/frontend evidence | Create | Update | Owner DTO | Public DTO | Decision |
|---|---|---|---|---|---|---|---|
| `id` | A | DB primary key with UUID default; used throughout | server only | no | yes | yes | none |
| `user_id` / `userId` | A, M | DB FK is structural owner; route session exists; generic schema accepts client value | server only | no | omit or implicit | no | session must remain sole authority |
| `commodity_id` | A | DB non-null FK; form requires commodity | blocked | blocked | yes with safe commodity label | yes | validate FK; no commodity redesign |
| `type` | A | DB enum `buy`/`sell`; shared/form agree | blocked | business decision | yes | yes | whether type is mutable after create |
| `quantity` | A | DB `numeric(15,2)` non-null; all data positive; client utilities reject non-positive | blocked | business decision | yes | yes | mutation rules and stale-update policy |
| `unit` | A, H | DB non-null but unconstrained; legacy, conversion layer, and form vocabularies conflict | blocked | blocked | yes | yes | authoritative per-commodity unit vocabulary |
| `price_per_unit` | A | DB `numeric(15,2)` non-null; client utility treats non-positive as invalid | blocked | business decision | yes | yes | whether zero is ever commercially valid |
| `currency` | B, H | DB nullable/default USD/unconstrained; legacy is USD; form adds EUR/GBP/JPY | blocked | business decision | yes | yes | supported currencies; whether null is permitted |
| `location` | A | DB non-null; form requires; no length/content rule | blocked | blocked | yes | yes | maximum length/normalization |
| `status` | H, J | DB enum/default active; vocabularies and meanings conflict | server only | server transition only | yes | active only after publication proof | define initial state and transitions |
| `valid_until` | B, G, H | nullable timestamp; every legacy date is past while status is active | blocked | blocked | yes plus derived expiry | yes | required/optional and expiry behavior |
| `min_quantity` | B, H | nullable numeric; shared comment says positive and ≤ quantity; DB does not enforce | blocked | blocked | yes | yes | authoritative constraint and optionality |
| `delivery_terms` | B, H | free text mixes Incoterm and delivery prose | blocked | blocked | yes | yes | free text versus structured Incoterm |
| `payment_terms` | B, K | free commercial text; present in legacy data | blocked | blocked | yes | yes only under public policy | whether editable before contracting |
| `created_at` | A | DB default | server only | no | yes | yes | none |
| `updated_at` | A, H | DB default but no trigger; storage changes it only for status | server only | server only | yes | yes | optimistic concurrency/version policy |
| `verified` | D, E, I, J, M | shared/seed/public gate; absent in DB | no | no | no raw value | strict verified projection only | verification workflow outside scope |
| `specifications` | D, E, H | shared text; commodity table has different JSON specifications | no | no | no | no | define offer-specific specification model |
| `delivery_options` | D, E, H | shared only | no | no | no | no | define semantics |
| `seller_org_id` | D, E, I, M | shared only; no organization table authority | no | no | no | no | organization model required |
| `seller_org_name` | D, E, I, M | shared/seed/UI only | no | no | no | no | organization authority required |
| `seller_org_verified` | D, E, I, J, M | shared/seed/public gate; absent in DB | no | no | no raw value | strict verified projection only | organization verification required |
| `seller_org_rating` | D, E, M | shared/UI concept; absent in DB | no | no | no | no | rating authority required |
| `delegate_id` | D, E, M | shared only | no | no | no | no | delegate authority required |
| `delegate_full_name` | D, E, M | shared/demo UI only | no | no | no | no | identity disclosure/authority required |
| `delegate_role_title` | D, E, M | shared/demo UI only | no | no | no | no | delegate authority required |
| `delegate_is_authorized` | D, E, I, M | shared default true; absent in DB | no | no | no | no | must never default authority |
| `bar_spec` | D, E, H | shared only; scripts contain another model | no | no | no | no | commodity-specific design |
| `packaging` | D, E, H | shared only | no | no | no | no | commodity-specific design |
| `moderation_status` | D, E, J, M | shared/admin only; separate from lifecycle | no | no | no | no | admin moderation outside scope |
| `moderation_reason` | D, E, M | shared/admin only | no | no | no | no | sensitive internal field |
| `moderated_by` | D, E, M | shared/admin only | no | no | no | no | admin authority outside scope |
| `moderated_at` | D, E, M | shared/admin only | no | no | no | no | admin authority outside scope |
| offer-verification record | I, J, M | additive table supports pending submissions only | no | no | status summary only after workflow approval | never raw | Phase 5A excludes verification |
| publication eligibility | G, J | derived only by Phase 3C from two explicit true values and active status | no | no | safe visibility summary only | required public gate | policy remains unchanged |
| expiry state | G | mechanically derived from `valid_until` and current time | no | no | yes | yes | effect on lifecycle remains undecided |
| recovery provenance | E, F, H | no offer field or mapping table exists | server only | no | no | no | needed if a retained test draft must be identifiable |

## Lifecycle status matrix

| Status/concept | Source | Current label/use | Owner actions proven | Public possible | Reversible | Authority finding |
|---|---|---|---|---|---|---|
| `active` | DB/shared/seed/routes | active marketplace candidate | none | only with both Phase 3C verification proofs | unknown | stored authority exists; business meaning beyond status is incomplete |
| `pending` | DB/shared | no active owner UI meaning and no rows | none | no current public projection | unknown | exact meaning unproven; cannot be relabeled draft |
| `closed` | DB/shared/My Offers | frontend calls transition “Archive” | none | no | unknown | terminal/reopen semantics unproven |
| `cancelled` | DB/shared | no active offer action | none | no | unknown | cancellation side effects and reversibility unproven |
| `hidden` | shared status plus admin moderation concept | admin hide | none | no | admin code suggests unhide | absent from DB enum; moderation, not owner lifecycle |
| `archived` | shared status plus admin moderation concept | admin archive | none | no | unknown | absent from DB enum; moderation meaning conflicts with frontend “closed” |
| `draft` | stale My Offers/demo only | private editable draft | none | should be no | unknown | absent from DB and shared enum |
| `pending_verification` | stale My Offers only | verification label | none | no | unknown | not a lifecycle value; mixes verification |
| `paused` | stale My Offers only | pause/resume buttons | none | unknown | UI says reversible | database rejects it |
| `sold_out` | stale My Offers only | label | none | unknown | unknown | no database/server authority |
| expired | derived from `valid_until` | not reconciled with status | none | Phase 3C query currently does not filter expiry | time-derived | separate state; all 9 legacy offers are active and expired |
| verified/unverified/pending | trust domain | badges and offer-verification submissions | none | verified proof required | workflow unknown | not lifecycle status |
| published/hidden/archived | visibility/moderation domain | public DTO/admin concepts | none | publication policy controls | workflow unknown | must remain separate from lifecycle |

## Transition matrix

No owner lifecycle transition is authorized by current evidence.

| Transition | Technical evidence | Business authority | Phase 5A result |
|---|---|---|---|
| create → draft | frontend type only; DB rejects draft | absent | blocked |
| create → pending | DB accepts pending; no meaning or rows | absent | blocked |
| create → active | DB default and legacy seed behavior | active is not publication, but creation/eligibility semantics unresolved | Option B only; not authorized |
| draft → active | no persisted draft | absent | blocked |
| draft → cancelled | no persisted draft | absent | blocked |
| pending → active | arbitrary status endpoint could write it | no owner or verification rule | blocked |
| active → closed | stale frontend action and arbitrary endpoint | closure effects unknown | blocked |
| active → cancelled | DB accepts value | cancellation effects unknown | blocked |
| active → expired | time can pass without status change | no synchronization rule | derived only, not a stored transition |
| active → hidden/archive | current admin intent only; DB rejects values | moderation outside scope | blocked |
| closed/cancelled → active | arbitrary endpoint technically allows it | reopen policy absent | blocked |
| delete any state | no route/storage method | retention and linkage semantics absent | blocked |

The current status endpoint is implementation behavior, not authority: it
accepts an arbitrary status and does not check ownership.

## Ownership model

Authoritative ownership is `offers.user_id → users.id`.

A future owner workflow must:

1. require Phase 4B authentication;
2. take the acting user only from `req.user.claims.sub`;
3. use `WHERE offers.id = :id AND offers.user_id = :sessionUserId` in the same
   query for detail, update, cancellation, and cleanup;
4. return a generic 404 for missing or non-owned rows;
5. ignore no owner field—reject owner-like client keys instead;
6. return explicit DTOs with no joined user row;
7. keep public reads on the existing Phase 3C projection.

The current implementation satisfies only part of item 2 during create and
owner list. Detail, status changes, verification submission, raw responses,
and validation are unsafe.

## Candidate safe DTOs

These are design contracts only. They are not implemented because there is no
approved initial lifecycle state.

### Owner offer summary

```text
{
  id,
  offerType,
  commodity: { id, name, category },
  quantity: { value, unit },
  pricing: { amountPerUnit, currency },
  location,
  lifecycle: { state },
  expiry: { state, validUntil },
  visibility: { state: "not_public" | "published" },
  createdAt,
  updatedAt
}
```

### Owner offer detail

Summary fields plus:

```text
{
  minimumQuantity,
  deliveryTerms,
  paymentTerms
}
```

It must not include a user row, verification evidence, organization/delegate
data, moderation fields, ratings, contract/order/payment data, or database
errors.

### Candidate create request

```text
{
  offerType,
  commodityId,
  quantity,
  unit,
  amountPerUnit,
  currency?,
  location,
  minimumQuantity?,
  deliveryTerms?,
  paymentTerms?,
  validUntil?
}
```

The server would assign ID, owner, timestamps, initial lifecycle state, and
non-public visibility. Implementation is blocked until the initial state and
validation vocabularies are approved.

### Candidate update request

Only the create fields declared mutable by a future lifecycle decision. It
must not contain ID, owner, status, trust, verification, publication,
moderation, organization, timestamps, or external-workflow fields.

Status changes require a separate transition endpoint with an explicit
transition table and same-query owner predicate.

### Public marketplace DTO

No change. It remains exactly `PublicMarketplaceOffer` from Phase 3C and
requires:

- offer verification = verified;
- seller organization verification = verified;
- lifecycle status = active.

## Validation characterization

| Rule | Current evidence | Required future behavior |
|---|---|---|
| Positive quantity | current utility/audit logic treats ≤0 as invalid; DB/schema do not | explicit decimal validation |
| Positive price | current utility treats ≤0 as invalid; DB/schema do not | business decision whether zero is ever valid, then explicit validation |
| Commodity FK | DB FK; form only checks non-empty | query approved commodity and reject generic not-found |
| Type | DB/shared agree on buy/sell | strict enum |
| Unit | unconstrained DB; three conflicting vocabularies | per-commodity authoritative vocabulary decision |
| Currency | unconstrained DB/default USD; frontend invents list | supported-currency decision |
| Incoterm | no separate field; mixed free text | decide structured enum versus delivery prose |
| Valid date | route can construct Invalid Date; no future rule | strict parse and explicit future/expiry decision |
| Minimum quantity | shared comment and audits suggest >0 and ≤ quantity | confirm rule, then validate |
| Text lengths | no DB or shared limits | define safe maximums |
| Decimal precision | DB `numeric(15,2)` | reject overflow and >2 fractional digits before SQL |
| Authority fields | broad current schema accepts them | strict allow-list and reject unknown keys |
| Malformed JSON | Express JSON middleware handles parsing globally | generic 400 with no raw error |
| Duplicate submission | no idempotency key or unique business constraint | idempotency decision required |
| Optimistic concurrency | no version or timestamp predicate | stale-update decision required |
| Raw DB errors | several routes log raw errors | generic public error and redacted logging |

## Write-recovery options

### Option A — Draft-only offer recovery

Data integrity:

- strongest separation from publication if a real draft state exists;
- owner-only create/read/edit/cancel can be bounded;
- requires an authoritative initial state and cleanup identity.

Business fidelity:

- matches the stale frontend's apparent intent but not the database or shared
  schema.

Security/publication risk:

- lowest conceptual risk;
- currently impossible without assigning new meaning to `pending` or changing
  the database enum/schema.

Future verification:

- clean handoff point after a separate verification decision.

Cleanup:

- safe only with same-query owner predicate and a generated ID held by the
  test; retaining a record also needs persistent recovery provenance.

Frontend:

- could support My Offers, create, detail, edit, and cancellation after the
  lifecycle decision.

Migration:

- a true draft value and retained recovery provenance would require a schema
  decision and likely additive migration, which Phase 5A forbids.

Suitability:

- preferred future design, but **not implementable in Phase 5A**.

### Option B — Owner-managed active but unpublished

Data integrity:

- technically supported by the database default;
- Phase 3C still prevents publication without both trust proofs.

Business fidelity:

- consistent with legacy stored status but not with expired legacy dates;
- unclear whether “active” means submitted, tradable, approved, or merely
  enabled.

Security/publication risk:

- higher because future verification/backfill could publish an owner-created
  row without a draft review boundary.

Future verification:

- couples lifecycle and future publication more tightly.

Cleanup:

- possible for one generated owner row only after delete/cancel semantics are
  decided.

Frontend:

- would need explicit “active but not public” wording and no trust claims.

Migration:

- none technically, but requires explicit business approval and removal of
  automatic verification/activity side effects.

Suitability:

- **not authorized**; explicit follow-up approval required.

### Option C — Full lifecycle with verification handoff

Data integrity/business fidelity:

- cannot be established because verification, moderation, KYB, and lifecycle
  handoffs are unresolved.

Security/publication risk:

- highest.

Future verification/frontend:

- requires a complete workflow and authority model.

Migration:

- likely.

Suitability:

- outside Phase 5A.

## Recommendation

Do not implement a write path yet.

The recommended next decision is to define an additive, private `draft`
lifecycle state and its invariants, separately from:

- verification state;
- publication eligibility;
- moderation state;
- expiry state.

If schema change remains prohibited, the owner must explicitly decide whether
the existing `pending` value may be redefined as a private, owner-editable
draft. That is a business-rule change and cannot be inferred.

## Required business decisions

1. Is `pending` a private draft, or must a new `draft` enum value be added?
2. Which states may owners create, edit, cancel, archive, or delete?
3. Is cancellation terminal and reversible?
4. May a draft be deleted, or must it be retained/audited?
5. What happens when `valid_until` passes?
6. Is `valid_until` required for new offers?
7. Is price required to be strictly positive?
8. What are the authoritative per-commodity units?
9. Which currencies are supported?
10. Is Incoterm a structured field or part of free-form delivery terms?
11. Which fields remain mutable after submission/activation?
12. What optimistic-concurrency and idempotency behavior is required?
13. How is a retained recovery offer marked without public terminology?
14. Which activity log is authoritative, and must offer plus audit writes be
    atomic?

Until those decisions are approved, recovery mode must continue blocking all
offer writes and private raw-detail routes.
