# Phase 8F.0C — Authoritative Order-to-Contract Flow

## Scope

This phase establishes the minimum first-cycle trading flow:

`Publishable Offer → Created Order → Accepted Order → Draft Contract`

It does not implement negotiation, settlement, payment, escrow, blockchain,
AML, sanctions, or AI.

## Authority boundaries

- Offer Publication Eligibility remains the sole publication gate.
- Organization Participation Eligibility independently authorizes the buyer.
- Order authority binds the current Offer version, publication proof, buyer
  participation proof, identities, organizations, and submitted quantity.
- Only the bound seller user may move a `created` Order to `accepted`.
- Contract authority requires an authentic `accepted` Order and copies its
  accepted terms without accepting commercial values from the controller.
- Contract creation does not call payment or blockchain services.

Legacy `verified`, `sellerOrgVerified`, Offer lifecycle flags by themselves,
payment status, escrow status, and legacy Order or Contract rows do not grant
authority. Legacy rows remain unchanged and readable, but lack the complete
authority binding required by the new flow.

## First-cycle lifecycle

- `created`: authoritative Order recorded from a currently publishable Offer
  and an eligible buyer.
- `accepted`: the authoritative seller accepted the unchanged Order while its
  Offer and eligibility proofs remained current.
- `cancelled`: terminal/non-contractible for this phase. No cancellation route
  or broader lifecycle was introduced.

The repository contains no authoritative rule prohibiting a user or
organization from appearing on both sides of an Order. Phase 8F.0C therefore
does not invent a self-order prohibition; both roles remain explicitly bound.

## Persistence

Migration `0014_order_contract_authority.sql` makes the legacy circular
`orders.contract_id` requirement nullable and adds complete, fingerprinted
authority columns. New Contracts have a unique `order_id` and bind the accepted
Order version/fingerprint and accepted terms. Completeness constraints ensure
partially authoritative records fail closed.

## Runtime routes

- `POST /api/orders`: accepts only Offer ID, buyer organization ID, and quantity;
  authenticated user identity is server-owned.
- `PATCH /api/orders/:id/status`: permits only the `accepted` transition through
  the trading-flow service.
- `POST /api/contracts`: accepts only Order ID; all Contract identities and terms
  come from the accepted Order.

Arbitrary legacy status mutation is disabled at these controller boundaries.
