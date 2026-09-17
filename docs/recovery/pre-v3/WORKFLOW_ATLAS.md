# Current V2 Workflow Atlas

## User and commercial path

1. A business user registers with a canonical email, verifies the one-time email token and establishes a server session.
2. The user creates an Organization. The Registry creates the profile revision and active owner Membership atomically.
3. The owner submits structured evidence metadata. This is not a protected-document repository.
4. Self-service verification runs Policy V2 but self-attestation alone resolves to review, never `approved` or `trusted`.
5. An independent authorized reviewer records a Review Artifact. A reviewer who is a member or submitter is rejected.
6. A legitimate re-evaluation trigger invokes the canonical engine, Replay and Trust derivation. Eligible owners receive a participation runtime binding.
7. The seller creates and edits a SELL offer draft, records evidence metadata, and submits it. Submission freezes the revision and queues verification.
8. The offer engine completes the attempt. The coordinator moves an approved current revision to `verified`.
9. Marketplace reads independently recompute Organization participation, offer verification and publication eligibility. Only publishable SELL offers are returned.
10. An eligible buyer creates an order. The server checks quantity, expiry, current offer fingerprint, both participants, publication, and Enforcement.
11. Only the canonical seller accepts the current order after all checks are repeated.
12. Either bound participant can create one immutable Current V2 Contract draft from the accepted Order snapshot.

## Admin and VRE path

Authenticated user → active Platform Principal/Role or Ownership Assignment → permission → MFA/recent-step-up → explicit command with reason → domain record and Security Audit in one transaction.

Verification reviewers append independent artifacts; they never set Trust. Risk signals do not impose Enforcement. Enforcement requires a case, explicit decision and scoped append-only action. The command guard consumes the latest matching USER and ORGANIZATION action without altering Trust or history.
