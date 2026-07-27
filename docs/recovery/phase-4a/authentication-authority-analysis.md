# Phase 4A authentication authority analysis

Status: characterization complete; application implementation stopped at the
mandatory schema and identity-authority boundary

## Approved baseline reconfirmation

- Branch: `recovery/phase-2-runtime-workflows`
- Starting commit:
  `9fefa89a55c1d132b4b576f152a107958db11432`
- Starting worktree: clean
- Recovery marker: exactly one valid `tutela-recovery-test` row
- Application-schema fingerprint:
  `1654ed34b5a19cef9edc6fe3e996553e59c370f311207a89348811f969e3def8`
- Legacy users: 4
- Sessions: 0
- All approved business-table counts matched the Phase 3C baseline.
- `DATABASE_URL`, `SESSION_SECRET`, and `NODE_ENV` were present. Their values
  were not displayed.
- No Render marker was present.
- Legacy Replit variable names were present locally, but the archived Replit
  module has no active import. No production identity provider was contacted.

All database characterization ran inside PostgreSQL `READ ONLY` transactions.

## Active authentication architecture

### Startup and middleware order

`server/index.ts` installs the controlled-recovery request guard before route
registration. `server/routes.ts` then calls `setupAuth`, which installs:

1. `express-session`;
2. a PostgreSQL-backed `connect-pg-simple` store;
3. `passport.initialize()`;
4. `passport.session()`;
5. one Passport local strategy;
6. authentication routes.

The ordering is mechanically correct. The active data model is not compatible
with the legacy database.

### Supported strategies and identity sources

| Source | Repository state | Runtime authority |
|---|---|---|
| Passport local strategy | Active in `server/auth.ts` | The only active login strategy |
| `public.users` | Active application user store | Expected source for login and session deserialization |
| `public.sessions` | Active session store | Structurally compatible with `connect-pg-simple` |
| `neon_auth.users_sync` | Exists with one row | Not read or imported by active authentication code |
| Replit/OpenID module | Preserved as `server/replitAuth.legacy.ts` | Archived/inactive |
| Demo authentication bypass | Present in `isAuthenticated` | Forced off by recovery startup; bypasses meaningful authentication and may create a demo row outside production |
| Client `localStorage` role/verification helpers | Active in route guards | Demo state only; not authoritative server authentication or authorization |

No active OAuth, OpenID, Neon Auth, password-reset, or email-based activation
strategy was found.

### Local login contract currently implemented

- Identifier: JSON `email`, trimmed, validated, and lower-cased.
- Secret: JSON `password`, required to be non-empty for login.
- Storage lookup: `storage.getUserByEmail`.
- Password format:
  `scrypt-v1$<base64-salt>$<base64-derived-key>`.
- Salt: 16 random bytes.
- Derived key: Node.js `scrypt`, 64 bytes.
- Comparison: `timingSafeEqual`.
- Generic unknown/wrong-password message:
  `Invalid email or password.`
- Rate limit: 10 failed attempts per 15 minutes per limiter key; successful
  requests are skipped.
- Successful login: writes `last_login_at`, logs the user into the Passport
  session, reloads the stored user, and returns it through `publicUser`.

The login request validation is sound in isolation. It cannot reach its generic
credential result on the approved schema: the Drizzle user lookup selects
columns that do not exist.

### Session contract

- Cookie name: `tutela.sid`
- Cookie contents: signed opaque session identifier, not a user object
- Server-side store: `public.sessions`
- Serialized Passport value: user ID string
- Deserialization lookup: `storage.getUser(id)`
- Cookie flags: `httpOnly=true`, `sameSite=lax`, path `/`
- Expiration: 7 days
- Production: `secure=true`, proxy trust enabled
- Recovery/development: `secure=false`, without changing production defaults
- Recovery: automatic session pruning is disabled to prevent startup writes
- Logout: Passport logout, session destruction, then cookie clearing

The database session table has the expected `sid varchar`, `sess jsonb`, and
`expire timestamp` columns. User IDs are non-null unique `varchar` values, so
the serialization type itself is compatible.

Session deserialization is not operational. `storage.getUser` selects the full
current Drizzle `users` model, including many columns absent from the legacy
table.

## Legacy user schema characterization

### Available columns

`id`, `email`, `first_name`, `last_name`, `profile_image_url`,
`company_name`, `role`, `financial_rating`, `credit_rating`, `verified`,
`created_at`, and `updated_at`.

### Aggregate findings

- Rows: 4
- Non-null login identifiers: 4
- Blank login identifiers: 0
- Distinct normalized login identifiers: 4
- Distinct non-null IDs: 4
- Password-like columns: none
- Authentication-provider columns: none
- Provider identifier columns: none
- Email-verification timestamp: absent
- Last-login timestamp: absent
- Disabled/deleted/account-lock columns: absent
- Organization field: `company_name` exists, but it is only display data; no
  organization identity, membership, or verification authority exists
- Boolean `verified`: 3 true, 1 false; this is not authentication, email,
  organization, seller, or KYB proof
- Roles: one row each for `admin`, `commodity_manager`, `senior_trader`, and
  `trading_director`

The legacy role values do not match the shared model's default `trader`, the
client role union (`buyer`, `seller`, `partner`, `admin`), or the server
administrative authority field (`admin_role`). Role mapping is therefore a
business-authority decision, not a mechanical rename.

No personal field values or row contents were recorded.

## Required current runtime fields

The active auth path requires:

