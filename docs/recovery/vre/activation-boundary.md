# VRE v1.1 activation boundary

Status: implementation complete and gated for prospective activation. The module
becomes ACTIVE_BASELINE only when migration 0022 and its matching application
revision have been deployed together and the post-deployment checks pass.
Starting commit: ca02f4fcbf392d47c886743d6afd3fdbbfd3de25.

## Existing operational authorities

The runtime already registers Organization Verification through
`server/trade-trust-application/routes.ts`. Organization owners submit scoped
assertions and initiate verification through the application service. The
orchestrator uses the canonical workflow, append-only evidence persistence,
policy runtime, Decision Engine, replay, and Trust Status Deriver. Admin shell
labels and the inert architecture marker do not describe all current wiring.

The existing policy is
`minimum-trade-trust-organization-policy/v1`, implemented in
`server/trade-trust-policy/organizationVerificationPolicy.ts`. It evaluates
legal identity completeness, existence evidence, representative association,
consistency, and evidence integrity. Its local evidence adapter labels stored
platform-submitted assertions as documentary. The policy does not require an
independent reviewer before its satisfied findings can result in an approved
decision and derived trusted status.

This is a policy-mediated decision, not a provider directly setting Trust.
However, the evidence collection path accepts owner-submitted assertions;
integrity fingerprints establish consistency, not independent verification of
the underlying claim. The existing test `valid real evidence reaches trusted
only through Decision and Trust authorities` confirms approval and Trust from
these fixture assertions. A focused run passed (one selected test, four skipped).
No Production data was used for this check.

## Verification review authority decision

The platform decision maker approved option 2: require independent confirmation
for future approvals under a new prospective Policy V2. See
[the accepted policy decision](verification-policy-v2.md). A permitted trusted
source can satisfy future policy without a human in every case; no such provider
is currently configured. Baseline authorized independent human reviews are
bound to exact evidence and profile versions. Existing V1 decisions and Trust
history remain intact. A review never directly approves or sets Trust.

## VRE ownership and implementation constraints

Verification owns legitimate review inputs and canonical policy decisions
through the existing application service. Trust remains independently derived.
Safe queries may expose workflow status, policy version, actor, timestamps,
decision references, and evidence metadata, but never confidential payloads.

Risk owns provenance-bearing signals, assessments, and review dispositions.
Creating or reviewing a signal must not create an enforcement action. Missing
verification alone must not be modeled as misconduct. AI observations, if
introduced later, remain explicitly advisory.

Enforcement owns cases, linked context, explicit decisions, and scoped actions.
The approved state vocabulary is NORMAL, MONITORED, RESTRICTED, SUSPENDED,
BLOCKED, and TERMINATED. Lifting an action appends a new fact and preserves its
history. No enforcement command may rewrite Verification, Trust, or transaction
history. Downstream command restrictions require an explicit consuming policy;
unwired restrictions must be labeled as such.

Privileged mutations require a resolved Platform Principal, an atomic
permission, the required server session assurance, a reason, request and
correlation identifiers, and Security Audit in the same transaction as the
authoritative change. Audit failure rolls back the mutation. Existing role
names are SUPPORT, VERIFICATION_REVIEWER, OPERATIONS, and PLATFORM_ADMIN;
Platform Owner remains separate and subject to domain rules.

Cross-domain links identify source facts and versions. Read models and events
do not introduce alternative authorities. Provider outages cannot create PASS.
New persistence must be additive, reviewed, exercised on TEST_DATABASE_URL,
and contain no inferred backfill or seeded Production decisions. The application
labels these modules ACTIVE_BASELINE only with their real capabilities and
authorization in place; downstream enforcement consumption remains explicitly
INACTIVE.
