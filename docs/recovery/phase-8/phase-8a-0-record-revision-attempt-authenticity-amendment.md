# Phase 8A.0 — Record, Revision, and Attempt Authenticity Amendment

## Status and scope

This amendment closes the runtime-authenticity gap identified by the Phase
8A.0 preflight. It adds authenticity only to the existing Organization
Verification Record, Revision, and Attempt values.

It does not implement the Attempt Lifecycle Execution contract, transition
records, lifecycle execution versions, fingerprints, chronology coordination,
idempotency, conflict handling, orchestration, workflow, or persistence.

## Original gap

Record, Revision, and Attempt values were immutable structural objects. Their
existing factories and transition authority froze their outputs, but no
private runtime seal or read-only guard distinguished an authority-created
value from:

- a plain object;
- a frozen structural clone;
- an object-spread or `Object.assign` copy;
- a JSON round trip;
- a fabricated object with equivalent fields.

This prevented an application contract from proving the required authentic
continuity chain:

```text
Organization
    ↓
Authentic Record
    ↓
Authentic Revision
    ↓
Authentic Attempt
```

## Private authenticity model

Each value type owns an independent private symbol seal and an independent
module-private runtime authenticity registry. An authorized authority:

1. defines its type-specific seal as a non-enumerable property;
2. makes the seal non-writable and non-configurable;
3. records the exact object identity in its private registry;
4. freezes the value through the existing immutable output path.

The Boolean guard requires all of:

- an object value;
- exact object-identity membership in the private registry;
- the correct private seal descriptor;
- a frozen value.

The registry check means that reflecting a seal descriptor from an authentic
value and applying it to a fabricated value cannot forge authenticity.

No seal, registry, stamping helper, constructor, or alternative factory is
exported.

## Construction and evolution authorities

### Record

Authenticity is established only by:

- `createOrganizationVerificationRecord`

It is preserved only through the existing Record evolution authorities:

- `attachDraftToRecord`
- `appendRevisionReference`
- `appendAttemptReference`

Each evolution authority requires an authentic predecessor Record. This
prevents a fabricated structural predecessor from being laundered into an
authentic value.

### Revision

Authenticity is established only by the existing submission authority:

- `submitDraftToRevision`

There is no separate Revision constructor, factory, or evolution path.
Submission requires the authentic predecessor Record already required by the
continuity chain.

### Attempt

Authenticity is established only by:

- `createAttemptForRevision`

Creation requires an authentic Record and authentic Revision. Authenticity is
preserved only through:

- `transitionAttemptProcess`

The transition authority requires an authentic predecessor Attempt.

## Public read-only guards

The only new public capabilities are:

- `isOrganizationVerificationRecord(value)`
- `isOrganizationVerificationRevision(value)`
- `isOrganizationVerificationAttempt(value)`

They accept unknown values, return Boolean guard results, and provide no
construction or mutation authority.

Architecture enforcement limits their use to:

- their owning Organization Verification Domain validation paths;
- the future Phase 8A.0 Attempt Lifecycle Execution contract boundary;
- focused tests.

They are prohibited from unrelated workflow, eligibility, marketplace,
repository, route, controller, persistence, or authorization code.

## Copy and impersonation resistance

Focused tests prove that all guards reject:

- plain objects;
- frozen structural clones;
- object-spread copies;
- `Object.assign` copies;
- JSON serialization and rehydration;
- `structuredClone` results;
- mutated fabricated copies;
- fabricated objects carrying a reflected seal descriptor.

Authentic values remain immutable, and caller mutation of a copy cannot alter
the authority-created source value.

## Compatibility

All existing authority-created Records, Revisions, and Attempts remain valid.
All existing Record evolution, Revision submission, Attempt creation, and
Attempt transition tests pass unchanged.

The only intentionally strengthened boundary is rejection of unauthenticated
structural predecessor objects by authorities that preserve or establish
continuity authenticity. No existing supported test or authority path depended
on such fabricated predecessors.

No fields, identities, timestamps, outcomes, or error vocabularies were added
or reinterpreted.

## Unchanged semantics

The following remain unchanged:

- Record identity and Organization binding;
- revision-reference and attempt-reference behavior;
- Revision identity, sequence, submission, evidence, and timestamps;
- Attempt identity and sequence;
- lifecycle vocabulary:
  `not_started`, `queued`, `running`, `completed`;
- transition matrix:
  `not_started → queued`,
  `queued → running`,
  `running → queued`,
  `running → completed`;
- `completed` terminal behavior;
- completion-reference requirements;
- frozen-object behavior.

Attempt sequence was not converted into a version.

## Deferred work

Still deferred pending explicit approval:

- `OrganizationVerificationAttemptLifecycleExecution`;
- lifecycle transition records;
- lifecycle execution identity and versioning;
- application chronology;
- transition fingerprints;
- idempotency and conflict contracts;
- transition execution orchestration;
- cancellation, failure, retry, restart, lease, timeout, or scheduling
  semantics;
- workflow, persistence, database, API, providers, startup, and environment
  integration.
