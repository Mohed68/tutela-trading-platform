# Phase 4A authentication decision-boundary report

Date: 2026-07-27

Status: mandatory stop condition reached before authentication implementation

## Executive summary

The approved repository and disposable database state remain intact, and the
authentication authority is now fully traced.

The active system implements email/password authentication with Passport
LocalStrategy, scrypt password hashes, PostgreSQL-backed sessions, user-ID
serialization, and database user lookup during deserialization. The approved
legacy database cannot support that implementation:

- `public.users` has no password, provider, email-verification, or last-login
  columns;
- current user lookups select additional absent KYB, administration,
  subscription, usage, and preference columns;
- repository, client, and legacy role vocabularies conflict;
- no legacy credential ownership or activation policy exists.

An isolated local recovery user therefore cannot be created securely without
a prohibited schema change and a role-authority decision. The instruction to
stop before implementation was followed.

No user was created. No existing user changed. No session was created. No
database write, migration, seed, reset, schema change, authentication bypass,
production-provider request, marketplace change, or application behavior
change occurred.

Phase 4A produced the exact decision package and executable, read-only
characterization coverage. Authentication itself is not recovered and must not
be represented as operational.

## Repository state

- Branch: `recovery/phase-2-runtime-workflows`
- Starting revision:
  `9fefa89a55c1d132b4b576f152a107958db11432`
- Authority analysis commit: `62d792c`
- Characterization test commit: `1e0473e`
- Report commit: this document's commit; the full final hash is recorded in
  the handoff
- Approved history was not rewritten

## Disposable database confirmation

- Recovery marker: exactly one valid `tutela-recovery-test` row
- Fingerprint:
  `1654ed34b5a19cef9edc6fe3e996553e59c370f311207a89348811f969e3def8`
- Fingerprint result: matches approved Phase 3C baseline
- Migration journal: 6 accepted records
- Production/Render marker: absent
- Inspection mode: PostgreSQL read-only transactions

### Approved row counts

| Table | Count |
|---|---:|
| `neon_auth.users_sync` | 1 |
| `public.activity_logs` | 0 |
| `public.commodities` | 9 |
| `public.contracts` | 0 |
| `public.offers` | 9 |
| `public.partner_relations` | 0 |
| `public.sessions` | 0 |
| `public.users` | 4 |
| `public.verification_documents` | 0 |
| `public.offer_verifications` | 0 |
| `public.performance_insights_reports` | 0 |

The same identity fingerprint, four users, and zero sessions were observed
before and after the controlled authentication probes. The marketplace runtime
suite separately reconfirmed its full database safety snapshot.

## Authentication architecture trace

### Active implementation

1. `server/index.ts` installs recovery protections.
2. `server/routes.ts` calls `setupAuth`.
3. `express-session` uses `connect-pg-simple` and `public.sessions`.
4. Passport LocalStrategy accepts normalized email and password.
5. `storage.getUserByEmail` loads the user.
6. `server/password.ts` verifies a versioned salted scrypt hash with a
   constant-time comparison.
7. Successful login updates `last_login_at`.
8. Passport serializes the user ID string into the session.
9. Passport deserializes through `storage.getUser(id)`.
10. `GET /api/auth/user` reloads the row and passes it through `publicUser`.

### Supported strategies

- Active: Passport local email/password only.
- Inactive: archived Replit/OpenID code.
- Not integrated: Neon Auth, OAuth, production SSO.
- Unsafe for recovery evidence: demo request-user injection and client
  local-storage role/verification state.

No production provider was contacted.

## Legacy user findings

- Columns:
  `id`, `email`, `first_name`, `last_name`, `profile_image_url`,
  `company_name`, `role`, `financial_rating`, `credit_rating`, `verified`,
  `created_at`, `updated_at`.
- Four of four rows have non-null, non-blank, distinct normalized login
  identifiers.
- Four of four IDs are non-null and distinct `varchar` strings compatible with
  Passport serialization.
