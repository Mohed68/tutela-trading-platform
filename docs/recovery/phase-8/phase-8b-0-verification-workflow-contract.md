# Phase 8B.0 — Verification Workflow Contract and Step Authority Matrix

## Baseline and responsibility

Accepted baseline:
`72aca607d07042683f84a008e656fd4b53378b5b`.

`OrganizationVerificationWorkflowExecution` is an authenticated,
application-level coordination envelope. It records exact outputs of frozen
authorities. It does not execute those authorities and is not a Domain value,
database transaction, persisted aggregate, API response, Decision, Trust
Status, or eligibility result.

## Discovered authority chain

```text
OrganizationVerificationAttemptLifecycleExecution
  -> executeOrganizationVerificationAttemptTransition
  -> OrganizationVerificationAttemptLifecycleTransitionExecution
  -> buildOrganizationVerificationEvidenceSnapshot
  -> OrganizationVerificationEvidenceSnapshot
  -> buildOrganizationVerificationEvaluationProjection
  -> OrganizationVerificationEvaluationProjection
  -> buildOrganizationVerificationPolicyEvaluationInput
  -> OrganizationVerificationPolicyEvaluationInput
  -> executeOrganizationVerificationPolicyEvaluation
  -> OrganizationVerificationPolicyEvaluationExecution + authentic completion
  -> executeOrganizationVerificationDecisionTrustIntegration
  -> authentic Decision + Trust Status + integration binding/execution
```

The final frozen integration authority owns the atomic Decision-to-Trust
sequence and authenticated binding. The Workflow contract does not split or
recreate that authority.

## Workflow stage vocabulary

- `attempt_in_progress`
- `attempt_completed`
- `snapshot_bound`
- `projection_bound`
- `evaluation_input_bound`
- `policy_completed`
- `completed`

`initialized` is excluded because an authentic lifecycle execution is required
at creation. `decision_bound` and `trust_bound` are excluded because the
existing integration authority produces Decision, Trust Status, and their
binding atomically. Adding intermediate Workflow stages would invent
independent authority boundaries.

`completed` means only that the complete coordination chain is bound to an
authentic Decision–Trust integration execution. It does not mean approved,
verified, trusted, eligible, published, or authorized.

## Step Authority Matrix

| Predecessor stage | Workflow step | Required authentic input | Frozen authority owned outside Workflow | Authentic output | Resulting stage | Terminal |
|---|---|---|---|---|---|---|
| `attempt_in_progress` | `attempt_transition` | Lifecycle Execution | `executeOrganizationVerificationAttemptTransition` | Lifecycle Transition Execution | `attempt_in_progress` or `attempt_completed` | No |
| `attempt_completed` | `bind_snapshot` | completed Lifecycle Execution | `buildOrganizationVerificationEvidenceSnapshot` | Evidence Snapshot | `snapshot_bound` | No |
| `snapshot_bound` | `bind_projection` | Evidence Snapshot | `buildOrganizationVerificationEvaluationProjection` | Evaluation Projection | `projection_bound` | No |
| `projection_bound` | `bind_evaluation_input` | Evaluation Projection | `buildOrganizationVerificationPolicyEvaluationInput` | Policy Evaluation Input | `evaluation_input_bound` | No |
| `evaluation_input_bound` | `complete_policy` | Policy Evaluation Input | `executeOrganizationVerificationPolicyEvaluation` | Policy Evaluation Execution | `policy_completed` | No |
| `policy_completed` | `complete_decision_trust_integration` | Policy Evaluation Execution | `executeOrganizationVerificationDecisionTrustIntegration` | Decision–Trust Integration Execution | `completed` | Yes |

The executable matrix is exported as
`ORGANIZATION_VERIFICATION_WORKFLOW_STEP_AUTHORITY_MATRIX`. It contains
ownership metadata only; authority names are not callable references.

## Workflow execution contract

The envelope binds explicit Workflow, Organization, Record, Revision, and
Attempt identities; an authentic lifecycle execution; the contiguous optional
Snapshot, Projection, Evaluation Input, Policy Runtime, and Decision–Trust
integration artifacts; ordered authentic step records; explicit timestamps;
provenance and integrity references; and a deterministic Workflow fingerprint.

Artifact gaps are rejected. Every artifact is accepted only through its
existing public authenticity guard. Snapshot-to-Projection,
Projection-to-Evaluation Input, Evaluation Input-to-Policy Runtime, and
Policy-to-Integration identity and fingerprint continuity are exact.

## Workflow step record contract

Each authenticated immutable step record binds:

- explicit Workflow and step identity;
- predecessor and next Workflow versions;
- predecessor, requested step, and resulting stage;
- Organization, Record, Revision, and Attempt continuity;
- canonical typed input/output artifact fingerprint references;
- explicit occurred-at time;
- canonical provenance and integrity references;
- optional explicit correlation, causation, and reason references;
- deterministic `workflowStepBindingFingerprint`.

The factory authenticates the supplied artifacts but invokes no authority.

## Version model

Initial `workflowExecutionVersion` is exactly `1`. Every unique successful
step advances the Workflow envelope exactly once. For `N` ordered steps:

```text
workflowExecutionVersion = 1 + N
```

Attempt sequence, lifecycle execution version, Revision sequence, Snapshot
version, Evaluation Input version, Policy version, and integration version
remain independent and unchanged.

## Chronology

Only explicit timestamps are used. Workflow and step timestamps must be
parseable. Step chronology is non-decreasing from Workflow creation. Each
binding step cannot precede the timestamp exposed by its authentic output.
`lastStepAt` is absent for empty history and equals the final step timestamp
otherwise. Equal timestamps remain valid. There is no clock, timeout, expiry,
lease, retry interval, or SLA inference.

## Idempotency and conflicts

Canonical equal semantics produce equal fingerprints. An existing authentic
step with the same identity and fingerprint is idempotent. The same identity
with changed semantics is a duplicate conflict. Different step identities
consuming one predecessor Workflow version are a branch conflict. Stale,
skipped, reordered, discontinuous, or terminal-following histories fail
closed. No cache, registry, persistence lookup, or mutable current pointer is
used.

## Fingerprints and authenticity

`workflowStepBindingFingerprint` and `workflowExecutionFingerprint` are
application-scoped SHA-256 fingerprints over canonical semantic data.
Semantically unordered evidence references are sorted before binding.

Workflow executions and step records use separate private authenticity seals
and private identity sets. Public read-only guards reject plain objects,
frozen clones, object-spread and `Object.assign` copies, JSON round trips, and
`structuredClone` results. Seals, stamping helpers, canonicalization, and
fingerprint helpers are not exported.

## Deferred and excluded behavior

Phase 8B.0 contains no Workflow step executor, Coordinator, automatic
progression, persistence, repository, database, schema, migration, Unit of
Work, transaction, API, route, controller, frontend, provider, worker, queue,
notification, startup wiring, environment access, scheduling, retry, lease,
timeout, cancellation, failure state, Eligibility, permission, or user
verification behavior.

Workflow Coordinator Runtime remains deferred to Phase 8B.1 and requires
explicit approval.
