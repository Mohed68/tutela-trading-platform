# Deployment, Demo, and Self-Service Registration

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
