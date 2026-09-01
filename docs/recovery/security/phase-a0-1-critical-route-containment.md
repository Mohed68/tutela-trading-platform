# Phase A0.1 — Critical legacy route containment

The production server treats browser state, including `localStorage` role values,
as presentation-only and untrusted. Platform and record authority is enforced by
server-side identity, persisted ownership, canonical application services, or the
existing administrative middleware.

## Retired legacy capabilities

The following routes are intentionally unavailable to every caller because they
provided alternate, non-canonical authority or unsafe serialization:

- `GET /api/verification/pending`
- `PATCH /api/verification/:id/status`
- `POST /api/commodities`
- `GET /api/offers/:id`
- `POST /api/offers/:offerId/verify`

Organization verification remains exclusively:

`Evidence → Application Service → Policy/Decision → Replay → Trust`.

Offer documentary evidence remains the owned draft/application path. The public
marketplace continues to use its publication-eligibility projection.

## Active containment boundaries

- Only the target (`partnerId`) may approve or reject a pending legacy Partner
  Relation. Reconsideration and unrelated-user mutation are unavailable.
- The legacy Offer status endpoint accepts only an owner closing or cancelling
  their own Offer. It cannot create active, submitted, or verified lifecycle state.
- Ordinary API responses use safe user summaries and never serialize password
  hashes, platform roles, authentication fields, MFA flags, or internal KYB state.
- `/admin/companies` remains protected by server-side platform-admin middleware,
  but its raw DTO is classified HIGH / FIX BEFORE USE for Admin Foundation.

## Deferred Admin Foundation findings

The legacy browser `AdminRoute` can be visually spoofed through `localStorage`,
but backend admin endpoints do not consume that value. Existing MFA code treats
`is2FAEnabled` as if it proved session MFA satisfaction; this is not a valid
session-level MFA guarantee and must be replaced before activating Admin.

