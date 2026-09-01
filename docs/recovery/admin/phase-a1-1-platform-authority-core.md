# Phase A1.1 — Platform Authority Core

## Status

Implemented as a dormant server-side authority core. It is not deployed,
activated, persisted, bootstrapped, or connected to HTTP or frontend code.

The A1.0b conformance review found the original candidate **conformant with
small corrections**. A1.1 adopts the conformant Principal, role, permission,
resolver, read-port, atomic-mutation, and deny-by-default design. The bounded
corrections add target-role-sensitive administration policy, a separate
Platform Owner governance policy extension point, privileged request/session
context, stronger audit context, and explicit negative tests.

## Current contract map

- Authenticated identity is resolved from the server session and `users`.
- Organization authority is separately represented by `organization_memberships`
  with `owner` and `member` roles.
- Legacy platform access reads the nullable `users.adminRole` value through
  `requireAdminAuth`, then expands a hard-coded legacy permission map through
  `requirePermission`.
- `updateUserAdminRole()` exists only as an unused storage method. Registration,
  profile, and preference requests cannot assign it.
- Existing frontend Admin guards read `localStorage`; they are presentation-only
  legacy and are not part of the new authority model.

## Frozen authority separation

`Organization Role != Platform Role`

`Authenticated User != Platform Principal`

`Platform Role != Platform Permission`

A Platform Principal references an authenticated User without copying account
identity. A normal User has no Platform Principal and therefore no Platform
permission. Organization ownership never implies Platform authority.

## Platform policy

The four roles are `PLATFORM_ADMIN`, `VERIFICATION_REVIEWER`, `OPERATIONS`, and
`SUPPORT`. Their permissions are a closed typed vocabulary and are resolved from
active assignments only. The policy is deny-by-default. `PLATFORM_ADMIN` is not
a wildcard role and has no permission to manufacture Verification, Trust, or
Eligibility truth.

The server resolver accepts only the authenticated User ID, looks up its
Platform Principal, validates every persisted assignment, and derives effective
permissions. Unsupported or malformed authority data invalidates the entire
resolution and yields no permission. Request roles, client roles, local storage,
and Organization Membership are not resolver inputs.

`PLATFORM_ADMIN` may manage lower-privilege Platform Roles only through the
role-administration policy. Its grant/revoke permission alone cannot grant or
revoke `PLATFORM_ADMIN`. Those higher-order changes require both recent step-up
assurance and approval from the separate Platform Ownership governance policy.

## Platform Owner governance boundary

Platform Owner is not a Platform Role and is not an `isOwner` attribute. The
future representation remains a durable Platform Ownership Assignment attached
to a Platform Principal. A1.1 defines only the policy dependency needed by role
administration; it does not define or persist an ownership record.

The future ownership implementation must enforce:

- at least one active Platform Owner;
- no removal of the final active owner;
- succession as grant new owner, confirm active, then optionally revoke old;
- current Platform Owner authority, recent MFA, and explicit reason for
  ownership grant/revoke;
- controlled, high-severity, server-side emergency recovery with no ordinary
  HTTP self-promotion; and
- no ability for ownership to fabricate Verification, Trust, or Eligibility.

Future dual control may be added when multiple active owners exist.

## Privileged command context

Role grant/revoke commands carry request and correlation identities, session
assurance, and a typed authorization scope containing the target Principal and
target role. This context must eventually be assembled from trusted server-side
request/session state. It is not accepted as a browser or client authority
claim.

A1.1 does not implement MFA. Policy fails closed when a `PLATFORM_ADMIN`
mutation lacks `recent_step_up`. A1.2 will supply authentic session assurance
without redesigning the command contract.

## Legacy compatibility

The new capability is dormant and is not wired into legacy Admin middleware or
HTTP routes. `users.adminRole` remains a legacy/migration source only. It does
not create a Platform Principal or Role Assignment and grants no new authority.
This preserves current production behavior without silently expanding access.

## Mutation and audit boundary

Grant and revoke commands require an authenticated actor, target Principal,
role/assignment identity, reason, timestamp, audit event identity, and
correlation identity. Only a Principal with the exact grant or revoke permission
and an approving target-role policy may execute them. Audit evidence also binds
request identity, effective permission, session assurance, authorization scope,
and high security severity.

The `PlatformAuthorityMutationPort` requires the authority mutation and its
security audit record to be persisted atomically. Failure of either side is a
failed, non-partial mutation. Persistent security-audit storage and bootstrap
authority are intentionally deferred; no HTTP mutation or first Platform Admin
exists in A1.1.

## Persistence decision

No migration is introduced in A1.1. The persistent table design must be bound to
the atomic security-audit implementation and controlled bootstrap provenance so
the first assignment does not create an unaudited circular authority. This phase
defines the records and ports needed for that implementation without changing
production data or runtime behavior.

## Intentionally unimplemented

A1.1 adds **no persistence, migration, HTTP route, bootstrap, frontend
integration, Platform Ownership storage, MFA runtime, production activation, or
deployment**. `users.adminRole` remains only a legacy/possible future migration
source and never creates a Platform Principal or permission.
