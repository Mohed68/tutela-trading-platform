# Phase 3A redacted environment contract

This contract records variable names and behavior only. It contains no values.

## Core startup

| Variable | Requirement | Behavior |
|---|---|---|
| `DATABASE_URL` | Required | Startup fails if absent. Used by Drizzle, health checks, and the PostgreSQL session store. Must be a raw PostgreSQL URL supplied by the environment. |
| `SESSION_SECRET` | Required | Startup fails if absent. Used only to sign the HTTP session cookie. |
| `NODE_ENV` | Required operational setting | Controls production cookies, proxy trust, static/Vite mode, and security headers. Phase 3A never starts with `production`. |
| `PORT` | Optional | Normal server default is 5000. The recovery launcher uses 5055 unless overridden safely. |
| `SESSION_DB_POOL_MAX` | Optional | Session database pool maximum; defaults to 5. |

## Controlled recovery

| Variable | Requirement | Behavior |
|---|---|---|
| `TUTELA_RECOVERY_MODE` | Recovery only | Explicitly enables read-only route gating and startup-side-effect suppression. Defaults off. Rejected in production or Render. |
| `TUTELA_RECOVERY_PORT` | Optional recovery setting | Overrides recovery port 5055 without changing normal server defaults. |
| `RENDER` | Platform-provided | Any non-empty value prevents controlled recovery startup. |
| `DEMO_AUTH_BYPASS` | Optional development feature | Must remain false in recovery. When true outside production, existing code can create a demo user on an authenticated route. |
| `DEMO_MODE` | Optional tenant/demo feature | Forced false by the recovery launcher. |
| `AUTO_VERIFY_DEMO` | Optional standalone-script feature | Forced false by the recovery launcher; not used by core startup. |

## Authentication

| Variable | Requirement | Behavior |
|---|---|---|
| `REPL_ID` | Legacy/inactive | Used only by the archived Replit authentication module and optional Replit Vite plugins. |
| `REPLIT_DOMAINS` | Legacy/inactive | Used only by the archived Replit authentication module. |
| `ISSUER_URL` | Legacy/inactive | Optional issuer for the archived Replit authentication module. |
| `TUTELA_USER_EMAIL` | Operator script only | Required only by the explicit local-password command. |
| `TUTELA_USER_PASSWORD` | Operator script only | Required only by the explicit local-password command. |

## Optional feature integrations

| Variable(s) | Feature behavior when absent |
|---|---|
| `OPENAI_API_KEY` | Core startup succeeds. OpenAI-dependent features fail or use their existing feature-level fallback. OpenAI is disabled in recovery mode even when configured. |
| `STRIPE_SECRET_KEY` | Core startup succeeds. Checkout reports that Stripe is not configured. |
| `PRICE_MA_ANNUAL`, `PRICE_MA_MONTHLY`, `PRICE_TD_ANNUAL`, `PRICE_TD_MONTHLY`, `PRICE_CS_ANNUAL`, `PRICE_CS_MONTHLY` | Required only for the corresponding Stripe plan/term. |
| `APP_BASE_URL` | Optional Stripe redirect base; request origin/host is the current fallback. |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Required only for public object reads. The feature fails clearly when absent. |
| `PRIVATE_OBJECT_DIR` | Required only for private uploads/downloads. The feature fails clearly when absent. |
| `SENTRY_BACKEND_DSN`, `SENTRY_DSN` | Server monitoring is disabled when absent and forcibly disabled in recovery. |
| `VITE_SENTRY_DSN` | Browser monitoring is disabled when absent and cleared in the recovery child process. |
| `DEFAULT_TENANT_ID` | Optional tenant fallback. No core-startup dependency. |
| `DEMO_TENANT_ID` | Optional demo tenant override. No core-startup dependency. |

No active server email configuration variables were found. The current
blockchain service takes no environment variables and remains a simulation.

## Phase 3A observed presence

Presence was checked without revealing values:

- present: `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV`, `PORT`,
  `REPLIT_DOMAINS`, `OPENAI_API_KEY`;
- absent: Render marker, Stripe configuration, storage paths, Sentry
  configuration, pricing identifiers, and tenant overrides.

The local `.env` has `NODE_ENV=production`; the recovery launcher overrides it
only inside its child process before importing the application. Production
defaults and `.env` remain unchanged.
