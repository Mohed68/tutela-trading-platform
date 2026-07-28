# Phase 4B additive authentication recovery report

Date: 2026-07-28

Status: complete; stopped before legacy activation or business-workflow recovery

## Executive summary

The controlled recovery environment now has one complete, real local
authentication loop:

```text
recovery trader
→ Passport local login
→ PostgreSQL session
→ current-user resolution
→ authenticated application shell
→ server restart
→ persisted session
→ logout
→ access revoked
```

The recovery account uses the repository's versioned salted scrypt password
format and every approved authority predicate. It is an ordinary `trader`
only. Authentication does not grant or infer administrator, buyer, seller,
offer, organization, KYB, subscription, or marketplace verification state.

The four legacy users are byte-for-byte unchanged in their original fields,
all six additive auth fields remain null, and they cannot authenticate. Unknown
identifiers, malformed identifiers, and legacy identifiers receive the same
generic HTTP 401 response.

Public registration is disabled. The current-user API returns an explicit
allow-listed DTO. No credential, hash, session identifier, cookie, personal
value, or environment secret was printed, committed, or included in this
report.

## Repository state

- Branch: `recovery/phase-2-runtime-workflows`
- Starting revision:
  `6c108d61eb0be27f7e7996719fc576a8f737af28`
- Migration commit: `99947cd`
- Authority and DTO commit: `065270a`
- Recovery-account tooling commit: `c4abcc9`
- Session and route commit: `8274ac6`
- Security/runtime test commit: `cfe3100`
- Safe shell boundary commit: `6e71d9a`
- Report commit: this document's commit; the final full hash is recorded in
  the handoff
- Approved history was not rewritten

## Disposable database confirmation

- Recovery marker: exactly one valid `tutela-recovery-test` control row
- Render marker: absent
- Controlled execution environment: development/recovery only
- Production identity providers contacted: none
- Recovery server at handoff: stopped

### Structural fingerprints

- Pre-migration:
  `1654ed34b5a19cef9edc6fe3e996553e59c370f311207a89348811f969e3def8`
- Rehearsed and executed post-migration:
  `e79139302ae53b2dafb58a2eaf54ab47873df4a15dd3c0026ea0024d424da659`

The migration rehearsal ran in a transaction, passed postflight and exact
legacy-user snapshot comparison, and rolled back. Execution then produced the
same fingerprint.

## Migration result

- Identifier: `0006_additive_auth_recovery`
- Filename: `migrations/0006_additive_auth_recovery.sql`
- Journal provenance: `additive_migration`
- Execution path: `existing_database_upgrade`
- Journal status: `succeeded`
- SQL executed: true
- Included in bootstrap: false
- Migration `0001`: not executed
- Migrations `0002`–`0005`: unchanged

### Added authentication fields

All fields are nullable and have no default:

1. `password_hash`
2. `auth_provider`
3. `last_login_at`
4. `login_enabled`
5. `credential_status`
6. `recovery_provenance`

Added safety objects:

- nullable credential status check: `active` or `revoked`;
- nullable recovery provenance check:
  `tutela-recovery-test` only;
- partial unique recovery provenance index, limiting the database to one
  marked recovery account.

No value was backfilled.

## Final database state

| Table | Count |
|---|---:|
| `neon_auth.users_sync` | 1 |
| `public.activity_logs` | 0 |
| `public.commodities` | 9 |
| `public.contracts` | 0 |
| `public.offers` | 9 |
| `public.partner_relations` | 0 |
| `public.sessions` | 0 |
| `public.users` | 5 |
| `public.verification_documents` | 0 |
| `public.offer_verifications` | 0 |
| `public.performance_insights_reports` | 0 |

### Legacy users

- Rows: 4
- Original-field snapshot: unchanged through migration, account creation,
  runtime testing, and cleanup rehearsal
- `password_hash`: null
- `auth_provider`: null
- `last_login_at`: null
- `login_enabled`: null
- `credential_status`: null
- `recovery_provenance`: null
- Login status: disabled by explicit application authority
- Credential status: unknown

### Retained recovery data

One recovery-only account is intentionally retained for Phase 4C:

- provenance: `tutela-recovery-test`;
- role: `trader`;
- provider: local;
- login enabled: true;
- credential status: active;
- password: stored only as a versioned salted scrypt hash;
- last login: recorded;
- `verified`: false;
- personal name fields: null;
- company/organization display field: null;
- financial and credit rating fields: null;
- admin authority: none;
- KYB authority: none;
- organization/seller/offer verification: none;
- subscription entitlement: none.

