# Phase 8B.1 — Pure Verification Workflow Coordinator Runtime

## Accepted baseline

`56a49af331eb081dd88fcb710dfece7d33a447c3`

## Responsibility

The Phase 8B.1 runtime is a pure application boundary that consumes one
authentic Organization Verification Workflow execution and executes exactly
one requested Workflow step. It returns authenticated application execution
evidence containing the predecessor Workflow, the one authentic authority
result, one authenticated step record, and one authenticated next Workflow.

It is not a Workflow engine, Domain aggregate, persisted transaction,
authorization result, Eligibility result, or API response.

## One-step and one-authority rules

One invocation executes one exhaustive static dispatch branch and invokes one
frozen authority. It stops immediately after binding the authority result:

| Requested step | Exact frozen authority | Stage progression |
| --- | --- | --- |
| `attempt_transition` | `executeOrganizationVerificationAttemptTransition` | `attempt_in_progress` → `attempt_in_progress` or `attempt_completed` |
| `bind_snapshot` | `buildOrganizationVerificationEvidenceSnapshot` | `attempt_completed` → `snapshot_bound` |
| `bind_projection` | `buildOrganizationVerificationEvaluationProjection` | `snapshot_bound` → `projection_bound` |
| `bind_evaluation_input` | `buildOrganizationVerificationPolicyEvaluationInput` | `projection_bound` → `evaluation_input_bound` |
| `complete_policy` | `executeOrganizationVerificationPolicyEvaluation` | `evaluation_input_bound` → `policy_completed` |
| `complete_decision_trust_integration` | `executeOrganizationVerificationDecisionTrustIntegration` | `policy_completed` → `completed` |

There is no recursion, loop, automatic continuation, function registry,
provider dispatch, or caller-injected authority.

For `attempt_transition`, the Workflow runtime does not reproduce the Attempt
transition matrix. It inspects only the authentic resulting Attempt state:
`completed` maps mechanically to `attempt_completed`; every other authentic
result remains `attempt_in_progress`.

## Runtime input

Every call supplies:

- an authentic predecessor Workflow execution;
- explicit Workflow step ID and requested step;
- explicit `occurredAt`;
- explicit provenance and integrity references;
- optional explicit correlation, causation, and reason references;
- exactly one step-specific authority input;
- optionally, an authentic prior step execution for deterministic replay and
  explicit branch-conflict comparison.

The bound predecessor artifact is taken from the authenticated Workflow and
cannot be replaced by the caller. Unknown or irrelevant top-level
authority-input fields fail closed.

No ID, version, timestamp, reference, Domain artifact, or completion evidence
is generated from hidden state.

## Runtime output

`OrganizationVerificationWorkflowStepExecution` is a sealed, deeply immutable
discriminated union keyed by `requestedStep`. It contains:

- Workflow and step identities;
- predecessor and next Workflow versions;
- predecessor and resulting stages;
- the authentic predecessor Workflow;
- the authentic authority result;
- the authenticated Workflow step record;
- the authenticated next Workflow;
- explicit occurrence time;
- a deterministic runtime-scoped fingerprint.

The public surface exports only the executor, the read-only authenticity
guard, and their types. Seals, constructors, canonicalization, fingerprint
helpers, and result helpers remain private.

## Identity and artifact continuity

The frozen authorities and Workflow contract factories jointly enforce exact
Organization, Record, Revision, Attempt, lifecycle, Snapshot, Projection,
Evaluation Input, Policy Runtime, Decision, Trust, and binding continuity.
Artifacts are accepted only after their public authenticity guard succeeds.
Structural equality is never treated as authenticity.

Every earlier authentic artifact is preserved by reference in the next
Workflow. Only the artifact produced by the requested step is newly bound.
The predecessor Workflow and all earlier history remain unchanged.

## Workflow version behavior

The next Workflow version is always exactly the predecessor Workflow version
plus one. The step record binds both versions, and exactly one step record is
appended. Attempt lifecycle execution version, Attempt sequence, and Revision
version remain independent.

An optional authentic prior step execution makes replay evidence explicit:
identical semantics return the existing authentic execution; a changed step
identity, predecessor, requested step, or resulting fingerprint fails closed.
No cache, registry, lookup, lock, or mutable coordination state is used.

## Chronology

Only the caller-supplied `occurredAt` is used. It must be parseable and may not
precede Workflow creation or the prior step. The Workflow step contract also
requires it not to precede the authentic authority result timestamp. The next
Workflow `lastStepAt` equals it exactly. No clock, duration, expiry, lease,
timeout, or scheduling policy exists.

## Idempotency and conflicts

Determinism arises from explicit immutable inputs and canonical
fingerprinting. Equivalent provenance and integrity collections are
canonicalized by the existing Workflow contract. Explicit replay evidence
supports semantic idempotency without infrastructure.

The runtime fails closed for unauthentic Workflows, wrong stages, completed
Workflows, chronology regression, malformed or irrelevant input, frozen
authority failures, unauthentic results, step-record binding failures,
next-Workflow binding failures, and explicit replay or branch conflicts.
Frozen authority failures remain recognizable and are not translated into
HTTP, repository, retry, or transport errors.

## Fingerprint scope

`workflowStepExecutionFingerprint` is application-runtime evidence only. It
binds:

- predecessor Workflow fingerprint;
- Workflow step-record fingerprint;
- next Workflow fingerprint;
- requested step and authority-result fingerprint;
- Workflow and step IDs;
- predecessor and next versions;
- predecessor and resulting stages;
- explicit occurrence time.

Its SHA-256 input is canonical and property-order independent. It uses no
randomness, environment value, hidden salt, or system time. It is not a
Domain, Workflow contract, Policy, Decision, or Trust fingerprint.

## Meaning of `completed`

`completed` means only that the approved coordination chain finished. It is
never translated to approved, rejected, verified, unverified, trusted,
untrusted, eligible, ineligible, authorized, or blocked.

## Architecture boundaries and deferred work

The architecture scanner restricts all six authority invocations to the sole
Workflow runtime executor and rejects infrastructure, persistence, providers,
workers, queues, hidden clocks, hidden IDs, unsafe casts, multi-step engines,
duplicated Domain logic, and downstream Eligibility semantics.

Deferred and not implemented:

- execute-until-complete or a full Workflow engine;
- persistence, repositories, transactions, Unit of Work, locking, or
  concurrency control;
- API, routes, controllers, or frontend integration;
- providers, workers, queues, schedules, notifications, or startup wiring;
- retries, restart behavior, leases, timeouts, cancellation, or failure
  Workflow stages;
- Eligibility, permissions, authorization, or marketplace behavior.
