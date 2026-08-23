# Phase 8F.0A — Organization Membership and Participation Eligibility

## Scope

This phase introduces only the minimum internal boundary connecting an
authenticated user to an Organization through an explicit membership and then
deriving participation eligibility from authoritative Organization Registry and
Organization Verification Replay state.

The phase does not connect Eligibility to Offers, publication, Orders,
Contracts, routes, frontend, registration, or deployment.

## Existing-model finding

No existing Organization Membership authority was found. `partner_relations`
is a user-to-user relationship. Legacy `users.company_name`, User KYB flags,
and Offer `seller_org_*` / delegate fields are compatibility or offer-scoped
data and do not establish Organization Membership.

## Membership boundary

`server/organization-membership` owns an immutable authenticated membership
contract with the minimal first-cycle vocabulary:

- roles: `owner`, `member`;
- statuses: `active`, `inactive`;
- exact User and Organization identities;
- explicit version, timestamps, provenance, integrity, and deterministic
  fingerprint;
- a read port for resolving an exact membership.

No membership database table is introduced in this phase. Organization
Registry persistence is not yet present, and adding an unrelated Organization
table solely to support a foreign key would duplicate the existing Registry
authority. A future infrastructure adapter may implement the frozen membership
read port when Registry persistence is introduced.

## Eligibility boundary

`server/organization-participation-eligibility` owns the derived decision. It
requires explicit dependencies for:

1. exact Organization Registry profile revision resolution;
2. exact Organization Membership resolution;
3. authoritative Organization Verification Replay resolution.

Eligibility is deterministic and side-effect free. It stores no independent
current state, has no clock or generated identity, performs no database or
network access, and never executes Organization Verification Runtime.

`trusted` is an input to Eligibility, not a permission. Eligibility returns its
own authenticated result with `eligible` or `ineligible`, machine-readable
reason codes, and immutable references to the Registry, Membership, and Replay
facts used for the decision. It does not return or mutate the Trust Status
object.

Legacy User KYB and verification booleans are deliberately absent from the
eligibility input surface and cannot override Replay-derived Trust.