- Password-like columns: absent.
- Provider columns/identifiers: absent.
- Disabled, deleted, locked, or activation fields: absent.
- Email-verification and last-login timestamps: absent.
- Role distribution: four distinct non-null legacy roles.
- `verified` distribution: three true and one false. It was not treated as any
  authentication, email, KYB, organization, seller, or administrator proof.
- `company_name` is display data only; no organization membership or
  verification authority was found.

No row contents or personal values were reported.

## Identified mismatches

1. Secure local credentials have nowhere to be stored.
2. Provider and successful-login state have nowhere to be stored.
3. Full Drizzle user selection references numerous absent columns.
4. Session schema is compatible, but user deserialization is not.
5. The existing `publicUser` removes only `passwordHash` and raw-spreads all
   other fields.
6. Legacy `role`, current shared `role`, client roles, and server
   `admin_role` have different semantics.
7. Public registration exists outside recovery despite unresolved identity
   provisioning.
8. The operator password script targets an existing account, which is
   prohibited for legacy users and currently logs the target email.
9. Client role/verification route guards rely on local demo state and are not
   security authorities.
10. The demo authentication bypass injects a user and may create a demo row;
    recovery startup forces it off.

The detailed A–O classification is in
`authentication-authority-analysis.md`.

## Test-user options

### Option A — isolated recovery-only local user

Recommended in principle because it is the only option that can exercise the
real local Passport, session, deserialization, current-user, and logout path
without changing a legacy identity.

Not implemented. The approved schema cannot store its password hash and the
minimum non-admin role is unresolved.

### Option B — test-only in-memory identity

Rejected. It bypasses password lookup, database identity persistence, and
meaningful production authentication code. It would create false confidence
and violate the no-injected-user instruction.

### Option C — legacy credential recovery

Rejected for this phase. It requires account ownership, activation,
password-reset, delivery, audit, and role-authority decisions and would modify
an existing user.

## Required business decisions

Before a Phase 4B implementation:

1. approve or reject an additive auth-only schema reconciliation that does not
   run migration `0001`'s legacy-account backfill;
2. approve one exact minimum non-admin role for the recovery account;
3. approve the allow-listed display fields for the authenticated shell;
4. confirm all legacy accounts remain credential-unknown and login-disabled;
5. confirm public registration remains disabled.

## Implementation performed

Application implementation: none, due to the mandatory stop condition.

Added recovery artifacts:

- authentication authority and identity-boundary analysis;
- three-option recovery test-user decision;
- scrypt hash/verification tests;
- read-only legacy user/session/schema characterization test;
- recovery auth-route guard assertions;
- controlled anonymous auth/runtime test with before/after database checks;
- this report.

No safe DTO or session fix was integrated because there is no authorized
authenticated identity against which to validate it, and legacy role/display
authority remains unresolved.

## Authentication results

| Item | Result |
|---|---|
| Recovery test user | Not created |
| Test data final state | No Phase 4A user or session data exists |
| Login endpoint | HTTP 503 in controlled recovery; guard blocks it before Passport |
| Invalid-login behavior | Runtime generic failure not reachable; source intends a generic 401 for unknown/wrong password |
| User-enumeration behavior | Intended credential failure is generic, but not runtime-validated |
| Session creation | Not attempted; 0 rows before and after |
| Session persistence/restart | Not testable without a safe identity |
| Cookie contract | `httpOnly`, `sameSite=lax`, 7-day expiry; secure only in production |
| Production cookie default | Unchanged |
| Logout | HTTP 503 in recovery; invalidation not testable without a session |
| `GET /api/auth/user` anonymous | HTTP 401, `{ message: "Unauthorized" }` |
| `GET /api/auth/user` authenticated | Not testable |
| Dashboard metrics anonymous | HTTP 503 under recovery allowlist |
| Authenticated safe reads | Not testable |
| Login frontend shell | HTTP 200 HTML |
| Dashboard URL shell | HTTP 200 HTML catch-all; not authenticated-render proof |
| Authenticated frontend shell | Not testable |
| Visual browser claim | None |

