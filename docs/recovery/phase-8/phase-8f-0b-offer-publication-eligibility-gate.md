# Phase 8F.0B — Offer Publication Eligibility Gate

## Recovered authority boundary

The legacy marketplace admitted rows by combining `offers.verified`,
`offers.seller_org_verified`, and `offers.status = active`. Those values were
scattered compatibility fields and did not consume the authoritative Offer
Verification read model or Phase 8F.0A Organization Participation Eligibility.

Phase 8F.0B replaces that authority with one derived, immutable boundary:

```text
Organization Participation Eligibility
+ Offer Lifecycle
+ current Offer Verification Eligibility
→ Offer Publication Eligibility
→ Public Marketplace Projection
```

## Publication rule

An offer is `publishable` only when all of the following are true:

1. an authentic Phase 8F.0A Organization Participation result is `eligible`;
2. that result belongs to the offer's exact seller Organization and user;
3. the Offer Lifecycle is the private `verified` state;
4. the current Offer Verification read model is authentic, belongs to the
   exact offer, is `completed`, has decision `approved`, and maps to
   verification eligibility `eligible`.

Every absent, unavailable, stale, structurally fabricated, mismatched,
incomplete, or non-approved authority fails closed as `not_publishable` with a
machine-readable reason code. Trust remains inside Organization Verification;
Publication Eligibility consumes Participation Eligibility and never derives
Trust itself.

## Persistence and marketplace integration

Publication Eligibility is never persisted. It is evaluated for marketplace
candidates and only authentic `publishable` results may enter the public DTO.
The Offer Verification capability owns its current eligibility read model and
database reader; marketplace code does not query verification tables.

No durable Organization Membership or Organization Registry adapter exists at
this phase boundary. The production marketplace therefore supplies an explicit
`unavailable` Organization Participation reader and remains safely empty until
that authoritative adapter is implemented. Tests inject authentic Phase 8F.0A
results to prove the complete publishable path without inventing legacy
membership or Trust evidence.

The database schema, offers, Organization Verification, Trust derivation,
registration, Demo, Orders, Contracts, payments, deployment, and external
integrations are unchanged.
