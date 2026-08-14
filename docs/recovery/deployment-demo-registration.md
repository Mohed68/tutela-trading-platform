# Deployment, Demo, and Self-Service Registration

## Render production baseline for registration migration

Before migration `0011`, the deployed Render database was inspected in a
read-only transaction. The accepted production baseline records exact hashes
for the application schema and the four complete protected legacy user rows.
The verification hardening fingerprint remains identical to the approved
recovery baseline.

Safety assertions established before baselining:

- all expected business-table row counts remain unchanged;
- the migration journal exists and is empty;
- `email_verification_tokens` is absent;
- all four legacy users remain unable to authenticate locally because they
  have no password hash, no enabled login, no active credential status, and no
  recovery provenance;
- all four legacy users have no prior email-verification timestamp;
- no user, offer, session, or other business record was written during the
  inspection.

The baseline operation records migration provenance only. It does not claim
that repository SQL created pre-existing objects and does not modify protected
or business data. Migration `0011` remains the only SQL execution authorized
after the baseline is recorded.

### Production execution result

The guarded Render deployment completed successfully on 2026-08-10:

- the read-only preflight matched the documented schema, protected-user, and
  hardening fingerprints;
- 11 provenance records were added to the previously empty migration journal;
- all pre-existing records were marked as observed or verified without
  claiming repository SQL execution;
- migration `0011_self_service_registration` was applied and verified;
- the application returned HTTP 200 from `/api/health` after a clean restart;
- the permanent Render start command was restored to `npm run start`.

Production smoke tests confirmed that `/demo` opens its browser-local
dashboard without a 404, `/register` renders the registration form, malformed
registration is rejected without creating an account, and the strict public
marketplace continues to publish zero legacy offers.

## Production boundaries

- Production startup never clears or seeds business data.
- Destructive demo-data administration routes are not registered in production.
- `DEMO_AUTH_BYPASS` remains disabled in production.
- The interactive demo uses browser-local fixtures and does not write to the
  production database.
- Marketplace publication continues to require verified offer evidence and
  verified seller-organization evidence.

## Interactive demo

`/demo` is public. Starting the demo creates only browser-local state and opens
the demo dashboard. Demo authentication, dashboard totals, and marketplace
offers are presentation fixtures. Protected server APIs remain protected.

## Registration lifecycle

1. `POST /api/auth/register` validates and normalizes the account input.
2. The password is stored as a versioned salted scrypt hash.
3. The account is created with login disabled and email unverified.
4. A random verification token is emailed; only its SHA-256 digest is stored.
5. `POST /api/auth/verify-email` consumes the token once, enables login, and
   creates the authenticated session.
6. New accounts receive the `trader` role and no administrative or verification
   authority.
7. Offer and organization verification rules remain independent and unchanged.

Registration requires `APP_BASE_URL`, `RESEND_API_KEY`, and `EMAIL_FROM`.
Production registration fails closed when delivery is unavailable. Secret
values must be configured only in the deployment environment.

### Temporary direct-registration fallback

When `TUTELA_REGISTRATION_ACTIVATION=temporary_direct` is explicitly set in
the deployment environment, registration creates a locally authenticatable
trader account without sending a verification email. This is an operational
fallback while the Resend sending domain is unavailable, not proof of email
ownership:

- `email_verified_at` remains null;
- an explicit temporary provenance marker records the authority source;
- the account's public DTO reports email verification as `unknown`;
- passwords remain salted, versioned scrypt hashes;
- the default mode remains email verification; removing the environment value
  stops new direct registrations without rewriting existing data.

Do not represent the fallback as permanent email verification. The pending
Resend DNS follow-up remains documented in
`docs/recovery/deployment/resend-dns-follow-up.md`.

## Database migration

`migrations/0011_self_service_registration.sql` is additive. It creates the
email-verification token table and does not rewrite an existing user. Apply it
only after the approved legacy and verification migrations have been verified
on the intended disposable or production database.

For a controlled existing-database upgrade, run
`npm run db:migrate:registration`. The runner requires the verified 0010
predecessor journal entry, records 0011 in the migration journal, verifies the
new schema, and confirms that user, offer, and contract row counts did not
change.
