# Phase A1.2a — Privileged Session Assurance Foundation

## Scope

A1.2a adds a server-owned assurance context to the existing PostgreSQL-backed
Express Session. It does not implement MFA enrollment, a challenge, a secret,
Admin activation, Platform Owner persistence, or Platform Authority routes.

## Enrollment and session assurance are different

`users.is2FAEnabled` remains an account-level legacy enrollment/capability
field. It does not prove that the current Session completed MFA.

The following remain separate:

- MFA enrollment;
- MFA authentication event;
- MFA assurance for one Session;
- recent step-up assurance for one Session.

No email verification, password authentication, Platform role, request field,
cookie claim, browser storage value, or header is accepted as MFA assurance.

## Assurance model

The Session stores a versioned `privilegedSecurityContext` with:

- primary-authentication timestamp;
- MFA-satisfied timestamp, initially null;
- step-up-satisfied timestamp, initially null.

Its derived levels align with the existing A1.1 extension point:

1. `authenticated`
2. `mfa`
3. `recent_step_up`

Invalid versions, timestamps, chronology, missing MFA predecessors, future
timestamps, and malformed persisted JSON fail closed.

## Session lifecycle

Passport 0.7 regenerates the Session during `req.login` unless
`keepSessionInfo` is explicitly enabled. TUTELA does not enable it. After a
successful password login or verified-registration login, the regenerated
Session receives only `authenticated` assurance. Existing or account-level
`is2FAEnabled` state is not consulted.

Logout destroys the Express Session, so all authentication, MFA, and step-up
state disappears. Creating another Session for the same User creates no
assurance inheritance. A server-side downgrade can clear MFA and step-up while
retaining the Session's primary authenticated state.

## Recent step-up policy

`privileged-session-policy/v1` defines a conservative default freshness window
of five minutes. The value is centralized and can be replaced by a later
versioned policy without scattering time arithmetic through handlers. Time is
provided through a small injectable clock for deterministic boundary tests.

## PostgreSQL persistence

Assurance is ordinary server-managed Session JSON and therefore uses the
existing `public.sessions.sess` column. No schema change is required.

The controlled integration test uses only `TEST_DATABASE_URL`, writes two
namespaced Session IDs for one synthetic identity, proves cross-session
isolation and persistence, destroys the privileged Session, and removes both
exact IDs in `finally`. It creates no User or business record.

## Platform Authority compatibility

The future composition remains:

`Authenticated User → Platform Authority Resolution → Privileged Session Assurance → Resource/Role Policy → Command Authorization`

Assurance does not grant permissions, and permissions do not manufacture
assurance. The model can represent the MFA plus recent-step-up evidence needed
by future Platform Owner-sensitive operations without implementing ownership.

## Existing legacy Admin middleware

`server/adminAuth.ts` currently treats `users.is2FAEnabled` as if it were
current-session MFA proof. That interpretation is incorrect. A1.2a deliberately
does not change it because the legacy Admin routes are production-reachable and
changing enforcement here would be an active access-policy change.

A1.2c must replace that legacy interpretation with the centralized assurance
reader while completing reviewed Admin integration. Until then, the new
assurance contract remains dormant for privileged Admin authorization.

## Implemented in A1.2a

- versioned Session assurance contracts;
- centralized five-minute step-up policy;
- injectable clock;
- authenticated/MFA/step-up readers and server mutation API;
- explicit privileged-assurance downgrade;
- authenticated-only initialization after successful login;
- unit, architecture, and controlled PostgreSQL persistence tests.

## Remaining work

A1.2b must define and implement real MFA enrollment, protected secret storage,
challenge issuance/verification, recovery/reset policy, and trusted calls to
`markMfaSatisfied` and `markStepUpSatisfied`.

A1.2c must integrate the resulting assurance with reviewed Platform Authority
and Admin request boundaries, remove the legacy false-MFA interpretation, and
verify production rollout risk. MFA is not complete at the end of A1.2a.