The identifier and password remain only in the ignored local environment and
are not recorded here. No session row is retained.

The cleanup command was rehearsed in a transaction: it removed only the
recovery account and its sessions, confirmed four legacy users remained, then
rolled back. The account therefore remains intentionally available.

## Authentication authority

A user can authenticate locally only when all conditions are true:

1. `auth_provider = 'local'`;
2. `login_enabled IS TRUE`;
3. `credential_status = 'active'`;
4. `password_hash IS NOT NULL`;
5. role is exactly `trader`;
6. recovery provenance is exactly `tutela-recovery-test`;
7. the supplied password matches through constant-time scrypt verification.

Missing or unauthorized identities still perform a dummy scrypt verification
before returning the generic failure. Session deserialization repeats the
authority check, so revoking an account prevents a stored session from
resolving.

## Endpoint and session results

| Behavior | Result |
|---|---|
| Anonymous `GET /api/auth/user` | HTTP 401 |
| Unknown identifier login | Generic HTTP 401 |
| Legacy identifier login | Same generic HTTP 401 |
| Malformed identifier login | Same generic HTTP 401 |
| Valid recovery login | HTTP 200 |
| PostgreSQL session after login | Exactly 1 row |
| Authenticated `GET /api/auth/user` | HTTP 200, safe DTO |
| Malformed cookie | HTTP 401 |
| Session after controlled server restart | Persisted; current-user remained HTTP 200 |
| Explicitly expired test session | HTTP 401 |
| Logout | HTTP 200, server session destroyed, cookie cleared |
| Current-user after logout | HTTP 401 |
| Sessions at completion | 0 |
| Recovery registration request | HTTP 503, blocked by recovery guard |
| Registration route without recovery guard | HTTP 403, explicitly disabled |

Cookie contract:

- name: `tutela.sid`;
- `httpOnly=true`;
- `sameSite=lax`;
- path `/`;
- seven-day maximum age;
- recovery/development `secure=false`, required for local HTTP;
- production `secure=true`, unchanged;
- no cookie or session value was logged.

Session pruning remains disabled only in controlled recovery to avoid
background writes. Normal production configuration retains pruning.

## Safe current-user DTO

The login and current-user endpoints return only:

```text
{
  id: string,
  displayName: "Recovery trader",
  role: "trader",
  authenticated: true,
  accountState: "active",
  organizationDisplayName: null,
  emailVerified: "unknown",
  userVerified: "unknown",
  kybState: "unknown",
  organizationVerification: "unknown"
}
```

Explicitly excluded:

- email and personal/legal names;
- password and password hash;
- provider and recovery provenance internals;
- last-login timestamp;
- cookies, session IDs, and session data;
- `users.verified`;
- KYB state, evidence, documents, and paths;
- organization/seller/offer verification evidence;
- administrator fields and permissions;
- financial and credit ratings;
- subscription/payment identifiers;
- moderation, audit, and risk fields;
- raw database objects and all future unlisted fields.

Authentication, email verification, user verification, KYB verification,
organization verification, seller verification, and administrator authority
remain separate states.

## Protected frontend shell

- Login HTML shell: HTTP 200.
- Valid login returns the DTO consumed by `useAuth`.
- The authenticated dashboard URL returns the application HTML shell.
- The current-user bootstrap returns HTTP 200 before and after server restart.
- Logout updates the client auth cache to null and returns to the public home.
- Post-logout current-user access returns HTTP 401.

No visual browser success is claimed. Credentials were intentionally not
entered into an interactive browser or exposed to browser tooling.

The existing dashboard business-metrics endpoint remains HTTP 503 in
controlled recovery. Runtime characterization proved that it references
legacy-incompatible contract and verification-document columns. Mapping those
fields would require contract/KYB business decisions outside Phase 4B, so the
endpoint remains blocked rather than returning invented zeroes.

## Files modified

