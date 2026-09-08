# Phase A1.4 — Controlled Admin Activation

## Platform Ownership

Platform Ownership is a durable assignment from a Platform Principal. It is separate from `PLATFORM_ADMIN`, Organization membership, legacy `adminRole`, and every canonical Trust, Verification, or Eligibility authority.

The initial Owner is created only through the server CLI with an explicit user ID, reason, operator identity, and confirmation. The transaction validates an active verified local account, acquires an advisory lock, refuses any different bootstrap after an Owner exists, creates a Principal only when required, and commits the Ownership assignment with a critical bootstrap audit. Exact retry is idempotent.

Normal succession requires an existing active Owner, recent step-up, explicit reason, and atomic security audit. A database transaction and advisory lock prohibit revocation of the final active Owner. Ownership changes invalidate the affected user's sessions.

The production command is:

`npm run platform-owner:bootstrap -- --target-user-id <USER_ID> --reason "<EXPLICIT_REASON>" --operator-id <OPERATOR_ID> --confirm`

The target is never embedded in code or environment configuration.

## MFA and Admin activation

The Security settings experience uses the existing server MFA APIs. Enrollment remains pending until TOTP confirmation; recovery codes are shown once and never stored in browser persistence. Sensitive actions request an explicit TOTP step-up and are never replayed automatically.

Admin access requires authentication, Platform Principal resolution, Platform Role or Ownership authority, and the centrally required Session Assurance. The minimal Control Plane exposes only safe read models and clearly labels inactive modules as `DEFINED` or `ACTIVE_BASELINE`.

The active shell includes Overview, Organizations & Users, Verification, Risk, Enforcement, Trade Operations, Documents, Shipping & Fulfilment, Settlement & Finance, Claims & Disputes, Support, Platform Administration, and Security & Audit. Only the Platform Administration and Security/Audit foundations are active; other modules remain honestly labelled. Controllers accept requested targets and reasons, while server repositories resolve existing assignment ownership and the domain services remain the sole mutation authority. Platform Owner permissions are explicitly bounded to administration and security and cannot manufacture business truth.

## Deployment and rollback

Migration 0020 is additive and creates no Owner automatically. Deploy code, apply 0020, restart, verify health and denial before bootstrap, then run the explicit bootstrap only after owner selection. Code rollback returns to the pre-A1.4 HEAD; the additive ownership tables remain forward-compatible. Ownership bootstrap is not rolled back by deleting history—succession must be used.

Remaining work belongs to A1.5/VRE: operational verification queues, enforcement commands, advanced risk review, and broader Admin modules.
