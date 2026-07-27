# TUTELA Phase 1 — Local Authentication Migration Report

## Outcome

The project source was migrated away from Replit OIDC to local email/password authentication while preserving the existing `req.user.claims` contract used across the API.

**Final readiness status: NOT READY — BLOCKERS REMAIN**

The implementation is complete at source level, but it still requires dependency installation, a safe development/staging Neon database, migration execution, and end-to-end testing before GitHub preparation or deployment.

## Main changes

- Added Passport Local authentication.
- Added password hashing and verification using Node.js `crypto.scrypt` and `timingSafeEqual`.
- Added PostgreSQL-backed sessions through `connect-pg-simple` using the existing `sessions` table.
- Added registration, login, logout, current-user, and health endpoints.
- Added `/login` and `/register` frontend pages.
- Removed the automatic development authentication bypass; an explicit `DEMO_AUTH_BYPASS=true` remains available outside production.
- Preserved `req.user.claims.sub`, email, first/last name, and profile image compatibility.
- Added a safe SQL migration for local-auth user columns.
- Added `.env.example` and Render deployment preparation notes.
- Removed active imports and startup requirements for Replit OIDC.
- Renamed the old implementation to `server/replitAuth.legacy.ts` for reference only.

## New files

- `server/auth.ts`
- `server/auth-types.d.ts`
- `server/password.ts`
- `server/replitAuth.legacy.ts`
- `client/src/pages/login.tsx`
- `client/src/pages/register.tsx`
- `.env.example`
- `migrations/0001_local_auth.sql`
- `docs/RENDER_DEPLOYMENT.md`
- `AUTH_MIGRATION_REPORT.md`

## Important modified files

- `shared/schema.ts`
- `server/storage.ts`
- `server/routes.ts`
- `client/src/hooks/useAuth.ts`
- `client/src/App.tsx`
- `vite.config.ts`
- `package.json`
- `package-lock.json`
- `.gitignore`

## Database changes

The migration adds these nullable/defaulted columns to `users`:

- `password_hash`
- `auth_provider`
- `email_verified_at`
- `last_login_at`

The existing `sessions(sid, sess, expire)` table is retained and used by `connect-pg-simple`.

Do not apply the migration to production first. Apply it to a backed-up development or staging database and verify existing users and sessions.

## Required environment variables

At minimum:

- `DATABASE_URL`
- `SESSION_SECRET`
- `NODE_ENV`
- `PORT`
- `APP_BASE_URL`

See `.env.example` for optional integrations.

## Commands after extracting on Windows PowerShell

```powershell
npm ci
npm run check
npm run build
npm run dev
```

For production-like local execution:

```powershell
$env:NODE_ENV="production"
npm start
```

## Render preparation

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health endpoint: `/api/health`
- Set `NODE_ENV=production`
- Use the pooled Neon `DATABASE_URL`
- Generate a strong `SESSION_SECRET`

## Verification performed here

- Confirmed the application no longer imports `server/replitAuth.ts`.
- Confirmed no active server authentication code requires `REPLIT_DOMAINS`, `REPL_ID`, `ISSUER_URL`, or `/api/callback`.
- Confirmed the client no longer treats every development session as authenticated.
- Confirmed `client/.env` contains only a `VITE_SENTRY_DSN` variable name; its value was not copied or exposed.
- Performed a syntax-oriented TypeScript pass, but full type-checking was unavailable because dependencies could not be installed in the execution environment.

## Tests not completed

The environment timed out while installing the full dependency tree, so these were not honestly claimable:

- `npm run check`
- `npm run build`
- Server startup
- Register/login/logout integration tests
- Session persistence after restart
- Protected route and admin authorization tests
- Database migration execution

## Existing project concerns observed

The original source appears to contain unrelated TypeScript/storage inconsistencies, including duplicated methods and missing interface implementations in `server/storage.ts`. These were not broadly refactored because Phase 1 was intentionally limited to authentication and portability. They may surface during `npm run check` and should be separated from migration-introduced issues.

## Next gate

Before GitHub preparation:

1. Extract the project into a fresh folder.
2. Create a local `.env` from `.env.example`.
3. Provide a safe Neon development/staging database.
4. Apply `migrations/0001_local_auth.sql` after backup.
5. Run `npm ci`, `npm run check`, and `npm run build`.
6. Test registration, login, logout, session persistence, protected routes, and admin authorization.
7. Resolve any pre-existing TypeScript errors separately.
