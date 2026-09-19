# TUTELA Authority Invariants

These are non-negotiable unless a newer canonical architecture document explicitly supersedes them.

## Core separation

- User != Organization
- Identity != Email Verification
- Email Verification != Organization Membership
- Membership != Operational Role
- Role != Capability
- Capability != Signing Mandate
- Organization Verification != Membership
- Verification != Trust
- Trust != Eligibility
- Eligibility != Trade Authority
- Deal Operator != Commercial Approver != Legal Signatory
- Evidence != Truth
- AI != Authority
- External Provider Evidence != Canonical Truth
- Frontend != Authority
- Read Model != Authority
- Risk Signal != Enforcement

## Historical integrity

- Executed contracts are immutable.
- Historical evidence and authority records are not silently rewritten.
- New reference/profile versions do not mutate historical contracts.
- Legacy ambiguity cannot gain authority through inference.
- Missing required authority fails closed.

## Contract role boundary

Seller and Buyer are the only parties to the commodity sale contract unless a future explicitly approved legal architecture says otherwise.

TUTELA is not, merely by operating the platform:
- Seller
- Buyer
- guarantor
- bank
- escrow provider
- customs authority
- legal adviser

## Progressive trust

Evidence may support a governed decision but does not itself create Verification, Trust, Eligibility, Publication authority, Signing authority, or Enforcement.

## External systems

External sources/providers are adapters or evidence/reference sources. They do not become TUTELA canonical authority merely because they are authoritative in their own domain.

## Organization authority

Corporate email domain is discovery/evidence, not authority by itself.

A job title such as CEO does not itself grant signing authority.

Sensitive grants must be explicit, scoped, auditable, revocable, and evaluated at time of action.