## Safe current-user DTO definition

Proposed, not integrated:

```text
{
  id: string,
  displayName: string | null,
  role: string | null,
  organizationDisplayName: string | null,
  account: {
    authenticated: true
  }
}
```

Role and organization display fields remain subject to the decisions above.
The mapper must explicitly exclude password material, provider internals,
email-verification evidence, `users.verified`, KYB, organization/seller
verification, admin authority, documents, subscription/payment identifiers,
moderation/audit state, and every unlisted database field.

The current raw-spread response remains an unresolved risk and is unreachable
as a successful response in controlled recovery.

## Files modified

| File | Reason |
|---|---|
| `docs/recovery/phase-4a/authentication-authority-analysis.md` | Trace architecture, schema, DTO, session, frontend, and mismatch authority |
| `docs/recovery/phase-4a/recovery-test-user-decision.md` | Compare Options A/B/C and record the exact decision boundary |
| `server/password.test.ts` | Verify scrypt format, salt uniqueness, comparison, and fail-closed malformed hashes |
| `scripts/auth/legacy-auth.characterization.test.ts` | Enforce approved identity/schema/count boundary in a read-only transaction |
| `scripts/auth/phase-4a.runtime.characterization.test.ts` | Prove anonymous/guard behavior and unchanged database state |
| `server/recoveryMode.test.ts` | Assert auth writes and protected reads remain blocked |
| `package.json` | Register explicit auth characterization/runtime test commands |
| `docs/recovery/phase-4a/phase-4a-report.md` | Record this checkpoint |

## Validation

All commands passed:

- `npm run check`
- `npm run build`
- `npm run test:auth-characterization` — 3 passed
- `npm run test:auth-runtime` — 1 passed
- `npm run test:recovery` — 8 passed
- `npm run test:migrations` — 5 passed
- `npm run test:api-request` — 4 passed
- `npm run test:marketplace-characterization` — 2 passed
- `npm run test:marketplace-policy` — 4 passed
- `npm run test:marketplace-presentation` — 3 passed
- `npm run test:marketplace-runtime` — 1 passed

Build warnings remain limited to stale Browserslist metadata and a frontend
chunk above 500 kB. They predate Phase 4A and do not affect this decision.

## Database writes and cleanup

- User inserts/updates/deletes: none
- Session inserts/deletes: none
- Schema/migration writes: none
- Business-table writes: none
- Marker writes: none
- Cleanup: not applicable; there is no Phase 4A test data

## Remaining authentication risks

1. Local login and current-user resolution are not operational.
2. The current-user serializer is unsafe if it ever becomes reachable.
3. Production registration is present but identity provisioning is unresolved.
4. Legacy account ownership and activation remain unknown.
5. Role and administrator authority are inconsistent across layers.
6. Client demo/local-storage guards can create misleading UI authorization.
7. The explicit password operator script is not safe for legacy recovery.
8. Session persistence and logout invalidation remain unproven.
9. Protected dashboard reads depend on additional unrecovered schema.

## Recommended Phase 4B scope

Only after the five business decisions are approved:

1. add nullable auth columns through a reconciled migration with no legacy
   backfill;
2. implement minimal auth-specific database projections;
3. add an explicit allow-listed current-user DTO;
4. disable public registration;
5. permit only login, logout, and current-user routes in recovery;
6. add explicit production/Render-safe recovery-user create/cleanup tooling;
7. create one non-admin recovery user using environment-only credentials;
8. test generic invalid login, normal login, cookie flags, database session,
   restart persistence, current-user DTO, safe protected reads, logout, and
   cleanup;
9. reconfirm all four legacy users, business rows, and marketplace behavior
   remain unchanged.

Do not include legacy-user activation, password reset, OAuth, Neon Auth, KYB,
admin redesign, registration, offer writes, contracts, orders, payments,
blockchain, or deployment.

