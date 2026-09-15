# ADR: prospective independent Organization Verification — Policy V2

Status: ACCEPTED by the platform decision maker. Activation occurs with the VRE deployment, not the date this document was written.

## Decision

Self-attestation is Evidence, not independent verification. New Organization
Verification decisions use `minimum-trade-trust-organization-policy/v2`.
An approval requires independent confirmation in addition to all minimum
identity, evidence consistency and integrity rules. A reviewer records a review
artifact, never `approved` or `trusted`.

Authority: Evidence → immutable independent confirmation → versioned Policy →
canonical Verification Decision Engine → replay → Trust Status Deriver.

Confirmation may be an authorized independent human review, or an independently
confirmed trusted source expressly admitted by a versioned policy. V2's initial
provider registry is empty: there is no configured independently trusted source
integration. This is not a permanent human-only requirement. Adding a provider
requires an explicit permitted provider/method, subject binding, authenticated
provenance and failure handling; owner assertions and AI observations cannot
masquerade as provider confirmations. Provider unavailability never creates PASS.

The baseline human reviewer must hold `verification.review.submit`, have recent
step-up, and must not be an Organization member or the evidence submitter.
Platform Owner has no independence exemption. Review binds the exact Organization,
profile revision/fingerprint and evidence identity/version/digest. A new evidence
or profile revision requires a new matching review. Review outcome and provenance
are snapshotted into the canonical workflow, not read from mutable live state
during replay. Requesting revision is a review finding, not a direct rejection.

## History and activation

V1 remains a separate reproducible policy implementation. No migration rewrites
prior decisions, Trust snapshots or evidence. Existing V1-approved Organizations
continue under their existing canonical state. Earlier self-attestation approvals
do not imply misconduct. No activation backfill or automatic reevaluation occurs.

Every new decision after activation uses V2, including legitimate reverification,
expiry, material evidence/Organization change or remediation/enforcement triggers.
Policy activation provenance is stored separately. New reviews and decisions
carry V2 provenance. Replaying an old workflow uses its historical artifacts,
not today's review state or policy choice.

Risk and Enforcement remain separate authorities. A missing independent review
does not create risk misconduct or an enforcement case. No reviewer, provider,
Risk signal, UI control or Platform Owner may bypass the Decision Engine.