- lookup: `id`, `email`, `password_hash`;
- password/provider state: `password_hash`, `auth_provider`;
- successful-login write: `last_login_at`, `updated_at`;
- session identity: `id`, plus name/email/profile fields copied into the
  Passport request object;
- current-user reload: the full shared `users` model under the current storage
  implementation.

The full shared model also selects absent KYB, administration, subscription,
usage, and preferences columns. Adding only the four columns in migration
`0001_local_auth.sql` would therefore not make `storage.getUser` or
`getUserByEmail` safe against this legacy table without a minimal auth
projection.

## DTO safety finding

`publicUser` currently removes only `passwordHash` and then spreads every other
database field. If the current schema existed, that would expose internal
provider state, verification timestamps, KYB fields, administration state,
subscription identifiers, usage counters, preferences, and future fields
added to the row.

This is not an acceptable current-user DTO.

A future explicit current-user mapping should be versioned and allow-listed.
The minimal proposed shell DTO is:

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

Before integrating that DTO, the role and organization display fields require
confirmation that their legacy meanings are acceptable for the authenticated
user's own shell. It must not include or infer:

- password or password hash;
- authentication-provider internals;
- email-verification evidence;
- `users.verified`;
- offer or seller verification;
- KYB state or documents;
- organization-verification evidence;
- admin role or permissions;
- subscription/payment identifiers;
- moderation/audit fields;
- the raw database user object.

The following states must remain separate: authenticated, email verified, user
verified, KYB verified, organization verified, seller verified, and
administrator authorized.

## Frontend authentication trace

- `useAuth` treats a successful `GET /api/auth/user` response as the
  authentication source.
- `App.tsx` mounts the dashboard/application routes only when that query
  returns a user.
- The login page posts email/password, caches the returned user, and redirects
  to `/`.
- The header uses `GET /api/logout`, while the login API also exposes
  `POST /api/auth/logout`.
- The registration page and public registration API are present, but recovery
  mode blocks the write. Production registration is unresolved and was not
  enabled.
- `client/src/lib/session.ts` always reports `loggedIn=true` and derives
  verification and role from DOM/local storage demo state. Route guards based
  on this module are not security controls and cannot be used as identity or
  authorization evidence.
- The dashboard shell depends on authenticated bootstrap plus additional
  protected API reads. Those reads use schema fields and tables outside this
  phase's approved recovery scope.

## Controlled runtime results

| Probe | Result | Meaning |
|---|---:|---|
| `GET /api/auth/user` anonymous | 401 | Anonymous current-user access is denied |
| `POST /api/auth/login` | 503 | Recovery guard blocks auth writes before Passport |
| `POST /api/auth/logout` | 503 | Recovery guard blocks the route |
| `GET /api/logout` | 503 | Recovery guard blocks the route |
| `GET /api/dashboard/metrics` anonymous | 503 | Route is outside the recovery read allowlist |
| `GET /login` | 200 HTML | Frontend shell is served |
| `GET /dashboard` | 200 HTML | Catch-all shell is served; this is not proof of authenticated rendering |

The fingerprint, four user rows, and zero session rows were identical before
and after the controlled probe. Browser-level authenticated rendering was not
attempted because no safe identity exists.

## Gap classification

| Code | Finding | Runtime impact | Mechanical now? | Decision required? |
|---|---|---|---|---|
| A | `password_hash` absent | No local credential can exist | No; adding it is prohibited | Yes |
| B | No legacy password alias found | No compatible alternate lookup | No | No alias exists |
| C | `auth_provider` absent | Provider state cannot be represented | No; adding/backfilling is prohibited | Yes |
| D | `email_verified_at` absent | Email state unavailable | No; must remain unknown | Yes before use |
| E | `last_login_at` absent | Successful local login write would fail | No; adding it is prohibited | Yes |
| F | Serialized ID format is compatible; deserialization query is not | A persisted session cannot resolve a user | Minimal projection is mechanical only after an identity strategy is approved | Yes |
| G | IDs are compatible non-null `varchar` strings | No type mismatch | Not applicable | No |
| H | Raw-spread current-user DTO is unsafe and full-row query is incompatible | Current-user success is unsafe/unavailable | Explicit mapping is mechanical after field authority is approved | Yes for role/org fields |
| I | Three incompatible role vocabularies; `admin_role` absent | Privilege meaning is ambiguous | No | Yes |
| J | Legacy credential ownership unknown | Existing accounts cannot be activated safely | No | Yes |
| K | Public registration exists outside recovery | Could create uncontrolled business identities | Disable/isolate later | Yes for production policy |
| L | No user password-reset route exists; operator reset script targets existing email and reveals it in output | Legacy recovery cannot proceed safely | No | Yes |
| M | Neon/Replit provider variables are not required by active code | No active optional-provider startup defect | Not applicable | No |
| N | Full-row auth lookup and raw-spread DTO are genuine defects against the legacy schema/security contract | Login/current-user cannot operate safely | Partially, after the stop boundary is resolved | Yes first |
| O | Demo bypass and local-storage authorization are mixed into runtime code | Can bypass meaningful auth outside controlled recovery/client security | Isolation is future work | Yes before production |

## Exact stop boundary

A recovery-only local user cannot be created with a secure hash because the
approved database has no password storage. Creating that storage requires a
schema change expressly prohibited in Phase 4A. The minimum non-admin role is
also not authoritative because repository and legacy role vocabularies do not
agree.

Per the approved stop conditions, no authentication implementation, user
creation, session creation, legacy update, schema change, DTO integration, or
recovery-guard expansion was performed.

