# Phase 8G.0A — Minimum Viable Trade Trust Policy

## Scope

Production Cycle 1 uses platform-submitted evidence and deterministic TUTELA
policy. External KYB, compliance, inspection, AML, sanctions and PEP providers
are optional future evidence sources; none is required by this implementation.

The authority chain remains:

`Provider Evidence → TUTELA Policy → Decision / Eligibility`

A provider response is evidence only and can never construct a TUTELA Decision,
Trust Status, Activity Eligibility, Participation Eligibility, Offer
Verification, or Publication Eligibility.

## Organization Verification

The production policy evaluates only legal/organizational identity,
organization-existence evidence, representative association, evidence
consistency, and evidence integrity. Missing identity or existence evidence
requires revision. Missing representative association is routed to manual
review. Invalid integrity fails closed.

The policy does not evaluate product existence, financial capability,
commodity ownership, transaction legitimacy, or delivery assurance.

Only authentic `platform_submitted` documentary evidence bound to the exact
Organization and profile version may enter the Organization Verification
snapshot adapter. Object copies and structural fakes are rejected.

## Activity Eligibility

Activity Eligibility is independent from Organization Trust. It compares the
submitted activity evidence with the requested activity, commodity and
available jurisdiction context. Exact matches are `eligible`, explicit
contradictions are `ineligible`, and absent or ambiguous context is
`requires_review`.

## Trigger-Based Compliance

Compliance outcomes are `not_required`, `required`, and `requires_review`.
Only explicit legal/commercial requirements and explicit risk flags can create
a `required` outcome in Production Cycle 1. Unknown context is reviewable. A
triggered case requires manual/internal review and never silently passes when
no external provider is configured.

## Offer Evidence

The authoritative Offer Verification read model records its evidence source and
assurance level. Production Cycle 1 derives `documentary` assurance from the
immutable platform-submitted Offer revision bound by the verification input
fingerprint. Publication Eligibility requires an authentic assurance level in
addition to completed approved Offer Verification.

Documentary verification evaluates evidence credibility, consistency and
subject binding. It does **not** guarantee physical goods existence, ownership,
continued availability, or successful delivery.

Future evidence may attain `source_confirmed` or `independently_inspected`
assurance without changing Decision, Trust, Eligibility, or Publication
authority ownership.
