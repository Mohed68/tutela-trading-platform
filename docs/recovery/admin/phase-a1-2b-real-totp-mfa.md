# Phase A1.2b — Real TOTP MFA

## Boundaries

MFA Credential, Session Assurance, and Platform Authority remain independent.
An active credential proves only enrollment. A successful challenge upgrades
only the current server-managed Session. It grants no Platform permission.

## Credential lifecycle

The additive `0018_totp_mfa_credentials.sql` migration introduces versioned
TOTP credentials with lifecycle states:

- `pending_enrollment`
- `active`
- `revoked`

Activation requires a valid TOTP confirmation. Pending and revoked credentials
cannot authenticate. Only one pending or active credential may exist per User;
revoked history can remain.

## Secret protection

TOTP secrets are encrypted with AES-256-GCM using per-record random 96-bit IVs,
128-bit authentication tags, and associated data binding credential ID, User
ID, and key version. Production configuration requires:

```text
MFA_ENCRYPTION_KEY=
```

The value must be exactly 32 random bytes represented as 64 hexadecimal
characters. It never falls back to `SESSION_SECRET`, `DATABASE_URL`, or another
key. The plaintext TOTP secret and provisioning URI are returned only during a
new pending enrollment and are not stored in plaintext.

## TOTP policy

- RFC 6238 TOTP using HMAC-SHA1;
- six digits and 30-second period;
- one time-step of accepted clock skew;
- accepted counters are stored atomically under row lock;
- an accepted or older counter cannot be replayed;
- five failed attempts cause a five-minute server-side lock.

## Recovery codes

Ten cryptographically random recovery codes are created only after enrollment
confirmation and returned in plaintext once. PostgreSQL stores only independent
salted scrypt hashes. Consumption is atomic and each code is single-use.

## Session Assurance

Successful enrollment confirmation or normal challenge calls the server-only
`markMfaSatisfied` and yields `mfa` assurance in that Session only. It never
creates `recent_step_up`.

The explicit step-up endpoint requires existing MFA Session assurance and a
fresh, non-replayed TOTP. Only then does it call `markStepUpSatisfied`. Recovery
codes are not accepted for privileged step-up.

## Safe HTTP surface

The Auth service exposes status, enrollment, confirmation, challenge, and
step-up routes. DTOs never expose encrypted material, hashes, counters, locks,
or database rows. Missing encryption configuration makes only MFA operations
unavailable; ordinary trader authentication remains unchanged.

Reset/disable is deliberately absent until A1.2c supplies strong authority and
cross-session invalidation. No Admin access policy changes in A1.2b.

## Test database and migration

`npm run db:migrate:mfa:test` applies or verifies `0018` only through the
explicit `TEST_DATABASE_URL` target and refuses equality with `DATABASE_URL`.
The rehearsal preserves User, Offer, Order, and Contract counts.

Integration tests create one `.invalid` User and dependent MFA records, then
delete that exact User in `finally`; foreign-key cascade removes the test MFA
records. No Production target, business data, or deployment is involved.

## Future factors

The dedicated factor type and credential boundary permit later WebAuthn,
passkeys, and hardware security keys without treating those future factors as
TOTP or changing Session Assurance ownership. They are not implemented here.
