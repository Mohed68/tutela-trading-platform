# Phase 8G — Final Staging E2E

## Scope

This recovery checkpoint proves Production Cycle 1 against the disposable Neon staging target through real HTTP and application paths. It does not authorize or perform production deployment.

## Runtime composition exercised

The verified path is:

`Local registration → Organization Registry → active owner Membership → platform-submitted Evidence → Organization Verification Application Service → PostgreSQL Load/Rehydrate/Replay → Trust → Activity Eligibility → Participation Eligibility → Offer documentary Evidence → Offer Verification → Publication Eligibility → Marketplace → Order → acceptance → Contract`

Controllers translate requests only. Decisions, Trust, Eligibility, Offer Verification, publication, Order, and Contract authority remain in their existing domain/application boundaries.

## Recovered blockers

- Draft creation now binds `seller_org_id` from the authenticated user's active owner Membership. Legacy verification flags are not consulted.
- Platform evidence references are category-specific projections of one immutable submitted evidence envelope, preventing category collisions without duplicating evidence authority.
- Durable Policy Runtime replay rehydrates and authenticates the nested Policy Evaluation Completion before Decision normalization.
- The Attempt completion reference and Policy Evaluation Completion ID use one explicit semantic identity.
- Application Service request immutability preserves authentic Decision Applicability artifacts rather than producing unauthentic structural copies.
- Legacy timestamp-without-time-zone values are rendered by PostgreSQL as explicit UTC versions before Offer evidence binding and Order rehydration.
- Current Participation and Publication authorities are re-evaluated at Order acceptance and Contract creation. A fresh evaluation event may have a new fingerprint; authority outcomes still fail closed, while immutable Offer version/fingerprint and accepted terms remain strictly bound.
- Contract terms are read from the authoritative `accepted_terms_snapshot`, not from legacy Order columns that do not exist.

## Schema compatibility

Migration `0017_organization_verification_artifact_fingerprint_compatibility.sql` permits the two repository-approved SHA-256 encodings used by durable verification artifacts: raw 64-character lowercase hexadecimal and `sha256:`-prefixed hexadecimal. It changes only the check constraint and does not rewrite evidence or business rows.

## Recovery proof

The staging process was stopped after authoritative state existed and restarted unchanged. Subsequent login, Participation evaluation through Replay, Marketplace lookup, Order read, and Contract read succeeded from persisted PostgreSQL state. Startup schema verification succeeded, demo auto-seeding remained disabled, and no external KYB, AML, sanctions, PEP, payment, escrow, blockchain, or AI provider was required.
