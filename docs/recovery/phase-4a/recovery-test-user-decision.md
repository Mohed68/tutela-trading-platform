# Phase 4A recovery test-user decision

Status: Option A recommended in principle but not authorized or implementable
under the current schema constraints

## Option comparison

| Criterion | Option A: isolated recovery-only local user | Option B: test-only in-memory identity | Option C: legacy credential recovery |
|---|---|---|---|
| Fidelity | Highest once implemented through local Passport, PostgreSQL sessions, and storage | Low; it bypasses password lookup and meaningful identity persistence | Potentially high, but only after ownership and activation policy exists |
| Data integrity | Can leave all four legacy users unchanged | Leaves database users unchanged | Requires changing an existing identity |
| Security | Secure only with an environment-supplied secret and stored scrypt hash | Creates a bypass path and can hide production integration failures | Requires assigning/resetting a secret for a real legacy account |
| Production leakage risk | Low only with recovery/Render/production hard stops and explicit tooling | High if test injection is reachable outside a harness | High until ownership, delivery, audit, and reset controls exist |
| Legacy-user effect | None | None | Direct modification |
| Cleanup | Delete only the tagged new user and its sessions; verify legacy snapshot unchanged | Remove harness state | Must not be treated as disposable |
| Runtime suitability | Correct choice for login, restart persistence, logout, DTO, and safe-read tests | Unsuitable because it does not prove the real Passport/storage path | Unsuitable during recovery without an account-ownership decision |
| Current blocker | No `password_hash`, `auth_provider`, or `last_login_at`; full-row auth lookups select additional missing columns; minimum role is unresolved | Violates the instruction not to inject arbitrary users or bypass Passport | Credentials would have to be invented or reset |

## Option A safety-gate result

| Required guarantee | Result |
|---|---|
| New isolated recovery-only user | Conceptually possible, not currently storable |
| No existing user modified | Can be guaranteed by snapshot and transaction checks |
| Impossible on production or Render | Can be guaranteed by the existing recovery assertions plus tooling checks |
| Environment-only credential | Can be guaranteed |
| Secure password hash | Cannot be stored in the approved schema |
| Clearly recovery-only | Can be guaranteed with an explicit identifier/tag after schema authority is approved |
| Minimum non-admin role | Not yet authoritative; role vocabularies conflict |
| No KYB/organization verification inference | Can be guaranteed by null/false/absent values and explicit DTO separation |
| Cleanup safe and tested | Can be designed |
| Explicit, never ordinary startup | Can be guaranteed |
| Idempotent duplicate prevention | Can be guaranteed with a dedicated normalized identifier and transaction |
| Removable without legacy impact | Can be guaranteed after its storage model is approved |

Option A therefore fails the current gate on both password storage and role
authority.

## Recommendation

Do not use Option B or C.

For a separately approved Phase 4B, use Option A only after approving a narrow
authentication compatibility package:

1. an additive, reconciled local-auth migration that adds nullable
   `password_hash`, `auth_provider`, `email_verified_at`, and `last_login_at`
   without running migration `0001`'s legacy-user backfill;
2. an explicit minimal authentication projection so Passport does not select
   unrelated absent KYB, administration, subscription, or preference fields;
3. one authoritative non-admin recovery role value;
4. an explicit allow-listed current-user DTO;
5. recovery-only login/logout guard exceptions, while registration and all
   business writes remain blocked;
6. explicit recovery-user create/cleanup commands with production and Render
   hard stops;
7. before/after snapshots proving all four legacy users and all business rows
   are unchanged.

This recommendation intentionally does not activate any legacy account,
reinterpret `users.verified`, integrate Neon Auth/Replit/OAuth, enable public
registration, or modify marketplace trust rules.

## Required business approvals for Phase 4B

1. Approve or reject the additive auth-only schema reconciliation described
   above.
2. Select the exact minimum non-admin role for the isolated recovery account.
3. Confirm whether the authenticated shell may receive the user's own display
   name, legacy role label, and company display name.
4. Confirm that all legacy account credential state remains unknown and no
   legacy user becomes login-capable.
5. Confirm that public registration remains disabled until a later dedicated
   decision.

Until those decisions are made, authenticated success, persistence, logout
invalidation, protected authenticated reads, and the authenticated frontend
shell cannot be truthfully validated.