| File | Reason |
|---|---|
| `migrations/0006_additive_auth_recovery.sql` | Add nullable auth authority fields and narrow constraints |
| `scripts/auth/auth-migration.ts` | Rehearse, execute, journal, and verify migration safely |
| `docs/recovery/phase-4b/auth-migration-safety.md` | Record preflight, postflight, fingerprint, and rollback design |
| `shared/auth.ts` | Define authority constants, minimal auth identity, and safe DTO |
| `shared/schema.ts` | Represent only the additive auth fields |
| `server/storage.ts` | Add minimal auth-only projections that avoid unrelated legacy schema gaps |
| `server/databaseHealth.ts` | Validate the approved additive auth contract |
| `server/auth.ts` | Enforce authority, generic failures, safe DTO, session revalidation, and disabled registration |
| `server/recoveryMode.ts` | Permit only login/logout/current-user while preserving write and business-read guards |
| `client/src/hooks/useAuth.ts` | Consume the explicit DTO |
| `client/src/hooks/useMonitoring.ts` | Stop expecting email/subscription fields from the DTO |
| `client/src/components/navigation/AppHeader.tsx` | Use POST logout and invalidate client auth state |
| `scripts/auth/recovery-user-lib.ts` | Validate environment, credentials, role, and trust state |
| `scripts/auth/recovery-user.ts` | Explicit create, verify, cleanup rehearsal, and cleanup tooling |
| `server/auth.security.test.ts` | Test authority predicates, DTO allowlist, cookies, and registration |
| `server/password.test.ts` | Verify scrypt hashing and fail-closed malformed hashes |
| `scripts/auth/recovery-user-lib.test.ts` | Test production/Render/marker/input safety |
| `scripts/auth/legacy-auth.characterization.test.ts` | Prove legacy users remain disabled and unchanged |
| `scripts/auth/phase-4b.runtime.test.ts` | Exercise the real Passport/session/restart/expiry/logout loop |
| `server/recoveryMode.test.ts` | Test the narrow recovery route allowlist |
| `scripts/marketplace/legacy-offer.characterization.test.ts` | Track the approved auth-only fingerprint change |
| `scripts/marketplace/phase-3c.runtime.test.ts` | Track the fingerprint while preserving marketplace behavior |
| `package.json` | Register explicit migration, recovery-user, and test commands |

## Validation

Passed:

- `npm run check`
- `npm run build`
- `npm run test:auth-characterization` — 10 passed
- `npm run test:auth-runtime` — 1 passed
- `npm run test:recovery` — 8 passed
- `npm run test:migrations` — 5 passed
- `npm run test:api-request` — 4 passed
- `npm run test:marketplace-characterization` — 2 passed
- `npm run test:marketplace-policy` — 4 passed
- `npm run test:marketplace-presentation` — 3 passed
- `npm run test:marketplace-runtime` — 1 passed

Total: 38 passed, 0 failed, 0 skipped.

The build retains only the existing stale Browserslist metadata warning and
the frontend chunk-size warning.

## Database writes performed

Authorized writes only:

1. six additive nullable auth columns;
2. two auth constraints and one partial unique index;
3. one succeeded `0006` migration-journal row;
4. one recovery-only trader row;
5. `last_login_at` updates for that recovery row during valid logins;
6. test-owned session inserts;
7. one test-owned session expiry update;
8. test-owned session deletion through expiry cleanup, bounded failure
   cleanup, and normal logout.

No legacy user, offer, commodity, contract, partner, verification, activity,
marketplace, KYB, payment, or administration row changed.

## Marketplace regression

The strict fail-closed marketplace policy is unchanged:

- HTTP 200;
- zero published offers;
- nine legacy offers unchanged;
- no trust inferred from authentication or the new trader;
- no raw user identity exposed;
- runtime before/after database state identical.

## Remaining authentication risks

1. Only the marked recovery account is intentionally login-capable.
2. Legacy ownership, activation, password reset, and provider linking remain
   unresolved and disabled.
3. Dashboard business metrics remain blocked due to contract/KYB schema
   mismatches.
4. Browser-level visual authentication was not performed to avoid exposing
   local credentials to interactive tooling.
5. Client demo/local-storage verification helpers remain non-authoritative and
   must not be treated as server security.
6. The recovery account must be removed before the disposable branch is
   retired or repurposed.
7. Production registration, OAuth, Neon Auth, and password reset remain
   disabled/unimplemented.

## Recommended Phase 4C scope

Keep the recovery account and authentication contract unchanged. Limit the next
phase to authenticated application-shell characterization and safe read-only
dependencies:

1. characterize each dashboard component independently;
2. keep contract, KYB, order, payment, and offer-write endpoints blocked;
3. prepare a separate decision package for legacy dashboard metrics field
   mappings;
4. add executable frontend component tests for authenticated routing, refresh,
   and logout cache invalidation without embedding credentials;
5. preserve marketplace fail-closed behavior and the four disabled legacy
   accounts;
6. rehearse recovery-account cleanup again at Phase 4C completion.

Do not activate legacy accounts, public registration, password reset, OAuth,
Neon Auth, KYB, offers, contracts, orders, payments, blockchain, or deployment
without separate approval.

