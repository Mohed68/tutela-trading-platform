# TUTELA deployment on Render

TUTELA is deployed as one Render **Node web service**. Express serves both the API and the built Vite frontend, so authentication cookies remain same-origin.

## Required service settings

- Runtime: Node
- Node version: `22.16.0`
- Build command: `npm ci --no-audit --no-fund && npm run build`
- Pre-deploy command: `npm run db:migrate:auth`
- Start command: `npm start`
- Health check path: `/api/health`

The included `render.yaml` contains the same configuration. Render supports `preDeployCommand` for migrations that must run before each deploy.

## Required environment variables

- `NODE_ENV=production`
- `DATABASE_URL`: pooled Neon PostgreSQL URL
- `SESSION_SECRET`: generated random secret; never reuse a development value
- `APP_BASE_URL`: final HTTPS URL, such as `https://your-service.onrender.com`
- `DEMO_AUTH_BYPASS=false`

Add Stripe, OpenAI, Google Cloud, and Sentry variables only when those features are enabled. Every `VITE_` variable is public browser configuration and must never contain a server secret.

## Database prerequisite

The target Neon database must already contain the existing TUTELA application schema, including the `users` table and business tables. The pre-deploy command applies only the idempotent local-auth migration in `migrations/0001_local_auth.sql` and creates the `sessions` table when needed.

Before the first production deployment:

1. Back up the Neon database.
2. Test the migration against a staging branch/database.
3. Run `npm run db:migrate:auth` with the staging `DATABASE_URL`.
4. Start the application and confirm the startup schema check passes.
5. Test registration, login, an authenticated route, logout, and admin access.

The application intentionally refuses to start if the required database tables or local-auth columns are missing. This prevents a partially migrated deployment from appearing healthy.

## Rollback

Application rollback is performed from Render's deploy history. The local-auth migration only adds columns/table/index and does not delete legacy data. Do not remove these columns during an application rollback.
