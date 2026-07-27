# TUTELA deployment-readiness audit

## Status

**DEPLOYMENT CANDIDATE — source-level hardening completed; final runtime smoke test still required against a staging Neon database.**

The project has been re-audited beyond the initial authentication migration. The source tree is now structured for a clean GitHub repository and a single Render Node web service.

## Corrections made in this audit

- Fixed the global Express error handler so handled request errors no longer crash the Node process after a response is sent.
- Removed `reusePort`, which can cause portability problems on Windows and is unnecessary on Render.
- Replaced the session store connection with the official `pg.Pool` interface expected by `connect-pg-simple`.
- Added startup database connectivity and schema preflight checks.
- Added graceful `SIGTERM`/`SIGINT` handling for Render deployments.
- Added an idempotent local-auth migration runner and Render pre-deploy command.
- Made the auth migration create the sessions table when needed.
- Marked existing passwordless accounts as `legacy` instead of incorrectly treating them as local-password accounts.
- Added an operator script for assigning a secure local password to a legacy user.
- Added explicit anonymous handling in `useAuth` so an expected HTTP 401 does not become an application error.
- Updated login and registration to populate the authenticated-user cache directly.
- Removed a syntactically broken, unused legacy page from the TypeScript source tree and archived it outside the compiler include paths.
- Removed `package-lock.json` from `.gitignore`; the lockfile must be committed for reproducible `npm ci` deployments.
- Removed stale build output, the old local Git metadata, and the temporary authentication backup from the delivery package.
- Added current Render Blueprint configuration, Node version pinning, environment-variable documentation, and a deployment runbook.
- Removed an unused dependency (`zod-validation-error`) that had no imports in the application.

## Deployment configuration

- Node: 22.16.0
- Build: `npm ci --no-audit --no-fund && npm run build`
- Pre-deploy: `npm run db:migrate:auth`
- Start: `npm start`
- Health check: `/api/health`
- Runtime architecture: one Express/Vite web service, same-origin cookies

## Required environment variables

At minimum:

- `NODE_ENV=production`
- `DATABASE_URL`
- `SESSION_SECRET`
- `APP_BASE_URL`
- `DEMO_AUTH_BYPASS=false`

See `.env.example` for optional integrations.

## Database requirements

The deployment database must already contain the existing TUTELA business schema. The included migration only adds local-auth fields and the sessions table. Startup now fails clearly if `users`, `sessions`, or required authentication columns are absent.

Existing accounts without passwords are preserved as `legacy`. Assign a local password with:

```bash
TUTELA_USER_EMAIL=user@example.com \
TUTELA_USER_PASSWORD='a-strong-password' \
DATABASE_URL='postgresql://...' \
npm run user:set-password
```

Do not retain the password in shell history or environment after use.

## Validation performed here

Passed:

- Project structure and runtime import audit.
- No active imports of Replit authentication.
- No hardcoded production database URLs, private keys, or live Stripe keys detected.
- `package.json` and `package-lock.json` dependency sections match.
- `render.yaml` parses as valid YAML and uses current Render Blueprint fields.
- Node syntax checks passed for the migration and password-administration scripts.
- The previously broken legacy TSX file was removed from compiler scope.
- Runtime startup now has deterministic failure messages for missing environment or schema prerequisites.

Not executable in this sandbox:

- Full `npm ci`, because the package gateway repeatedly timed out and the sandbox cache lacked required packages.
- `npm run check` and `npm run build`, because dependencies could not be installed here.
- End-to-end registration, login, session persistence, and protected-route tests, because no staging Neon credentials were supplied.

These are environmental validation gaps, not claims of success. Before production, run the commands in `FINAL_VALIDATION.md` against a staging Neon branch. Do not deploy to production until every command passes.

## Remaining operational items before production

- Create a staging Neon branch/database based on the current TUTELA schema.
- Run the final validation script locally or in CI.
- Configure optional integrations only when their credentials are available.
- Assign passwords to any existing legacy users who must retain access.
- Confirm the intended first administrator and 2FA process; the existing admin authorization model was preserved rather than redesigned.
